import {
  existsSync,
  readFileSync,
  realpathSync
} from 'node:fs'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve
} from 'node:path'

const appPath = resolve(
  process.argv[2] ?? 'release/mac-arm64/Harness Studio.app'
)
const applicationRoot = realpathSync(
  join(appPath, 'Contents', 'Resources', 'app')
)
const rootManifest = readManifest(applicationRoot)
const queue = Object.keys(rootManifest.dependencies ?? {}).map((name) => ({
  name,
  from: applicationRoot,
  chain: ['Harness Studio', name],
  required: true
}))
const visited = new Set()
const missing = []

function readManifest(packageDirectory) {
  return JSON.parse(
    readFileSync(join(packageDirectory, 'package.json'), 'utf8')
  )
}

function isInsideApplication(path) {
  const candidate = relative(applicationRoot, path)
  return candidate === '' || (!candidate.startsWith('..') && !isAbsolute(candidate))
}

function resolvePackage(from, name) {
  let directory = from
  while (isInsideApplication(directory)) {
    const candidate = join(directory, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) {
      const realPath = realpathSync(candidate)
      if (!isInsideApplication(realPath)) {
        throw new Error(`Runtime package escapes the application: ${candidate} -> ${realPath}`)
      }
      return realPath
    }
    if (directory === applicationRoot) break
    directory = dirname(directory)
  }
  return undefined
}

while (queue.length > 0) {
  const request = queue.shift()
  const packageDirectory = resolvePackage(request.from, request.name)
  if (!packageDirectory) {
    if (request.required) missing.push(request.chain.join(' -> '))
    continue
  }
  if (visited.has(packageDirectory)) continue
  visited.add(packageDirectory)

  const manifest = readManifest(packageDirectory)
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    queue.push({
      name,
      from: packageDirectory,
      chain: [...request.chain, name],
      required: true
    })
  }
  for (const name of Object.keys(manifest.peerDependencies ?? {})) {
    queue.push({
      name,
      from: packageDirectory,
      chain: [...request.chain, name],
      required: manifest.peerDependenciesMeta?.[name]?.optional !== true
    })
  }
  for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
    queue.push({
      name,
      from: packageDirectory,
      chain: [...request.chain, name],
      required: false
    })
  }
}

if (missing.length > 0) {
  console.error('The packaged runtime dependency closure is incomplete:')
  for (const chain of missing.slice(0, 40)) console.error(`- ${chain}`)
  if (missing.length > 40) console.error(`- …and ${missing.length - 40} more`)
  process.exit(1)
}

console.log(`Runtime closure audit passed: ${visited.size} packages resolved inside the app`)
