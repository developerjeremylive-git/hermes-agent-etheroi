import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { notify, readableError } from '@/store/notifications'

type RepoListSectionProps = {
  roots: string[]
  title: string
  hint: string
  disabled?: boolean
  onSelectRepo: (root: string) => void
}

export function RepoListSection({ roots, title, hint, disabled, onSelectRepo }: RepoListSectionProps) {
  const { t } = useI18n()

  const [repos, setRepos] = useState<{ root: string; label: string }[]>([])
  const [repoSyncInfo, setRepoSyncInfo] = useState<Record<string, { behind: number }>>({})
  const [scanningRepos, setScanningRepos] = useState(false)
  const [pullingRepo, setPullingRepo] = useState<string | null>(null)
  const scanGeneration = useRef(0)

  const refresh = useCallback(async () => {
    const git = desktopGit()

    if (!git?.scanRepos) {
      return
    }

    setScanningRepos(true)

    try {
      const found = await git.scanRepos(roots)
      setRepos(found)
      setRepoSyncInfo({})

      // Each repo publishes its sync info as its fetch completes, so a slow or
      // failing fetch for one repo never delays the pull buttons of the others.
      const generation = ++scanGeneration.current

      for (const repo of found) {
        void (async () => {
          const info = git.syncInfo ? await git.syncInfo(repo.root).catch(() => null) : null

          if (info && generation === scanGeneration.current) {
            setRepoSyncInfo(prev => ({ ...prev, [repo.root]: info }))
          }
        })()
      }
    } catch {
      setRepos([])
      setRepoSyncInfo({})
    } finally {
      setScanningRepos(false)
    }
  }, [roots])

  const pullRepo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.pull) {
        return
      }

      setPullingRepo(root)

      try {
        await git.pull(root)
        notify({ kind: 'success', message: t.settings.gitHub.updatedFromOrigin })

        // The folder now has the original project's branch — refresh the count
        // so the pull button stops showing missing commits (it hides once
        // behind is 0).
        const info = git.syncInfo ? await git.syncInfo(root).catch(() => null) : null

        setRepoSyncInfo(prev => {
          const next = { ...prev }

          if (info) {
            next[root] = info
          } else {
            delete next[root]
          }

          return next
        })
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, t.settings.gitHub.pullFailed).message })
      } finally {
        setPullingRepo(null)
      }
    },
    [t]
  )

  return (
    <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button disabled={scanningRepos} onClick={() => void refresh()} size="sm" variant="ghost">
          {scanningRepos ? t.settings.gitHub.scanningRepos : t.common.refresh}
        </Button>
      </div>
      {repos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.settings.gitHub.noReposFound}</p>
      ) : (
        <div className="h-64 overflow-y-auto">
          <ul className="space-y-1 pr-1">
            {repos.map(repo => {
              const syncInfo = repoSyncInfo[repo.root]

              return (
                <li key={repo.root}>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-(--ui-bg-tertiary)"
                      disabled={disabled}
                      onClick={() => onSelectRepo(repo.root)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{repo.label}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground truncate">
                          {repo.root}
                        </span>
                      </span>
                      <span className="text-xs text-(--ui-accent) shrink-0">{t.settings.gitHub.useThisRepo}</span>
                    </button>
                    {syncInfo && syncInfo.behind > 0 ? (
                      <Button
                        disabled={pullingRepo === repo.root}
                        onClick={() => void pullRepo(repo.root)}
                        size="xs"
                        title={t.settings.gitHub.pullFromOriginHint}
                        variant="secondary"
                      >
                        {pullingRepo === repo.root
                          ? t.settings.gitHub.pulling
                          : t.settings.gitHub.pullFromOrigin(syncInfo.behind)}
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
