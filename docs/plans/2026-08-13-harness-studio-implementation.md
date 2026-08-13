# Harness Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个可双击运行、自动托管 DeepSeek Harness、具有 Apple 风格桌面外壳并可打包为 macOS `.app`/`.dmg` 的客户端。

**Architecture:** Electron 主进程启动固定版本的 `@deepseek-ai/dsh web` 子进程，并以状态机管理健康检查、日志、重启和退出。受限 preload IPC 驱动本地启动/错误界面，Harness 官方 UI 放在隔离的 `WebContentsView` 中，主窗口保留原生标题栏与常驻工具栏。

**Tech Stack:** Electron、TypeScript、Vite、Vitest、Playwright Electron、electron-builder、`@deepseek-ai/dsh@0.1.0-rc.6`。

---

### Task 1: 建立可重复构建的项目骨架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `src/shared/contracts.ts`

**Steps:**
1. 写入固定版本依赖、构建脚本和 macOS arm64 打包配置。
2. 创建 strict TypeScript 配置和 renderer 构建入口。
3. 运行 `npm install`，确认 lockfile 生成且 Electron 内置 Node 版本满足 Harness。
4. 运行 `npm run typecheck`，预期无错误。

### Task 2: 以测试驱动实现引擎状态与基础工具

**Files:**
- Create: `src/main/engine-state.ts`
- Create: `src/main/port.ts`
- Create: `src/main/navigation-policy.ts`
- Create: `tests/unit/engine-state.test.ts`
- Create: `tests/unit/port.test.ts`
- Create: `tests/unit/navigation-policy.test.ts`

**Steps:**
1. 先编写状态迁移、空闲端口和导航白名单的失败测试。
2. 运行 `npm test -- --run tests/unit`，确认测试按预期失败。
3. 实现最小纯函数与错误类型。
4. 再次运行测试，预期全部通过。

### Task 3: 实现 Harness 子进程托管

**Files:**
- Create: `src/main/engine-manager.ts`
- Create: `src/main/log-buffer.ts`
- Create: `tests/fixtures/fake-harness.mjs`
- Create: `tests/integration/engine-manager.test.ts`

**Steps:**
1. 用假服务编写 ready、提前退出、超时、重启和停止测试。
2. 实现 `HarnessEngineManager`：解析 dsh bin、选择端口、spawn、HTTP 健康检查、结构化状态通知、日志写入与有限终止。
3. 验证并发 `start()`/`stop()` 幂等，退出后端口释放。
4. 运行 `npm test -- --run tests/integration/engine-manager.test.ts`。

### Task 4: 建立安全桌面窗口和 IPC

**Files:**
- Create: `src/main/main.ts`
- Create: `src/main/window-controller.ts`
- Create: `src/main/app-menu.ts`
- Create: `src/preload.ts`
- Create: `src/types/electron-api.d.ts`

**Steps:**
1. 创建隐藏式标题栏窗口，关闭 Node integration，开启 context isolation 和 sandbox。
2. 仅暴露状态订阅、重试、重启、刷新、打开日志/数据目录 API。
3. 将 Harness 装入 `WebContentsView`；限制外部导航、弹窗和权限。
4. 实现 macOS 应用菜单和退出时引擎清理。
5. 运行类型检查和 IPC 合约单元测试。

### Task 5: 实现 Apple 风格 renderer

**Files:**
- Create: `index.html`
- Create: `src/renderer/main.ts`
- Create: `src/renderer/styles.css`
- Create: `src/renderer/components.ts`

**Steps:**
1. 建立启动、就绪工具栏、失败和重启四种可访问状态。
2. 实现半透明材质、柔和光源、状态指示、原生交通灯安全区和 reduced-motion。
3. 连接 IPC，保证按钮具有 loading/disabled/错误反馈。
4. 运行 renderer 单元测试与 `npm run build`。

### Task 6: 增加真实桌面冒烟与视觉验证

**Files:**
- Create: `tests/e2e/desktop.spec.ts`
- Create: `tests/e2e/real-harness.mjs`
- Create: `playwright.config.ts`

**Steps:**
1. 使用 Playwright `_electron` 启动应用，等待引擎状态稳定。
2. 验证启动屏、常驻工具栏、重试/重启和窗口尺寸行为。
3. 保存截图并人工检查无裁切、重叠、低对比或加载残留。
4. 用真实 dsh 启动一次，验证根页面可达与退出后端口释放。

### Task 7: 品牌资产、文档与 macOS 交付

**Files:**
- Create: `build/icon.svg`
- Create: `scripts/build-icon.sh`
- Create: `README.md`
- Create: `THIRD_PARTY_NOTICES.md`

**Steps:**
1. 创建原创应用图标并生成 `.icns`。
2. 文档化安装、首次启动、数据位置、安全边界与故障恢复。
3. 运行 `npm run check` 完成类型、单元、集成和构建验证。
4. 运行 `npm run dist:mac` 生成 arm64 `.app`、`.zip` 与 `.dmg`。
5. 冷启动打包后的 `.app`，确认 Harness 就绪、界面可交互且退出无残留进程。
6. 将最终安装包、源码归档、校验值和截图复制到 `outputs/`。
