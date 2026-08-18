# Windows 版构建指南

Harness Studio 的代码层 Windows 适配已全部完成（窗口样式、菜单、登录
shell 解析、引擎启动参数、插件路径兼容）。唯一无法在 macOS 上完成的是
`node-pty` 的原生编译 —— 它没有发布任何预编译二进制（官方 v1.1.0 release
零资产），且 Electron ABI(148) 的 win32 预编译也不存在，必须用 MSVC
在 Windows 上原生构建。

## 在 Windows 机器上构建（一次性）

前置：Node.js 22+、npm、Visual Studio Build Tools（含 C++ 桌面开发负载）、
Git。然后：

```powershell
git clone <本仓库> && cd harness-studio
npm install          # Windows 上会自动编译 node-pty + 各原生依赖
npm run dist:win     # 产出 release/Harness-Studio-<version>-x64.exe（NSIS 安装包）
```

## 或者用 GitHub Actions（无需本地 Windows）

把仓库推到 GitHub，推送 `main` 后到 Actions 页面手动触发
"build-windows" 工作流，产物 exe 会出现在 workflow 的 Artifacts 里。

## 代码层已完成的适配清单

| 文件 | 改动 |
|---|---|
| src/main/window-controller.ts | win32 用 titleBarStyle:hidden + titleBarOverlay（替代 macOS 红绿灯/毛玻璃） |
| src/main/app-menu.ts | win32 菜单去掉 macOS 专属项（services/hide 等），保留退出 |
| src/main/login-shell-path.ts | win32 直接使用进程 PATH（无登录 shell 探测） |
| src/main/main.ts | 引擎启动参数加 `--patch upload.patch.yml`（位于 --host 之前，双平台一致） |
| src/main/tray.ts | 系统托盘（双平台）：显示/隐藏、重启引擎、打开日志、退出；关闭窗口 = 收起托盘 |
| src/main/desktop-services（vendor） | 内置 pnpm 11.22 运行时 + desktopProfiles/desktopPnpm 服务（对齐 anywhere-labs dsh-plugin-desktop 契约） |
| resources/runtime/pnpm/ | macos-arm64 + win-x64 双平台 pnpm 独立二进制（随安装包分发，插件市场安装零依赖） |
| package.json | 新增 win/nsis 打包配置 + `dist:win` 脚本 + win32 原生依赖声明 + extraResources 携带 runtime/pnpm |
| build/icon.ico | 由 build/icon.icns 生成的多尺寸 Windows 图标 |
| vendor/ | 六个内置插件（file-upload/dsh-skin/artifact-studio/studio-ux/desktop-services/dshmarket）以 file: 依赖形式进入打包 |
| upload.patch.yml | 仓库根目录（打包后落在 resources/app/，与 macOS 版行为一致） |
| node_modules/@deepseek-ai/dsh/package.json | 已登记插件依赖（heal 机制在用户机器上自动建立链接） |
| node-addon-require-builtin-win32-x64-msvc | 已放入 node_modules（另一原生依赖的 win32 变体） |
| @harness/file-upload | 附件引用路径统一正斜杠（Windows 下消息内路径可读） |

## 插件市场：零依赖安装（重要）

插件市场的安装/卸载命令由内置的 `resources/runtime/pnpm/win-x64/pnpm.exe`
执行 —— **用户机器上不需要 Node、不需要 pnpm、不需要 corepack**。
引擎把用户数据目录（`%APPDATA%/Harness Studio/dsh`）作为插件 profile，
安装结果直接落在那里，重启引擎后生效。桌面服务按
[anywhere-labs dsh-plugin-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop)
的契约提供 `desktopProfiles` / `desktopPnpm` 服务，dshmarket 检测到后走
Desktop 模式（不再探测系统 PATH，不再触发一键安装组件的引导）。

## 系统托盘

- 关闭窗口 = 最小化到托盘（不是退出）；托盘菜单可显示窗口、重启引擎、
  打开日志目录、真正退出。
- 退出只能通过窗口菜单「退出」或托盘「退出 Harness Studio」。

## 分发提醒

- 未签名 exe：Windows SmartScreen 会提示"未知发布者"，用户需
  「更多信息 → 仍要运行」。正式分发建议购买代码签名证书。
- 目标架构 x64（绝大多数 Windows）；如需 arm64 Windows 另行加构。
- 首次运行会弹出新手引导：欢迎 → 配置 DeepSeek Key → 选供应商 → 功能介绍。

## 待办（需要 Windows 真机验证）

1. 首次启动引擎（PowerShell 路径、杀进程、单实例锁）
2. 五个插件的 Windows 路径行为（盘符、uploads/ 落盘）
3. 设置面板与皮肤（已修复 backdrop-filter 包含块问题的跨平台一致性）
4. 窗口标题栏 overlay 与工具栏的视觉间距
