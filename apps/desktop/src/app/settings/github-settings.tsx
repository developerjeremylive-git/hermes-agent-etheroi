import { useEffect, useState } from 'react'

import type { HermesGitHubProfile } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'

type GitHubSettingsProps = {
  activeView: string
}

export function GitHubSettings({ activeView }: GitHubSettingsProps) {
  const { t } = useI18n()

  const isGitHubView = activeView === 'github' || activeView === 'config:github'

  const [profile, setProfile] = useState<HermesGitHubProfile | null>(null)

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
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile.name || profile.login}</p>
            <p className="text-xs text-muted-foreground truncate">@{profile.login}</p>
          </div>
        </div>
      ) : (
        <div className="bg-(--ui-bg-secondary) rounded-md p-4 space-y-1">
          <p className="text-sm font-medium">{t.settings.gitHub.notConnected}</p>
          <p className="text-xs text-muted-foreground">{t.settings.gitHub.connectHint}</p>
        </div>
      )}
    </div>
  )
}