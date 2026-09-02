// electron-builder afterPack 钩子：在生成 zip/DMG 之前对打包好的 .app
// 做 ad-hoc 深签名。此前签名是在 electron-builder 完成之后手工执行的，
// 导致分发的 zip/DMG 里是只有链接器签名的 app，Gatekeeper 判定
// "code has no resources but signature indicates they must be present"，
// 用户下载后提示「已损坏，无法打开」。
const { spawnSync } = require('node:child_process')
const path = require('node:path')

module.exports = async function afterPackSign(context) {
  if (process.platform !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  console.log(`[after-pack-sign] codesign --deep ${appPath}`)
  const result = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(`ad-hoc signing failed with exit code ${result.status}`)
  }
  const verify = spawnSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit'
  })
  if (verify.status !== 0) {
    throw new Error('ad-hoc signature verification failed')
  }
  console.log('[after-pack-sign] signature verified')
}
