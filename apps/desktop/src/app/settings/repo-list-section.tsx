import { useCallback, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Tip } from '@/components/ui/tooltip'
import type { HermesRepoStatus } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, FolderOpen, iconSize, MoreVertical, RefreshCw, Search } from '@/lib/icons'
import { refreshRepoStatus } from '@/store/coding-status'
import { notify, readableError } from '@/store/notifications'
import { requestStartWorkSession } from '@/store/projects'

import { ConflictResolverDialog } from './conflict-resolver'

export type RepoSortMode = 'lastCommit' | 'name'

type RepoInfo = {
  ahead: number
  behind: number
  conflicted: boolean
  conflictedFiles: string[]
  gitlabUrl: null | string
  lastCommitAt: null | number
  mergeInProgress: boolean
  remote: 'origin' | 'upstream'
  unpushed: number
  url: null | string
}

type RepoConfig = {
  global: string | null
  local: string | null
}

type AccountDialogState = {
  repoPath: string
  scope: 'global' | 'local'
}

export type RepoListHost = 'github' | 'gitlab'

type RepoListSectionProps = {
  roots: string[]
  title: string
  hint: string
  /** Which forge the rows point at — picks the remote URL, the "open on" label, and the credential config. */
  host?: RepoListHost
  disabled?: boolean
  onSelectRepo: (root: string) => void
}

export function formatCommitDate(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function RepoListSection({ roots, title, hint, host = 'github', disabled, onSelectRepo }: RepoListSectionProps) {
  const { t } = useI18n()

  // Forge-specific strings: every host block mirrors the same key set.
  const tr = host === 'gitlab' ? t.settings.gitLab : t.settings.gitHub

  const [repos, setRepos] = useState<{ root: string; label: string }[]>([])
  const [repoSyncInfo, setRepoSyncInfo] = useState<Record<string, RepoInfo>>({})
  const [repoConfigs, setRepoConfigs] = useState<Record<string, RepoConfig>>({})
  const [syncSettled, setSyncSettled] = useState<Record<string, boolean>>({})
  const [scanningRepos, setScanningRepos] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [pullingRepo, setPullingRepo] = useState<null | string>(null)
  const [syncingRepo, setSyncingRepo] = useState<null | string>(null)
  const [pushingRepo, setPushingRepo] = useState<null | string>(null)
  const [continuingMergeRepo, setContinuingMergeRepo] = useState<null | string>(null)
  const [conflictRepo, setConflictRepo] = useState<null | string>(null)
  const [sortMode, setSortMode] = useState<RepoSortMode>('name')
  const [searchQuery, setSearchQuery] = useState('')
  const [accountDialog, setAccountDialog] = useState<AccountDialogState | null>(null)
  const [accountUsername, setAccountUsername] = useState('')
  const scanGeneration = useRef(0)

  // The connected profile of the section's host, if any — used to prefill the
  // repo credential without prompting. Optional calls: an older backend bridge
  // may not expose the glab surface yet.
  const getHostUsername = useCallback(async (): Promise<string | null> => {
    const git = window.hermesDesktop?.git

    if (!git) {
      return null
    }

    const profileFn = host === 'gitlab' ? git.glProfile : git.ghProfile

    if (!profileFn) {
      return null
    }

    try {
      const profile = await profileFn()

      if (profile.ok && profile.login) {
        return profile.login
      }
    } catch {
      // CLI missing or not logged in
    }

    return null
  }, [host])

  const fetchRepoConfig = useCallback(
    async (repoPath: string) => {
      const git = window.hermesDesktop?.git

      if (!git) {
        return
      }

      const configGet = host === 'gitlab' ? git.glConfigGet : git.configGet

      if (!configGet) {
        return
      }

      try {
        const result = await configGet(repoPath)

        if (result.ok) {
          setRepoConfigs(prev => ({
            ...prev,
            [repoPath]: { global: result.global, local: result.local }
          }))
        } else {
          setRepoConfigs(prev => ({ ...prev, [repoPath]: { global: null, local: null } }))
        }
      } catch {
        setRepoConfigs(prev => ({ ...prev, [repoPath]: { global: null, local: null } }))
      }
    },
    [host]
  )

  const applyAccountConfig = useCallback(
    async (repoPath: string, scope: 'global' | 'local', username: string) => {
      const git = window.hermesDesktop?.git
      const configSet = host === 'gitlab' ? git?.glConfigSet : git?.configSet

      if (!git || !configSet || !username) {
        return
      }

      const result = await configSet(repoPath, scope, username)

      if (result.ok) {
        notify({ kind: 'success', message: tr.configSetSuccess })
        await fetchRepoConfig(repoPath)
      } else {
        notify({ kind: 'error', message: result.error || tr.configSetFailed })
      }
    },
    [host, fetchRepoConfig, t]
  )

  const requestAccountConfig = useCallback(
    async (repoPath: string, scope: 'global' | 'local') => {
      const username = await getHostUsername()

      if (username) {
        await applyAccountConfig(repoPath, scope, username)

        return
      }

      setAccountUsername('')
      setAccountDialog({ repoPath, scope })
    },
    [getHostUsername, applyAccountConfig]
  )

  const confirmAccountDialog = useCallback(async () => {
    if (!accountDialog) {
      return
    }

    const { repoPath, scope } = accountDialog

    setAccountDialog(null)
    await applyAccountConfig(repoPath, scope, accountUsername.trim())
  }, [accountDialog, accountUsername, applyAccountConfig])

  const sortedRepos = useMemo(() => {
    // The GitLab list only carries repos whose remote actually points at
    // gitlab.com — decided per repo once its syncInfo (remote URL) arrives.
    const pool = host === 'gitlab' ? repos.filter(repo => repoSyncInfo[repo.root]?.gitlabUrl) : [...repos]
    const copy = [...pool]

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()

      return copy
        .filter(repo => repo.label.toLowerCase().includes(query) || repo.root.toLowerCase().includes(query))
        .sort((a, b) => a.label.localeCompare(b.label))
    }

    copy.sort((a, b) => {
      if (sortMode === 'name') {
        return a.label.localeCompare(b.label)
      }

      const left = repoSyncInfo[a.root]?.lastCommitAt ?? null
      const right = repoSyncInfo[b.root]?.lastCommitAt ?? null

      if (left !== null && right !== null) {
        return right - left || a.label.localeCompare(b.label)
      }

      if (left !== null) {
        return -1
      }

      if (right !== null) {
        return 1
      }

      return a.label.localeCompare(b.label)
    })

    return copy
  }, [host, repos, repoSyncInfo, sortMode, searchQuery])

  // While any repo's remote is still unresolved, the GitLab filter can't trust
  // an empty list — show a loader instead of a false "no repositories".
  const resolvingRepos = host === 'gitlab' && repos.some(repo => !syncSettled[repo.root])

  const refresh = useCallback(async () => {
    const git = desktopGit()

    if (!git?.scanRepos) {
      setRepos([])
      setRepoSyncInfo({})
      setRepoConfigs({})
      setSyncSettled({})
      setScanningRepos(false)
      setHasScanned(true)

      return
    }

    setScanningRepos(true)
    setHasScanned(false)

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Repo scan timed out')), 60_000)
      })

      const found = await Promise.race([git.scanRepos(roots), timeoutPromise])
      setRepos(found)
      setRepoSyncInfo({})
      setRepoConfigs({})
      setSyncSettled({})

      const generation = ++scanGeneration.current

      for (const repo of found) {
        void (async () => {
          const info = git.syncInfo ? await git.syncInfo(repo.root).catch(() => null) : null

          if (generation !== scanGeneration.current) {
            return
          }

          if (info) {
            setRepoSyncInfo(prev => ({ ...prev, [repo.root]: info }))
          }

          setSyncSettled(prev => ({ ...prev, [repo.root]: true }))
        })()

        void fetchRepoConfig(repo.root)
      }
    } catch {
      setRepos([])
      setRepoSyncInfo({})
      setRepoConfigs({})
      setSyncSettled({})
    } finally {
      clearTimeout(timeoutId)
      setScanningRepos(false)
      setHasScanned(true)
    }
  }, [roots, fetchRepoConfig])

  const refreshSyncInfo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.syncInfo) {
        return
      }

      const info = await git.syncInfo(root).catch(() => null)

      setRepoSyncInfo(prev => {
        const next = { ...prev }

        if (info) {
          next[root] = info
        } else {
          delete next[root]
        }

        return next
      })

      setSyncSettled(prev => ({ ...prev, [root]: true }))

      await fetchRepoConfig(root)
    },
    [fetchRepoConfig]
  )

  // A failed sync leaves the repo in one of three states that block a retry:
  // unresolved conflicts, an interrupted merge, or local uncommitted changes
  // the merge would overwrite (git aborts pre-merge, so no markers are written
  // and `conflicted` stays false). All three need a decision the agent chat can
  // make; pure network/auth failures leave the tree clean and are not its job.
  // Merge conflict markers in source files also cause Vite parse errors in dev
  // mode, so auto-resolving via a Hermes Agent chat removes them.
  const resolveConflictsIfNeeded = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.syncInfo) {
        return
      }

      const info = await git.syncInfo(root).catch(() => null)

      if (info?.conflicted || info?.mergeInProgress) {
        void requestStartWorkSession(root, t.settings.gitHub.resolveConflictsWithAgentPrompt, { autoSubmit: true })

        return
      }

      let status: HermesRepoStatus | null = null

      if (git.repoStatus) {
        try {
          status = (await git.repoStatus(root)) ?? null
        } catch {
          status = null
        }
      }

      if (status && status.changed > 0) {
        void requestStartWorkSession(root, t.settings.gitHub.resolveConflictsWithAgentPrompt, { autoSubmit: true })
      }
    },
    [t]
  )

  const pullRepo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.pull) {
        return
      }

      setPullingRepo(root)

      try {
        await git.pull(root)
        notify({ kind: 'success', message: tr.updatedFromOrigin })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, tr.pullFailed).message })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
        void resolveConflictsIfNeeded(root)
      } finally {
        setPullingRepo(null)
      }
    },
    [refreshSyncInfo, resolveConflictsIfNeeded, t]
  )

  const syncForkRepo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.syncFork) {
        return
      }

      setSyncingRepo(root)

      try {
        await git.syncFork(root)
        notify({ kind: 'success', message: tr.forkSynced })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, tr.syncForkFailed).message })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
        void resolveConflictsIfNeeded(root)
      } finally {
        setSyncingRepo(null)
      }
    },
    [refreshSyncInfo, resolveConflictsIfNeeded, t]
  )

  const pushRepo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.push) {
        return
      }

      setPushingRepo(root)

      try {
        await git.push(root)
        notify({ kind: 'success', message: tr.pushedToOrigin })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, tr.pushFailed).message })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } finally {
        setPushingRepo(null)
      }
    },
    [refreshSyncInfo, t]
  )

  const continueMergeRepo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.continueMerge) {
        return
      }

      setContinuingMergeRepo(root)

      try {
        await git.continueMerge(root)
        notify({ kind: 'success', message: tr.mergeCompleted })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, tr.continueFailed).message })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } finally {
        setContinuingMergeRepo(null)
      }
    },
    [refreshSyncInfo, t]
  )

  const openRepoFolder = useCallback(
    async (root: string) => {
      const result = await window.hermesDesktop?.openDir?.(root)

      if (result && !result.ok) {
        notify({ kind: 'error', message: result.error || tr.openRepoFolderFailed })
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
        <div className="flex shrink-0 items-center gap-1.5">
          <SegmentedControl
            onChange={setSortMode}
            options={[
              { id: 'name', label: tr.sortByName },
              { id: 'lastCommit', label: tr.sortByLastCommit }
            ]}
            value={sortMode}
          />
          <Tip label={t.common.refresh}>
            <Button
              aria-label={t.common.refresh}
              disabled={scanningRepos}
              onClick={() => void refresh()}
              size="icon-sm"
              variant="ghost"
            >
              {scanningRepos ? (
                <Loader aria-label={tr.scanningRepos} className="size-3.5" strokeScale={0.7} />
              ) : (
                <RefreshCw className={iconSize.sm} />
              )}
            </Button>
          </Tip>
        </div>
      </div>
      {hasScanned && repos.length > 0 && (
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
      {scanningRepos && !hasScanned ? (
        <div className="grid h-64 place-items-center">
          <Loader aria-label={tr.scanningRepos} className="size-8" label={tr.scanningRepos} />
        </div>
      ) : sortedRepos.length === 0 && resolvingRepos ? (
        <div className="grid h-40 place-items-center">
          <Loader aria-label={tr.scanningRepos} className="size-6" label={tr.scanningRepos} />
        </div>
      ) : repos.length === 0 || sortedRepos.length === 0 ? (
        <EmptyState className="min-h-40" title={tr.noReposFound} />
      ) : (
        <div className="h-64 overflow-y-auto">
          <ul className="space-y-1 pr-1">
            {sortedRepos.map(repo => {
              const info = repoSyncInfo[repo.root]
              const repoUrl = host === 'gitlab' ? (info?.gitlabUrl ?? null) : (info?.url ?? null)
              const openOnHostLabel = host === 'gitlab' ? tr.openRepoOnGitLab : tr.openRepoOnGitHub
              const repoConfig = repoConfigs[repo.root]
              const resolvedUser = repoConfig?.local || repoConfig?.global || null

              return (
                <li className="group/repo" key={repo.root}>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-(--ui-bg-tertiary)"
                      disabled={disabled}
                      onClick={() => onSelectRepo(repo.root)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{repo.label}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground truncate">{repo.root}</span>
                        {info?.conflicted ? (
                          <span className="block text-[11px] text-destructive truncate">{tr.branchHasConflicts}</span>
                        ) : info?.mergeInProgress ? (
                          <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                            {tr.allConflictsResolved}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {info && !info.conflicted && !info.mergeInProgress && info.behind > 0 ? (
                          <Badge size="xs" variant="warn">
                            ↓{info.behind}
                          </Badge>
                        ) : null}
                        {info && !info.conflicted && !info.mergeInProgress && info.unpushed > 0 ? (
                          <Badge size="xs" variant="default">
                            ↑{info.unpushed}
                          </Badge>
                        ) : null}
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {info?.lastCommitAt ? formatCommitDate(info.lastCommitAt) : '—'}
                        </span>
                      </span>
                      <span className="w-24 shrink-0 text-right text-xs text-(--ui-accent) opacity-0 transition-opacity group-hover/repo:opacity-100 group-focus-within/repo:opacity-100">
                        {tr.useThisRepo}
                      </span>
                    </button>
                    <Tip label={tr.openRepoFolder}>
                      <Button
                        aria-label={tr.openRepoFolder}
                        disabled={disabled}
                        onClick={() => void openRepoFolder(repo.root)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <FolderOpen className={iconSize.sm} />
                      </Button>
                    </Tip>
                    {repoUrl ? (
                      <Tip label={openOnHostLabel}>
                        <Button
                          aria-label={openOnHostLabel}
                          disabled={disabled}
                          onClick={() => openExternalLink(repoUrl)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <ExternalLink className={iconSize.sm} />
                        </Button>
                      </Tip>
                    ) : null}
                    {info?.conflicted ? (
                      <Button
                        disabled={pullingRepo === repo.root || syncingRepo === repo.root}
                        onClick={() => setConflictRepo(repo.root)}
                        size="xs"
                        variant="secondary"
                      >
                        {tr.resolveConflicts}
                      </Button>
                    ) : info?.mergeInProgress ? (
                      <Button
                        disabled={continuingMergeRepo === repo.root}
                        onClick={() => void continueMergeRepo(repo.root)}
                        size="xs"
                        variant="secondary"
                      >
                        {continuingMergeRepo === repo.root ? t.common.loading : tr.continueMerge}
                      </Button>
                    ) : (
                      <>
                        {info && info.remote === 'upstream' && info.behind > 0 ? (
                          <Button
                            disabled={pullingRepo === repo.root || syncingRepo === repo.root}
                            onClick={() => void syncForkRepo(repo.root)}
                            size="xs"
                            variant="secondary"
                          >
                            {syncingRepo === repo.root ? tr.syncingFork : tr.syncFork(info.behind)}
                          </Button>
                        ) : null}
                        {info && info.behind > 0 ? (
                          <Button
                            disabled={pullingRepo === repo.root || syncingRepo === repo.root}
                            onClick={() => void pullRepo(repo.root)}
                            size="xs"
                            variant="secondary"
                          >
                            {pullingRepo === repo.root ? tr.pulling : tr.pullFromOrigin(info.behind)}
                          </Button>
                        ) : null}
                        {info && info.unpushed > 0 ? (
                          <Button
                            disabled={
                              pullingRepo === repo.root || syncingRepo === repo.root || pushingRepo === repo.root
                            }
                            onClick={() => void pushRepo(repo.root)}
                            size="xs"
                            variant="secondary"
                          >
                            {pushingRepo === repo.root ? tr.pushing : tr.pushToOrigin(info.unpushed)}
                          </Button>
                        ) : null}
                      </>
                    )}
                    <Tip label={tr.refreshSync}>
                      <Button
                        aria-label={tr.refreshSync}
                        disabled={disabled}
                        onClick={() => void refreshSyncInfo(repo.root)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <RefreshCw className={iconSize.sm} />
                      </Button>
                    </Tip>
                    {resolvedUser ? (
                      <Badge size="xs" variant="outline">
                        {resolvedUser}
                      </Badge>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label={tr.configGlobal} disabled={disabled} size="icon-sm" variant="ghost">
                          <MoreVertical className={iconSize.sm} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          disabled={disabled}
                          onSelect={() => void requestAccountConfig(repo.root, 'global')}
                        >
                          {tr.configGlobal}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={disabled}
                          onSelect={() => void requestAccountConfig(repo.root, 'local')}
                        >
                          {tr.configLocal}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {conflictRepo ? (
        <ConflictResolverDialog
          ahead={repoSyncInfo[conflictRepo]?.ahead ?? 0}
          behind={repoSyncInfo[conflictRepo]?.behind ?? 0}
          onClose={() => setConflictRepo(null)}
          onResolved={() => {
            void refreshSyncInfo(conflictRepo)
            void refreshRepoStatus(conflictRepo)
            void resolveConflictsIfNeeded(conflictRepo)
          }}
          open
          repoRoot={conflictRepo}
        />
      ) : null}
      <Dialog
        onOpenChange={open => {
          if (!open) {
            setAccountDialog(null)
          }
        }}
        open={accountDialog !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr.setAccountTitle}</DialogTitle>
            <DialogDescription>{tr.setAccountHint}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label={tr.usernameLabel}
            autoFocus
            onChange={event => setAccountUsername(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void confirmAccountDialog()
              }
            }}
            placeholder={tr.usernameLabel}
            value={accountUsername}
          />
          <DialogFooter>
            <Button onClick={() => setAccountDialog(null)} size="sm" variant="text">
              {t.common.cancel}
            </Button>
            <Button disabled={!accountUsername.trim()} onClick={() => void confirmAccountDialog()} size="sm">
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
