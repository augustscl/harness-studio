// 内置 pnpm 运行时拉取脚本（幂等）。
// pnpm 的平台独立二进制（mac ~141MB / win ~98MB）超过 GitHub 100MB 单文件
// 限制，不能入库；本脚本在 npm install 后按当前平台下载官方 artifact
// 并与 pnpm 的 JS dist 组装成完整运行时：
//   resources/runtime/pnpm/<platform-dir>/{pnpm|pnpm.exe + dist/}
// 已存在则跳过（本地可离线重复安装）。
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = '11.22.0'
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function artifactFor() {
  const { platform, arch } = process
  if (platform === 'darwin' && arch === 'arm64') return { pkg: '@pnpm/macos-arm64', bin: 'pnpm', dir: 'macos-arm64' }
  if (platform === 'darwin' && arch === 'x64') return { pkg: '@pnpm/macos-x64', bin: 'pnpm', dir: 'macos-x64' }
  if (platform === 'win32' && arch === 'x64') return { pkg: '@pnpm/win-x64', bin: 'pnpm.exe', dir: 'win-x64' }
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

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  if (r.status !== 0) {
    const detail = (r.stderr?.toString() || r.stdout?.toString() || '').slice(0, 400)
    throw new Error(`${cmd} ${args.join(' ')} 失败: ${detail}`)
  }
  return r
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
  run('npm', ['pack', `${art.pkg}@${VERSION}`, '--silent'], tmp)
  run('npm', ['pack', `pnpm@${VERSION}`, '--silent'], tmp)
  const tgz = (name) => path.join(tmp, `${name}-${VERSION}.tgz`)
  run(tarBinary(), ['-xzf', tgz(art.pkg.replace(/^@/, '').replace('/', '-'))], tmp)
  run(tarBinary(), ['-xzf', tgz('pnpm')], tmp)
  const pkgDir = path.join(tmp, 'package')
  mkdirSync(target, { recursive: true })
  cpSync(path.join(pkgDir, art.bin), path.join(target, art.bin))
  cpSync(path.join(pkgDir, 'dist'), path.join(target, 'dist'), { recursive: true })
  for (const extra of ['LICENSE', 'README.md', 'package.json']) {
    if (existsSync(path.join(pkgDir, extra))) cpSync(path.join(pkgDir, extra), path.join(target, extra))
  }
  if (process.platform !== 'win32') chmodSync(path.join(target, art.bin), 0o755)
  console.log(`[pnpm-runtime] 完成: ${target}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
