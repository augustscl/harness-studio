// 内置 pnpm 运行时拉取脚本（幂等）。
// pnpm 的平台独立二进制（mac ~141MB / win ~98MB）超过 GitHub 100MB 单文件
// 限制，不能入库；本脚本在 npm install 后按当前平台下载官方 artifact
// 并与 pnpm 的 JS dist 组装成完整运行时：
//   resources/runtime/pnpm/<platform-dir>/{pnpm|pnpm.exe + dist/}
// 已存在则跳过（本地可离线重复安装）。
//
// 下载用 Node 内置 fetch 直接访问 registry.npmjs.org（Windows 上 spawnSync
// 无法执行 npm.cmd 垫片，EINVAL），解压用系统 tar（Win10+ 自带 tar.exe）。
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = '11.22.0'
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function artifactFor() {
  const { platform, arch } = process
  if (platform === 'darwin' && arch === 'arm64') return { pkg: '@pnpm/macos-arm64', bin: 'pnpm', dir: 'macos-arm64' }
  if (platform === 'darwin' && arch === 'x64') return { pkg: '@pnpm/macos-x64', bin: 'pnpm', dir: 'macos-x64' }
  if (platform === 'win32') return { pkg: '@pnpm/win-x64', bin: 'pnpm.exe', dir: 'win-x64' }
  if (platform === 'linux' && arch === 'x64') return { pkg: '@pnpm/linux-x64', bin: 'pnpm', dir: 'linux-x64' }
  return null
}

function tarBinary() {
  if (process.platform === 'win32') {
    // Windows 10+ 自带 bsdtar。
    const systemTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    if (existsSync(systemTar)) return systemTar
  }
  return 'tar'
}

/** registry.npmjs.org 的 tarball 直链。 */
function tarballUrl(pkg) {
  if (pkg.startsWith('@')) {
    const [scope, name] = pkg.split('/')
    return `https://registry.npmjs.org/${scope}/${name}/-/${name}-${VERSION}.tgz`
  }
  return `https://registry.npmjs.org/${pkg}/-/${pkg}-${VERSION}.tgz`
}

function extractTarball(tgzPath, intoDir) {
  const r = spawnSync(tarBinary(), ['-xzf', tgzPath], {
    cwd: intoDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (r.error || r.status !== 0) {
    const detail = (r.error?.message || r.stderr?.toString() || r.stdout?.toString() || '').slice(0, 400)
    throw new Error(`tar 解压失败: ${detail}`)
  }
}

const art = artifactFor()
const runtimeRoot = path.join(projectRoot, 'resources', 'runtime', 'pnpm')
if (!art) {
  console.log('[pnpm-runtime] 当前平台无预编译 pnpm，跳过')
  process.exit(0)
}
const target = path.join(runtimeRoot, art.dir)
if (existsSync(path.join(target, art.bin)) && existsSync(path.join(target, 'dist', 'pnpm.mjs'))) {
  console.log(`[pnpm-runtime] 已存在 ${art.dir}，跳过`)
  process.exit(0)
}

const tmp = path.join(runtimeRoot, '.fetch-tmp')
console.log(`[pnpm-runtime] 拉取 ${art.pkg}@${VERSION} + pnpm@${VERSION} …`)
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
mkdirSync(runtimeRoot, { recursive: true })
try {
  const artTgz = path.join(tmp, 'artifact.tgz')
  const jsTgz = path.join(tmp, 'pnpm-js.tgz')
  for (const [url, dest, label] of [
    [tarballUrl(art.pkg), artTgz, art.pkg],
    [tarballUrl('pnpm'), jsTgz, `pnpm@${VERSION}`],
  ]) {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`下载 ${label} 失败: HTTP ${res.status} ${url}`)
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  }
  const artDir = path.join(tmp, 'artifact')
  const jsDir = path.join(tmp, 'js')
  mkdirSync(artDir, { recursive: true })
  mkdirSync(jsDir, { recursive: true })
  extractTarball(artTgz, artDir)
  extractTarball(jsTgz, jsDir)

  mkdirSync(target, { recursive: true })
  const artPkg = path.join(artDir, 'package')
  const jsPkg = path.join(jsDir, 'package')
  cpSync(path.join(artPkg, art.bin), path.join(target, art.bin))
  cpSync(path.join(jsPkg, 'dist'), path.join(target, 'dist'), { recursive: true })
  for (const extra of ['LICENSE', 'README.md']) {
    if (existsSync(path.join(jsPkg, extra))) cpSync(path.join(jsPkg, extra), path.join(target, extra))
  }
  if (process.platform !== 'win32') chmodSync(path.join(target, art.bin), 0o755)
  console.log(`[pnpm-runtime] 完成: ${target}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
