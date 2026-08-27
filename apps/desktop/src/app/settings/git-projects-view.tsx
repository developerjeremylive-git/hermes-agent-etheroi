import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n'
import { ChevronLeft, Clock, FolderOpen, MessageSquareText } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $projectsRpcAvailable, $projectTree, $projectTreeLoading, fetchProjectSessions, refreshProjectTree } from '@/store/projects'
import type { SessionInfo } from '@/types/hermes'

import { openSession } from '../open-session'

export type GitSettingsTab = 'connection' | 'projects'

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

function ProjectCard({ onSelect, project }: { onSelect: (project: SidebarProjectTree) => void; project: SidebarProjectTree }) {
  const { t } = useI18n()

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
        {project.color ? (
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

/** The Projects matrix: one card per project that owns chats (same data as the
 *  sidebar's grouped view); selecting a card drills into its chat list, and
 *  selecting a chat opens it exactly like a sidebar click. */
export function GitProjectsView({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const tree = useStore($projectTree)
  const treeLoading = useStore($projectTreeLoading)
  const rpcAvailable = useStore($projectsRpcAvailable)

  const [selected, setSelected] = useState<SidebarProjectTree | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  useEffect(() => {
    void refreshProjectTree()
  }, [])

  const openProject = (project: SidebarProjectTree) => {
    setSelected(project)
    setSessions(null)
    setSessionsLoading(true)

    void fetchProjectSessions(project.id).then(full => {
      // The full drill-in payload carries hydrated lanes; fall back to the
      // overview preview so the list still renders if the fetch failed.
      const source = full ?? project

      setSessions(flattenProjectSessions(source))
      setSessionsLoading(false)
    })
  }

  const openChat = useCallback(
    (session: SessionInfo) => {
      openSession(session.id, navigate, 'in-place')
    },
    [navigate]
  )

  if (rpcAvailable === false) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{t.settings.gitProjects.projectsUnavailable}</p>
      </div>
    )
  }

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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t.settings.gitProjects.projectsTitle}</h2>
        <p className="text-xs text-muted-foreground">{t.settings.gitProjects.projectsHint}</p>
      </div>

      {treeLoading && tree.length === 0 ? (
        <div className="flex items-center gap-3 py-8">
          <Loader aria-label={t.settings.gitProjects.loading} className="size-5" />
          <p className="text-sm text-muted-foreground">{t.settings.gitProjects.loading}</p>
        </div>
      ) : tree.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {tree.map(project => (
            <ProjectCard key={project.id} onSelect={openProject} project={project} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.settings.gitProjects.noProjects}</p>
      )}
    </div>
  )
}
