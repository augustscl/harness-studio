# Harness Studio

一个能双击启动的 DeepSeek Harness 桌面客户端。

我不是程序员，一行代码没写。21:51下单，22:56交付，7次提交，65分钟。之后又用了32条消息骂它、改它，迭代成现在的样子。

> 丑话说在前面：这是独立社区预览，**不是 DeepSeek 官方产品**。DeepSeek Harness 本身还在 developer preview，随时可能有破坏性变更。

## 为什么做这个

用 Harness 得开终端、敲命令。我英语专业出身，做过销售、猎头、会展，最后在一家学术教育公司做社群运营——终端对我来说，是"能用但不想用"的东西。

于是我给 AI 发了一条消息：

「你能不能基于 deepseek-harness 做一个客户端？在终端里用还是不方便。我要的是真的能用的，UI好看的，类似苹果那种风格。」

65分钟后，它交付了。下单模板、验收清单、报修模板这套东西，我整理成了教程，之后会放进这个仓库的文档里。

## 下载

最新版永远在这里：

👉 [github.com/augustscl/harness-studio/releases/latest](https://github.com/augustscl/harness-studio/releases/latest)

版本历史：

| 版本 | 日期 | 变化 |
|------|------|------|
| v0.2.0 | 2026-08-17 | 插件市场 + 内置5插件（上传/皮肤/产物工坊/交互优化） |
| v0.1.1 | 2026-08-14 | 文件上传入口（含预设图片） |
| v0.1.0 | 2026-08-13 | 第一版：设计→骨架→引擎→桌面壳→发布验证 |

## Windows 版

macOS 之外，Windows（x64）版通过 GitHub Actions 构建（node-pty 需要在
Windows 上原生编译，Mac 上无法交叉构建）：

1. 打开仓库的 [Actions](https://github.com/augustscl/harness-studio/actions) 页面
2. 左侧选 **build-windows** → 右侧 **Run workflow** 手动触发
3. 几分钟后构建完成，在运行页底部的 Artifacts 下载
   `harness-studio-windows-x64`，解压即得 NSIS 安装包（exe）

Windows 版功能与 macOS 版一致（上传/皮肤/产物工坊/新手引导/插件市场）。
注意：exe 未签名，SmartScreen 会提示"未知发布者"，需点「更多信息 → 仍要
运行」；正式分发建议配置代码签名证书。详细构建与验证清单见
[WINDOWS.md](WINDOWS.md)。

## 安装

1. 双击 dmg，把 `Harness Studio.app` 拖进"应用程序"。
2. 打开，等顶部状态变成"已连接"。
3. 在 Harness 界面里配好模型（用你自己的账号或 API 凭据），开始用。

`⌘R` 刷新界面，`⇧⌘R` 重启本地引擎。

凭据只应在 Harness 自己的设置界面里填。别把密钥写进项目文件、终端命令或 issue。

### 打开提示"无法验证开发者"

正常，别慌。这是没签名的社区预览版。

1. 先正常尝试打开一次。
2. 系统设置 → 隐私与安全性。
3. 点"仍要打开"。

受管理的企业 Mac 可能不让绕过，那就先核对发布页的 SHA-256。正式公开分发前应该补 Developer ID 签名、公证和 stapling——这句话是写给我自己看的，还没做。

## 能做什么

- 双击启动，不用装全局 `dsh`，不用碰终端
- 官方 Harness Web 界面、模型设置、工作区、会话能力全都在
- 跟随 macOS 深浅色外观，自带原生工具栏、启动进度、失败恢复、日志入口
- 端口自动选，只监听 `127.0.0.1`，不开放到局域网
- 退出时先优雅停掉 Harness，再清理整个子进程组
- 强制关闭 Harness 遥测

内置 5 个插件，开箱即用：

| 插件 | 干什么 |
|------|--------|
| dshmarket | 插件市场：客户端内浏览、安装插件 |
| @harness/file-upload | 文件上传入口（含预设图片） |
| @harness/dsh-skin | 皮肤引擎：预设皮肤 + 全局染色 |
| @harness/artifact-studio | 产物工坊：工作目录产物浏览与管理 |
| @harness/studio-ux | 对话交互体验优化 |

## 还没有的

- **Windows 版**。我用 Mac，所以先做了 Mac。这事记在小本本上。
- **Apple 签名与公证**。免费分发够用，正式分发前补。
- 皮肤配色还在迭代，浅色系没调完。

## 安全边界

- 本地服务只绑定 `127.0.0.1`，不会把 Web 服务开放到局域网。
- 遥测被强制关闭，但**这不等于模型请求离线**。你发给模型的提示、代码和工具结果，仍由你配置的模型服务商处理。
- Harness 的本地沙箱主要限制文件写入，不是完整的读取、网络或进程隔离。别在同一个 macOS 账号下暴露不希望代理读取的 SSH、云平台或其他敏感文件。
- 第三方插件是在你本机执行的代码。只装你信任的插件。
- 处理机密仓库时，建议用独立 macOS 账号、临时虚拟机或容器化工作区。

## 本地构建

构建用固定的依赖锁文件，不依赖全局 Harness：

```bash
npm ci
npm run check
npm run test:e2e
npm run dist:mac
```

`dist:mac` 生成 arm64 的 DMG 和 ZIP。当前必须保持 `asar: false`：Harness 首次启动会在自己的数据目录里建指向打包依赖的符号链接，把运行时放进 ASAR 会弄断这些链接。

## 技术说明

- Electron `43.4.0`（内置 Node `24.18.1`）
- `@deepseek-ai/dsh@0.1.0-rc.6`
- Harness 必需的 peer dependencies 作为精确版本的运行时闭包随包固定，发布时递归审计
- Harness 由 Electron 的 Node 模式启动，用 `--expose-internals` 满足当前 HMR 运行时要求
- 官方完整就绪行 + 首页启动标记共同作为健康判据
- 主页面用隔离的 `WebContentsView`；Node integration 关闭，context isolation 与 sandbox 开启

## 许可与归属

Harness Studio 自身代码使用 MIT License。DeepSeek Harness 及其依赖受各自许可证约束，详见 [THIRD_PARTY.md](THIRD_PARTY.md)。DeepSeek 名称和相关商标归其权利人所有。
