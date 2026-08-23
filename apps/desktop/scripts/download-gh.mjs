/**
 * download-gh.mjs — Downloads the GitHub CLI (gh) binary for bundling
 * with the Electron app. Runs during the build process.
 *
 * The binary is downloaded from the official GitHub CLI releases and placed
 * in the build/ directory so it can be included as an extraResource.
 */
import { existsSync, mkdirSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import https from 'node:https'
import http from 'node:http'

const GH_VERSION = '2.67.0'

function getPlatformConfig(platform) {
  const configs = {
    win32: {
      url: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_windows_amd64.zip`,
      filename: 'gh.exe',
      zipName: 'gh.zip'
    },
    darwin: {
      url: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_macOS_amd64.tar.gz`,
      filename: 'gh',
      zipName: 'gh.tar.gz'
    },
    linux: {
      url: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz`,
      filename: 'gh',
      zipName: 'gh.tar.gz'
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
  
  if (zipPath.endsWith('.zip')) {
    // Windows: use PowerShell to extract
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`)
  } else {
    // Unix: use tar
    execSync(`tar -xzf "${zipPath}" -C "${destDir}"`)
  }
  
  // Find and move the binary
  const fs = await import('node:fs/promises')
  const files = await fs.readdir(destDir)
  
  // gh extracts to a subdirectory like gh_2.67.0_windows_amd64/
  const subDir = files.find(f => f.startsWith('gh_') && !f.endsWith('.zip') && !f.endsWith('.tar.gz'))
  let ghFile
  
  if (subDir) {
    // Look inside the subdirectory
    const subFiles = await fs.readdir(join(destDir, subDir))
    ghFile = subFiles.find(f => f === filename || f.startsWith('gh'))
    if (ghFile) {
      const sourcePath = join(destDir, subDir, ghFile)
      ghFile = filename
      const destPath = join(destDir, ghFile)
      await fs.rename(sourcePath, destPath)
      await fs.rm(join(destDir, subDir), { recursive: true, force: true })
    }
  } else {
    ghFile = files.find(f => f === filename || f.startsWith('gh'))
  }
  
  if (!ghFile) {
    throw new Error(`Could not find ${filename} in extracted files`)
  }
  
  const destPath = join(destDir, filename)
  
  // Make executable on Unix
  if (process.platform !== 'win32') {
    chmodSync(destPath, 0o755)
  }
  
  // Clean up other files
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
  
  const buildDir = join(import.meta.dirname, '..', 'build', 'gh')
  
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true })
  }
  
  const zipPath = join(buildDir, config.zipName)
  const binaryPath = join(buildDir, config.filename)
  
  // Skip if already downloaded
  if (existsSync(binaryPath)) {
    console.log(`[download-gh] gh already exists at ${binaryPath}`)
    return
  }
  
  console.log(`[download-gh] Downloading gh ${GH_VERSION} for ${platform}...`)
  console.log(`[download-gh] URL: ${config.url}`)
  
  try {
    await downloadFile(config.url, zipPath)
    console.log(`[download-gh] Extracting...`)
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
    
    console.log(`[download-gh] Successfully installed gh at ${binaryPath}`)
  } catch (err) {
    console.error(`[download-gh] Failed to download gh: ${err.message}`)
    process.exit(1)
  }
}

main()
