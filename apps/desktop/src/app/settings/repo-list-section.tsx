import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Tip } from '@/components/ui/tooltip'
import type { HermesRepoStatus } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, FolderOpen, iconSize, MoreVertical, RefreshCw } from '@/lib/icons'
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

type RepoListSectionProps = {
  roots: string[]
  title: string
  hint: string
  disabled?: boolean
  onSelectRepo: (root: string) => void
}

export function formatCommitDate(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function RepoListSection({ roots, title, hint, disabled, onSelectRepo }: RepoListSectionProps) {
  const { t } = useI18n()

  const [repos, setRepos] = useState<{ root: string; label: string }[]>([])
  const [repoSyncInfo, setRepoSyncInfo] = useState<Record<string, RepoInfo>>({})
  const [repoConfigs, setRepoConfigs] = useState<Record<string, RepoConfig>>({})
  const [scanningRepos, setScanningRepos] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [pullingRepo, setPullingRepo] = useState<null | string>(null)
  const [syncingRepo, setSyncingRepo] = useState<null | string>(null)
  const [pushingRepo, setPushingRepo] = useState<null | string>(null)
  const [continuingMergeRepo, setContinuingMergeRepo] = useState<null | string>(null)
  const [conflictRepo, setConflictRepo] = useState<null | string>(null)
  const [sortMode, setSortMode] = useState<RepoSortMode>('name')
  const [accountDialog, setAccountDialog] = useState<AccountDialogState | null>(null)
  const [accountUsername, setAccountUsername] = useState('')
  const scanGeneration = useRef(0)
  const [scannedRootsKey, setScannedRootsKey] = useState<string | null>(null)

  const getGitHubUsername = useCallback(async (): Promise<string | null> => {
    const git = window.hermesDesktop?.git

    if (!git) {
      return null
    }

    try {
      const profile = await git.ghProfile()

      if (profile.ok && profile.login) {
        return profile.login
      }
    } catch {
      // gh not available or not logged in
    }

    return null
  }, [])

  const fetchRepoConfig = useCallback(async (repoPath: string) => {
    const git = window.hermesDesktop?.git

    if (!git) {
      return
    }

    try {
      const result = await git.configGet(repoPath)

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
  }, [])

  const applyAccountConfig = useCallback(
    async (repoPath: string, scope: 'global' | 'local', username: string) => {
      const git = window.hermesDesktop?.git

      if (!git || !username) {
        return
      }

      const result = await git.configSet(repoPath, scope, username)

      if (result.ok) {
        notify({ kind: 'success', message: t.settings.gitHub.configSetSuccess })
        await fetchRepoConfig(repoPath)
      } else {
        notify({ kind: 'error', message: result.error || t.settings.gitHub.configSetFailed })
      }
    },
    [fetchRepoConfig, t]
  )

  const requestAccountConfig = useCallback(
    async (repoPath: string, scope: 'global' | 'local') => {
      const username = await getGitHubUsername()

      if (username) {
        await applyAccountConfig(repoPath, scope, username)

        return
      }

      setAccountUsername('')
      setAccountDialog({ repoPath, scope })
    },
    [getGitHubUsername, applyAccountConfig]
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
    const copy = [...repos]

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
  }, [repos, repoSyncInfo, sortMode])

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
      setRepoConfigs({})

      const generation = ++scanGeneration.current

      for (const repo of found) {
        void (async () => {
          const info = git.syncInfo ? await git.syncInfo(repo.root).catch(() => null) : null

          if (info && generation === scanGeneration.current) {
            setRepoSyncInfo(prev => ({ ...prev, [repo.root]: info }))
          }
        })()

        void fetchRepoConfig(repo.root)
      }
    } catch {
      setRepos([])
      setRepoSyncInfo({})
      setRepoConfigs({})
    } finally {
      setScanningRepos(false)
      setHasScanned(true)
    }
  }, [roots, fetchRepoConfig])

  // Scan on mount (and when the roots actually change), not only on explicit
  // refresh — a first visit must not read as "no repositories" while unscanned.
  const rootsKey = roots.join('\u0000')

  useEffect(() => {
    if (scannedRootsKey === rootsKey) {
      return
    }

    setScannedRootsKey(rootsKey)
    void refresh()
  }, [rootsKey, scannedRootsKey, refresh])

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
        notify({ kind: 'success', message: t.settings.gitHub.updatedFromOrigin })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, t.settings.gitHub.pullFailed).message })
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
        notify({ kind: 'success', message: t.settings.gitHub.forkSynced })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, t.settings.gitHub.syncForkFailed).message })
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
        notify({ kind: 'success', message: t.settings.gitHub.pushedToOrigin })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, t.settings.gitHub.pushFailed).message })
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
        notify({ kind: 'success', message: t.settings.gitHub.mergeCompleted })
        await refreshSyncInfo(root)
        void refreshRepoStatus(root)
      } catch (error) {
        notify({ kind: 'error', message: readableError(error, t.settings.gitHub.continueFailed).message })
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
        notify({ kind: 'error', message: result.error || t.settings.gitHub.openRepoFolderFailed })
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
              { id: 'name', label: t.settings.gitHub.sortByName },
              { id: 'lastCommit', label: t.settings.gitHub.sortByLastCommit }
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
                <Loader aria-label={t.settings.gitHub.scanningRepos} className="size-3.5" strokeScale={0.7} />
              ) : (
                <RefreshCw className={iconSize.sm} />
              )}
            </Button>
          </Tip>
        </div>
      </div>
      {scanningRepos && !hasScanned ? (
        <div className="grid h-64 place-items-center">
          <Loader aria-label={t.settings.gitHub.scanningRepos} className="size-8" label={t.settings.gitHub.scanningRepos} />
        </div>
      ) : repos.length === 0 ? (
        <EmptyState className="min-h-40" title={t.settings.gitHub.noReposFound} />
      ) : (
        <div className="h-64 overflow-y-auto">
          <ul className="space-y-1 pr-1">
            {sortedRepos.map(repo => {
              const info = repoSyncInfo[repo.root]
              const repoUrl = info?.url ?? null
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
                        <span className="block font-mono text-[11px] text-muted-foreground truncate">
                          {repo.root}
                        </span>
                        {info?.conflicted ? (
                          <span className="block text-[11px] text-destructive truncate">
                            {t.settings.gitHub.branchHasConflicts}
                          </span>
                        ) : info?.mergeInProgress ? (
                          <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                            {t.settings.gitHub.allConflictsResolved}
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
                        {t.settings.gitHub.useThisRepo}
                      </span>
                    </button>
                    <Tip label={t.settings.gitHub.openRepoFolder}>
                      <Button
                        aria-label={t.settings.gitHub.openRepoFolder}
                        disabled={disabled}
                        onClick={() => void openRepoFolder(repo.root)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <FolderOpen className={iconSize.sm} />
                      </Button>
                    </Tip>
                    {repoUrl ? (
                      <Tip label={t.settings.gitHub.openRepoOnGitHub}>
                        <Button
                          aria-label={t.settings.gitHub.openRepoOnGitHub}
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
                        {t.settings.gitHub.resolveConflicts}
                      </Button>
                    ) : info?.mergeInProgress ? (
                      <Button
                        disabled={continuingMergeRepo === repo.root}
                        onClick={() => void continueMergeRepo(repo.root)}
                        size="xs"
                        variant="secondary"
                      >
                        {continuingMergeRepo === repo.root
                          ? t.common.loading
                          : t.settings.gitHub.continueMerge}
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
                            {syncingRepo === repo.root
                              ? t.settings.gitHub.syncingFork
                              : t.settings.gitHub.syncFork(info.behind)}
                          </Button>
                        ) : null}
                        {info && info.behind > 0 ? (
                          <Button
                            disabled={pullingRepo === repo.root || syncingRepo === repo.root}
                            onClick={() => void pullRepo(repo.root)}
                            size="xs"
                            variant="secondary"
                          >
                            {pullingRepo === repo.root
                              ? t.settings.gitHub.pulling
                              : t.settings.gitHub.pullFromOrigin(info.behind)}
                          </Button>
                        ) : null}
                        {info && info.unpushed > 0 ? (
                          <Button
                            disabled={pullingRepo === repo.root || syncingRepo === repo.root || pushingRepo === repo.root}
                            onClick={() => void pushRepo(repo.root)}
                            size="xs"
                            variant="secondary"
                          >
                            {pushingRepo === repo.root
                              ? t.settings.gitHub.pushing
                              : t.settings.gitHub.pushToOrigin(info.unpushed)}
                          </Button>
                        ) : null}
                      </>
                    )}
                    <Tip label={t.settings.gitHub.refreshSync}>
                      <Button
                        aria-label={t.settings.gitHub.refreshSync}
                        disabled={disabled}
                        onClick={() => void refreshSyncInfo(repo.root)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <RefreshCw className={iconSize.sm} />
                      </Button>
                    </Tip>
                    {resolvedUser ? <Badge size="xs" variant="outline">{resolvedUser}</Badge> : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={t.settings.gitHub.configGlobal}
                          disabled={disabled}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <MoreVertical className={iconSize.sm} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          disabled={disabled}
                          onSelect={() => void requestAccountConfig(repo.root, 'global')}
                        >
                          {t.settings.gitHub.configGlobal}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={disabled}
                          onSelect={() => void requestAccountConfig(repo.root, 'local')}
                        >
                          {t.settings.gitHub.configLocal}
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
            <DialogTitle>{t.settings.gitHub.setAccountTitle}</DialogTitle>
            <DialogDescription>{t.settings.gitHub.setAccountHint}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label={t.settings.gitHub.githubUsername}
            autoFocus
            onChange={event => setAccountUsername(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void confirmAccountDialog()
              }
            }}
            placeholder={t.settings.gitHub.githubUsername}
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
