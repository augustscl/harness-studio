import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const projectRoot = new URL('../', import.meta.url)
const releaseDirectory = new URL('../release/', import.meta.url)
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function sourceCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8'
    }).trim()
  } catch {
    return null
  }
}

const artifactNames = readdirSync(releaseDirectory)
  .filter((name) => name.endsWith('.dmg') || name.endsWith('.zip'))
  .sort()

if (artifactNames.length === 0) {
  throw new Error('No DMG or ZIP artifacts were found in release/')
}

const artifacts = artifactNames.map((name) => {
  const path = join(releaseDirectory.pathname, name)
  return {
    name,
    bytes: statSync(path).size,
    sha256: sha256(path)
  }
})

const manifest = {
  schemaVersion: 1,
  product: packageJson.build.productName,
  version: packageJson.version,
  architecture: 'arm64',
  platform: 'darwin',
  signed: false,
  notarized: false,
  sourceCommit: sourceCommit(),
  packageLockSha256: sha256(new URL('../package-lock.json', import.meta.url)),
  buildRuntime: {
    node: process.versions.node,
    npm: process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1] ?? null
  },
  bundledRuntime: {
    electron: packageJson.devDependencies.electron,
    node: '24.18.1',
    dsh: packageJson.dependencies['@deepseek-ai/dsh']
  },
  artifacts
}

writeFileSync(
  new URL('../release/build-manifest.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o644 }
)

for (const artifact of artifacts) {
  console.log(`${artifact.sha256}  ${artifact.name}`)
}
