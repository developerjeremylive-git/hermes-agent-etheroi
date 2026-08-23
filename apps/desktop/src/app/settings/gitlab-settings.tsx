import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import type { HermesGitLabProfile } from '@/global'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { desktopGit } from '@/lib/desktop-git'
import { openExternalLink } from '@/lib/external-link'
import { notify, readableError } from '@/store/notifications'
import { applyConfiguredGitWorkdir, commitWorkspaceCwdForSelectedSession } from '@/store/session'

import { RemoteRepoBrowser } from './remote-repo-browser'
import { RepoListSection } from './repo-list-section'

// Repos folder on the J: drive, surfaced as its own section below the
// home-directory scan.
const J_AI_PRODUCTS_ROOT = 'J:\\AI_Products'

const GITLAB_TOKEN_URL = 'https://gitlab.com/-/user_settings/personal_access_tokens'

type GitLabSettingsProps = {
  activeView: string
}

export function GitLabSettings({ activeView }: GitLabSettingsProps) {
  const { t } = useI18n()
  const tr = t.settings.gitLab

  const isGitLabView = activeView === 'gitlab' || activeView === 'config:gitlab'

  const [profile, setProfile] = useState<HermesGitLabProfile | null>(null)
  const [tokenDialog, setTokenDialog] = useState(false)
  const [token, setToken] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  const refreshProfile = useCallback(() => {
    void desktopGit()?.glProfile?.().then(result => {
      setProfile(result ?? { ok: false, login: '', name: null, avatarUrl: null })
    })
  }, [])

  useEffect(() => {
    if (!isGitLabView) {
      return
    }

    let cancelled = false

    void desktopGit()?.glProfile?.().then(result => {
      if (!cancelled) {
        setProfile(result ?? { ok: false, login: '', name: null, avatarUrl: null })
      }
    })

    return () => {
      cancelled = true
    }
  }, [isGitLabView])

  // glab has no non-interactive browser login (its prompts need a TTY), so the
  // connect flow signs in with a personal access token instead of a device code.
  const loginWithToken = useCallback(async () => {
    const git = desktopGit()
    const trimmed = token.trim()

    if (!git?.glLoginWithToken || !trimmed) {
      return
    }

    setTokenBusy(true)
    setTokenError('')

    try {
      const result = await git.glLoginWithToken(trimmed)

      if (result.ok) {
        setTokenDialog(false)
        setToken('')
        refreshProfile()
      } else {
        setTokenError(result.error || tr.loginFailed)
      }
    } catch (error) {
      setTokenError(readableError(error, tr.loginFailed).message)
    } finally {
      setTokenBusy(false)
    }
  }, [token, refreshProfile, tr])

  const logout = useCallback(async () => {
    setLoggingOut(true)
    setLogoutFailed(false)

    const result = await desktopGit()?.glLogout?.(profile?.login ?? '')

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
    if (!isGitLabView) {
      return
    }

    refreshWorkdir()
  }, [isGitLabView, refreshWorkdir])

  const commitWorkdir = useCallback(
    (root: string) => {
      applyConfiguredGitWorkdir(root)
      commitWorkspaceCwdForSelectedSession(root)
      notify({ kind: 'success', message: tr.workingFolderUpdated })
    },
    [tr]
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
      setWorkdirError(readableError(error, tr.notInsideRepo).message)
    } finally {
      setBusy(false)
    }
  }, [tr, commitWorkdir])

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
      setWorkdirError(readableError(error, tr.createRepoFailed).message)
    } finally {
      setBusy(false)
    }
  }, [tr, commitWorkdir])

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
        setWorkdirError(readableError(error, tr.notInsideRepo).message)
      } finally {
        setBusy(false)
      }
    },
    [tr, commitWorkdir]
  )

  if (!isGitLabView) {
    return null
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-medium mb-4">{tr.title}</h2>

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
                {tr.connected}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">@{profile.login}</p>
          </div>
          {logoutFailed && <p className="text-xs text-(--ui-danger)">{t.common.error}</p>}
          <Button disabled={loggingOut} onClick={() => void logout()} size="sm" variant="text">
            {tr.logout}
          </Button>
        </div>
      ) : (
        <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
          <p className="text-sm font-medium">{tr.notConnected}</p>
          <p className="text-xs text-muted-foreground">{tr.connectHint}</p>
          <Button onClick={() => setTokenDialog(true)} size="sm">
            {t.common.connect}
          </Button>
        </div>
      )}

      <Dialog
        onOpenChange={open => {
          if (!open) {
            setTokenDialog(false)
          }
        }}
        open={tokenDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr.tokenTitle}</DialogTitle>
            <DialogDescription>{tr.tokenHint}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label={tr.tokenLabel}
            autoFocus
            onChange={event => setToken(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void loginWithToken()
              }
            }}
            placeholder={tr.tokenPlaceholder}
            type="password"
            value={token}
          />
          {tokenError && <p className="text-xs text-(--ui-danger) break-all">{tokenError}</p>}
          <DialogFooter>
            <Button
              onClick={() => openExternalLink(GITLAB_TOKEN_URL)}
              size="sm"
              variant="text"
            >
              {tr.createToken}
            </Button>
            <div className="flex-1" />
            <Button disabled={tokenBusy} onClick={() => setTokenDialog(false)} size="sm" variant="text">
              {t.common.cancel}
            </Button>
            <Button disabled={tokenBusy || !token.trim()} onClick={() => void loginWithToken()} size="sm">
              {tokenBusy ? (
                <Loader aria-label={t.common.connecting} className="size-4" strokeScale={0.7} />
              ) : (
                t.common.connect
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isDesktopFsRemoteMode() && (
        <>
          <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tr.workingFolder}</p>
                <p className="text-xs text-muted-foreground">{tr.workingFolderHint}</p>
              </div>
              {workdir ? (
                <Button disabled={busy} onClick={() => void clearWorkdir()} size="sm" variant="text">
                  {t.common.clear}
                </Button>
              ) : null}
            </div>
            <p className="font-mono text-xs text-muted-foreground break-all">
              {workdir || tr.noWorkingFolder}
            </p>
            {workdirError && <p className="text-xs text-(--ui-danger)">{workdirError}</p>}
            <div className="flex items-center gap-2">
              <Button disabled={busy} onClick={() => void chooseWorkdir()} size="sm">
                {tr.chooseWorkingFolder}
              </Button>
              <Button disabled={busy} onClick={() => void createRepo()} size="sm" variant="secondary">
                {tr.createRepo}
              </Button>
            </div>
          </div>

          <RepoListSection
            disabled={busy}
            hint={tr.localRepositoriesHint}
            host="gitlab"
            onSelectRepo={selectRepo}
            roots={[]}
            title={tr.localRepositories}
          />
          <RepoListSection
            disabled={busy}
            hint={tr.jDriveRepositoriesHint}
            host="gitlab"
            onSelectRepo={selectRepo}
            roots={[J_AI_PRODUCTS_ROOT]}
            title={tr.jDriveRepositories}
          />

          <RemoteRepoBrowser disabled={busy} host="gitlab" />
        </>
      )}
    </div>
  )
}
