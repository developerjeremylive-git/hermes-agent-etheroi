// Git ops backing the coding rail + Codex-style review pane. Built on `simple-git`
// (a maintained wrapper around the system git binary — same git the rest of the
// app shells to, no native build) so we read structured status()/diffSummary()
// results instead of hand-parsing porcelain. Reads degrade to null/empty on a
// non-repo / remote backend; mutations reject so the renderer can toast.

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import simpleGit from 'simple-git'

import { resolveRequestedPathForIpc } from './hardening'

const COMMIT_CONTEXT_DIFF_MAX_CHARS = 120_000
const COMMIT_CONTEXT_UNTRACKED_MAX = 80
const REVIEW_FILE_CAP = 2_000
const UNTRACKED_LINE_COUNT_CONCURRENCY = 16
const UNTRACKED_LINE_COUNT_MAX_BYTES = 1024 * 1024

// GUI-launched Electron apps on macOS inherit only a minimal PATH (no
// /opt/homebrew/bin or /usr/local/bin), so `gh` — and the `git` gh shells out
// to — aren't found. Augment PATH with the resolved gh dir + the common
// package-manager bins so gh runs the same way it does in a terminal.
function ghEnv(ghBin) {
  const extra = [ghBin ? path.dirname(ghBin) : '', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'].filter(
    dir => dir && dir !== '.'
  )

  return { ...process.env, PATH: [...extra, process.env.PATH].filter(Boolean).join(path.delimiter) }
}

// Run the `gh` CLI in a repo. Resolves { ok, stdout } so callers branch on
// availability/auth without a throw. gh missing/unauthed → ok:false.
function runGh(args, cwd, ghBin): Promise<{ ok: boolean; stdout: string }> {
  return new Promise(resolve => {
    execFile(
      ghBin || 'gh',
      args,
      { cwd, env: ghEnv(ghBin), windowsHide: true, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => resolve({ ok: !err, stdout: String(stdout || '') })
    )
  })
}

// simple-git's own restricted-char rule for custom binary paths, mirrored
// from its custom-binary.plugin so the escape-hatch gate can never drift
// from what the library actually rejects. `gitBin` is resolved inside the
// Electron main process from known install locations or PATH — never
// renderer/user input. simple-git rejects paths with spaces (the default
// Windows install is `C:\Program Files\Git\cmd\git.exe`) and other shell
// characters (parens, quotes, …), which silently broke the Review pane.
// For such paths, opt into simple-git's trusted-binary escape hatch instead
// of falling back to PATH (often absent in GUI-launched apps, and PATH
// lookup could resolve a repo-local git.exe).
const SIMPLE_GIT_SAFE_BINARY_RE = /^([a-z]:)?([a-z0-9/.\\_~-]+)$/i

function gitFor(cwd, gitBin) {
  if (!gitBin || SIMPLE_GIT_SAFE_BINARY_RE.test(gitBin)) {
    return simpleGit({
      baseDir: cwd,
      binary: gitBin || 'git',
      maxConcurrentProcesses: 4,
      trimmed: false
    })
  }

  // simple-git prints a console.warn whenever the trusted-binary escape hatch
  // is used with a restricted path. The binary is vetted (resolved in-main
  // from known locations, never renderer input), so that notice is noise:
  // drop only that exact line while constructing, then restore console.warn.
  // Construction is synchronous in the single-threaded main process, so the
  // shim cannot swallow warnings from other work.
  const originalWarn = console.warn

  console.warn = (...args) => {
    if (!String(args[0]).includes('Invalid value supplied for custom binary')) {
      originalWarn(...args)
    }
  }

  try {
    return simpleGit({
      baseDir: cwd,
      binary: gitBin,
      maxConcurrentProcesses: 4,
      trimmed: false,
      unsafe: { allowUnsafeCustomBinary: true }
    })
  } finally {
    console.warn = originalWarn
  }
}

// simple-git reports renames as `old => new` (and `dir/{old => new}/f`); resolve
// to the NEW path so the row addresses the real file for diff/stage.
function resolveRenamePath(raw) {
  const path = String(raw || '').trim()

  if (!path.includes(' => ')) {
    return path
  }

  const brace = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/)

  if (brace) {
    const [, prefix, , to, suffix] = brace

    return `${prefix}${to}${suffix}`.replace(/\/{2,}/g, '/')
  }

  return path.split(' => ').pop().trim()
}

// DiffResult.files → Map<path, {added, removed}> (binary files carry no line
// delta).
function countsByPath(summary) {
  const map = new Map()

  for (const file of summary.files) {
    map.set(resolveRenamePath(file.file), {
      added: file.binary ? 0 : file.insertions,
      removed: file.binary ? 0 : file.deletions
    })
  }

  return map
}

// Untracked files don't appear in diffSummary(); count insertions from disk so
// the review tree can show +N for new files (matches an all-add diff view).
// Insertions = line count: newline bytes, plus one for a final unterminated
// line. Binary (NUL byte) → 0, mirroring git numstat's "-".
async function untrackedInsertions(cwd, relPath) {
  try {
    const fullPath = path.join(cwd, relPath)
    const stat = await fs.stat(fullPath)

    if (!stat.isFile() || stat.size > UNTRACKED_LINE_COUNT_MAX_BYTES) {
      return 0
    }

    const buf = await fs.readFile(fullPath)

    if (buf.includes(0)) {
      return 0
    }

    let lines = 0

    for (const byte of buf) {
      if (byte === 10) {
        lines++
      }
    }

    return buf.length > 0 && buf[buf.length - 1] !== 10 ? lines + 1 : lines
  } catch {
    return 0
  }
}

function capText(text, maxChars, label = 'truncated') {
  const value = String(text || '')

  if (value.length <= maxChars) {
    return value
  }

  return `${value.slice(0, maxChars)}\n# ${label}: ${value.length - maxChars} chars omitted\n`
}

async function fillUntrackedCounts(cwd, files) {
  const pending = files.filter(file => file.status === '?' && file.added === 0 && file.removed === 0)

  for (let i = 0; i < pending.length; i += UNTRACKED_LINE_COUNT_CONCURRENCY) {
    await Promise.all(
      pending.slice(i, i + UNTRACKED_LINE_COUNT_CONCURRENCY).map(async file => {
        file.added = await untrackedInsertions(cwd, file.path)
      })
    )
  }
}

// Resolve the base ref for "all branch changes": merge-base with the remote
// default branch (origin/HEAD), falling back to common trunk names.
async function branchBase(git) {
  const candidates = []

  try {
    const head = (await git.revparse(['--abbrev-ref', 'origin/HEAD'])).trim()

    if (head) {
      candidates.push(head)
    }
  } catch {
    // No origin/HEAD configured.
  }

  candidates.push('origin/main', 'origin/master', 'main', 'master')

  for (const ref of candidates) {
    try {
      const base = (await git.raw(['merge-base', 'HEAD', ref])).trim()

      if (base) {
        return base
      }
    } catch {
      // Ref doesn't exist; try the next candidate.
    }
  }

  return null
}

// Resolve the repo's default branch NAME ("main" / "master" / …), preferring
// the remote's HEAD, then common local trunk names. Null when none is found
// (e.g. a fresh repo with only a feature branch). Used to offer "branch off the
// trunk" regardless of which branch you're currently on.
async function defaultBranchName(git) {
  try {
    const head = (await git.revparse(['--abbrev-ref', 'origin/HEAD'])).trim()

    // "origin/main" → "main"; skip the bare "origin/HEAD" placeholder.
    if (head && head !== 'origin/HEAD') {
      return head.replace(/^origin\//, '')
    }
  } catch {
    // No origin/HEAD configured.
  }

  // Prefer a local trunk, then a remote-only one (returns the clean name either
  // way) so "branch off main" works even before main is checked out locally.
  for (const ref of [
    'refs/heads/main',
    'refs/heads/master',
    'refs/remotes/origin/main',
    'refs/remotes/origin/master'
  ]) {
    try {
      await git.raw(['rev-parse', '--verify', '--quiet', ref])

      return ref.replace(/^refs\/(?:heads|remotes\/origin)\//, '')
    } catch {
      // Ref doesn't exist; try the next candidate.
    }
  }

  return null
}

// A status file's single-letter classification, preferring the staged (index)
// code over the worktree code; untracked wins (simple-git marks both '?').
function statusLetter(file) {
  if (file.index === '?' || file.working_dir === '?') {
    return '?'
  }

  const code = file.index && file.index !== ' ' ? file.index : file.working_dir

  return (code || 'M').toUpperCase()
}

const isStaged = file => Boolean(file.index && file.index !== ' ' && file.index !== '?')

async function reviewList(repoPath, scope, baseRef, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review list' })
  } catch {
    return { files: [], base: null }
  }

  const git = gitFor(cwd, gitBin)

  try {
    if (scope === 'branch' || scope === 'lastTurn') {
      const base = scope === 'branch' ? await branchBase(git) : baseRef

      if (!base) {
        return { files: [], base: null }
      }

      const range = scope === 'branch' ? `${base}...HEAD` : base
      const summary = await git.diffSummary([range])

      const files = summary.files.slice(0, REVIEW_FILE_CAP).map(file => ({
        path: resolveRenamePath(file.file),
        added: 'insertions' in file ? file.insertions : 0,
        removed: 'deletions' in file ? file.deletions : 0,
        status: 'M',
        staged: false
      }))

      // "Last turn" also surfaces files created since the baseline (untracked).
      if (scope === 'lastTurn' && files.length < REVIEW_FILE_CAP) {
        // Keep untracked directories compact. A recursive status can produce
        // hundreds of thousands of rows for browser profiles, generated
        // artifacts, or dependency trees before the response reaches the
        // renderer.
        const status = await git.status(['--untracked-files=normal'])
        const knownPaths = new Set(files.map(file => file.path))

        for (const path of status.not_added) {
          if (files.length >= REVIEW_FILE_CAP) {
            break
          }

          if (!knownPaths.has(path)) {
            files.push({ path, added: 0, removed: 0, status: '?', staged: false })
            knownPaths.add(path)
          }
        }
      }

      files.sort((a, b) => a.path.localeCompare(b.path))
      await fillUntrackedCounts(cwd, files)

      return { files, base }
    }

    // Default: uncommitted (staged + unstaged + untracked), one row per path.
    const [status, staged, unstaged] = await Promise.all([
      // `normal` reports an untracked directory as one row instead of walking
      // every descendant. The result is also capped before per-file stat/read
      // work and before crossing the Electron IPC boundary.
      git.status(['--untracked-files=normal']),
      git.diffSummary(['--cached']),
      git.diffSummary([])
    ])

    const stagedCounts = countsByPath(staged)
    const unstagedCounts = countsByPath(unstaged)

    const files = status.files.slice(0, REVIEW_FILE_CAP).map(file => {
      const filePath = resolveRenamePath(file.path)
      const sc = stagedCounts.get(filePath) || { added: 0, removed: 0 }
      const uc = unstagedCounts.get(filePath) || { added: 0, removed: 0 }

      return {
        path: filePath,
        added: sc.added + uc.added,
        removed: sc.removed + uc.removed,
        status: statusLetter(file),
        staged: isStaged(file)
      }
    })

    files.sort((a, b) => a.path.localeCompare(b.path))
    await fillUntrackedCounts(cwd, files)

    return { files, base: null }
  } catch {
    return { files: [], base: null }
  }
}

async function reviewDiff(repoPath, filePath, scope, baseRef, staged, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review diff' })
  } catch {
    return ''
  }

  const git = gitFor(cwd, gitBin)
  const safe = args => git.diff(args).catch(() => '')

  if (scope === 'branch') {
    const base = await branchBase(git)

    return base ? safe([`${base}...HEAD`, '--', filePath]) : ''
  }

  if (scope === 'lastTurn') {
    return baseRef ? safe([baseRef, '--', filePath]) : ''
  }

  if (staged) {
    return safe(['--cached', '--', filePath])
  }

  const worktree = await safe(['--', filePath])

  if (worktree.trim()) {
    return worktree
  }

  // Untracked file: no worktree diff exists, so synthesize an all-add diff via
  // --no-index (exits non-zero by design when files differ, so go around
  // simple-git's reject-on-nonzero with a raw execFile).
  return new Promise(resolve => {
    execFile(
      gitBin || 'git',
      ['diff', '--no-index', '--', '/dev/null', filePath],
      { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 },
      (_err, stdout) => resolve(String(stdout || ''))
    )
  })
}

// Working-tree-vs-HEAD diff for ONE file — the "what changed since the last
// commit" view used by the file preview. Unlike reviewDiff this never synthesizes
// a full-add for a clean tracked file (so a pristine file shows no diff); it only
// all-adds a genuinely untracked file.
async function fileDiffVsHead(repoPath, filePath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'File diff' })
  } catch {
    return ''
  }

  const git = gitFor(cwd, gitBin)
  const head = await git.diff(['HEAD', '--', filePath]).catch(() => '')

  if (head.trim()) {
    return head
  }

  // No tracked changes vs HEAD. Only synthesize an all-add diff for a file git
  // doesn't know yet; a clean tracked file must return empty.
  const status = await git.raw(['status', '--porcelain', '--', filePath]).catch(() => '')

  if (!status.trim().startsWith('??')) {
    return ''
  }

  return new Promise(resolve => {
    execFile(
      gitBin || 'git',
      ['diff', '--no-index', '--', '/dev/null', filePath],
      { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 },
      (_err, stdout) => resolve(String(stdout || ''))
    )
  })
}

async function reviewStage(repoPath, filePath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review stage' })

  await gitFor(cwd, gitBin).raw(filePath ? ['add', '--', filePath] : ['add', '-A'])

  return { ok: true }
}

async function reviewUnstage(repoPath, filePath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review unstage' })

  await gitFor(cwd, gitBin).raw(filePath ? ['reset', '-q', 'HEAD', '--', filePath] : ['reset', '-q', 'HEAD'])

  return { ok: true }
}

// Discard changes back to the committed state. Destructive — the renderer
// confirms first. Restores tracked files and removes untracked ones.
async function reviewRevert(repoPath, filePath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review revert' })
  const git = gitFor(cwd, gitBin)

  if (filePath) {
    await git.raw(['checkout', 'HEAD', '--', filePath]).catch(() => undefined)
    await git.raw(['clean', '-fd', '--', filePath]).catch(() => undefined)
  } else {
    await git.raw(['checkout', 'HEAD', '--', '.']).catch(() => undefined)
    await git.raw(['clean', '-fd']).catch(() => undefined)
  }

  return { ok: true }
}

// Resolve a ref to a commit sha (captures the turn baseline for "Last turn").
async function reviewRevParse(repoPath, ref, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review rev-parse' })
  } catch {
    return null
  }

  try {
    return (await gitFor(cwd, gitBin).revparse([ref || 'HEAD'])).trim() || null
  } catch {
    return null
  }
}

// Commit the working tree. Mirrors VS Code: if nothing is staged, stage
// everything first ("commit all"), then commit. Optionally push afterward,
// setting upstream on the first push.
async function reviewCommit(repoPath, message, push, gitBin, ghBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review commit' })
  const git = gitFor(cwd, gitBin)
  const status = await git.status()

  if (status.staged.length === 0) {
    await git.raw(['add', '-A'])
  }

  const identity = ghBin ? await ghIdentity(ghBin) : null

  if (identity) {
    await git.raw([
      '-c',
      `user.name=${identity.name}`,
      '-c',
      `user.email=${identity.email}`,
      'commit',
      '-m',
      message
    ])
  } else {
    await git.commit(message)
  }

  if (push) {
    const fresh = await git.status()

    if (fresh.tracking) {
      await git.push()
    } else if (fresh.current) {
      await git.raw(['push', '-u', 'origin', fresh.current])
    }
  }

  return { ok: true }
}

// Gather the context the model needs to draft a commit message: the diff of
// what *will* be committed (staged when anything is staged, else everything
// vs HEAD — mirroring reviewCommit's "stage all when nothing staged" rule),
// the names of untracked files (which carry no diff), and recent commit
// subjects for style. Diff is capped so the payload stays bounded. Reads only.
async function reviewCommitContext(repoPath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review commit context' })
  } catch {
    return { diff: '', recent: '' }
  }

  const git = gitFor(cwd, gitBin)
  const safe = args => git.diff(args).catch(() => '')

  let status

  try {
    status = await git.status()
  } catch {
    return { diff: '', recent: '' }
  }

  // What will land: staged changes if any, otherwise all tracked changes vs HEAD.
  let diff = capText(
    status.staged.length > 0 ? await safe(['--cached']) : await safe(['HEAD']),
    COMMIT_CONTEXT_DIFF_MAX_CHARS,
    'diff truncated for commit-message generation'
  )

  // Untracked files have no diff — list them so new files aren't invisible.
  const untracked = status.not_added || []

  if (untracked.length > 0) {
    const visible = untracked.slice(0, COMMIT_CONTEXT_UNTRACKED_MAX)
    const omitted = untracked.length - visible.length

    const note =
      `\n# New (untracked) files:\n${visible.map(p => `#   ${p}`).join('\n')}\n` +
      (omitted > 0 ? `#   ... ${omitted} more omitted\n` : '')

    diff = diff ? `${diff}${note}` : note
  }

  const recent = await git.raw(['log', '-n', '10', '--pretty=format:%s']).catch(() => '')

  return { diff: diff || '', recent: String(recent || '').trim() }
}

async function reviewPush(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review push' })
  const git = gitFor(cwd, gitBin)
  const status = await git.status()

  if (status.tracking) {
    await git.push()
  } else if (status.current) {
    await git.raw(['push', '-u', 'origin', status.current])
  }

  return { ok: true }
}

// Fork sync for the settings "local repositories" list: how many commits the
// original project has that this checkout doesn't — the exact count the pull
// button shows — plus the tracked remote's name ('upstream' on a fork,
// 'origin' otherwise — gates the fork-sync button), the GitHub URL of that
// remote (null when it isn't GitHub-hosted, which hides the "open on GitHub"
// button) and the last commit's epoch-ms timestamp (null before the first
// commit), which feed the commit-date column and its sort. GitHub forks
// conventionally point `origin` at the fork and `upstream` at the project it
// was forked from, so the count (and the pull) track `upstream` when it
// exists and `origin` otherwise. `ahead` is the reverse count — commits this
// checkout has that the original project doesn't (local-only work) — shown
// with `behind` in the conflict banner's "X ahead of and Y behind" copy.
// `unpushed` is the count the push button shows: commits this checkout has
// that `origin` doesn't — the local-only work the push would actually
// upload. On a fork, `ahead` tracks upstream (the conflict banner's frame)
// while `unpushed` tracks the fork's own remote, so the push button count
// reflects the real push destination instead of the upstream comparison.
// `conflicted`/`conflictedFiles` report an in-progress merge whose conflicts
// are unresolved — the state a conflicted `git pull` leaves behind — so the
// row swaps the sync buttons for the resolve flow instead of offering a pull
// that would fail again. `mergeInProgress` reports the in-progress merge
// itself (MERGE_HEAD present), even when every conflict is already resolved
// but the merge commit hasn't been created — the state an interrupted
// resolution leaves behind — so the row offers "continue merge" instead of a
// pull that would fail mid-merge. Null when no tracked remote is resolvable
// or the path doesn't resolve, so the sync affordance only appears where it
// applies.
async function repoSyncInfo(repoPath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo sync info' })
  } catch {
    return null
  }

  await refreshRemotes(cwd, gitBin)

  const git = gitFor(cwd, gitBin)
  const target = await resolvePullTarget(git)

  if (!target) {
    return null
  }

  const branch = String((await git.raw(['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => null)) || '').trim()

  const [count, aheadCount, unpushedCount, remoteUrl, headDate, unmerged, mergeHead] = await Promise.all([
    git.raw(['rev-list', '--count', `HEAD..${target.remote}/${target.branch}`]).catch(() => null),
    git.raw(['rev-list', '--count', `${target.remote}/${target.branch}..HEAD`]).catch(() => null),
    git
      .raw(['rev-list', '--count', branch && branch !== 'HEAD' ? `origin/${branch}..HEAD` : 'HEAD..HEAD'])
      .catch(() => null),
    git.raw(['remote', 'get-url', target.remote]).catch(() => null),
    git.raw(['log', '-1', '--format=%ct', 'HEAD']).catch(() => null),
    git.raw(['diff', '--name-only', '--diff-filter=U']).catch(() => ''),
    git.raw(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).catch(() => null)
  ])

  if (count === null) {
    return null
  }

  const conflictedFiles = String(unmerged || '').split('\n').filter(Boolean)

  return {
    ahead: Math.max(0, parseInt(String(aheadCount || '').trim(), 10) || 0),
    behind: Math.max(0, parseInt(String(count).trim(), 10) || 0),
    conflicted: conflictedFiles.length > 0,
    conflictedFiles,
    lastCommitAt: headDate ? Number(String(headDate).trim()) * 1000 : null,
    mergeInProgress: Boolean(String(mergeHead || '').trim()),
    remote: target.remote,
    unpushed: Math.max(0, parseInt(String(unpushedCount || '').trim(), 10) || 0),
    url: githubUrlFromRemote(String(remoteUrl || '').trim()),
    gitlabUrl: gitlabUrlFromRemote(String(remoteUrl || '').trim())
  }
}

// Normalize a git remote URL to the https GitHub URL for the same repo, or
// null when the remote isn't GitHub-hosted (so the "open on GitHub" button
// only appears where it points at GitHub). Handles the scp syntax
// (`git@github.com:owner/repo.git`) and the https/ssh/git URL forms.
function githubUrlFromRemote(raw) {
  return forgeUrlFromRemote(raw, 'github.com')
}

// Same normalization for GitLab-hosted remotes — powers the "open on GitLab"
// affordance and the GitLab repo-list filter.
function gitlabUrlFromRemote(raw) {
  return forgeUrlFromRemote(raw, 'gitlab.com')
}

function forgeUrlFromRemote(raw, host) {
  const value = String(raw || '').trim()

  if (!value) {
    return null
  }

  const escaped = host.replace(/\./g, '\\.')
  const scp = new RegExp(`^(?:[^@\\s]+@)?${escaped}:([^/\\s]+)\\/([^/\\s]+?)(?:\\.git)?$`)
  const url = new RegExp(`^(?:https?|git|ssh):\\/\\/(?:[^@\\s]+@)?${escaped}\\/([^/\\s]+)\\/([^/\\s]+?)(?:\\.git)?\\/?$`)

  const match = value.match(scp) ?? value.match(url)

  if (!match) {
    return null
  }

  return `https://${host}/${match[1]}/${match[2]}`
}

// The remotes that define "the original project", in preference order.
const ORIGINAL_REMOTE_PREFERENCE = ['upstream', 'origin']

// Resolve which remote/branch the sync affordance should track: the first
// configured remote from ORIGINAL_REMOTE_PREFERENCE whose remote-tracking
// branch can be named. The branch comes from the remote's HEAD symref when
// set, else the conventional main/master — never assume a fork's default
// branch is main.
async function resolvePullTarget(git) {
  const remotes = String(await git.raw(['remote']).catch(() => '')).split(/\s+/).filter(Boolean)

  for (const remote of ORIGINAL_REMOTE_PREFERENCE) {
    if (!remotes.includes(remote)) {
      continue
    }

    const branch = await resolveRemoteBranch(git, remote)

    if (branch) {
      return { remote, branch }
    }
  }

  return null
}

async function resolveRemoteBranch(git, remote) {
  const prefix = `refs/remotes/${remote}/`
  const head = String(await git.raw(['symbolic-ref', prefix + 'HEAD']).catch(() => '')).trim()
  const candidates = head.startsWith(prefix) ? [head.slice(prefix.length), 'main', 'master'] : ['main', 'master']

  for (const branch of candidates) {
    const ok = await git.raw(['rev-parse', '--verify', `refs/remotes/${remote}/${branch}`]).catch(() => null)

    if (ok) {
      return branch
    }
  }

  return null
}

// Refresh the tracked remotes with a bounded timeout so the behind count is
// the exact number of missing commits, not a stale last-fetch snapshot. A
// failed fetch (offline) falls back to the refs we already have — the count
// stays honest, just possibly older. All-branch fetch: never fails because a
// default branch is named differently than main.
function refreshRemotes(cwd, gitBin) {
  return new Promise<void>(resolve => {
    const git = gitFor(cwd, gitBin)

    void git
      .raw(['remote'])
      .then(remotes => {
        const names = String(remotes || '').split(/\s+/).filter(Boolean)
        const targets = ORIGINAL_REMOTE_PREFERENCE.filter(name => names.includes(name))

        return Promise.all(targets.map(remote => fetchRemote(cwd, gitBin, remote)))
      })
      .catch(() => null)
      .then(() => resolve())
  })
}

function fetchRemote(cwd, gitBin, remote) {
  return new Promise(resolve => {
    execFile(
      gitBin || 'git',
      ['fetch', '--quiet', remote],
      { cwd, windowsHide: true, timeout: 15_000 },
      err => resolve(!err)
    )
  })
}

// Bring a local repo folder up to date with the latest commits from the
// git pull refuses to start a merge when local uncommitted changes (tracked
// or untracked) would be overwritten — it aborts before writing any conflict
// markers, so a plain retry can never recover. The sync flow instead stashes
// the local work under a known name, retries the pull so the incoming commits
// land in the working tree, then pops the stash back. A conflicted pop leaves
// the stash entry in place (nothing is lost) and the unmerged paths become the
// conflict state the resolver/agent flow sees; a failed pull for a real reason
// (auth, network) restores the stash before rethrowing.
const AUTOSTASH_MESSAGE = 'hermes-sync-autostash'

function isDirtyTreeAbort(error) {
  return /local changes|would be overwritten/i.test(String(error?.message || error || ''))
}

async function hasUnresolvedMergeState(git) {
  const [unmerged, mergeHead] = await Promise.all([
    git.raw(['diff', '--name-only', '--diff-filter=U']).catch(() => ''),
    git.raw(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).catch(() => null)
  ])

  return String(unmerged || '').trim().length > 0 || Boolean(String(mergeHead || '').trim())
}

async function pullWithDirtyTreeRecovery(git, remote, branch) {
  try {
    await git.raw(['pull', remote, branch])

    return
  } catch (error) {
    if (!isDirtyTreeAbort(error)) {
      throw error
    }
  }

  try {
    await git.raw(['stash', 'push', '--include-untracked', '-m', AUTOSTASH_MESSAGE])
  } catch {
    // The tree was already clean by the time we retried; the plain pull below
    // decides the outcome.
  }

  try {
    await git.raw(['pull', remote, branch])
  } catch (error) {
    // The retried pull either conflicted mid-merge (leave the repo resolvable
    // with the stash holding the local work) or failed for a real reason
    // (restore the stash so the user's changes are not left hidden).
    if (await hasUnresolvedMergeState(git)) {
      throw new Error('The sync merge has conflicts. Resolve them with the agent.')
    }

    await git.raw(['stash', 'pop']).catch(() => {})

    throw error
  }

  const pop = await git.raw(['stash', 'pop']).catch(error => ({ error }))

  if (await hasUnresolvedMergeState(git)) {
    throw new Error('Your local changes conflict with the sync. Resolve them with the agent.')
  }

  if (pop && pop.error) {
    throw new Error(
      `The sync succeeded, but your local changes could not be restored automatically. They are preserved in a stash entry named ${AUTOSTASH_MESSAGE} — apply it with git stash apply.`
    )
  }
}

// original project (`git pull upstream main` for forks, `git pull origin main`
// for plain clones). Used by the settings repo list's sync button; rejects so
// the renderer can surface the failure.
async function repoPull(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo pull' })

  await refreshRemotes(cwd, gitBin)

  const git = gitFor(cwd, gitBin)
  const target = await resolvePullTarget(git)

  if (!target) {
    throw new Error('No upstream or origin remote to pull from')
  }

  await pullWithDirtyTreeRecovery(git, target.remote, target.branch)

  return { ok: true }
}

// Bring a fork folder fully in sync with the original project, mirroring
// GitHub's "Sync fork → Update branch": pull the upstream branch into the
// local checkout, then push the updated branch to the fork (`origin`) so the
// fork on GitHub carries the same commits. Only meaningful when the resolved
// pull target is `upstream` — a plain clone (origin only) has no fork to
// sync — and rejects so the renderer can toast.
async function repoSyncFork(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo sync fork' })

  await refreshRemotes(cwd, gitBin)

  const git = gitFor(cwd, gitBin)
  const target = await resolvePullTarget(git)

  if (!target) {
    throw new Error('No upstream or origin remote to sync from')
  }

if (target.remote !== 'upstream') {
    throw new Error('No upstream remote — nothing to sync a fork from')
  }

  await pullWithDirtyTreeRecovery(git, target.remote, target.branch)
  await git.raw(['push', 'origin', 'HEAD'])

  return { ok: true }
}

// Upload the local branch's commits to the repo's own remote (`origin`), the
// counterpart of the settings push button: the local-only work the `unpushed`
// count reports. Pushing to `upstream` is never attempted — a fork's original
// project is read-only for the checkout's owner. Rejects when the repo has no
// origin so the renderer can surface the failure.
async function repoPush(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo push' })

  const git = gitFor(cwd, gitBin)
  const remotes = String(await git.raw(['remote']).catch(() => '')).split(/\s+/).filter(Boolean)

  if (!remotes.includes('origin')) {
    throw new Error('No origin remote to push to')
  }

  await git.raw(['push', 'origin', 'HEAD'])

  return { ok: true }
}

// Cap for conflict content shipped across IPC — a conflicted file can be a
// generated artifact or vendored bundle, and the resolver UI only needs the
// marker region, not megabytes of surrounding file.
const CONFLICT_FILE_MAX_BYTES = 512 * 1024

// Resolve a renderer-supplied conflict file against the repo root. Returns
// the normalized relative path (git-style forward slashes). Throws when the
// path escapes the repo, is absolute, or is not currently in conflict — the
// resolver must never touch files git isn't actively merging.
async function assertConflictPath(cwd, git, file) {
  const normalized = String(file || '').replace(/\\/g, '/')

  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error('Conflict path must be a relative path inside the repository')
  }

  const resolved = path.resolve(cwd, normalized)

  if (resolved !== cwd && !resolved.startsWith(cwd + path.sep)) {
    throw new Error('Conflict path escapes the repository')
  }

  const raw = await git.raw(['diff', '--name-only', '--diff-filter=U']).catch(() => '')

  if (!String(raw || '').split('\n').includes(normalized)) {
    throw new Error(`Not a conflicted file: ${normalized}`)
  }

  return normalized
}

// The conflicted files of a repo with their current worktree content (conflict
// markers included) so the resolver UI can show the code that must be decided.
// Content is capped; oversized or binary files report null so the UI degrades
// gracefully instead of shipping megabytes or mojibake across IPC.
async function repoConflictFiles(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo conflict files' })

  const git = gitFor(cwd, gitBin)
  const raw = await git.raw(['diff', '--name-only', '--diff-filter=U']).catch(() => '')

  const files = []

  for (const rel of String(raw || '').split('\n').filter(Boolean)) {
    let content = null

    try {
      const full = path.join(cwd, rel)
      const stat = await fs.stat(full)

      if (stat.size <= CONFLICT_FILE_MAX_BYTES) {
        content = await fs.readFile(full, 'utf8')
      }
    } catch {
      // File may have been deleted (a delete/delete conflict); report null.
    }

    files.push({ content, path: rel })
  }

  return { files }
}

// Resolve one conflicted file: take ours (the checked-out branch), theirs (the
// merged-in branch), or both (both sides concatenated, ours first), then stage
// it. During a merge, stage 2 is ours (HEAD) and stage 3 is theirs
// (MERGE_HEAD), so `git show :2:<path>` / `:3:<path>` fetch the exact sides.
async function repoResolveConflict(repoPath, file, choice, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo conflict resolve' })

  const git = gitFor(cwd, gitBin)
  const rel = await assertConflictPath(cwd, git, file)

  if (choice === 'ours') {
    await git.raw(['checkout', '--ours', '--', rel])
  } else if (choice === 'theirs') {
    await git.raw(['checkout', '--theirs', '--', rel])
  } else if (choice === 'both') {
    const [ours, theirs] = await Promise.all([
      git.raw(['show', `:2:${rel}`]).catch(() => ''),
      git.raw(['show', `:3:${rel}`]).catch(() => '')
    ])

    if (String(ours).includes('\0') || String(theirs).includes('\0')) {
      throw new Error('Cannot merge both sides of a binary file — pick ours or theirs')
    }

    await fs.writeFile(path.join(cwd, rel), `${String(ours).replace(/\n$/, '')}\n${String(theirs)}`)
  } else {
    throw new Error(`Unknown conflict choice: ${choice}`)
  }

  await git.raw(['add', '--', rel])

  return { ok: true }
}

// Finish the in-progress merge after the user resolved every conflict: verify
// none remain (the UI disables Continue until then, but git is the authority —
// the repo may have changed underneath), then commit with the default merge
// message. The merge commit preserves BOTH histories — the local commits and
// the pulled-in remote commits — which is exactly "resolve without losing my
// branch's commits". Abort is the only path that discards work, and it is
// explicit (repoAbortMerge).
async function repoContinueMerge(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo continue merge' })

  const git = gitFor(cwd, gitBin)
  const remaining = String(await git.raw(['diff', '--name-only', '--diff-filter=U']).catch(() => '')).trim()

  if (remaining) {
    throw new Error('Unresolved conflicts remain — resolve every file before continuing')
  }

  await git.raw(['commit', '--no-edit'])

  return { ok: true }
}

// Discard the in-progress merge entirely and return to the pre-pull state.
// Safe: `git merge --abort` restores HEAD to where it was before the pull, so
// the branch's own commits are never touched.
async function repoAbortMerge(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo abort merge' })

  await gitFor(cwd, gitBin).raw(['merge', '--abort'])

  return { ok: true }
}

// gh availability + auth + whether this branch already has a PR. Reads only;
// drives the PR button's enabled/label state. `ghReady` is false when gh is
// missing OR not authenticated — either way the PR action can't run.
async function reviewShipInfo(repoPath, ghBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review ship info' })
  } catch {
    return { ghReady: false, pr: null }
  }

  const auth = await runGh(['auth', 'status'], cwd, ghBin)

  if (!auth.ok) {
    return { ghReady: false, pr: null }
  }

  const view = await runGh(['pr', 'view', '--json', 'url,state,number'], cwd, ghBin)

  if (!view.ok) {
    // gh exits non-zero when no PR exists for the branch — that's not an error.
    return { ghReady: true, pr: null }
  }

  try {
    const pr = JSON.parse(view.stdout)

    return { ghReady: true, pr: pr && pr.url ? { url: pr.url, state: pr.state, number: pr.number } : null }
  } catch {
    return { ghReady: true, pr: null }
  }
}

// The authenticated GitHub CLI identity — the same gh profile the Review pane's
// PR flows act as. The "connected" signal is exactly the review pane's gate:
// `gh auth status` exit code. The identity is best-effort on top of it —
// `gh api user` for login/name/avatar, falling back to the login parsed from
// auth status output (covers tokens with auth but no API scope). No repo
// required: both commands are cwd-independent.
async function ghProfile(ghBin) {
  const auth = await runGh(['auth', 'status'], process.cwd(), ghBin)

  if (!auth.ok) {
    return { ok: false }
  }

  const parsedLogin = auth.stdout.match(/Logged in to \S+ (?:account|as) (\S+)/)?.[1] ?? ''

  const user = await runGh(
    ['api', 'user', '--jq', '{login: .login, name: .name, avatar_url: .avatar_url}'],
    process.cwd(),
    ghBin
  )

  if (user.ok) {
    try {
      const data = JSON.parse(user.stdout)

      return {
        ok: true,
        login: String(data.login || parsedLogin),
        name: data.name ? String(data.name) : null,
        avatarUrl: data.avatar_url ? String(data.avatar_url) : null
      }
    } catch {
      // fall through to the auth-status parse
    }
  }

  return { ok: true, login: parsedLogin, name: null, avatarUrl: null }
}

// The git identity commits should carry when gh is authenticated: the
// profile's display name (falling back to the login) and GitHub's noreply
// email (`<id>+<login>@users.noreply.github.com`), so commits are attributed
// to the account the user is logged into gh as. Null when gh can't answer.
async function ghIdentity(ghBin) {
  const user = await runGh(
    ['api', 'user', '--jq', '{login: .login, name: .name, id: .id}'],
    process.cwd(),
    ghBin
  )

  if (!user.ok) {
    return null
  }

  try {
    const data = JSON.parse(user.stdout)
    const login = String(data.login || '')

    if (!login) {
      return null
    }

    const id = String(data.id ?? '')

    return {
      name: data.name ? String(data.name) : login,
      email: id ? `${id}+${login}@users.noreply.github.com` : `${login}@users.noreply.github.com`
    }
  } catch {
    return null
  }
}

let ghLoginProc = null
let ghLoginDoneCb = null

// Parse the device-login banner `gh auth login --web` prints. gh 2.x writes
// the whole banner to stderr (the terminal shows exactly these two lines),
// and the URL is the device endpoint the user must open in a browser.
function parseGhLoginBanner(text) {
  const code = text.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)?.[1] ?? null
  const url = text.match(/https:\/\/github\.com\/login\/device/)?.[0] ?? null

  return { code, url }
}

// Start `gh auth login --web` and resolve with the one-time code + device URL
// once gh prints them. The caller shows those to the user while the process
// keeps running; `onDone(ok)` fires when it exits (completed or failed).
// Returns null when gh is missing or a login is already running. gh 2.x
// prints the banner to stderr, so both streams feed the same parser.
function ghLogin(ghBin, onDone) {
  if (ghLoginProc || !ghBin) {
    return null
  }

  ghLoginDoneCb = onDone

  const proc = execFile(
    ghBin,
    ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'],
    // GH_PROMPT_DISABLED skips the "Press Enter to open ..." step so gh
    // prints the code + URL and polls in the background on its own.
    { env: { ...ghEnv(ghBin), GH_PROMPT_DISABLED: '1' }, windowsHide: true },
    err => {
      ghLoginProc = null
      const done = ghLoginDoneCb
      ghLoginDoneCb = null
      done?.(!err)
    }
  )

  ghLoginProc = proc

  return new Promise(resolve => {
    let buffer = ''
    let settled = false

    // gh prints the banner within a couple of seconds; anything longer means
    // the binary is broken or blocked, so fail instead of spinning forever.
    const timer = setTimeout(() => {
      proc.kill()

      if (!settled) {
        settled = true
        resolve({ code: '', url: '', error: 'gh auth login did not respond' })
      }
    }, 10_000)

    const onChunk = chunk => {
      buffer += chunk.toString()

      const { code, url } = parseGhLoginBanner(buffer)

      if (!settled && code && url) {
        settled = true
        clearTimeout(timer)
        resolve({ code, url })
      }
    }

    proc.stdout.on('data', onChunk)
    proc.stderr.on('data', onChunk)

    proc.on('close', () => {
      clearTimeout(timer)

      if (!settled) {
        settled = true
        // gh died before printing the banner — surface whatever it said.
        resolve({ code: '', url: '', error: buffer.trim().slice(0, 300) || 'gh auth login exited early' })
      }
    })

    proc.on('error', () => {
      clearTimeout(timer)

      if (!settled) {
        settled = true
        resolve({ code: '', url: '', error: 'gh could not be started' })
      }
    })
  })
}

function cancelGhLogin() {
  ghLoginProc?.kill()
}

// Sign out of the github.com host (the one `ghLogin` signs into). gh has no
// non-interactive logout flag, so the confirmation prompt is answered with
// `y` on stdin. `login` pins the account (avoids the account picker when
// several are stored). `{ ok: false }` when gh is missing or the logout fails.
async function ghLogout(ghBin, login) {
  if (!ghBin) {
    return { ok: false }
  }

  const args = ['auth', 'logout', '--hostname', 'github.com']

  if (login) {
    args.push('--user', login)
  }

  return new Promise(resolve => {
    const proc = execFile(
      ghBin,
      args,
      { env: ghEnv(ghBin), windowsHide: true, timeout: 30_000 },
      err => resolve({ ok: !err })
    )

    proc.stdin.write('y\n')
  })
}

// --- GitLab (glab CLI) ------------------------------------------------------
//
// glab has no non-interactive browser/device login the way `gh auth login
// --web` has — its prompts need a TTY. The reliable non-interactive path is a
// personal access token, so the GitLab connect flow asks for one in the UI and
// pipes it here (`glab auth login --stdin`).

function runGlab(args, cwd, glabBin) {
  return runGh(args, cwd, glabBin)
}

async function glProfile(glabBin) {
  const auth = await runGlab(['auth', 'status', '--hostname', 'gitlab.com'], process.cwd(), glabBin)

  if (!auth.ok) {
    return { ok: false }
  }

  const parsedLogin =
    auth.stdout.match(/Logged in to \S+ (?:account|as) (\S+)/)?.[1] ??
    auth.stdout.match(/\bas\s+(\S+)/i)?.[1] ??
    ''

  const user = await runGlab(['api', 'user'], process.cwd(), glabBin)

  if (user.ok) {
    try {
      const data = JSON.parse(user.stdout)

      return {
        ok: true,
        login: String(data.username || parsedLogin),
        name: data.name ? String(data.name) : null,
        avatarUrl: data.avatar_url ? String(data.avatar_url) : null
      }
    } catch {
      // fall through to the auth-status parse
    }
  }

  return { ok: true, login: parsedLogin, name: null, avatarUrl: null }
}

// Sign in with a personal access token. `--stdin` keeps the token out of the
// process list; older glab builds lack the flag, so a failed stdin attempt
// retries with `--token` as a compatibility rung.
function glLoginWithToken(glabBin, token) {
  if (!token) {
    return Promise.resolve({ ok: false, error: 'Token is required' })
  }

  if (!glabBin) {
    return Promise.resolve({ ok: false, error: 'GitLab CLI (glab) is not installed. Install it from https://gitlab.com/gitlab-org/cli' })
  }

  const env = ghEnv(glabBin)

  return new Promise(resolve => {
    execFile(
      glabBin,
      ['auth', 'login', '--hostname', 'gitlab.com', '--stdin'],
      { env, windowsHide: true, timeout: 30_000 },
      err => {
        if (!err) {
          resolve({ ok: true })

          return
        }

        // If the first attempt failed, try the --token flag as a fallback
        execFile(
          glabBin,
          ['auth', 'login', '--hostname', 'gitlab.com', '--token', token],
          { env, windowsHide: true, timeout: 30_000 },
          fallbackErr => {
            // Handle ENOENT (binary not found) with a user-friendly message
            if (fallbackErr && 'code' in fallbackErr && fallbackErr.code === 'ENOENT') {
              resolve({ ok: false, error: 'GitLab CLI (glab) is not installed. Install it from https://gitlab.com/gitlab-org/cli' })
            } else {
              resolve({ ok: !fallbackErr, error: fallbackErr ? String(fallbackErr.message || '').slice(0, 300) : undefined })
            }
          }
        )
      }
    ).stdin.end(`${token}\n`)
  })
}

// Sign out of gitlab.com. Like gh, glab has no non-interactive confirmation
// flag, so the prompt is answered with `y` on stdin; `login` pins the account.
function glLogout(glabBin, login) {
  if (!glabBin) {
    return Promise.resolve({ ok: false })
  }

  const args = ['auth', 'logout', '--hostname', 'gitlab.com']

  if (login) {
    args.push('--username', login)
  }

  return new Promise(resolve => {
    const proc = execFile(
      glabBin,
      args,
      { env: ghEnv(glabBin), windowsHide: true, timeout: 30_000 },
      err => {
        // Handle ENOENT (binary not found) gracefully
        if (err && 'code' in err && err.code === 'ENOENT') {
          resolve({ ok: false })
        } else {
          resolve({ ok: !err })
        }
      }
    )

    proc.stdin.write('y\n')
  })
}

// GraphQL asks per branch, so the answer can't be crowded out the way a
// `gh pr list` page can. Aliases let one request carry many branches; 50 keeps
// the document well inside GitHub's node budget.
const PR_QUERY_BRANCH_CHUNK = 50
const PR_QUERY_BRANCH_CAP = 300

const PR_NODE_FIELDS = 'number state isDraft isCrossRepository title url headRefName'

function prQueryFor(owner, name, branches, numbers) {
  const fields = [
    ...branches.map(
      (branch, i) =>
        `b${i}: pullRequests(headRefName: ${JSON.stringify(branch)}, first: 5, ` +
        `orderBy: {field: CREATED_AT, direction: DESC}) ` +
        `{ nodes { ${PR_NODE_FIELDS} } }`
    ),
    // A PR recovered from a transcript is known by number, and asking for it
    // directly also tells us its branch — so it lands in the same by-branch map
    // as everything else.
    ...numbers.map((number, i) => `n${i}: pullRequest(number: ${number}) { ${PR_NODE_FIELDS} }`)
  ].join('\n')

  return `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {\n${fields}\n} }`
}

const prPayload = pr => ({
  branch: String(pr.headRefName),
  draft: Boolean(pr.isDraft),
  number: Number(pr.number) || 0,
  state: String(pr.state || '').toLowerCase(),
  title: String(pr.title || ''),
  url: String(pr.url || '')
})

// A GitHub review-comment / issue-comment URL, as pasted from the browser.
// Captures owner, repo, PR number, and the comment kind + id. Review threads
// deep-link as `#discussion_r<id>`; conversation-tab comments as
// `#issuecomment-<id>`.
const PR_COMMENT_URL_RE =
  /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:\/[^#\s]*)?#(discussion_r|issuecomment-)(\d+)$/

function parsePrCommentUrl(url) {
  const match = PR_COMMENT_URL_RE.exec(String(url || '').trim())

  if (!match) {
    return null
  }

  const [, owner, repo, prNumber, kind, id] = match

  return { id, kind: kind === 'discussion_r' ? 'review' : 'issue', owner, prNumber: Number(prNumber), repo }
}

// Resolve a pasted PR comment URL into the structured context the composer
// attaches: author, body, and — for review comments — the file, line range,
// and the diff hunk the comment anchors to. Reads only; any failure (gh
// missing, unauthenticated, private repo, deleted comment) yields null and the
// paste falls back to being a plain URL.
async function reviewFetchPrComment(repoPath, ghBin, url) {
  const parsed = parsePrCommentUrl(url)

  if (!parsed) {
    return null
  }

  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review comment fetch' })
  } catch {
    return null
  }

  const endpoint =
    parsed.kind === 'review'
      ? `repos/${parsed.owner}/${parsed.repo}/pulls/comments/${parsed.id}`
      : `repos/${parsed.owner}/${parsed.repo}/issues/comments/${parsed.id}`

  const res = await runGh(['api', endpoint], cwd, ghBin)

  if (!res.ok) {
    return null
  }

  try {
    const data = JSON.parse(res.stdout)

    return {
      author: String(data?.user?.login || ''),
      body: String(data?.body || ''),
      diffHunk: parsed.kind === 'review' ? String(data?.diff_hunk || '') : '',
      kind: parsed.kind,
      // `line` is the comment's anchor in the current diff; null once the code
      // moved on (outdated comment) — `original_line` still says where it was.
      line: data?.line ?? data?.original_line ?? null,
      path: parsed.kind === 'review' ? String(data?.path || '') : '',
      prNumber: parsed.prNumber,
      startLine: data?.start_line ?? data?.original_start_line ?? null,
      url: String(data?.html_url || url)
    }
  } catch {
    return null
  }
}

// The PR for each of the given branches, keyed by branch. Asks GitHub about the
// branches we actually have sessions on rather than listing the repo's newest
// PRs and hoping ours are in the page — on a busy repo they are not. One
// GraphQL request per 50 branches; reads only.
async function reviewPrList(repoPath, ghBin, branches, numbers) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review PR list' })
  } catch {
    return { ghReady: false, prs: [] }
  }

  const wanted = [...new Set((branches || []).filter(Boolean).map(String))].slice(0, PR_QUERY_BRANCH_CAP)
  const byNumber = [...new Set((numbers || []).map(Number).filter(Boolean))].slice(0, PR_QUERY_BRANCH_CAP)

  if (wanted.length === 0 && byNumber.length === 0) {
    return { ghReady: false, prs: [] }
  }

  const repo = await runGh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], cwd, ghBin)
  const [owner, name] = repo.stdout.trim().split('/')

  if (!repo.ok || !owner || !name) {
    // gh missing, unauthenticated, or no GitHub remote — all "nothing to badge".
    return { ghReady: false, prs: [] }
  }

  const prs = []
  const chunks = []

  for (let start = 0; start < wanted.length; start += PR_QUERY_BRANCH_CHUNK) {
    chunks.push([wanted.slice(start, start + PR_QUERY_BRANCH_CHUNK), []])
  }

  for (let start = 0; start < byNumber.length; start += PR_QUERY_BRANCH_CHUNK) {
    chunks.push([[], byNumber.slice(start, start + PR_QUERY_BRANCH_CHUNK)])
  }

  for (const [branchChunk, numberChunk] of chunks) {
    const query = prQueryFor(owner, name, branchChunk, numberChunk)
    const res = await runGh(['api', 'graphql', '-f', `query=${query}`], cwd, ghBin)

    if (!res.ok) {
      continue
    }

    try {
      const repository = JSON.parse(res.stdout)?.data?.repository ?? {}

      for (const key of Object.keys(repository)) {
        // Asked for by number, so it's ours by construction — a fork PR can't
        // be recovered from our own transcript. Asked for by branch, it has to
        // prove it: fork PRs share our branch namespace, and a contributor's
        // `main` is how a session on trunk ends up badged with a stranger's PR.
        const pr = key.startsWith('n')
          ? repository[key]
          : (repository[key]?.nodes ?? []).find(node => node && !node.isCrossRepository)

        if (pr?.headRefName) {
          prs.push(prPayload(pr))
        }
      }
    } catch {
      // A malformed chunk drops its branches; the rest still resolve.
    }
  }

  return { ghReady: true, prs }
}

// Create a PR for the current branch (pushing first so gh has a remote ref),
// letting gh fill title/body from the commits. Returns the new PR url.
async function reviewCreatePr(repoPath, gitBin, ghBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review create PR' })

  await reviewPush(repoPath, gitBin).catch(() => undefined)

  const created = await runGh(['pr', 'create', '--fill'], cwd, ghBin)

  if (!created.ok) {
    throw new Error('gh pr create failed (is gh installed and authenticated?)')
  }

  const url = created.stdout.trim().split('\n').filter(Boolean).pop() || ''

  return { url }
}

// Compact working-tree status for the composer coding rail: branch, ahead/behind,
// per-state change counts, +/- vs HEAD, and a capped changed-file list.
async function repoStatus(repoPath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo status' })
  } catch {
    return null
  }

  // Session cwds can point at a deleted worktree for a moment (or forever in a
  // stale row). simple-git throws at construction time on a missing baseDir, so
  // fail soft and hide the coding rail instead of spamming IPC handler errors.
  try {
    const stat = await fs.stat(cwd)

    if (!stat.isDirectory()) {
      return null
    }
  } catch {
    return null
  }

  let git

  try {
    git = gitFor(cwd, gitBin)
  } catch {
    return null
  }

  let status

  try {
    // The coding rail needs compact change truth, not every generated file.
    // `simple-git` defaults bare `-u` to recursive `all`, which can make a
    // generated workspace consume gigabytes before the 200-row UI cap is
    // applied. `normal` reports each untracked directory as one entry.
    status = await git.status(['--untracked-files=normal'])
  } catch {
    // Not a repo / git unavailable / remote backend.
    return null
  }

  const detached = typeof status.detached === 'boolean' ? status.detached : !status.current

  const files = status.files.map(file => ({
    path: file.path,
    staged: isStaged(file),
    unstaged: Boolean(file.working_dir && file.working_dir !== ' ' && file.working_dir !== '?'),
    untracked: file.index === '?' || file.working_dir === '?',
    conflicted: file.index === 'U' || file.working_dir === 'U'
  }))

  const result = {
    branch: detached ? null : status.current || null,
    defaultBranch: await defaultBranchName(git),
    detached,
    ahead: status.ahead || 0,
    behind: status.behind || 0,
    staged: files.filter(f => f.staged).length,
    unstaged: files.filter(f => f.unstaged).length,
    untracked: status.not_added.length,
    conflicted: status.conflicted.length,
    changed: files.length,
    added: 0,
    removed: 0,
    files: files.slice(0, 200)
  }

  // +/- vs HEAD (staged + unstaged tracked changes). No HEAD yet → leave 0.
  try {
    const summary = await git.diffSummary(['HEAD'])
    result.added = summary.insertions
    result.removed = summary.deletions
  } catch {
    // No commits yet.
  }

  // `git diff HEAD` ignores untracked files, so a turn that only creates new
  // files (the common case — a fresh module) showed +0 in the rail while the
  // review pane counted them. Fold top-level untracked file insertions into
  // `added`; directories reported by the compact `normal` scan intentionally
  // remain at zero rather than recursively walking their contents.
  try {
    const untracked = status.not_added.slice(0, 500)

    for (let i = 0; i < untracked.length; i += UNTRACKED_LINE_COUNT_CONCURRENCY) {
      const batch = await Promise.all(
        untracked.slice(i, i + UNTRACKED_LINE_COUNT_CONCURRENCY).map(path => untrackedInsertions(cwd, path))
      )

      result.added += batch.reduce((sum, n) => sum + n, 0)
    }
  } catch {
    // Best-effort: a probe failure just leaves untracked lines uncounted.
  }

  return result
}

export {
  branchBase,
  cancelGhLogin,
  fileDiffVsHead,
  ghLogin,
  ghLogout,
  ghProfile,
  gitFor,
  githubUrlFromRemote,
  gitlabUrlFromRemote,
  glLoginWithToken,
  glLogout,
  glProfile,
  parseGhLoginBanner,
  repoAbortMerge,
  repoConflictFiles,
   repoContinueMerge,
   repoGitConfigGet,
   repoGitConfigSet,
   repoPull,
   repoPush,
  repoResolveConflict,
  repoStatus,
  repoSyncFork,
  repoSyncInfo,
  resolveRenamePath,
  REVIEW_FILE_CAP,
  reviewCommit,
  reviewCommitContext,
  reviewCreatePr,
  reviewDiff,
  reviewFetchPrComment,
  reviewList,
  reviewPrList,
  reviewPush,
  reviewRevert,
  reviewRevParse,
  reviewShipInfo,
  reviewStage,
  reviewUnstage
}

async function repoGitConfigGet(repoPath, gitBin, host = 'github.com') {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Git config get' })
  } catch {
    return { ok: false }
  }

  let git

  try {
    git = gitFor(cwd, gitBin)
  } catch {
    return { ok: false }
  }

  const key = `credential.https://${host}.username`

  const [globalVal, localVal] = await Promise.all([
    git.raw(['config', '--global', key]).catch(() => ''),
    git.raw(['config', '--local', key]).catch(() => '')
  ])

  const globalUser = String(globalVal || '').trim() || null
  const localUser = String(localVal || '').trim() || null

  return { ok: true, global: globalUser, local: localUser }
}

async function repoGitConfigSet(repoPath, scope, username, gitBin, host = 'github.com') {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Git config set' })
  } catch {
    return { ok: false, error: 'Invalid repo path' }
  }

  let git

  try {
    git = gitFor(cwd, gitBin)
  } catch {
    return { ok: false, error: 'Git unavailable' }
  }

  const key = `credential.https://${host}.username`
  const flag = scope === 'global' ? '--global' : '--local'

  try {
    await git.raw(['config', flag, key, username])

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
