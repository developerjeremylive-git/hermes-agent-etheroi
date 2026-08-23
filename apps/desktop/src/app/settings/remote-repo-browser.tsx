import { useCallback, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import type { HermesRemoteRepo } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { GitBranch, iconSize, RefreshCw, Search } from '@/lib/icons'
import { notify } from '@/store/notifications'

import { CloneDialog } from './clone-dialog'

type RepoListHost = 'github' | 'gitlab'

type RemoteRepoBrowserProps = {
  disabled?: boolean
  host: RepoListHost
}

export function RemoteRepoBrowser({ disabled, host }: RemoteRepoBrowserProps) {
  const { t } = useI18n()
  const tr = host === 'gitlab' ? t.settings.gitLab : t.settings.gitHub

  const [repos, setRepos] = useState<HermesRemoteRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cloneRepo, setCloneRepo] = useState<HermesRemoteRepo | null>(null)

  const fetchRepos = useCallback(async () => {
    const git = desktopGit()
    const listFn = host === 'gitlab' ? git?.glListRepos : git?.ghListRepos

    if (!listFn) {
      return
    }

    setLoading(true)

    try {
      const result = await listFn()
      setRepos(result.repos)
      setHasLoaded(true)
    } catch (err) {
      notify({ kind: 'error', message: tr.listReposFailed })
      setRepos([])
    } finally {
      setLoading(false)
    }
  }, [host, tr])

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) {
      return repos
    }

    const query = searchQuery.toLowerCase()

    return repos.filter(
      repo =>
        repo.name.toLowerCase().includes(query) ||
        repo.fullName.toLowerCase().includes(query) ||
        (repo.description && repo.description.toLowerCase().includes(query))
    )
  }, [repos, searchQuery])

  const handleCloned = useCallback((path: string) => {
    notify({ kind: 'success', message: tr.clonedTo(path) })
  }, [tr])

  return (
    <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{tr.remoteRepositories}</p>
          <p className="text-xs text-muted-foreground">{tr.remoteRepositoriesHint}</p>
        </div>
        <Button
          disabled={disabled || loading}
          onClick={() => void fetchRepos()}
          size="sm"
        >
          {loading ? (
            <Loader aria-label={tr.loadingRepos} className="size-4" strokeScale={0.7} />
          ) : (
            <>
              <RefreshCw className={iconSize.sm} />
              <span className="ml-1">{hasLoaded ? t.common.refresh : tr.loadRepos}</span>
            </>
          )}
        </Button>
      </div>

      {hasLoaded && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            aria-label={tr.searchRepos}
            className="pl-9"
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tr.searchRepos}
            value={searchQuery}
          />
        </div>
      )}

      {loading && !hasLoaded ? (
        <div className="grid h-40 place-items-center">
          <Loader aria-label={tr.loadingRepos} className="size-6" label={tr.loadingRepos} />
        </div>
      ) : hasLoaded && filteredRepos.length === 0 ? (
        <EmptyState className="min-h-32" title={tr.noRemoteReposFound} />
      ) : hasLoaded ? (
        <div className="h-64 overflow-y-auto">
          <ul className="space-y-1 pr-1">
            {filteredRepos.map(repo => (
              <li key={repo.id}>
                <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-(--ui-bg-tertiary)">
                  <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{repo.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {repo.fullName}
                      {repo.isPrivate && (
                        <span className="ml-2 text-[10px] text-muted-foreground">(private)</span>
                      )}
                    </span>
                    {repo.description && (
                      <span className="block text-xs text-muted-foreground truncate mt-0.5">
                        {repo.description}
                      </span>
                    )}
                  </div>
                  <Button
                    disabled={disabled}
                    onClick={() => setCloneRepo(repo)}
                    size="xs"
                    variant="secondary"
                  >
                    {tr.clone}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <CloneDialog
        host={host}
        onCloned={handleCloned}
        onClose={() => setCloneRepo(null)}
        open={cloneRepo !== null}
        repo={cloneRepo}
      />
    </div>
  )
}
