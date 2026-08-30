import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { HermesRemoteRepo } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { ChevronLeft, Clock, FolderOpen, GitBranch, Home, MessageSquareText } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $projectsRpcAvailable, $projectTree, $projectTreeLoading, $reposScanning, fetchProjectSessions, refreshProjectTree, scanAndRecordRepos } from '@/store/projects'
import { focusOpenSession, openSessionTile } from '@/store/session-states'
import type { SessionInfo } from '@/types/hermes'

import { CloneDialog } from './clone-dialog'

export type GitSettingsTab = 'connection' | 'projects' | 'repositories'

export type GitProvider = 'github' | 'gitlab'

/** Top tab strip shared by the GitHub and GitLab settings pages: the existing
 *  connection/setup surface and the new Projects matrix view. */
export function GitSettingsTabs({
  onTabChange,
  tab,
}: {
  onTabChange: (tab: GitSettingsTab) => void
  tab: GitSettingsTab
}) {
  const { t } = useI18n()

  return (
    <Tabs
      onValueChange={value => onTabChange(value as GitSettingsTab)}
      value={tab}
    >
      <TabsList>
        <TabsTrigger value="connection">{t.settings.gitProjects.tabConnection}</TabsTrigger>
        <TabsTrigger value="projects">{t.settings.gitProjects.tabProjects}</TabsTrigger>
        <TabsTrigger value="repositories">{t.settings.gitProjects.tabRepositories}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/** All chat rows under a project, flattened across repo/worktree lanes,
 *  deduped, newest activity first. Same rows the sidebar would render. */
function flattenProjectSessions(project: SidebarProjectTree): SessionInfo[] {
  const byId = new Map<string, SessionInfo>()

  for (const repo of project.repos) {
    for (const group of repo.groups) {
      for (const session of group.sessions) {
        if (!byId.has(session.id)) {
          byId.set(session.id, session)
        }
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.last_active - a.last_active)
}

function formatActivity(timestamp: number): string {
  if (!timestamp) {
    return ''
  }

  const date = new Date(timestamp * 1000)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()

  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Path-based project categorization
// ---------------------------------------------------------------------------

type ProjectCategory = 'home' | 'c-drive' | 'j-ai-products' | 'other'

function categorizeProject(project: SidebarProjectTree): ProjectCategory {
  if (project.isNoProject || !project.path) {
    return 'home'
  }

  const normalized = project.path.replace(/[/\\]+$/, '')

  // C: drive — any path starting with C:\ or c:\
  if (/^[Cc]:[/\\]/.test(normalized)) {
    return 'c-drive'
  }

  // J:\AI_Products tree
  if (/^[Jj]:[/\\]AI_Products/i.test(normalized)) {
    return 'j-ai-products'
  }

  return 'other'
}

interface ProjectCategoryGroup {
  key: ProjectCategory
  label: string
  projects: SidebarProjectTree[]
}

function groupProjectsByCategory(
  projects: SidebarProjectTree[],
  t: ReturnType<typeof useI18n>['t'],
  showEmptyCategories = false
): ProjectCategoryGroup[] {
  const buckets: Record<ProjectCategory, SidebarProjectTree[]> = {
    home: [],
    'c-drive': [],
    'j-ai-products': [],
    other: []
  }

  for (const project of projects) {
    buckets[categorizeProject(project)].push(project)
  }

  const groups: ProjectCategoryGroup[] = []

  // Home always first
  if (buckets.home.length > 0) {
    groups.push({ key: 'home', label: t.settings.gitProjects.categoryHome, projects: buckets.home })
  }

  if (showEmptyCategories || buckets['c-drive'].length > 0) {
    groups.push({ key: 'c-drive', label: t.settings.gitProjects.categoryCDrive, projects: buckets['c-drive'] })
  }

  if (showEmptyCategories || buckets['j-ai-products'].length > 0) {
    groups.push({
      key: 'j-ai-products',
      label: t.settings.gitProjects.categoryJDrive,
      projects: buckets['j-ai-products']
    })
  }

  if (buckets.other.length > 0) {
    groups.push({ key: 'other', label: t.settings.gitProjects.categoryOther, projects: buckets.other })
  }

  return groups
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function ProjectCard({ onSelect, project }: { onSelect: (project: SidebarProjectTree) => void; project: SidebarProjectTree }) {
  const { t } = useI18n()
  const isHome = project.isNoProject

  const githubRepos = project.repos.filter(r => r.gitProvider === 'github')
  const gitlabRepos = project.repos.filter(r => r.gitProvider === 'gitlab')
  const otherRepos = project.repos.filter(r => r.gitProvider === 'other' || !r.gitProvider)

  return (
    <button
      className={cn(
        'group flex flex-col gap-2 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-secondary)',
        'p-4 text-left transition-colors hover:border-(--ui-accent)/50 hover:bg-(--ui-bg-tertiary)',
        'focus-visible:outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-ring/35'
      )}
      onClick={() => onSelect(project)}
      type="button"
    >
      <div className="flex items-center gap-2">
        {isHome ? (
          <Home className="size-4 shrink-0 text-muted-foreground" />
        ) : project.color ? (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
        ) : (
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.label}</span>
        <Badge size="xs" variant="default">
          {project.sessionCount}
        </Badge>
      </div>
      {project.path && (
        <p className="font-mono text-[11px] text-muted-foreground truncate">{project.path}</p>
      )}
      {!isHome && project.repos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {githubRepos.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-(--ui-bg-tertiary) px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <GitBranch className="size-3" />
              {githubRepos.length} GitHub
            </span>
          )}
          {gitlabRepos.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-(--ui-bg-tertiary) px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <GitBranch className="size-3" />
              {gitlabRepos.length} GitLab
            </span>
          )}
          {otherRepos.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-(--ui-bg-tertiary) px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <GitBranch className="size-3" />
              {otherRepos.length} Other
            </span>
          )}
        </div>
      )}
      <div className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageSquareText className="size-3" />
        {t.settings.gitProjects.chatsCount(project.sessionCount)}
        {project.lastActive ? (
          <>
            <span aria-hidden>·</span>
            <Clock className="size-3" />
            {formatActivity(project.lastActive)}
          </>
        ) : null}
      </div>
    </button>
  )
}

function ChatCard({ onSelect, session }: { onSelect: (session: SessionInfo) => void; session: SessionInfo }) {
  return (
    <button
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-secondary)',
        'p-3.5 text-left transition-colors hover:border-(--ui-accent)/50 hover:bg-(--ui-bg-tertiary)',
        'focus-visible:outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-ring/35'
      )}
      onClick={() => onSelect(session)}
      type="button"
    >
      <span className="line-clamp-2 text-sm font-medium">
        {session.title || session.preview || session.id}
      </span>
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {session.git_branch && (
          <span className="font-mono truncate">{session.git_branch}</span>
        )}
        <span aria-hidden>·</span>
        <MessageSquareText className="size-3 shrink-0" />
        {session.message_count}
        <span className="ml-auto whitespace-nowrap">
          {formatActivity(session.last_active)}
        </span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Remote repo card
// ---------------------------------------------------------------------------

function RemoteRepoCard({
  host,
  repo,
  onClone,
}: {
  host: 'github' | 'gitlab'
  repo: HermesRemoteRepo
  onClone: (repo: HermesRemoteRepo) => void
}) {
  const { t } = useI18n()
  const tr = host === 'gitlab' ? t.settings.gitLab : t.settings.gitHub

  return (
    <div
      className={cn(
        'group flex flex-col gap-2 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-secondary)',
        'p-4 text-left transition-colors hover:border-(--ui-accent)/50 hover:bg-(--ui-bg-tertiary)'
      )}
    >
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{repo.name}</span>
        {repo.isPrivate && (
          <span className="text-[10px] text-muted-foreground">(private)</span>
        )}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground truncate">{repo.fullName}</p>
      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{repo.description}</p>
      )}
      <div className="mt-auto">
        <Button onClick={() => onClone(repo)} size="sm" variant="secondary" className="w-full">
          {tr.clone}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

/** The Projects matrix: one card per project that owns chats (same data as the
 *  sidebar's grouped view); selecting a card drills into its chat list, and
 *  selecting a chat opens it exactly like a sidebar click. */
export function GitProjectsView({
  onClose,
  provider
}: {
  onClose?: () => void
  provider?: GitProvider
} = {}) {
  const { t } = useI18n()

  const tree = useStore($projectTree)
  const treeLoading = useStore($projectTreeLoading)
  const rpcAvailable = useStore($projectsRpcAvailable)
  const reposScanning = useStore($reposScanning)

  const [selected, setSelected] = useState<SidebarProjectTree | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const [remoteRepos, setRemoteRepos] = useState<HermesRemoteRepo[]>([])
  const [remoteReposLoading, setRemoteReposLoading] = useState(false)
  const [remoteReposLoaded, setRemoteReposLoaded] = useState(false)
  const [cloneRepo, setCloneRepo] = useState<HermesRemoteRepo | null>(null)
  const [emptyProjectsMode, setEmptyProjectsMode] = useState<'local' | 'ai' | null>(null)

  useEffect(() => {
    const init = async () => {
      await refreshProjectTree()
      await scanAndRecordRepos()
    }
    void init()
  }, [])

  useEffect(() => {
    if (!provider) {
      return
    }

    const fetchRemoteRepos = async () => {
      const git = desktopGit()
      const listFn = provider === 'gitlab' ? git?.glListRepos : git?.ghListRepos

      if (!listFn) {
        return
      }

      setRemoteReposLoading(true)
      setRemoteReposLoaded(false)

      try {
        const result = await listFn()
        setRemoteRepos(result.repos || [])
        setRemoteReposLoaded(true)
      } catch {
        setRemoteRepos([])
        setRemoteReposLoaded(true)
      } finally {
        setRemoteReposLoading(false)
      }
    }

    void fetchRemoteRepos()
  }, [provider])

  const scanRoots = useMemo(() => {
    if (emptyProjectsMode === 'local') {
      return ['C:\\']
    }

    if (emptyProjectsMode === 'ai') {
      return ['J:\\AI_Products']
    }

    return []
  }, [emptyProjectsMode])

  useEffect(() => {
    if (!provider || scanRoots.length === 0) {
      return
    }

    const trigger = async () => {
      await scanAndRecordRepos(true, scanRoots)
    }

    void trigger()
  }, [provider, scanRoots])

  const openProject = (project: SidebarProjectTree) => {
    setSelected(project)
    setSessions(null)
    setSessionsLoading(true)

    void fetchProjectSessions(project.id).then(full => {
      const source = full ?? project

      setSessions(flattenProjectSessions(source))
      setSessionsLoading(false)
    })
  }

  const openChat = useCallback(
    (session: SessionInfo) => {
      openSessionTile(session.id, 'center')
      focusOpenSession(session.id)
      onClose?.()
    },
    [onClose]
  )

  const categorized = useMemo(() => {
    const filtered: SidebarProjectTree[] = []

    for (const project of tree) {
      const isCLocal = Boolean(project.path && /^[Cc]:[/\\]/.test(project.path))
      const isAIProducts = Boolean(project.path && /^[Jj]:[/\\]AI_Products/i.test(project.path))

      if (isCLocal || isAIProducts) {
        if (project.sessionCount > 0) {
          filtered.push(project)
          continue
        }

        if (emptyProjectsMode === 'local' && isCLocal) {
          filtered.push(project)
          continue
        }

        if (emptyProjectsMode === 'ai' && isAIProducts) {
          filtered.push(project)
          continue
        }

        continue
      }

      if (provider) {
        const matchesProvider = project.repos.some(repo => repo.gitProvider === provider)
        if (matchesProvider) {
          filtered.push(project)
          continue
        }
      }

      const matchesProvider = project.repos.some(repo =>
        repo.gitProvider === 'github' || repo.gitProvider === 'gitlab'
      )

      if (matchesProvider) {
        filtered.push(project)
        continue
      }

      if (project.sessionCount > 0) {
        filtered.push(project)
        continue
      }
    }

    console.log('[git-projects-view] categorized', {
      provider,
      emptyProjectsMode,
      treeLength: tree.length,
      filteredLength: filtered.length,
      filtered: filtered.map(project => ({
        id: project.id,
        label: project.label,
        path: project.path,
        sessionCount: project.sessionCount,
        repoCount: project.repos.length,
        isCLocal: Boolean(project.path && /^[Cc]:[/\\]/.test(project.path)),
        isAIProducts: Boolean(project.path && /^[Jj]:[/\\]AI_Products/i.test(project.path)),
        repos: project.repos.map(repo => ({ id: repo.id, gitProvider: repo.gitProvider }))
      }))
    })

    return groupProjectsByCategory(filtered, t, true)
  }, [tree, t, provider, emptyProjectsMode])

  // Only block on loading when the project tree is still in flight.
  const treeStillLoading = treeLoading && tree.length === 0
  const scanStillLoading = reposScanning
  const showEmptyLoading =
    emptyProjectsMode !== null && (scanStillLoading || treeStillLoading)

  console.log('[git-projects-view] render', {
    treeLoading,
    treeLength: tree.length,
    remoteReposLoading,
    remoteReposLoaded,
    remoteReposLength: remoteRepos.length,
    rpcAvailable,
    treeStillLoading,
    scanStillLoading,
    provider,
    selected: selected?.id ?? null,
    categorizedLength: categorized.length,
    emptyProjectsMode,
  })

  if (rpcAvailable === false) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{t.settings.gitProjects.projectsUnavailable}</p>
      </div>
    )
  }

  // Drill-in: show sessions for a selected project
  if (selected) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button onClick={() => setSelected(null)} size="icon" variant="ghost">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-medium">{selected.label}</h2>
            {selected.path && (
              <p className="font-mono text-[11px] text-muted-foreground truncate">{selected.path}</p>
            )}
          </div>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center gap-3 py-8">
            <Loader aria-label={t.settings.gitProjects.loading} className="size-5" />
            <p className="text-sm text-muted-foreground">{t.settings.gitProjects.loading}</p>
          </div>
        ) : sessions && sessions.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground">{t.settings.gitProjects.chats}</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {sessions.map(session => (
                <ChatCard key={session.id} onSelect={openChat} session={session} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.settings.gitProjects.noChats}</p>
        )}
      </div>
    )
  }

  // Overview: categorized project cards
  return (
    <>
      {showEmptyLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader aria-label={t.settings.gitProjects.loading} className="size-5" />
            <p className="text-sm text-muted-foreground">{t.settings.gitProjects.loading}</p>
          </div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-medium">{t.settings.gitProjects.projectsTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.settings.gitProjects.projectsHint}</p>
        </div>

        {tree.length === 0 && treeStillLoading ? (
          <div className="flex items-center gap-3 py-8">
            <Loader aria-label={t.settings.gitProjects.loading} className="size-5" />
            <p className="text-sm text-muted-foreground">{t.settings.gitProjects.loading}</p>
          </div>
        ) : null}
        {provider ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                checked={emptyProjectsMode === 'local'}
                className="size-4 accent-(--ui-accent)"
                disabled={emptyProjectsMode === 'ai'}
                onChange={event => setEmptyProjectsMode(event.target.checked ? 'local' : null)}
                type="checkbox"
              />
              Show local repos with 0 chats
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                checked={emptyProjectsMode === 'ai'}
                className="size-4 accent-(--ui-accent)"
                disabled={emptyProjectsMode === 'local'}
                onChange={event => setEmptyProjectsMode(event.target.checked ? 'ai' : null)}
                type="checkbox"
              />
              Show AI Products repos with 0 chats
            </label>
          </div>
        ) : null}
        {categorized.length > 0 ? (
          categorized.map(group => {
            if (group.projects.length === 0) {
              return null
            }
            return (
              <section className="space-y-3" key={group.key}>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {group.projects.map(project => (
                    <ProjectCard key={project.id} onSelect={openProject} project={project} />
                  ))}
                </div>
              </section>
            )
          }).filter(Boolean)
        ) : (
          <p className="text-sm text-muted-foreground">{t.settings.gitProjects.noProjects}</p>
        )}

        {provider && (
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {provider === 'gitlab' ? t.settings.gitLab.remoteRepositories : t.settings.gitHub.remoteRepositories}
            </h3>
            {remoteReposLoading && !remoteReposLoaded ? (
              <div className="flex items-center gap-3 py-8">
                <Loader aria-label={t.settings.gitProjects.loading} className="size-5" />
                <p className="text-sm text-muted-foreground">{t.settings.gitProjects.loading}</p>
              </div>
            ) : remoteReposLoaded && remoteRepos.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {remoteRepos.map(repo => (
                  <RemoteRepoCard
                    host={provider}
                    key={repo.id}
                    onClone={setCloneRepo}
                    repo={repo}
                  />
                ))}
              </div>
            ) : remoteReposLoaded ? (
              <p className="text-sm text-muted-foreground">{t.settings.gitProjects.noProjects}</p>
            ) : null}
          </section>
        )}
      </div>
      <CloneDialog
        host={provider ?? 'github'}
        onCloned={() => {
          void refreshProjectTree()
        }}
        onClose={() => setCloneRepo(null)}
        open={cloneRepo !== null}
        repo={cloneRepo}
      />
    </>
  )
}
