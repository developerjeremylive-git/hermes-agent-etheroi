import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Loader } from '@/components/ui/loader'
import type { HermesGitHubProfile } from '@/global'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { desktopGit } from '@/lib/desktop-git'
import { notify, readableError } from '@/store/notifications'
import { applyConfiguredGitWorkdir, commitWorkspaceCwdForSelectedSession } from '@/store/session'

import { RemoteRepoBrowser } from './remote-repo-browser'
import { RepoListSection } from './repo-list-section'

// Repos folder on the J: drive, surfaced as its own section below the
// home-directory scan.
const J_AI_PRODUCTS_ROOT = 'J:\\AI_Products'

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
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  const refreshProfile = useCallback(() => {
    void desktopGit()?.ghProfile?.().then(result => {
      setProfile(result ?? { ok: false, login: '', name: null, avatarUrl: null })
    })
  }, [])

  useEffect(() => {
    if (!isGitHubView) {
      return
    }

    let cancelled = false

    void desktopGit()?.ghProfile?.().then(result => {
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

    const git = desktopGit()
    let started: Awaited<ReturnType<NonNullable<typeof git>['ghLoginStart']>> | undefined

    try {
      started = await git?.ghLoginStart?.()
    } catch {
      started = undefined
    }

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
  const [busy, setBusy] = useState(false)
  const [workdirError, setWorkdirError] = useState('')

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
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{profile.name || profile.login}</p>
              <Badge size="xs" variant="default">
                {t.settings.gitHub.connected}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">@{profile.login}</p>
          </div>
          {logoutFailed && <p className="text-xs text-(--ui-danger)">{t.common.error}</p>}
          <Button disabled={loggingOut} onClick={() => void logout()} size="sm" variant="text">
            {t.settings.gitHub.logout}
          </Button>
        </div>
      ) : login.phase === 'starting' || login.phase === 'waiting' ? (
        <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
          {login.phase === 'starting' ? (
            <div className="flex items-center gap-3">
              <Loader aria-label={t.settings.gitHub.loginStarting} className="size-5" />
              <p className="text-sm font-medium">{t.settings.gitHub.loginStarting}</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">{t.settings.gitHub.waiting}</p>
              <div className="flex items-center gap-3">
                <code className="font-mono text-lg tracking-widest">{login.code}</code>
                <CopyButton appearance="inline" text={login.code} />
              </div>
              <p className="text-xs text-muted-foreground">{t.settings.gitHub.enterCode}</p>
              <div className="space-y-2 border-t border-(--ui-stroke-tertiary) pt-3">
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
                  <CopyButton appearance="inline" className="shrink-0" text={login.url} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => openLoginBrowser(login.url)} size="sm">
                  {t.settings.gitHub.openBrowser}
                </Button>
                <Button onClick={cancelLogin} size="sm" variant="text">
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
          <div className="flex items-center gap-2">
            <Button onClick={() => void startLogin()} size="sm">
              {t.common.connect}
            </Button>
            {login.phase === 'failed' && (
              <Button onClick={() => void startLogin()} size="sm" variant="text">
                {t.common.retry}
              </Button>
            )}
          </div>
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
                <Button disabled={busy} onClick={() => void clearWorkdir()} size="sm" variant="text">
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
              <Button disabled={busy} onClick={() => void createRepo()} size="sm" variant="secondary">
                {t.settings.gitHub.createRepo}
              </Button>
            </div>
          </div>

          <RepoListSection
            disabled={busy}
            hint={t.settings.gitHub.localRepositoriesHint}
            onSelectRepo={selectRepo}
            roots={[]}
            title={t.settings.gitHub.localRepositories}
          />
          <RepoListSection
            disabled={busy}
            hint={t.settings.gitHub.jDriveRepositoriesHint}
            onSelectRepo={selectRepo}
            roots={[J_AI_PRODUCTS_ROOT]}
            title={t.settings.gitHub.jDriveRepositories}
          />

          <RemoteRepoBrowser disabled={busy} host="github" />
        </>
      )}
    </div>
  )
}
