import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import * as desktopFs from '@/lib/desktop-fs'
import * as git from '@/lib/desktop-git'
import { notify } from '@/store/notifications'

import { GitHubSettings } from './github-settings'

vi.mock('@/lib/desktop-git', () => ({ desktopGit: vi.fn() }))
vi.mock('@/lib/desktop-fs', () => ({ isDesktopFsRemoteMode: vi.fn() }))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), readableError: vi.fn(() => ({ message: 'error' })) }))
vi.mock('@/store/session', () => ({
  applyConfiguredGitWorkdir: vi.fn(),
  commitWorkspaceCwdForSelectedSession: vi.fn()
}))
// The repo lists are covered by repo-list-section.test.tsx; keep them quiet.
vi.mock('./repo-list-section', () => ({ RepoListSection: () => null }))

const desktopGit = vi.mocked(git.desktopGit)
const isDesktopFsRemoteMode = vi.mocked(desktopFs.isDesktopFsRemoteMode)

function renderSettings() {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      <GitHubSettings activeView="github" />
    </I18nProvider>
  )
}

describe('GitHubSettings', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    delete (window as { hermesDesktop?: unknown }).hermesDesktop
  })

  it('renders nothing outside the github view', () => {
    desktopGit.mockReturnValue({} as never)

    const { container } = render(
      <I18nProvider configClient={null} initialLocale="en">
        <GitHubSettings activeView="providers" />
      </I18nProvider>
    )

    expect(container.textContent).toBe('')
  })

  it('shows the connected profile with a Connected badge and sign out', async () => {
    const ghLogout = vi.fn().mockResolvedValue({ ok: true })
    desktopGit.mockReturnValue({
      ghProfile: vi.fn().mockResolvedValue({ ok: true, login: 'octocat', name: 'Octo Cat', avatarUrl: null }),
      ghLogout,
      workdir: { get: vi.fn().mockResolvedValue({ dir: '' }) }
    } as never)
    isDesktopFsRemoteMode.mockReturnValue(false)

    renderSettings()

    await waitFor(() => expect(screen.getByText('Octo Cat')).toBeTruthy())
    expect(screen.getByText('@octocat')).toBeTruthy()
    expect(screen.getByText('Connected')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(ghLogout).toHaveBeenCalledWith('octocat'))
  })

  it('shows the device code with copy affordances while waiting for auth', async () => {
    const onGhLoginEvent = vi.fn()
    desktopGit.mockReturnValue({
      ghProfile: vi.fn().mockResolvedValue({ ok: false, login: '', name: null, avatarUrl: null }),
      ghLoginStart: vi.fn().mockResolvedValue({ code: 'ABCD-1234', url: 'https://github.com/login/device' }),
      onGhLoginEvent,
      workdir: { get: vi.fn().mockResolvedValue({ dir: '' }) }
    } as never)
    isDesktopFsRemoteMode.mockReturnValue(false)

    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(screen.getByText('ABCD-1234')).toBeTruthy())
    expect(screen.getByText('https://github.com/login/device')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open GitHub in browser' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('offers an explicit retry after a failed login start', async () => {
    desktopGit.mockReturnValue({
      ghProfile: vi.fn().mockResolvedValue({ ok: false, login: '', name: null, avatarUrl: null }),
      ghLoginStart: vi.fn().mockRejectedValue(new Error('gh missing')),
      workdir: { get: vi.fn().mockResolvedValue({ dir: '' }) }
    } as never)
    isDesktopFsRemoteMode.mockReturnValue(false)

    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(screen.getByText('GitHub authentication failed or was cancelled.')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(notify).not.toHaveBeenCalled()
  })

  it('renders the working-folder controls in local mode', async () => {
    desktopGit.mockReturnValue({
      ghProfile: vi.fn().mockResolvedValue({ ok: false, login: '', name: null, avatarUrl: null }),
      workdir: { get: vi.fn().mockResolvedValue({ dir: 'J:\\AI_Products\\repo-a' }) }
    } as never)
    isDesktopFsRemoteMode.mockReturnValue(false)

    renderSettings()

    await waitFor(() => expect(screen.getByText('J:\\AI_Products\\repo-a')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create repository' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
  })
})
