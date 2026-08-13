import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import { gitFor, parseGhLoginBanner, repoStatus, resolveRenamePath, REVIEW_FILE_CAP, reviewList } from './git-review-ops'

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
