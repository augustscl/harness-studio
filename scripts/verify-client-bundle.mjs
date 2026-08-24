// 客户端包运行验证器：模拟 __ModuleLoader__ + 最小 ctx，
// 执行 apply(ctx) 抓 ReferenceError/TypeError 类运行时错误。
// 用法: node scripts/verify-client-bundle.mjs <client.js 路径>
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/verify-client-bundle.mjs <client.js>')
  process.exit(2)
}
const source = readFileSync(file, 'utf8')

const start = source.indexOf('factory: (require) => {')
if (start < 0) {
  console.error('no __ModuleLoader__ factory found — not a client bundle?')
  process.exit(2)
}
// 用括号配平找 factory 函数体的结束位置（对任何 bundle 结构都通用）。
let openIdx = start + 'factory: (require) => '.length
if (source[openIdx] !== '{') {
  console.error('unexpected factory shape')
  process.exit(2)
}
let depth = 0
let closeIdx = -1
for (let i = openIdx; i < source.length; i += 1) {
  const c = source[i]
  if (c === '{') depth += 1
  else if (c === '}') {
    depth -= 1
    if (depth === 0) {
      closeIdx = i
      break
    }
  }
}
if (closeIdx < 0) {
  console.error('factory body never closes')
  process.exit(2)
}
const factoryBody = source.slice(openIdx + 1, closeIdx)

const reactMock = new Proxy({}, { get: (_t, k) => (k === 'useRef' ? () => ({ current: null }) : () => undefined) })
const jsxRuntimeMock = new Proxy({}, { get: () => () => ({}) })
const requireStub = (name) => {
  if (name === 'react') return reactMock
  if (name === 'react/jsx-runtime') return jsxRuntimeMock
  if (name.includes('primitives')) return {}
  throw new Error('unexpected require: ' + name)
}

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  URL,
  fetch: async () => ({ json: async () => ({ ok: true, tasks: [], sessions: [], skills: [], text: '' }) }),
  window: {
    __ModuleLoader__: { load: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, textContent: '', style: {} }),
      head: { appendChild() {} }
    }
  }
}
vm.createContext(sandbox)

const fnSrc = `(function(require){ var module={exports:{}}; var exports=module.exports; ${factoryBody}\n; return module.exports; })`
let factory
try {
  factory = vm.runInContext(fnSrc, sandbox)
} catch (e) {
  console.error('FAIL (parse/eval):', e.message)
  process.exit(1)
}
const mod = factory(requireStub)
const names = Object.keys(mod ?? {})
if (typeof mod?.apply !== 'function') {
  console.error('FAIL: module has no apply — exports:', names.join(', '))
  process.exit(1)
}

const registry = []
const slotsMock = {
  inject: (name, cb) => {
    try {
      return cb() ?? {}
    } catch (e) {
      console.error(`FAIL: slot inject cb "${name}" threw:`, e.message)
      process.exit(1)
    }
  },
  register: (opts) => {
    registry.push(`${opts?.name}#${opts?.id ?? '?'}`)
    return {}
  }
}
const ctxMock = {
  locale: { register: () => {} },
  theme: { register: () => {} },
  remote: { goals: { pause: async () => ({ ok: true }), resume: async () => ({ ok: true }), clear: async () => ({ ok: true }) } },
  inject: (_deps, cb) => {
    try {
      cb({ slots: slotsMock })
    } catch (e) {
      console.error('FAIL: inject cb threw:', e.message)
      process.exit(1)
    }
  },
  slots: slotsMock,
  effect: (fn) => {
    try {
      fn()
    } catch (e) {
      console.error('FAIL: effect body threw:', e.message)
      process.exit(1)
    }
    return () => {}
  },
  on: () => () => {},
  once: () => () => {}
}

try {
  mod.apply(ctxMock)
} catch (e) {
  console.error('FAIL: apply threw:', e.message)
  process.exit(1)
}
console.log(`OK  ${file}  (exports: ${names.join(', ')}; slots: ${registry.length})`)
