import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { desktopGit } from '@/lib/desktop-git'
import { $projectTree } from '@/store/projects'
import { $currentCwd, $selectedStoredSessionId, $sessions, sessionMatchesStoredId } from '@/store/session'

export type GitProvider = 'github' | 'gitlab' | null

/**
 * Detects whether the current working directory belongs to a GitHub or GitLab
 * repository by checking the git remote URL. Returns the provider type or null
 * if not a hosted repo / no cwd.
 *
 * Uses syncInfo from the git bridge to get the remote URL, then parses it
 * to determine the hosting provider.
 */
export function useGitProvider(): GitProvider {
  const currentCwd = useStore($currentCwd)
  const projectTree = useStore($projectTree)
  const selectedStoredSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)
  const [provider, setProvider] = useState<GitProvider>(null)

  // Find the repo root for the current cwd from the project tree
  const repoRoot = findRepoRoot(currentCwd, projectTree, sessions, selectedStoredSessionId)

  useEffect(() => {
    if (!repoRoot) {
      setProvider(null)

      return
    }

    let cancelled = false

    const git = desktopGit()

    if (!git?.syncInfo) {
      setProvider(null)

      return
    }

    git
      .syncInfo(repoRoot)
      .then(info => {
        if (cancelled) {
          return
        }

        if (!info?.url) {
          setProvider(null)

          return
        }

        const url = info.url.toLowerCase()

        if (url.includes('github.com')) {
          setProvider('github')
        } else if (url.includes('gitlab.com')) {
          setProvider('gitlab')
        } else {
          setProvider(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProvider(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [repoRoot])

  return provider
}

/**
 * Find the repo root for a given cwd by looking through the project tree.
 * Checks both project paths and repo paths within projects.
 */
function findRepoRoot(
  cwd: string,
  projectTree: ReturnType<typeof $projectTree.get>,
  sessions: ReturnType<typeof $sessions.get>,
  selectedStoredSessionId: string | null
): string | null {
  const target = cwd.trim()

  if (!target) {
    // Try to get cwd from the selected session
    if (selectedStoredSessionId) {
      const session = sessions.find(s => sessionMatchesStoredId(s, selectedStoredSessionId))

      if (session?.git_repo_root) {
        return session.git_repo_root
      }
    }

    return null
  }

  // First check if the session has a git_repo_root
  if (selectedStoredSessionId) {
    const session = sessions.find(s => sessionMatchesStoredId(s, selectedStoredSessionId))

    if (session?.git_repo_root) {
      return session.git_repo_root
    }
  }

  // Look through project tree for matching repo roots
  for (const project of projectTree) {
    for (const repo of project.repos) {
      if (repo.path && isUnderPath(repo.path, target)) {
        return repo.path
      }
    }
  }

  return null
}

/** Check if `child` is under `parent` path (case-insensitive on Windows). */
function isUnderPath(parent: string, child: string): boolean {
  const normalizedParent = parent.replace(/[/\\]+$/, '').toLowerCase()
  const normalizedChild = child.replace(/[/\\]+$/, '').toLowerCase()

  return normalizedChild.startsWith(normalizedParent + '/') || normalizedChild.startsWith(normalizedParent + '\\')
}
