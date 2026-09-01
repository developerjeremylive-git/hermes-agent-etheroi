import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import {
  gitFor,
  githubUrlFromRemote,
  parseGhLoginBanner,
  repoAbortMerge,
  repoConflictFiles,
  repoContinueMerge,
  repoPull,
  repoPush,
  repoResolveConflict,
  repoStatus,
  repoSyncFork,
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

// repoSyncInfo now carries url/lastCommitAt alongside behind. The fixture
// remotes are local paths (never GitHub), so url must be null and HEAD must
// have a commit date.
async function expectSyncInfo(repoPath, behind) {
  const info = await repoSyncInfo(repoPath, 'git')

  assert.equal(info?.behind, behind)
  assert.equal(info?.url, null)
  assert.equal(Number.isFinite(info?.lastCommitAt), true)

  return info
}

test('repoSyncInfo counts the exact commits missing from origin/main', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  // Fresh clone: nothing missing yet.
  const info = await expectSyncInfo(local, 0)
  assert.equal(info.remote, 'origin')

  advanceRemote(remote, seed)

  // The op fetches origin/main itself, so the count reflects the new commit
  // without a manual fetch.
  await expectSyncInfo(local, 1)
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
  await expectSyncInfo(local, 0)
})

test('repoSyncInfo counts missing commits against upstream when the fork has one', async () => {
  const { remote: upstream, seed } = makeRemoteRepo()
  const fork = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-fork-'))

  tempDirs.push(fork)
  execFileSync('git', ['clone', '-q', '--bare', seed, fork])

  const local = cloneRemote(fork)
  execFileSync('git', ['remote', 'add', 'upstream', upstream], { cwd: local })

  // Fork in sync with the original: nothing missing yet.
  const info = await expectSyncInfo(local, 0)
  assert.equal(info.remote, 'upstream')

  advanceRemote(upstream, seed)

  // The original moved ahead; the count tracks upstream, not the synced fork.
  await expectSyncInfo(local, 1)
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
  await expectSyncInfo(local, 0)
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

  await expectSyncInfo(local, 0)

  fs.writeFileSync(path.join(seed, 'second.txt'), 'second\n')
  execFileSync('git', ['add', 'second.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'second'], { cwd: seed })
  execFileSync('git', ['push', '-q', remote, 'master'], { cwd: seed })

  await expectSyncInfo(local, 1)
  assert.deepEqual(await repoPull(local, 'git'), { ok: true })
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)
})

test('githubUrlFromRemote normalizes GitHub remote URL forms', () => {
  assert.equal(githubUrlFromRemote('git@github.com:acme/widget.git'), 'https://github.com/acme/widget')
  assert.equal(githubUrlFromRemote('https://github.com/acme/widget.git'), 'https://github.com/acme/widget')
  assert.equal(githubUrlFromRemote('https://github.com/acme/widget/'), 'https://github.com/acme/widget')
  assert.equal(githubUrlFromRemote('ssh://git@github.com/acme/widget'), 'https://github.com/acme/widget')
  assert.equal(githubUrlFromRemote('git://github.com/acme/widget.git'), 'https://github.com/acme/widget')
})

test('githubUrlFromRemote returns null for non-GitHub remotes', () => {
  assert.equal(githubUrlFromRemote('git@gitlab.com:acme/widget.git'), null)
  assert.equal(githubUrlFromRemote('https://example.com/acme/widget.git'), null)
  assert.equal(githubUrlFromRemote(String.raw`C:\repos\widget`), null)
  assert.equal(githubUrlFromRemote('/srv/git/widget.git'), null)
  assert.equal(githubUrlFromRemote(''), null)
})

test('repoSyncInfo reports the GitHub URL of the pull target remote', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  execFileSync('git', ['remote', 'set-url', 'origin', 'git@github.com:acme/widget.git'], { cwd: local })

  // The refresh fetch against the bogus GitHub URL fails (no such repo), but
  // the existing remote-tracking refs still resolve — count and URL read
  // cleanly from local state.
  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.behind, 0)
  assert.equal(info?.url, 'https://github.com/acme/widget')
  assert.equal(Number.isFinite(info?.lastCommitAt), true)
})

test('repoSyncInfo takes the URL from upstream when the fork has one', async () => {
  const { remote: upstream, seed } = makeRemoteRepo()
  const fork = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-fork-'))

  tempDirs.push(fork)
  execFileSync('git', ['clone', '-q', '--bare', seed, fork])

  const local = cloneRemote(fork)
  execFileSync('git', ['remote', 'add', 'upstream', upstream], { cwd: local })

  // First sync resolves upstream against the local-path remote (no network).
  const before = await repoSyncInfo(local, 'git')

  assert.equal(before?.url, null)

  execFileSync('git', ['remote', 'set-url', 'upstream', 'git@github.com:acme/original.git'], { cwd: local })

  // The resolved target is still upstream — the URL now reflects its remote.
  const after = await repoSyncInfo(local, 'git')

  assert.equal(after?.url, 'https://github.com/acme/original')
})

test('repoSyncFork pulls upstream and pushes the fork remote', async () => {
  const { remote: upstream, seed } = makeRemoteRepo()
  const fork = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-fork-'))

  tempDirs.push(fork)
  execFileSync('git', ['clone', '-q', '--bare', seed, fork])

  const local = cloneRemote(fork)
  execFileSync('git', ['remote', 'add', 'upstream', upstream], { cwd: local })

  advanceRemote(upstream, seed)

  assert.deepEqual(await repoSyncFork(local, 'git'), { ok: true })
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)

  // The fork remote now carries the upstream commit too: local and fork head
  // must point at the same commit after the sync.
  const forkHead = execFileSync('git', ['-C', fork, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
  const localHead = execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  assert.equal(forkHead, localHead)
})

test('repoSyncFork rejects when the repo is not fork-shaped (no upstream)', async () => {
  const { remote } = makeRemoteRepo()
  const local = cloneRemote(remote)

  await assert.rejects(() => repoSyncFork(local, 'git'), /No upstream remote/)
})

test('repoPull completes even when uncommitted local changes block the merge, restoring them after', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  advanceRemote(remote, seed)

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'local uncommitted\n')

  assert.deepEqual(await repoPull(local, 'git'), { ok: true })

  // The incoming commit landed and the local change was restored on top of it.
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)
  assert.equal(fs.readFileSync(path.join(local, 'tracked.txt'), 'utf8').replace(/\r\n/g, '\n'), 'local uncommitted\n')
  assert.equal(execFileSync('git', ['-C', local, 'stash', 'list'], { encoding: 'utf8' }).trim(), '')
  await expectSyncInfo(local, 0)
})

test('repoPull surfaces a conflict when the sync and the local change touch the same file', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  fs.writeFileSync(path.join(seed, 'tracked.txt'), 'remote\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'remote change'], { cwd: seed })
  execFileSync('git', ['push', '-q', remote, 'main'], { cwd: seed })

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'local uncommitted\n')

  await assert.rejects(() => repoPull(local, 'git'), /conflict with the sync/)

  // The incoming commit landed, the local change is preserved in the conflicted
  // pop plus the stash entry — the state the agent chat resolves.
  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.conflicted, true)
  assert.equal(info?.mergeInProgress, false)
  assert.deepEqual(info?.conflictedFiles, ['tracked.txt'])
  assert.match(execFileSync('git', ['-C', local, 'stash', 'list'], { encoding: 'utf8' }), /hermes-sync-autostash/)

  const remoteHead = execFileSync('git', ['-C', remote, 'rev-parse', 'main'], { encoding: 'utf8' }).trim()
  const localHead = execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  assert.equal(remoteHead, localHead)
})

test('repoPull surfaces a conflicted merge when local commits and the remote diverge on a stashed file', async () => {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'local commit\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: local })
  execFileSync('git', ['commit', '-qm', 'local change'], { cwd: local })

  fs.writeFileSync(path.join(seed, 'tracked.txt'), 'remote\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'remote change'], { cwd: seed })
  execFileSync('git', ['push', '-q', remote, 'main'], { cwd: seed })

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'local uncommitted\n')

  await assert.rejects(() => repoPull(local, 'git'), /merge has conflicts/)

  // The retried pull conflicted mid-merge: MERGE_HEAD is present and the stash
  // still holds the local work — both halves of the resolution the agent sees.
  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.conflicted, true)
  assert.equal(info?.mergeInProgress, true)
  assert.deepEqual(info?.conflictedFiles, ['tracked.txt'])
  assert.match(execFileSync('git', ['-C', local, 'stash', 'list'], { encoding: 'utf8' }), /hermes-sync-autostash/)
})

test('repoSyncFork completes with uncommitted local changes, restoring them after the sync', async () => {
  const { remote: upstream, seed } = makeRemoteRepo()
  const fork = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-git-fork-'))

  tempDirs.push(fork)
  execFileSync('git', ['clone', '-q', '--bare', seed, fork])

  const local = cloneRemote(fork)
  execFileSync('git', ['remote', 'add', 'upstream', upstream], { cwd: local })

  advanceRemote(upstream, seed)

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'local uncommitted\n')

  assert.deepEqual(await repoSyncFork(local, 'git'), { ok: true })
  assert.equal(fs.existsSync(path.join(local, 'second.txt')), true)
  assert.equal(fs.readFileSync(path.join(local, 'tracked.txt'), 'utf8').replace(/\r\n/g, '\n'), 'local uncommitted\n')
  assert.equal(execFileSync('git', ['-C', local, 'stash', 'list'], { encoding: 'utf8' }).trim(), '')

  const forkHead = execFileSync('git', ['-C', fork, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()
  const localHead = execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  assert.equal(forkHead, localHead)
  await expectSyncInfo(local, 0)
})

test('repoPush pushes the local commits to the origin remote', async () => {
  const { remote } = makeRemoteRepo()
  const local = cloneRemote(remote)

  execFileSync('git', ['config', 'user.email', 'hermes-test@example.com'], { cwd: local })
  execFileSync('git', ['config', 'user.name', 'Hermes Test'], { cwd: local })
  fs.writeFileSync(path.join(local, 'local.txt'), 'local\n')
  execFileSync('git', ['add', 'local.txt'], { cwd: local })
  execFileSync('git', ['commit', '-qm', 'local change'], { cwd: local })

  const before = await repoSyncInfo(local, 'git')
  assert.equal(before?.unpushed, 1)

  assert.deepEqual(await repoPush(local, 'git'), { ok: true })

  const after = await repoSyncInfo(local, 'git')
  assert.equal(after?.unpushed, 0)

  // The remote is a bare repo: after the push its main must point at the
  // local HEAD — the push actually landed, it did not just report success.
  const remoteHead = execFileSync('git', ['-C', remote, 'rev-parse', 'main'], { encoding: 'utf8' }).trim()
  const localHead = execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  assert.equal(remoteHead, localHead)
})

test('repoPush rejects when the repo has no origin remote', async () => {
  const repo = makeRepo()

  await assert.rejects(() => repoPush(repo, 'git'), /No origin remote/)
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

// A local clone diverged from the original project on the same file: the clone
// commits 'local' while the seed commits 'remote' and pushes, so the pull is
// attempted, fails, and leaves a conflicted merge — the state the resolver ops
// exist for.
async function makeConflictedClone() {
  const { remote, seed } = makeRemoteRepo()
  const local = cloneRemote(remote)

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'local\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: local })
  execFileSync('git', ['commit', '-qm', 'local change'], { cwd: local })

  fs.writeFileSync(path.join(seed, 'tracked.txt'), 'remote\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: seed })
  execFileSync('git', ['commit', '-qm', 'remote change'], { cwd: seed })
  execFileSync('git', ['push', '-q', remote, 'main'], { cwd: seed })

  await assert.rejects(() => repoPull(local, 'git'))

  return { local }
}

test('repoSyncInfo reports the conflicted state a conflicted pull leaves behind', async () => {
  const { local } = await makeConflictedClone()

  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.conflicted, true)
  assert.equal(info?.mergeInProgress, true)
  assert.equal(info?.ahead, 1)
  assert.equal(info?.behind, 1)
  assert.deepEqual(info?.conflictedFiles, ['tracked.txt'])
})

test('repoSyncInfo reports mergeInProgress when conflicts are resolved but the merge is uncommitted', async () => {
  const { local } = await makeConflictedClone()

  // The agent resolved every conflict but died (e.g. rate limit) before
  // creating the merge commit — MERGE_HEAD still exists, nothing is unresolved.
  await repoResolveConflict(local, 'tracked.txt', 'ours', 'git')

  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.conflicted, false)
  assert.equal(info?.mergeInProgress, true)
  assert.deepEqual(info?.conflictedFiles, [])
})

test('repoConflictFiles lists conflicted paths with their marker-laden content', async () => {
  const { local } = await makeConflictedClone()

  const result = await repoConflictFiles(local, 'git')

  assert.deepEqual(
    result.files.map(file => file.path),
    ['tracked.txt']
  )

  const content = result.files[0].content ?? ''

  assert.match(content, /<<<<<<< HEAD/)
  assert.match(content, /local/)
  assert.match(content, /remote/)
})

test('repoResolveConflict takes ours', async () => {
  const { local } = await makeConflictedClone()

  assert.deepEqual(await repoResolveConflict(local, 'tracked.txt', 'ours', 'git'), { ok: true })
  assert.equal(fs.readFileSync(path.join(local, 'tracked.txt'), 'utf8').replace(/\r\n/g, '\n'), 'local\n')
  assert.deepEqual(await repoConflictFiles(local, 'git'), { files: [] })
})

test('repoResolveConflict takes theirs', async () => {
  const { local } = await makeConflictedClone()

  assert.deepEqual(await repoResolveConflict(local, 'tracked.txt', 'theirs', 'git'), { ok: true })
  assert.equal(fs.readFileSync(path.join(local, 'tracked.txt'), 'utf8').replace(/\r\n/g, '\n'), 'remote\n')
})

test('repoResolveConflict concatenates both sides for both', async () => {
  const { local } = await makeConflictedClone()

  assert.deepEqual(await repoResolveConflict(local, 'tracked.txt', 'both', 'git'), { ok: true })
  assert.equal(fs.readFileSync(path.join(local, 'tracked.txt'), 'utf8'), 'local\nremote\n')
})

test('repoContinueMerge finishes the merge and preserves the branch commits', async () => {
  const { local } = await makeConflictedClone()

  await repoResolveConflict(local, 'tracked.txt', 'ours', 'git')

  const localCommit = execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  assert.deepEqual(await repoContinueMerge(local, 'git'), { ok: true })

  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.conflicted, false)
  assert.equal(info?.mergeInProgress, false)
  assert.equal(info?.behind, 0)
  // origin/main..HEAD now counts the branch's own commit plus the merge
  // commit — the remote side is fully absorbed, nothing is lost.
  assert.equal(info?.ahead, 2)

  // The local commit is an ancestor of the new merge HEAD — the resolution did
  // not lose the branch's own work.
  assert.doesNotThrow(() => execFileSync('git', ['-C', local, 'merge-base', '--is-ancestor', localCommit, 'HEAD']))
})

test('repoContinueMerge rejects while conflicts remain', async () => {
  const { local } = await makeConflictedClone()

  await assert.rejects(() => repoContinueMerge(local, 'git'), /Unresolved conflicts remain/)
})

test('repoAbortMerge restores the pre-pull state', async () => {
  const { local } = await makeConflictedClone()

  const prePullHead = execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  assert.deepEqual(await repoAbortMerge(local, 'git'), { ok: true })

  assert.equal(execFileSync('git', ['-C', local, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), prePullHead)
  assert.equal(fs.readFileSync(path.join(local, 'tracked.txt'), 'utf8').replace(/\r\n/g, '\n'), 'local\n')

  const info = await repoSyncInfo(local, 'git')

  assert.equal(info?.conflicted, false)
  assert.equal(info?.mergeInProgress, false)
  assert.equal(info?.ahead, 1)
  assert.equal(info?.behind, 1)
})

test('conflict ops reject paths that escape the repository', async () => {
  const { local } = await makeConflictedClone()

  await assert.rejects(() => repoResolveConflict(local, '../outside.txt', 'ours', 'git'), /relative path/)
  await assert.rejects(() => repoResolveConflict(local, String.raw`..\outside.txt`, 'ours', 'git'), /relative path/)
  await assert.rejects(() => repoResolveConflict(local, 'deep/../../outside.txt', 'ours', 'git'), /relative path/)
})

test('repoResolveConflict rejects for a file that is not in conflict', async () => {
  const { local } = await makeConflictedClone()

  await repoResolveConflict(local, 'tracked.txt', 'ours', 'git')

  await assert.rejects(() => repoResolveConflict(local, 'tracked.txt', 'ours', 'git'), /Not a conflicted file/)
})

test('repoResolveConflict rejects an unknown choice', async () => {
  const { local } = await makeConflictedClone()

  await assert.rejects(() => repoResolveConflict(local, 'tracked.txt', 'sideways', 'git'), /Unknown conflict choice/)
})

test('repoConflictFiles reports null for oversized conflicted files', async () => {
  const { local } = await makeConflictedClone()

  fs.writeFileSync(path.join(local, 'tracked.txt'), 'x'.repeat(600 * 1024))

  const result = await repoConflictFiles(local, 'git')

  assert.deepEqual(
    result.files.map(file => file.path),
    ['tracked.txt']
  )
  assert.equal(result.files[0].content, null)
})
