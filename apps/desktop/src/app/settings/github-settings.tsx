import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { HermesGitHubProfile } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'

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
    </div>
  )
}