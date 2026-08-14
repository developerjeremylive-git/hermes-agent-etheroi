import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { HermesGitHubProfile } from '@/global'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { desktopGit } from '@/lib/desktop-git'
import { notify, readableError } from '@/store/notifications'
import { applyConfiguredGitWorkdir, commitWorkspaceCwdForSelectedSession } from '@/store/session'

type GitHubSettingsProps = {
  activeView: string
}

type LoginState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; code: string; url: string }
  | { phase: 'failed'; error?: string }

export function GitHubSettings({ activeView }: GitHubSettingsProps) {
  const { t } = useI18n()

  const isGitHubView = activeView === 'github' || activeView === 'config:github'

  const [profile, setProfile] = useState<HermesGitHubProfile | null>(null)
  const [login, setLogin] = useState<LoginState>({ phase: 'idle' })
  const [copied, setCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  const refreshProfile = useCallback(() => {
    void desktopGit()
      ?.ghProfile?.()
      .then(result => {
        setProfile(result ?? { ok: false, login: '', name: null, avatarUrl: null })
      })
  }, [])

  useEffect(() => {
    if (!isGitHubView) {
      return
    }

    let cancelled = false

    void desktopGit()
      ?.ghProfile?.()
      .then(result => {
        if (!cancelled) {
          setProfile(result ?? { ok: false, login: '', name: null, avatarUrl: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [isGitHubView])

  useEffect(() => {
    if (!isGitHubView || login.phase !== 'waiting') {
      return
    }

    return desktopGit()?.onGhLoginEvent?.(payload => {
      if (payload.ok) {
        setLogin({ phase: 'idle' })
        refreshProfile()
      } else {
        setLogin({ phase: 'failed' })
      }
    })
  }, [isGitHubView, login.phase, refreshProfile])

  const startLogin = useCallback(async () => {
    setLogin({ phase: 'starting' })

    const started = await desktopGit()?.ghLoginStart?.()

    if (!started) {
      setLogin({ phase: 'failed' })

      return
    }

    if (started.error) {
      setLogin({ phase: 'failed', error: started.error })

      return
    }

    setLogin({ phase: 'waiting', code: started.code, url: started.url })
  }, [])

  const cancelLogin = useCallback(() => {
    void desktopGit()?.ghLoginCancel?.()
    setLogin({ phase: 'idle' })
  }, [])

  const openLoginBrowser = useCallback((url: string) => {
    void window.hermesDesktop?.openExternal?.(url)
  }, [])

  const copyLoginCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — the code stays selectable text
    }
  }, [])

  const copyLoginUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    } catch {
      // clipboard unavailable — the URL stays selectable text
    }
  }, [])

  const logout = useCallback(async () => {
    setLoggingOut(true)
    setLogoutFailed(false)

    const result = await desktopGit()?.ghLogout?.(profile?.login ?? '')

    if (result?.ok) {
      refreshProfile()
    } else {
      setLogoutFailed(true)
    }

    setLoggingOut(false)
  }, [profile, refreshProfile])

  const [workdir, setWorkdir] = useState('')
  const [repos, setRepos] = useState<{ root: string; label: string }[]>([])
  const [repoSyncInfo, setRepoSyncInfo] = useState<Record<string, { behind: number }>>({})
  const [scanningRepos, setScanningRepos] = useState(false)
  const [pullingRepo, setPullingRepo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [workdirError, setWorkdirError] = useState('')
  const scanGeneration = useRef(0)

  const refreshWorkdir = useCallback(() => {
    const git = desktopGit()

    if (!git?.workdir?.get) {
      return
    }

    void git.workdir.get().then(result => setWorkdir(result.dir?.trim() || ''))
  }, [])

  useEffect(() => {
    if (!isGitHubView) {
      return
    }

    refreshWorkdir()
  }, [isGitHubView, refreshWorkdir])

  const commitWorkdir = useCallback(
    (root: string) => {
      applyConfiguredGitWorkdir(root)
      commitWorkspaceCwdForSelectedSession(root)
      notify({ kind: 'success', message: t.settings.gitHub.workingFolderUpdated })
    },
    [t]
  )

  const chooseWorkdir = useCallback(async () => {
    const git = desktopGit()

    if (!git?.workdir?.pick || !git?.workdir?.set) {
      return
    }

    const picked = await git.workdir.pick()

    if (picked.canceled || !picked.dir) {
      return
    }

    setBusy(true)

    try {
      const { root } = await git.workdir.set(picked.dir)
      setWorkdir(root)
      setWorkdirError('')
      commitWorkdir(root)
    } catch (error) {
      setWorkdirError(readableError(error, t.settings.gitHub.notInsideRepo).message)
    } finally {
      setBusy(false)
    }
  }, [t, commitWorkdir])

  const createRepo = useCallback(async () => {
    const git = desktopGit()

    if (!git?.workdir?.pick || !git?.gitInit) {
      return
    }

    const picked = await git.workdir.pick()

    if (picked.canceled || !picked.dir) {
      return
    }

    setBusy(true)

    try {
      const { root } = await git.gitInit(picked.dir)
      setWorkdir(root)
      setWorkdirError('')
      commitWorkdir(root)
    } catch (error) {
      setWorkdirError(readableError(error, t.settings.gitHub.createRepoFailed).message)
    } finally {
      setBusy(false)
    }
  }, [t, commitWorkdir])

  const clearWorkdir = useCallback(async () => {
    const git = desktopGit()

    if (!git?.workdir?.clear) {
      return
    }

    await git.workdir.clear()
    applyConfiguredGitWorkdir(null)
    setWorkdir('')
  }, [])

  const scanLocalRepos = useCallback(async () => {
    const git = desktopGit()

    if (!git?.scanRepos) {
      return
    }

    setScanningRepos(true)

    try {
      const found = await git.scanRepos([])
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
  }, [])

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

        // The folder now has origin/main — refresh the count so the pull
        // button stops showing missing commits (it hides once behind is 0).
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

  const selectRepo = useCallback(
    async (root: string) => {
      const git = desktopGit()

      if (!git?.workdir?.set) {
        return
      }

      setBusy(true)

      try {
        const { root: selected } = await git.workdir.set(root)
        setWorkdir(selected)
        setWorkdirError('')
        commitWorkdir(selected)
      } catch (error) {
        setWorkdirError(readableError(error, t.settings.gitHub.notInsideRepo).message)
      } finally {
        setBusy(false)
      }
    },
    [t, commitWorkdir]
  )

  if (!isGitHubView) {
    return null
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-medium mb-4">{t.settings.gitHub.title}</h2>

      {profile === null ? null : profile.ok ? (
        <div className="bg-(--ui-bg-secondary) rounded-md p-4 flex items-center gap-3">
          {profile.avatarUrl ? (
            <img alt="" className="size-9 rounded-full" src={profile.avatarUrl} />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--ui-bg-quaternary) font-semibold text-sm">
              {profile.login.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile.name || profile.login}</p>
            <p className="text-xs text-muted-foreground truncate">@{profile.login}</p>
          </div>
          {logoutFailed && <p className="text-xs text-(--ui-danger)">{t.common.error}</p>}
          <Button disabled={loggingOut} onClick={() => void logout()} size="sm" variant="ghost">
            {t.settings.gitHub.logout}
          </Button>
        </div>
      ) : login.phase === 'starting' || login.phase === 'waiting' ? (
        <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
          <p className="text-sm font-medium">
            {login.phase === 'starting' ? t.settings.gitHub.loginStarting : t.settings.gitHub.waiting}
          </p>
          {login.phase === 'waiting' && (
            <>
              <div className="flex items-center gap-3">
                <code className="font-mono text-lg tracking-widest">{login.code}</code>
                <button
                  className="text-xs text-muted-foreground underline"
                  onClick={() => void copyLoginCode(login.code)}
                  type="button"
                >
                  {copied ? t.common.copied : t.common.copy}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t.settings.gitHub.enterCode}</p>
              <div className="rounded-md bg-(--ui-bg-tertiary) p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t.settings.gitHub.loginUrlHint}</p>
                <div className="flex items-center gap-3">
                  <a
                    className="font-mono text-xs text-(--ui-accent) underline truncate"
                    href={login.url}
                    onClick={event => {
                      event.preventDefault()
                      openLoginBrowser(login.url)
                    }}
                  >
                    {login.url}
                  </a>
                  <button
                    className="text-xs text-muted-foreground underline shrink-0"
                    onClick={() => void copyLoginUrl(login.url)}
                    type="button"
                  >
                    {urlCopied ? t.common.copied : t.common.copy}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => openLoginBrowser(login.url)} size="sm">
                  {t.settings.gitHub.openBrowser}
                </Button>
                <Button onClick={cancelLogin} size="sm" variant="ghost">
                  {t.common.cancel}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
          <p className="text-sm font-medium">{t.settings.gitHub.notConnected}</p>
          <p className="text-xs text-muted-foreground">{t.settings.gitHub.connectHint}</p>
          {login.phase === 'failed' && (
            <>
              <p className="text-xs text-(--ui-danger)">{t.settings.gitHub.failed}</p>
              {login.error && <p className="font-mono text-[11px] text-muted-foreground break-all">{login.error}</p>}
            </>
          )}
          <Button onClick={() => void startLogin()} size="sm">
            {t.common.connect}
          </Button>
        </div>
      )}

      {!isDesktopFsRemoteMode() && (
        <>
          <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.settings.gitHub.workingFolder}</p>
                <p className="text-xs text-muted-foreground">{t.settings.gitHub.workingFolderHint}</p>
              </div>
              {workdir ? (
                <Button disabled={busy} onClick={() => void clearWorkdir()} size="sm" variant="ghost">
                  {t.common.clear}
                </Button>
              ) : null}
            </div>
            <p className="font-mono text-xs text-muted-foreground break-all">
              {workdir || t.settings.gitHub.noWorkingFolder}
            </p>
            {workdirError && <p className="text-xs text-(--ui-danger)">{workdirError}</p>}
            <div className="flex items-center gap-2">
              <Button disabled={busy} onClick={() => void chooseWorkdir()} size="sm">
                {t.settings.gitHub.chooseWorkingFolder}
              </Button>
              <Button disabled={busy} onClick={() => void createRepo()} size="sm" variant="ghost">
                {t.settings.gitHub.createRepo}
              </Button>
            </div>
          </div>

          <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.settings.gitHub.localRepositories}</p>
                <p className="text-xs text-muted-foreground">{t.settings.gitHub.localRepositoriesHint}</p>
              </div>
              <Button disabled={scanningRepos} onClick={() => void scanLocalRepos()} size="sm" variant="ghost">
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
                            disabled={busy}
                            onClick={() => void selectRepo(repo.root)}
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
        </>
      )}
    </div>
  )
}
