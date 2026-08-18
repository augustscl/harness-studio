import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'desktop-services'

// ---------------------------------------------------------------------------
// Bundled pnpm runtime
// ---------------------------------------------------------------------------
function pnpmBinaryPath() {
  const platform = process.platform
  const arch = process.arch
  let rel = null
  if (platform === 'darwin' && arch === 'arm64') rel = path.join('runtime', 'pnpm', 'macos-arm64', 'pnpm')
  else if (platform === 'darwin' && arch === 'x64') rel = path.join('runtime', 'pnpm', 'macos-x64', 'pnpm')
  else if (platform === 'win32') rel = path.join('runtime', 'pnpm', 'win-x64', 'pnpm.exe')
  else if (platform === 'linux') rel = path.join('runtime', 'pnpm', 'linux-x64', 'pnpm')
  if (!rel) return null

  // Packaged app: electron-builder puts the runtime under resources/.
  const packaged = path.join(process.resourcesPath ?? '', rel)
  if (existsSync(packaged)) return packaged

  // Dev / unpacked: <project>/resources/<rel>.
  const dev = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..',
    'resources',
    rel,
  )
  if (existsSync(dev)) return dev
  return null
}

function profileDir() {
  // The desktop engine boots with DSH_HOME=<userData>/dsh (engine-manager.ts).
  if (process.env.DSH_HOME) return process.env.DSH_HOME
  const home = homedir()
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Harness Studio', 'dsh')
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Harness Studio', 'dsh')
  return path.join(home, '.config', 'Harness Studio', 'dsh')
}

function killTree(child) {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      return
    } catch { /* fall through */ }
  }
  try { child.kill('SIGTERM') } catch { /* already gone */ }
  const escalate = setTimeout(() => {
    try { child.kill('SIGKILL') } catch { /* already gone */ }
  }, 3000)
  escalate.unref?.()
}

// ---------------------------------------------------------------------------
// ctx.desktopPnpm — spawns the bundled pnpm binary, one operation at a time.
//
// Contract (dsh-plugin-desktop / dshmarket createDesktopPluginRuntime):
//   runPlugin(args, cwd, signal) → SYNC handle { stdout, stderr, done, cancel }
//   handle.done: Promise<{ exitCode, signal }>
//   busy → throw with "another desktop pnpm operation is already running"
// ---------------------------------------------------------------------------
let activeHandle = null

function runPlugin(args, cwd, signal) {
  const bin = pnpmBinaryPath()
  if (!bin) {
    throw new Error(
      `bundled pnpm runtime is unavailable on ${process.platform}/${process.arch}`
    )
  }
  if (activeHandle !== null) {
    throw new Error('another desktop pnpm operation is already running')
  }
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    throw new Error('runPlugin: args must be an array of strings')
  }
  // dshmarket passes its "invoking dir" (the host's process.cwd()) as cwd.
  // In a desktop shell the engine boots with cwd = the user's documents
  // folder, NOT the profile dir — running pnpm there would re-resolve an
  // unrelated tree and put package.json in the wrong place. Plugin package
  // operations must always land in the active profile directory.
  const requested = typeof cwd === 'string' && cwd.length > 0 ? path.resolve(cwd) : null
  const engineCwd = path.resolve(process.cwd())
  const resolvedCwd =
    requested === null || requested === engineCwd ? profileDir() : requested

  // Isolated pnpm state: never touch the user's global pnpm home or npmrc.
  const env = {
    ...process.env,
    PNPM_HOME: path.join(profileDir(), '.desktop-pnpm-home'),
    npm_config_globalconfig: path.join(profileDir(), '.desktop-pnpm-home', 'npmrc-empty'),
    npm_config_userconfig: path.join(profileDir(), '.desktop-pnpm-home', 'npmrc'),
    COREPACK_ENABLE_STRICT: '0',
    CI: '1',
  }

  const child = spawn(bin, args, {
    cwd: resolvedCwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let cancelled = false
  const done = new Promise((resolve) => {
    child.on('error', (error) => {
      resolve({ exitCode: 127, signal: null, error: String(error?.message ?? error) })
    })
    child.on('close', (code, signalName) => {
      resolve({ exitCode: code ?? null, signal: signalName ?? null })
    })
  })

  const handle = {
    stdout: child.stdout,
    stderr: child.stderr,
    done,
    cancel() {
      if (cancelled) return
      cancelled = true
      killTree(child)
    },
  }
  activeHandle = handle
  void done.finally(() => {
    if (activeHandle === handle) activeHandle = null
  }).catch(() => undefined)

  if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => handle.cancel(), { once: true })
  }
  return handle
}

// ---------------------------------------------------------------------------
// ctx.desktopProfiles
// ---------------------------------------------------------------------------
const desktopProfiles = {
  current: {
    name: 'web',
    label: 'Web (current session)',
    dir: profileDir(),
    kind: 'local',
  },
  list() {
    const dir = profileDir()
    const entries = []
    try {
      if (existsSync(dir)) {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (!e.isDirectory() || e.name.startsWith('.')) continue
          entries.push({ name: e.name, label: e.name, dir: path.join(dir, e.name), kind: 'local' })
        }
      }
    } catch { /* ignore */ }
    return [this.current, ...entries]
  },
  select(name) {
    if (!name || name === 'web') {
      this.current = { name: 'web', label: 'Web (current session)', dir: profileDir(), kind: 'local' }
      return this.current
    }
    const found = this.list().find((p) => p.name === name)
    if (!found) return null
    this.current = found
    return found
  },
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c.toString()
      if (raw.length > 1024 * 1024) req.destroy()
    })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

// ---------------------------------------------------------------------------
// Host entry
// ---------------------------------------------------------------------------
export function apply(ctx, config) {
  const logger = ctx.logger?.('desktop-services') ?? console

  // Provided for other in-box plugins (dshmarket reads ctx.get('desktopProfiles')
  // and then injects ['desktopPnpm'] — the dsh-plugin-desktop contract).
  ctx.provide('desktopProfiles', desktopProfiles)
  ctx.provide('desktopPnpm', { runPlugin, pnpmBinaryPath, version: '11.22.0' })

  ctx.inject(['webServer'], (host) => {
    host.effect(() => {
      const web = host.webServer
      web.register({
        kind: 'exact',
        path: '/desktop/pnpm/status',
        handler: (req, res) => {
          sendJson(res, 200, {
            bundled: pnpmBinaryPath() !== null,
            binary: pnpmBinaryPath(),
            platform: `${process.platform}/${process.arch}`,
            version: '11.22.0',
            running: activeHandle !== null,
          })
        },
      })
      web.register({
        kind: 'exact',
        path: '/desktop/profiles',
        handler: (req, res) => {
          sendJson(res, 200, { current: desktopProfiles.current, profiles: desktopProfiles.list() })
        },
      })
      web.register({
        kind: 'exact',
        path: '/desktop/profiles/select',
        handler: async (req, res) => {
          const body = await readJsonBody(req)
          const p = desktopProfiles.select(body?.name)
          if (!p) sendJson(res, 404, { error: `profile "${String(body?.name)}" not found` })
          else sendJson(res, 200, { current: p })
        },
      })
      web.register({
        kind: 'exact',
        path: '/desktop/pnpm/run',
        handler: async (req, res) => {
          const body = await readJsonBody(req)
          const args = Array.isArray(body?.args) ? body.args : []
          let handle
          try {
            handle = runPlugin(args, body?.cwd)
          } catch (error) {
            sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
            return
          }
          let stdout = ''
          let stderr = ''
          handle.stdout?.on('data', (d) => { stdout += d.toString() })
          handle.stderr?.on('data', (d) => { stderr += d.toString() })
          const outcome = await handle.done
          sendJson(res, outcome.exitCode === 0 ? 200 : 500, {
            ok: outcome.exitCode === 0,
            exitCode: outcome.exitCode,
            signal: outcome.signal,
            stdout,
            stderr,
          })
        },
      })
    }, 'desktop-services: http routes')
  })

  logger.info?.('[desktop-services] ready; bundled pnpm:', pnpmBinaryPath())
}
