import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import * as git from '@/lib/desktop-git'
import { refreshRepoStatus } from '@/store/coding-status'
import { requestStartWorkSession } from '@/store/projects'

import { RepoListSection } from './repo-list-section'

vi.mock('@/lib/desktop-git', () => ({ desktopGit: vi.fn() }))
vi.mock('@/store/coding-status', () => ({ refreshRepoStatus: vi.fn() }))
vi.mock('@/store/projects', () => ({ requestStartWorkSession: vi.fn() }))

const desktopGit = vi.mocked(git.desktopGit)
const refreshRepoStatusMock = vi.mocked(refreshRepoStatus)
const requestStartWorkSessionMock = vi.mocked(requestStartWorkSession)

function mockGit() {
  const scanRepos = vi.fn()
  const syncInfo = vi.fn().mockResolvedValue(null)
  const repoStatus = vi.fn()
  const pull = vi.fn()
  const syncFork = vi.fn()
  const push = vi.fn()
  const conflictFiles = vi.fn()
  const resolveConflict = vi.fn()
  const continueMerge = vi.fn()
  const abortMerge = vi.fn()

  desktopGit.mockReturnValue({
    abortMerge,
    conflictFiles,
    continueMerge,
    pull,
    push,
    repoStatus,
    resolveConflict,
    scanRepos,
    syncFork,
    syncInfo
  } as never)

  return {
    abortMerge,
    conflictFiles,
    continueMerge,
    pull,
    push,
    repoStatus,
    resolveConflict,
    scanRepos,
    syncFork,
    syncInfo
  }
}

function renderSection(roots: string[] = ['J:\\AI_Products'], onSelectRepo = vi.fn()) {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      <RepoListSection
        hint="Repositories found in J:\AI_Products. Select one to use as the working folder."
        onSelectRepo={onSelectRepo}
        roots={roots}
        title="AI Products repositories"
      />
    </I18nProvider>
  )
}

describe('RepoListSection', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    refreshRepoStatusMock.mockClear()
    requestStartWorkSessionMock.mockClear()
    delete (window as { hermesDesktop?: unknown }).hermesDesktop
  })

  it('scans the given roots and shows the pull button with the missing commit count', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3 })

    renderSection()

    expect(screen.getByText('AI Products repositories')).toBeTruthy()
    expect(screen.getByText('No repositories found')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(scanRepos).toHaveBeenCalledWith(['J:\\AI_Products']))
    await waitFor(() => expect(screen.getByText('repo-a')).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pull 3' })).toBeTruthy())
  })

  it('hides the pull button once the branch is up to date', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 0 })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByText('repo-a')).toBeTruthy())
    await waitFor(() => expect(syncInfo).toHaveBeenCalled())

    expect(screen.queryByRole('button', { name: /pull/i })).toBeNull()
  })

  it('selects a repo through the onSelectRepo callback', async () => {
    const { scanRepos } = mockGit()
    const onSelectRepo = vi.fn()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])

    renderSection(['J:\\AI_Products'], onSelectRepo)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByText('repo-a')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /use this folder/i }))

    expect(onSelectRepo).toHaveBeenCalledWith('J:\\AI_Products\\repo-a')
  })

  it('sorts by last commit date and shows the date column', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([
      { root: 'J:\\AI_Products\\repo-a', label: 'repo-a' },
      { root: 'J:\\AI_Products\\repo-b', label: 'repo-b' }
    ])
    const older = new Date(2026, 7, 10, 12).getTime()
    const newer = new Date(2026, 7, 12, 12).getTime()
    syncInfo
      .mockResolvedValueOnce({ behind: 0, lastCommitAt: older, url: null })
      .mockResolvedValueOnce({ behind: 0, lastCommitAt: newer, url: null })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByText('2026-08-10')).toBeTruthy())

    const rowsByName = screen.getAllByRole('button', { name: /use this folder/i })
    expect(rowsByName[0].textContent).toContain('repo-a')

    fireEvent.click(screen.getByRole('button', { name: 'Last commit' }))

    await waitFor(() => {
      const rows = screen.getAllByRole('button', { name: /use this folder/i })
      expect(rows[0].textContent).toContain('repo-b')
    })
  })

  it('opens the repo folder through the desktop bridge', async () => {
    const { scanRepos } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])

    const openDir = vi.fn().mockResolvedValue({ ok: true })

    ;(window as { hermesDesktop?: unknown }).hermesDesktop = { openDir }

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open folder' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }))

    await waitFor(() => expect(openDir).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
  })

  it('opens the repo on GitHub only when the repo has a GitHub URL', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([
      { root: 'J:\\AI_Products\\repo-a', label: 'repo-a' },
      { root: 'J:\\AI_Products\\repo-b', label: 'repo-b' }
    ])
    syncInfo
      .mockResolvedValueOnce({ behind: 0, lastCommitAt: null, url: 'https://github.com/acme/repo-a' })
      .mockResolvedValueOnce({ behind: 0, lastCommitAt: null, url: null })

    const openExternal = vi.fn()

    ;(window as { hermesDesktop?: unknown }).hermesDesktop = { openExternal }

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Open on GitHub' })).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }))

    await waitFor(() => expect(openExternal).toHaveBeenCalledWith('https://github.com/acme/repo-a'))
  })

  it('syncs a fork through the fork-sync button when behind upstream', async () => {
    const { scanRepos, syncInfo, syncFork } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3, lastCommitAt: null, remote: 'upstream', url: null })
    syncFork.mockResolvedValue({ ok: true })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync 3' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Sync 3' }))

    await waitFor(() => expect(syncFork).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(refreshRepoStatusMock).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
  })

  it('hides the fork-sync button for plain clones (no upstream)', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3, lastCommitAt: null, remote: 'origin', url: null })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(syncInfo).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /sync/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Pull 3' })).toBeTruthy()
  })

  it('shows the push button with the unpushed commit count and pushes on click', async () => {
    const { scanRepos, syncInfo, push } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 0, lastCommitAt: null, remote: 'origin', unpushed: 2, url: null })
    push.mockResolvedValue({ ok: true })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Push 2' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Push 2' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(refreshRepoStatusMock).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(syncInfo.mock.calls.length).toBeGreaterThan(1))
  })

  it('hides the push button when there are no unpushed commits', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 0, lastCommitAt: null, remote: 'origin', unpushed: 0, url: null })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(syncInfo).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /push/i })).toBeNull()
  })

  it('refreshes the row counts through the refresh-status button', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3, lastCommitAt: null, remote: 'origin', unpushed: 0, url: null })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pull 3' })).toBeTruthy())

    const syncInfoCallsBefore = syncInfo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }))

    await waitFor(() => expect(syncInfo.mock.calls.length).toBeGreaterThan(syncInfoCallsBefore))
  })

  it('shows the resolve-conflicts flow instead of the pull button for a conflicted repo', async () => {
    const { scanRepos, syncInfo } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({
      ahead: 1,
      behind: 1,
      conflicted: true,
      conflictedFiles: ['tracked.txt'],
      lastCommitAt: null,
      remote: 'origin',
      url: null
    })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByText('This branch has conflicts that must be resolved')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Resolve conflicts' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /pull/i })).toBeNull()
  })

  it('shows the continue-merge flow when the merge is in progress with no conflicts left', async () => {
    const { scanRepos, syncInfo, continueMerge } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({
      ahead: 1,
      behind: 1,
      conflicted: false,
      conflictedFiles: [],
      lastCommitAt: null,
      mergeInProgress: true,
      remote: 'origin',
      url: null
    })
    continueMerge.mockResolvedValue({ ok: true })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByText('All Conflicts resolved')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Continue merge' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /pull/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /sync/i })).toBeNull()

    const syncInfoCallsBefore = syncInfo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Continue merge' }))

    await waitFor(() => expect(continueMerge).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(syncInfo.mock.calls.length).toBeGreaterThan(syncInfoCallsBefore))
    await waitFor(() => expect(refreshRepoStatusMock).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
  })

  it('opens the conflict resolver and resolves a conflicted file to ours', async () => {
    const { scanRepos, syncInfo, conflictFiles, resolveConflict } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({
      ahead: 1,
      behind: 1,
      conflicted: true,
      conflictedFiles: ['tracked.txt'],
      lastCommitAt: null,
      remote: 'origin',
      url: null
    })
    conflictFiles.mockResolvedValue({
      files: [{ content: '<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>>\n', path: 'tracked.txt' }]
    })
    resolveConflict.mockResolvedValue({ ok: true })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve conflicts' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve conflicts' }))

    await waitFor(() => expect(screen.getByText('tracked.txt')).toBeTruthy())
    expect(screen.getByText(/<<<<<<< HEAD/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Accept ours' }))

    await waitFor(() => expect(resolveConflict).toHaveBeenCalledWith('J:\\AI_Products\\repo-a', 'tracked.txt', 'ours'))
    await waitFor(() => expect(screen.getByText('All conflicts resolved. Continue the merge to finish.')).toBeTruthy())
  })

  it('continues the merge once every conflict is resolved and refreshes the row', async () => {
    const { scanRepos, syncInfo, conflictFiles, resolveConflict, continueMerge } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({
      ahead: 1,
      behind: 1,
      conflicted: true,
      conflictedFiles: ['tracked.txt'],
      lastCommitAt: null,
      remote: 'origin',
      url: null
    })
    conflictFiles.mockResolvedValue({
      files: [{ content: '<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>>\n', path: 'tracked.txt' }]
    })
    resolveConflict.mockResolvedValue({ ok: true })
    continueMerge.mockResolvedValue({ ok: true })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve conflicts' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve conflicts' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept ours' })).toBeTruthy())

    expect(screen.getByRole('button', { name: 'Continue merge' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Accept ours' }))
    await waitFor(() => expect(resolveConflict).toHaveBeenCalled())

    const syncInfoCallsBefore = syncInfo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Continue merge' }))

    await waitFor(() => expect(continueMerge).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(syncInfo.mock.calls.length).toBeGreaterThan(syncInfoCallsBefore))
    await waitFor(() => expect(refreshRepoStatusMock).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue merge' })).toBeNull())
  })

  it('aborts the merge through the two-step confirm', async () => {
    const { scanRepos, syncInfo, conflictFiles, abortMerge } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({
      ahead: 1,
      behind: 1,
      conflicted: true,
      conflictedFiles: ['tracked.txt'],
      lastCommitAt: null,
      remote: 'origin',
      url: null
    })
    conflictFiles.mockResolvedValue({
      files: [{ content: '<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>>\n', path: 'tracked.txt' }]
    })
    abortMerge.mockResolvedValue({ ok: true })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve conflicts' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve conflicts' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abort merge' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Abort merge' }))
    expect(screen.getByRole('button', { name: 'Confirm abort' })).toBeTruthy()
    expect(abortMerge).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm abort' }))

    await waitFor(() => expect(abortMerge).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm abort' })).toBeNull())
  })

  it('refreshes the row after a conflicted fork sync so the resolve flow appears', async () => {
    const { scanRepos, syncInfo, syncFork } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3, lastCommitAt: null, remote: 'upstream', url: null })
    syncFork.mockRejectedValue(new Error('Automatic merge failed'))

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync 3' })).toBeTruthy())

    const syncInfoCallsBefore = syncInfo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Sync 3' }))

    await waitFor(() => expect(syncInfo.mock.calls.length).toBeGreaterThan(syncInfoCallsBefore))
    await waitFor(() => expect(refreshRepoStatusMock).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
  })

  it('hands the conflicted repo to a new Hermes Agent chat with auto-submit', async () => {
    const { scanRepos, syncInfo, conflictFiles } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({
      ahead: 1,
      behind: 1,
      conflicted: true,
      conflictedFiles: ['tracked.txt'],
      lastCommitAt: null,
      remote: 'origin',
      url: null
    })
    conflictFiles.mockResolvedValue({
      files: [{ content: '<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>>\n', path: 'tracked.txt' }]
    })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve conflicts' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve conflicts' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Resolve conflicts with Hermes Agent' })).toBeTruthy()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resolve conflicts with Hermes Agent' }))

    expect(requestStartWorkSessionMock).toHaveBeenCalledWith(
      'J:\\AI_Products\\repo-a',
      expect.stringContaining('blocking the last sync'),
      { autoSubmit: true }
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Resolve conflicts with Hermes Agent' })).toBeNull())
  })

  it('opens an agent chat when a failed sync leaves local changes that block the merge', async () => {
    const { scanRepos, syncInfo, syncFork, repoStatus } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3, lastCommitAt: null, remote: 'upstream', url: null })
    syncFork.mockRejectedValue(
      new Error('Your local changes to the following files would be overwritten by merge:\n package-lock.json')
    )
    repoStatus.mockResolvedValue({ changed: 1, conflicted: 0 })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync 3' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Sync 3' }))

    await waitFor(() =>
      expect(requestStartWorkSessionMock).toHaveBeenCalledWith(
        'J:\\AI_Products\\repo-a',
        expect.stringContaining('blocking the last sync'),
        { autoSubmit: true }
      )
    )
  })

  it('does not open an agent chat when a failed sync leaves the tree clean', async () => {
    const { scanRepos, syncInfo, syncFork, repoStatus } = mockGit()
    scanRepos.mockResolvedValue([{ root: 'J:\\AI_Products\\repo-a', label: 'repo-a' }])
    syncInfo.mockResolvedValue({ behind: 3, lastCommitAt: null, remote: 'upstream', url: null })
    syncFork.mockRejectedValue(new Error('could not read Username for https://github.com'))
    repoStatus.mockResolvedValue({ changed: 0, conflicted: 0 })

    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync 3' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Sync 3' }))

    await waitFor(() => expect(syncFork).toHaveBeenCalledWith('J:\\AI_Products\\repo-a'))
    await waitFor(() => expect(repoStatus).toHaveBeenCalled())
    expect(requestStartWorkSessionMock).not.toHaveBeenCalled()
  })
})
