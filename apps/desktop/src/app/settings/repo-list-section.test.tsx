import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import * as git from '@/lib/desktop-git'

import { RepoListSection } from './repo-list-section'

vi.mock('@/lib/desktop-git', () => ({ desktopGit: vi.fn() }))

const desktopGit = vi.mocked(git.desktopGit)

function mockGit() {
  const scanRepos = vi.fn()
  const syncInfo = vi.fn().mockResolvedValue(null)
  const pull = vi.fn()

  desktopGit.mockReturnValue({ pull, scanRepos, syncInfo } as never)

  return { pull, scanRepos, syncInfo }
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
})
