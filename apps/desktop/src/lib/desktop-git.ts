import type {
  HermesGitBaseBranch,
  HermesGitBranch,
  HermesGitHubProfile,
  HermesGitLabProfile,
  HermesGitWorktree,
  HermesRepoPullRequests,
  HermesRepoStatus,
  HermesReviewList,
  HermesReviewShipInfo
} from '@/global'

import { desktopFsProfile, isDesktopFsRemoteMode } from './desktop-fs'

// Remote-aware git facade. Locally the desktop runs git through Electron
// (window.hermesDesktop.git); on a remote gateway that's the wrong filesystem,
// so we mirror the same surface over the dashboard REST API (/api/git/*) — the
// coding rail, worktree lanes, review pane, and branch ops then act on the
// BACKEND repo where sessions actually run. Mirrors desktop-fs.ts.

type GitBridge = NonNullable<NonNullable<Window['hermesDesktop']>['git']>

function desktopApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const desktop = window.hermesDesktop

  if (!desktop) {
    throw new Error('Hermes Desktop bridge is unavailable')
  }

  return desktop.api<T>(
    body ? { body, method: 'POST', path, profile: desktopFsProfile() } : { path, profile: desktopFsProfile() }
  )
}

function gitGet<T>(route: string, params: Record<string, boolean | null | string | undefined>): Promise<T> {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      query.set(key, String(value))
    }
  }

  return desktopApi<T>(`/api/git/${route}?${query.toString()}`)
}

function gitPost<T>(route: string, body: Record<string, unknown>): Promise<T> {
  return desktopApi<T>(`/api/git/${route}`, body)
}

const remoteGit: GitBridge = {
  worktreeList: async repoPath =>
    (await gitGet<{ worktrees: HermesGitWorktree[] }>('worktrees', { path: repoPath })).worktrees,

  worktreeAdd: (repoPath, options) => gitPost('worktree/add', { path: repoPath, ...options }),

  worktreeRemove: (repoPath, worktreePath, options) =>
    gitPost('worktree/remove', { force: options?.force ?? false, path: repoPath, worktreePath }),

  branchSwitch: (repoPath, branch) => gitPost('branch/switch', { branch, path: repoPath }),

  branchList: async repoPath =>
    (await gitGet<{ branches: HermesGitBranch[] }>('branches', { path: repoPath })).branches,

  baseBranchList: async repoPath =>
    (await gitGet<{ branches: HermesGitBaseBranch[] }>('base-branches', { path: repoPath })).branches,

  repoStatus: repoPath => gitGet<HermesRepoStatus | null>('status', { path: repoPath }),

  fileDiff: async (repoPath, filePath) =>
    (await gitGet<{ diff: string }>('file-diff', { file: filePath, path: repoPath })).diff,

  review: {
    list: (repoPath, scope, baseRef) =>
      gitGet<HermesReviewList>('review/list', { base: baseRef, path: repoPath, scope }),

    diff: async (repoPath, filePath, scope, baseRef, staged) =>
      (await gitGet<{ diff: string }>('review/diff', { base: baseRef, file: filePath, path: repoPath, scope, staged }))
        .diff,

    stage: (repoPath, filePath) => gitPost('review/stage', { file: filePath ?? null, path: repoPath }),

    unstage: (repoPath, filePath) => gitPost('review/unstage', { file: filePath ?? null, path: repoPath }),

    revert: (repoPath, filePath) => gitPost('review/revert', { file: filePath ?? null, path: repoPath }),

    revParse: async (repoPath, ref) =>
      (await gitGet<{ sha: null | string }>('review/rev-parse', { path: repoPath, ref })).sha,

    commit: (repoPath, message, push) => gitPost('review/commit', { message, path: repoPath, push }),

    commitContext: repoPath => gitGet('review/commit-context', { path: repoPath }),

    push: repoPath => gitPost('review/push', { path: repoPath }),

    shipInfo: repoPath => gitGet<HermesReviewShipInfo>('review/ship-info', { path: repoPath }),

    prList: (repoPath, branches, numbers) =>
      gitPost<HermesRepoPullRequests>('review/pr-list', { branches, numbers: numbers ?? [], path: repoPath }),

    // Remote gateways have no PR-comment route yet; resolve to null so the
    // paste degrades to a plain URL instead of throwing mid-paste.
    fetchPrComment: async () => null,

    createPr: repoPath => gitPost('review/create-pr', { path: repoPath })
  },

  // Repo discovery is a local-disk crawl; on a remote gateway the backend
  // already merges session-derived repos, so this is a no-op.
  scanRepos: async () => [],

  // Fork sync is a local-machine git fact (Electron's filesystem); the
  // settings repo list is hidden in remote mode, so these mirror the type
  // surface and degrade: no origin/main ref to count, no local pull or push.
  syncInfo: async () => null,
  pull: async () => {
    throw new Error('Pulling a repository is not available on a remote gateway')
  },
  push: async () => {
    throw new Error('Pushing a repository is not available on a remote gateway')
  },
  syncFork: async () => {
    throw new Error('Syncing a fork is not available on a remote gateway')
  },

  // Merge-conflict resolution is the same local-machine git fact as pull:
  // the conflicted files live on Electron's filesystem, so the resolver
  // degrades to "no conflicts to list" (syncInfo reports conflicted:false
  // anyway) and the mutations throw like pull.
  conflictFiles: async () => ({ files: [] }),
  resolveConflict: async () => {
    throw new Error('Resolving conflicts is not available on a remote gateway')
  },
  continueMerge: async () => {
    throw new Error('Continuing a merge is not available on a remote gateway')
  },
  abortMerge: async () => {
    throw new Error('Aborting a merge is not available on a remote gateway')
  },

   // The authenticated gh identity is a machine fact of the gateway host; there
  // is no remote route for it yet, so the settings GitHub view degrades to
  // nothing (same as an absent gh CLI locally).
  ghProfile: async (): Promise<HermesGitHubProfile> => ({ ok: false, login: '', name: null, avatarUrl: null }),
  // Git config is a local-machine fact (Electron's filesystem); remote
  // gateways have no route for it, so the settings view degrades to "no config".
  configGet: async () => ({ ok: true, global: null, local: null }),
  configSet: async () => ({ ok: false, error: 'Git config is not available on a remote gateway' }),

  // gh login is a local-machine flow (spawns the gh CLI process); remote
  // gateways have no route for it, so the settings view degrades to "cannot
  // start here" and never receives a completion event.
  ghLoginStart: async () => null,
  ghLoginCancel: async () => false,
  onGhLoginEvent: () => () => {},
  ghLogout: async () => ({ ok: false }),

  // glab identity/login/config mirror the gh surface above — all local-machine
  // facts with no remote route, so the GitLab settings view degrades the same
  // way as GitHub's on a remote gateway.
  glProfile: async (): Promise<HermesGitLabProfile> => ({ ok: false, login: '', name: null, avatarUrl: null }),
  glLoginWithToken: async () => ({ ok: false, error: 'GitLab login is not available on a remote gateway' }),
  glLogout: async () => ({ ok: false }),
  glConfigGet: async () => ({ ok: true, global: null, local: null }),
  glConfigSet: async () => ({ ok: false, error: 'Git config is not available on a remote gateway' }),

  // The git working directory is a local-machine fact of this computer
  // (Electron's userData); on a remote gateway the sessions run on the host,
  // so there is no local folder to pin. The settings view degrades to "no
  // working directory" and never lets a write pretend it landed.
  workdir: {
    get: async () => ({ defaultLabel: '', dir: null, resolvedCwd: '' }),
    pick: async () => ({ canceled: true, dir: null }),
    set: async () => {
      throw new Error('Git working directory is not available on a remote gateway')
    },
    clear: async () => ({ dir: null })
  },
  gitInit: async () => {
    throw new Error('Creating a repository is not available on a remote gateway')
  }
}

export function desktopGit(): GitBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return isDesktopFsRemoteMode() ? remoteGit : window.hermesDesktop?.git
}
