import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  preventCloseButtonAutoFocus
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { notify, readableError } from '@/store/notifications'
import { requestStartWorkSession } from '@/store/projects'

type ConflictFile = { content: null | string; path: string }

type ConflictResolverDialogProps = {
  open: boolean
  onClose: () => void
  // Fires after the merge is completed or aborted so the caller can refresh
  // the repo's sync info (the conflicted row returns to the pull/sync buttons).
  onResolved: () => void
  repoRoot: string
  ahead: number
  behind: number
}

// Resolves an in-progress merge that a conflicted pull left behind: lists the
// conflicted files with their marker-laden content, resolves each to ours /
// theirs / both (staging it), then either finishes the merge — preserving the
// branch's own commits — or aborts back to the pre-pull state.
export function ConflictResolverDialog({
  open,
  onClose,
  onResolved,
  repoRoot,
  ahead,
  behind
}: ConflictResolverDialogProps) {
  const { t } = useI18n()

  const [files, setFiles] = useState<ConflictFile[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [resolvingPath, setResolvingPath] = useState<string | null>(null)
  const [continuing, setContinuing] = useState(false)
  const [confirmingAbort, setConfirmingAbort] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const abortTimer = useRef<null | number>(null)

  const load = useCallback(async () => {
    const git = desktopGit()

    if (!git?.conflictFiles) {
      return
    }

    setFiles(null)
    setError(null)

    try {
      const { files } = await git.conflictFiles(repoRoot)
      setFiles(files)
      setSelected(prev => (prev && files.some(file => file.path === prev) ? prev : (files[0]?.path ?? null)))
    } catch (err) {
      setFiles([])
      setError(readableError(err, t.settings.gitHub.resolveFailed).message)
    }
  }, [repoRoot, t])

  useEffect(() => {
    if (open) {
      void load()
    }
  }, [open, load])

  useEffect(
    () => () => {
      if (abortTimer.current) {
        window.clearTimeout(abortTimer.current)
      }
    },
    []
  )

  const accept = useCallback(
    async (choice: 'both' | 'ours' | 'theirs') => {
      const git = desktopGit()

      if (!selected || !git?.resolveConflict) {
        return
      }

      setResolvingPath(selected)

      try {
        await git.resolveConflict(repoRoot, selected, choice)
        setFiles(prev => (prev ? prev.filter(file => file.path !== selected) : prev))
        setSelected(prev => (prev === selected ? null : prev))
      } catch (err) {
        setError(readableError(err, t.settings.gitHub.resolveFailed).message)
      } finally {
        setResolvingPath(null)
      }
    },
    [repoRoot, selected, t]
  )

  const continueMerge = useCallback(async () => {
    const git = desktopGit()

    if (!git?.continueMerge) {
      return
    }

    setContinuing(true)
    setError(null)

    try {
      await git.continueMerge(repoRoot)
      notify({ kind: 'success', message: t.settings.gitHub.mergeCompleted })
      onResolved()
      onClose()
    } catch (err) {
      setError(readableError(err, t.settings.gitHub.continueFailed).message)
      void load()
    } finally {
      setContinuing(false)
    }
  }, [load, onClose, onResolved, repoRoot, t])

  const abortMerge = useCallback(async () => {
    const git = desktopGit()

    if (!git?.abortMerge) {
      return
    }

    setError(null)

    try {
      await git.abortMerge(repoRoot)
      notify({ kind: 'success', message: t.settings.gitHub.mergeAborted })
      onResolved()
      onClose()
    } catch (err) {
      setError(readableError(err, t.settings.gitHub.abortFailed).message)
    }
  }, [onClose, onResolved, repoRoot, t])

  const resolveWithAgent = useCallback(() => {
    onClose()
    requestStartWorkSession(repoRoot, t.settings.gitHub.resolveConflictsWithAgentPrompt, { autoSubmit: true })
  }, [onClose, repoRoot, t])

  function onAbortClick() {
    if (confirmingAbort) {
      if (abortTimer.current) {
        window.clearTimeout(abortTimer.current)
      }

      setConfirmingAbort(false)
      void abortMerge()
    } else {
      setConfirmingAbort(true)
      abortTimer.current = window.setTimeout(() => setConfirmingAbort(false), 3000)
    }
  }

  const selectedFile = files?.find(file => file.path === selected) ?? null
  const busy = Boolean(resolvingPath) || continuing

  return (
    <Dialog onOpenChange={value => !value && !busy && onClose()} open={open}>
      <DialogContent
        bodyClassName="flex max-h-[calc(85vh-6rem)] min-h-0 flex-col overflow-hidden p-0"
        className="max-w-2xl"
        onOpenAutoFocus={preventCloseButtonAutoFocus}
      >
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t.settings.gitHub.branchHasConflicts}</DialogTitle>
          <DialogDescription>{t.settings.gitHub.branchAheadBehind(ahead, behind)}</DialogDescription>
        </DialogHeader>

        {error && <div className="mx-4 text-xs text-destructive">{error}</div>}

        {files === null ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t.settings.gitHub.loadingConflicts}</p>
        ) : files.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t.settings.gitHub.noConflictsLeft}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
            <div className="flex max-h-40 min-h-0 flex-col gap-1 overflow-y-auto">
              {files.map(file => (
                <button
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-(--ui-bg-tertiary) ${
                    selected === file.path ? 'bg-(--ui-bg-tertiary) text-foreground' : 'text-muted-foreground'
                  }`}
                  disabled={busy}
                  key={file.path}
                  onClick={() => setSelected(file.path)}
                  type="button"
                >
                  <span className="truncate font-mono">{file.path}</span>
                  <span className="shrink-0 rounded bg-destructive/12 px-1.5 py-0.5 text-[10px] text-destructive">
                    {t.settings.gitHub.conflicted}
                  </span>
                </button>
              ))}
            </div>

            {selectedFile ? (
              <>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-(--stroke-nous) bg-(--ui-bg-secondary) p-3 font-mono text-[11px] leading-relaxed">
                  {selectedFile.content ?? t.settings.gitHub.conflictContentUnavailable}
                </pre>
                <div className="flex flex-wrap gap-1.5">
                  <Button disabled={busy} onClick={() => void accept('ours')} size="xs" variant="secondary">
                    {t.settings.gitHub.acceptOurs}
                  </Button>
                  <Button disabled={busy} onClick={() => void accept('theirs')} size="xs" variant="secondary">
                    {t.settings.gitHub.acceptTheirs}
                  </Button>
                  <Button disabled={busy} onClick={() => void accept('both')} size="xs" variant="secondary">
                    {t.settings.gitHub.acceptBoth}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}

        <DialogFooter className="border-t border-(--stroke-nous) px-4 py-3">
          <Button disabled={busy} onClick={onAbortClick} type="button" variant="ghost">
            {confirmingAbort ? t.settings.gitHub.confirmAbort : t.settings.gitHub.abortMerge}
          </Button>
          <Button
            disabled={busy || !files || files.length === 0}
            onClick={resolveWithAgent}
            type="button"
            variant="secondary"
          >
            {t.settings.gitHub.resolveConflictsWithAgent}
          </Button>
          <Button disabled={busy || !files || files.length > 0} onClick={() => void continueMerge()} type="button">
            {continuing ? t.common.loading : t.settings.gitHub.continueMerge}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
