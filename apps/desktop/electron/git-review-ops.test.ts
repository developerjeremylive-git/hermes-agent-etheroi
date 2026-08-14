import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import {
  gitFor,
  parseGhLoginBanner,
  repoPull,
  repoStatus,
  repoSyncInfo,
  resolveRenamePath,
  REVIEW_FILE_CAP,
  reviewList
} from './git-review-ops'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-status-'))

  tempDirs.push(dir)
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 'hermes-test@example.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Hermes Test'], { cwd: dir })
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'tracked\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: dir })
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: dir })

  return dir
}

// A bare "original project" repo on `main` (deterministic regardless of the
// host's init.defaultBranch) plus the seed working copy that grows it.
function makeRemoteRepo() {
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-remote-'))
  const seed = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-seed-'))

  tempDirs.push(remote, seed)

  execFileSync('git', ['init', '-q'], { cwd: seed })
  execFileSync('git', ['branch', '-M', 'main'], { cwd: seed })
  execFileSync('git', ['config', 'user.email', 'hermes-test@example.com'], { cwd: seed })
  execFileSync('git', ['config', 'user.name', 'Hermes Test'], { cwd: seed })
  fs.writeFileSync(path.join(seed, 'tracked.txt'), 'tracked\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: seed })
  execFileSync('git', ['clone', '-q', '--bare', seed, remote])

  return { remote, seed }
}

// A local clone of the remote — the "folder created as a fork" shape, with an
// origin/main remote-tracking ref.
function cloneRemote(remote) {
  const local = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-local-'))

  tempDirs.push(local)
  execFileSync('git', ['clone', '-q', remote, local])

  return local
}

// Advance the original project by one commit on `main` and push it.
function advanceRemote(remote, seed) {
  fs.writeFileSync(path.join(seed, 'second.txt'), 'second\n')
  execFileSync('git', ['add', 'second.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'second'], { cwd: seed })
  execFileSync('git', ['push', '-q', remote, 'main'], { cwd: seed })
}

test('repoSyncInfo counts the exact commits missing from origin/main', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  // Fresh clone: nothing missing yet.
  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 0 })

  advanceRemote(remote, seed)

  // The op fetches origin/main itself, so the count reflects the new commit
  // without a manual fetch.
  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 1 })
})

test('repoSyncInfo returns null when the repo has no origin/main ref', async () => {
  const dir = makeRepo()

  assert.equal(await repoSyncInfo(dir, 'git'), null)
})

test('repoPull fast-forwards a fork folder to origin/main', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  advanceRemote(remote, seed)

  assert.deepEqual(await repoPull(local, 'git'), { ok: true })
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)
  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 0 })
})

test('repoSyncInfo counts missing commits against upstream when the fork has one', async () => {
  const { remote: upstream, seed } = makeRemoteRepo()
  const fork = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-fork-'))

  tempDirs.push(fork)
  execFileSync('git', ['clone', '-q', '--bare', seed, fork])

  const local = cloneRemote(fork)
  execFileSync('git', ['remote', 'add', 'upstream', upstream], { cwd: local })

  // Fork in sync with the original: nothing missing yet.
  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 0 })

  advanceRemote(upstream, seed)

  // The original moved ahead; the count tracks upstream, not the synced fork.
  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 1 })
})

test('repoPull updates a fork from upstream', async () => {
  const { remote: upstream, seed } = makeRemoteRepo()
  const fork = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-fork-'))

  tempDirs.push(fork)
  execFileSync('git', ['clone', '-q', '--bare', seed, fork])

  const local = cloneRemote(fork)
  execFileSync('git', ['remote', 'add', 'upstream', upstream], { cwd: local })

  advanceRemote(upstream, seed)

  assert.deepEqual(await repoPull(local, 'git'), { ok: true })
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)
  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 0 })
})

test('repoSyncInfo and repoPull handle a remote whose default branch is master', async () => {
  const seed = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-seed-master-'))
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-remote-master-'))

  tempDirs.push(seed, remote)

  execFileSync('git', ['init', '-q'], { cwd: seed })
  execFileSync('git', ['branch', '-M', 'master'], { cwd: seed })
  execFileSync('git', ['config', 'user.email', 'hermes-test@example.com'], { cwd: seed })
  execFileSync('git', ['config', 'user.name', 'Hermes Test'], { cwd: seed })
  fs.writeFileSync(path.join(seed, 'tracked.txt'), 'tracked\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: seed })
  execFileSync('git', ['clone', '-q', '--bare', seed, remote])

  const local = cloneRemote(remote)

  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 0 })

  fs.writeFileSync(path.join(seed, 'second.txt'), 'second\n')
  execFileSync('git', ['add', 'second.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'second'], { cwd: seed })
  execFileSync('git', ['push', '-q', remote, 'master'], { cwd: seed })

  assert.deepEqual(await repoSyncInfo(local, 'git'), { behind: 1 })
  assert.deepEqual(await repoPull(local, 'git'), { ok: true })
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)
})

test('resolveRenamePath: plain path is unchanged', () => {
  assert.equal(resolveRenamePath('src/a.ts'), 'src/a.ts')
})

test('gitFor accepts an internally resolved git binary path containing spaces', () => {
  assert.doesNotThrow(() => gitFor(process.cwd(), 'C:\\Program Files\\Git\\cmd\\git.exe'))
})

test('gitFor accepts an internally resolved git binary path with other restricted characters', () => {
  assert.doesNotThrow(() => gitFor(process.cwd(), 'C:\\Git (portable)\\cmd\\git.exe'))
})

test('gitFor suppresses simple-git custom-binary noise for trusted restricted paths', () => {
  const warns: unknown[][] = []
  const originalWarn = console.warn

  console.warn = (...args) => warns.push(args)

  try {
    gitFor(process.cwd(), 'C:\\Program Files\\Git\\cmd\\git.exe')
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warns.length, 0)
})

test('gitFor runs git through a spaced binary path', async () => {
  if (process.platform !== 'win32') {
    return
  }

  const gitBin = path.join(process.env.ProgramFiles || String.raw`C:\Program Files`, 'Git', 'cmd', 'git.exe')

  if (!fs.existsSync(gitBin)) {
    return
  }

  const repo = makeRepo()

  fs.writeFileSync(path.join(repo, 'changed.txt'), 'review me\n')

  const status = await gitFor(repo, gitBin).status()

  assert.equal(status.not_added.includes('changed.txt'), true)
})

test('resolveRenamePath: simple rename resolves to the new path', () => {
  assert.equal(resolveRenamePath('old.ts => new.ts'), 'new.ts')
})

test('resolveRenamePath: brace rename resolves to the new path', () => {
  assert.equal(resolveRenamePath('src/{old => new}/file.ts'), 'src/new/file.ts')
})

test('resolveRenamePath: brace rename collapsing a segment', () => {
  assert.equal(resolveRenamePath('src/{lib => }/file.ts'), 'src/file.ts')
})

test('repoStatus reports an untracked directory without recursively listing its contents', async () => {
  const dir = makeRepo()
  const nested = path.join(dir, 'generated', 'deep')

  fs.mkdirSync(nested, { recursive: true })
  fs.writeFileSync(path.join(nested, 'large-output.txt'), 'generated\n')

  const status = await repoStatus(dir, 'git')

  assert.ok(status)
  assert.equal(status.untracked, 1)
  assert.equal(status.changed, 1)
  assert.deepEqual(
    status.files.map(file => file.path),
    ['generated/']
  )
})

test('reviewList reports an untracked directory without recursively listing its contents', async () => {
  const dir = makeRepo()
  const nested = path.join(dir, 'browser-profile', 'Default', 'Cache')

  fs.mkdirSync(nested, { recursive: true })

  for (let i = 0; i < 20; i++) {
    fs.writeFileSync(path.join(nested, `cache-${i}.bin`), 'generated\n')
  }

  const result = await reviewList(dir, 'uncommitted', null, 'git')

  assert.deepEqual(
    result.files.map(file => file.path),
    ['browser-profile/']
  )
})

test('reviewList caps the file payload returned to the renderer', async () => {
  const dir = makeRepo()

  for (let i = 0; i < REVIEW_FILE_CAP + 10; i++) {
    fs.writeFileSync(path.join(dir, `untracked-${String(i).padStart(4, '0')}.txt`), 'generated\n')
  }

  const result = await reviewList(dir, 'uncommitted', null, 'git')

  assert.equal(result.files.length, REVIEW_FILE_CAP)
})

test('parseGhLoginBanner: extracts code + URL from the gh 2.x stderr banner', () => {
  // Captured verbatim from `gh auth login --hostname github.com --web` (gh 2.97).
  const banner = [
    '! First copy your one-time code: DF4F-6AE9',
    'Open this URL to continue in your web browser: https://github.com/login/device'
  ].join('\n')

  assert.deepEqual(parseGhLoginBanner(banner), { code: 'DF4F-6AE9', url: 'https://github.com/login/device' })
})

test('parseGhLoginBanner: returns nulls before both pieces have appeared', () => {
  assert.deepEqual(parseGhLoginBanner(''), { code: null, url: null })
  assert.deepEqual(parseGhLoginBanner('! First copy your one-time code: DF4F-6AE9'), {
    code: 'DF4F-6AE9',
    url: null
  })
})

test('parseGhLoginBanner: ignores stray codes outside the one-time-code line', () => {
  const banner =
    '! First copy your one-time code: ABCD-1234\n' +
    'some other token 9876-5432\n' +
    'Open this URL to continue in your web browser: https://github.com/login/device'

  assert.deepEqual(parseGhLoginBanner(banner), { code: 'ABCD-1234', url: 'https://github.com/login/device' })
})
