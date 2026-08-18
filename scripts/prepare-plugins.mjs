// 安装后钩子：把内置插件登记进 dsh 包的依赖清单。
// healProfilesModuleFallback 在引擎启动时按 dsh/package.json 的依赖闭包
// 为用户 profile 建立符号链接 —— 内置插件必须出现在这里才会被识别为
// "in-box"。本脚本幂等，可重复运行。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dshPkgPath = join(
  process.cwd(),
  'node_modules',
  '@deepseek-ai',
  'dsh',
  'package.json'
)

const PLUGINS = {
  '@harness/file-upload': '0.1.0',
  '@harness/dsh-skin': '0.1.0',
  '@harness/artifact-studio': '0.1.0',
  '@harness/studio-ux': '0.1.0',
  '@harness/desktop-services': '1.0.0',
  dshmarket: '1.8.0'
}

try {
  const pkg = JSON.parse(readFileSync(dshPkgPath, 'utf8'))
  let changed = false
  pkg.dependencies ??= {}
  for (const [name, version] of Object.entries(PLUGINS)) {
    if (pkg.dependencies[name] === undefined) {
      pkg.dependencies[name] = version
      changed = true
    }
  }
  if (changed) {
    writeFileSync(dshPkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log('[prepare-plugins] dsh/package.json: 已登记内置插件依赖')
  } else {
    console.log('[prepare-plugins] dsh/package.json: 插件依赖已存在，跳过')
  }
} catch (error) {
  console.error('[prepare-plugins] 失败:', error)
  process.exitCode = 1
}
