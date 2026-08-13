# Harness Studio

Harness Studio 是一个面向 macOS 的 DeepSeek Harness 桌面客户端。它把固定版本的 Harness 运行时随应用一起打包，在本机回环地址启动服务，并用原生 Electron 窗口承载官方界面。

> 当前版本是独立社区预览，并非 DeepSeek 官方产品。DeepSeek Harness 本身仍处于 developer preview，可能出现破坏性变更。

## 能做什么

- 双击启动，不需要安装或操作全局 `dsh` 命令
- 直接使用官方 Harness Web 界面、模型设置、工作区与会话能力
- 跟随 macOS 深浅色外观，提供原生工具栏、启动进度、失败恢复和日志入口
- 自动选择本地端口，只监听 `127.0.0.1`
- 退出应用时先优雅停止 Harness，再清理整个子进程组
- 强制关闭 Harness 遥测；模型请求仍会按你选择的模型提供商设置发送

## 系统要求

- Apple Silicon Mac（arm64）
- macOS 12.0 或更高版本
- 使用模型时需要你自己的模型提供商账号或 API 凭据

凭据只应在 Harness 自己的设置界面中填写。不要把密钥写入项目文件、终端命令或问题报告。

## 使用

1. 将 `Harness Studio.app` 拖入“应用程序”。
2. 打开应用，等待顶部状态变为“已连接”。
3. 在官方 Harness 界面中完成模型与工作区设置，然后开始会话。
4. `⌘R` 刷新界面；`⇧⌘R` 重启本地 Harness 引擎。

应用数据与引擎日志位于 Harness Studio 自己的 macOS 应用数据目录，可通过工具栏文件夹和日志按钮直接打开。

## 首次打开未签名预览版

当前本地预览包没有 Apple Developer ID 签名或公证。浏览器下载后，macOS 可能提示无法验证开发者：

1. 先正常尝试打开一次应用。
2. 打开“系统设置 → 隐私与安全性”。
3. 在对应拦截提示旁选择“仍要打开”。

受管理的企业 Mac 可能不允许绕过此限制。请先核对发布渠道提供的 SHA-256。正式公开分发前应完成 Developer ID 签名、hardened runtime、公证与 stapling。

## 安全边界

- 本地服务只绑定 `127.0.0.1`，应用不会把 Web 服务开放到局域网。
- Harness 遥测在桌面客户端中被强制关闭；这不等于模型请求离线。你发送给模型的提示、代码和工具结果可能由所配置的模型服务商处理。
- Harness 的本地沙箱主要限制文件写入，不是完整的读取、网络或进程隔离。不要在同一 macOS 账号下暴露不希望代理读取的 SSH、云平台或其他敏感文件。
- 第三方插件是在本机执行的代码。只安装你信任的插件。
- 处理机密仓库时，建议使用独立 macOS 账号、临时虚拟机或容器化工作区。

## 本地构建

构建使用固定的依赖锁文件，不依赖全局 Harness：

```bash
npm ci
npm run check
npm run test:e2e
npm run dist:mac
```

`dist:mac` 生成 arm64 的 DMG 和 ZIP。当前必须保持 `asar: false`：Harness 首次启动会在自己的数据目录中建立指向打包依赖的符号链接，把运行时放入 ASAR 会破坏这些链接。

## 技术说明

- Electron `43.4.0`（内置 Node `24.18.1`）
- `@deepseek-ai/dsh@0.1.0-rc.6`
- 当前 Harness 的必需 peer dependencies 作为精确版本运行时闭包随包固定，并在发布时递归审计
- Harness 由 Electron 的 Node 模式启动，并使用 `--expose-internals` 满足当前 HMR 运行时要求
- 官方完整就绪行与首页启动标记共同作为健康判据
- 主页面使用隔离的 `WebContentsView`；Node integration 关闭、context isolation 与 sandbox 开启

## 许可与归属

Harness Studio 自身代码使用 MIT License。DeepSeek Harness 及其依赖受各自许可证约束，详见 [THIRD_PARTY.md](THIRD_PARTY.md)。DeepSeek 名称和相关商标归其权利人所有。
