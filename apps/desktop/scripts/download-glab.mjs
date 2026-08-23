/**
 * download-glab.mjs — Downloads the GitLab CLI (glab) binary for bundling
 * with the Electron app. Runs during the build process.
 *
 * The binary is downloaded from the official GitLab CLI releases and placed
 * in the build/ directory so it can be included as an extraResource.
 */
import { existsSync, mkdirSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import https from 'node:https'
import http from 'node:http'

const GLAB_VERSION = '1.51.0'

function getPlatformConfig(platform) {
  const configs = {
    win32: {
      url: `https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_windows_amd64.zip`,
      filename: 'glab.exe',
      zipName: 'glab.zip'
    },
    darwin: {
      url: `https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_darwin_amd64.tar.gz`,
      filename: 'glab',
      zipName: 'glab.tar.gz'
    },
    linux: {
      url: `https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_linux_amd64.tar.gz`,
      filename: 'glab',
      zipName: 'glab.tar.gz'
    }
  }
  return configs[platform] || configs.linux
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const file = createWriteStream(dest)
    
    protocol.get(url, { headers: { 'User-Agent': 'Hermes-Desktop-Builder' } }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close()
        downloadFile(response.headers.location, dest).then(resolve).catch(reject)
        return
      }
      
      if (response.statusCode !== 200) {
        file.close()
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }
      
      pipeline(response, file).then(resolve).catch(reject)
    }).on('error', (err) => {
      file.close()
      reject(err)
    })
  })
}

async function extractBinary(zipPath, destDir, filename) {
  const { execSync } = await import('node:child_process')
  const fs = await import('node:fs/promises')
  
  if (zipPath.endsWith('.zip')) {
    // Windows: use PowerShell to extract
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`)
  } else {
    // Unix: use tar
    execSync(`tar -xzf "${zipPath}" -C "${destDir}"`)
  }
  
  // Find the binary - may be in a subdirectory like bin/
  const files = await fs.readdir(destDir)
  let sourcePath = null
  
  // First check root directory
  const rootMatch = files.find(f => f === filename || f.startsWith('glab'))
  if (rootMatch && !rootMatch.endsWith('.zip') && !rootMatch.endsWith('.tar.gz')) {
    sourcePath = join(destDir, rootMatch)
  }
  
  // If not found in root, look in subdirectories
  if (!sourcePath) {
    for (const file of files) {
      const filePath = join(destDir, file)
      const stat = await fs.stat(filePath)
      if (stat.isDirectory()) {
        const subFiles = await fs.readdir(filePath)
        const subMatch = subFiles.find(f => f === filename || f.startsWith('glab'))
        if (subMatch) {
          sourcePath = join(filePath, subMatch)
          break
        }
      }
    }
  }
  
  if (!sourcePath) {
    throw new Error(`Could not find ${filename} in extracted files`)
  }
  
  const destPath = join(destDir, filename)
  
  // Move the binary to the destination
  if (sourcePath !== destPath) {
    await fs.copyFile(sourcePath, destPath)
  }
  
  // Make executable on Unix
  if (process.platform !== 'win32') {
    chmodSync(destPath, 0o755)
  }
  
  // Clean up everything except the binary
  const remainingFiles = await fs.readdir(destDir)
  for (const file of remainingFiles) {
    if (file !== filename) {
      await fs.rm(join(destDir, file), { recursive: true, force: true })
    }
  }
}

async function main() {
  const platform = process.argv[2] || process.platform
  const config = getPlatformConfig(platform)
  
  const buildDir = join(import.meta.dirname, '..', 'build', 'glab')
  
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true })
  }
  
  const zipPath = join(buildDir, config.zipName)
  const binaryPath = join(buildDir, config.filename)
  
  // Skip if already downloaded
  if (existsSync(binaryPath)) {
    console.log(`[download-glab] glab already exists at ${binaryPath}`)
    return
  }
  
  console.log(`[download-glab] Downloading glab ${GLAB_VERSION} for ${platform}...`)
  console.log(`[download-glab] URL: ${config.url}`)
  
  try {
    await downloadFile(config.url, zipPath)
    console.log(`[download-glab] Extracting...`)
    await extractBinary(zipPath, buildDir, config.filename)
    
    // Clean up archive (may already be moved by extractBinary)
    try {
      const { unlinkSync } = await import('node:fs')
      if (existsSync(zipPath)) {
        unlinkSync(zipPath)
      }
    } catch {
      // Ignore cleanup errors
    }
    
    console.log(`[download-glab] Successfully installed glab at ${binaryPath}`)
  } catch (err) {
    console.error(`[download-glab] Failed to download glab: ${err.message}`)
    process.exit(1)
  }
}

main()
