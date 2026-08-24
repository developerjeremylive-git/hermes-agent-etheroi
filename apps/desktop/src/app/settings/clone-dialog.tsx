import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import type { HermesCloneProgress, HermesRemoteRepo } from '@/global'
import { useI18n } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { FolderOpen, iconSize } from '@/lib/icons'
import { notify, readableError } from '@/store/notifications'

type CloneDialogProps = {
  host: 'github' | 'gitlab'
  onClose: () => void
  onCloned: (path: string) => void
  open: boolean
  repo: HermesRemoteRepo | null
}

type ClonePhase = 'idle' | 'cloning' | 'done' | 'error'

export function CloneDialog({ host, onClose, onCloned, open, repo }: CloneDialogProps) {
  const { t } = useI18n()
  const tr = host === 'gitlab' ? t.settings.gitLab : t.settings.gitHub

  const [targetPath, setTargetPath] = useState('')
  const [phase, setPhase] = useState<ClonePhase>('idle')
  const [progress, setProgress] = useState<HermesCloneProgress | null>(null)
  const [error, setError] = useState('')

  const resetAndClose = useCallback(() => {
    setTargetPath('')
    setPhase('idle')
    setProgress(null)
    setError('')
    onClose()
  }, [onClose])

  const chooseDirectory = useCallback(async () => {
    const git = desktopGit()

    if (!git?.workdir?.pick) {
      return
    }

    const picked = await git.workdir.pick()

    if (!picked.canceled && picked.dir) {
      {
        setTargetPath(picked.dir)
      }
    }
  }, [])

  const startClone = useCallback(async () => {
    if (!repo || !targetPath.trim()) {
      return
    }

    const git = desktopGit()
    const cloneFn = host === 'gitlab' ? git?.glCloneRepo : git?.ghCloneRepo

    if (!cloneFn) {
      return
    }

    setPhase('cloning')
    setError('')
    setProgress(null)

    try {
      const result = await cloneFn(repo.cloneUrl, targetPath.trim(), (p: HermesCloneProgress) => {
        setProgress(p)
      })

      if (result.success) {
        setPhase('done')
        notify({ kind: 'success', message: tr.cloneSuccess(repo.name) })
        onCloned(result.path)
        resetAndClose()
      } else {
        setPhase('error')
        setError(result.error || tr.cloneFailed)
      }
    } catch (err) {
      setPhase('error')
      setError(readableError(err, tr.cloneFailed).message)
    }
  }, [host, repo, targetPath, tr, onCloned, resetAndClose])

  if (!repo) {
    return null
  }

  return (
    <Dialog onOpenChange={open => { if (!open) { resetAndClose() } }} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tr.cloneRepo}</DialogTitle>
          <DialogDescription>{tr.cloneRepoHint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md bg-(--ui-bg-tertiary) p-3">
            <p className="text-sm font-medium truncate">{repo.fullName}</p>
            {repo.description && (
              <p className="text-xs text-muted-foreground truncate mt-1">{repo.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tr.cloneLocation}</label>
            <div className="flex gap-2">
              <Input
                aria-label={tr.cloneLocation}
                onChange={e => setTargetPath(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && phase === 'idle') {
                    e.preventDefault()
                    void startClone()
                  }
                }}
                placeholder={tr.cloneLocationPlaceholder}
                value={targetPath}
              />
              <Button onClick={() => void chooseDirectory()} size="icon" variant="secondary">
                <FolderOpen className={iconSize.sm} />
              </Button>
            </div>
          </div>

          {phase === 'cloning' && progress && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader className="size-4" />
                <span className="text-sm">{tr.cloning}</span>
              </div>
              <div className="w-full bg-(--ui-bg-tertiary) rounded-full h-2">
                <div
                  className="bg-(--ui-accent) h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.totalBytes > 0 ? (progress.bytesReceived / progress.totalBytes) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {tr.cloneProgress(progress.phase, progress.bytesReceived, progress.totalBytes)}
              </p>
            </div>
          )}

          {phase === 'error' && error && (
            <p className="text-xs text-(--ui-danger)">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={resetAndClose} size="sm" variant="text">
            {t.common.cancel}
          </Button>
          <Button
            disabled={phase === 'cloning' || !targetPath.trim()}
            onClick={() => void startClone()}
            size="sm"
          >
            {phase === 'cloning' ? (
              <Loader aria-label={t.common.loading} className="size-4" strokeScale={0.7} />
            ) : (
              tr.clone
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
