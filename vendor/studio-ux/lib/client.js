/**
 * @harness/studio-ux — client half (plain browser bundle).
 *
 * 1. Hover-only message actions: the per-message icon rows (copy / feedback /
 *    branch) fade in on row hover instead of occupying every message.
 * 2. Turn process strip: a compact "● 运行中 · 耗时 · N 步" / "✓ 完成 · …"
 *    pill on each turn tail (chain slot election), live-ticking while the
 *    turn runs; short single-step turns stay quiet.
 */
window.__ModuleLoader__.load({
	id: "@harness/studio-ux",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const jsxRuntime = require("react/jsx-runtime");

		// ── styles ────────────────────────────────────────────────────────────
		const css = `
/* 悬停才显示的消息操作行（复制/反馈/分支），保留键盘可达性 */
.p-xYUq_actions,.Sxvs8a_actions,.osXY9a_actions{opacity:0;transition:opacity .15s ease}
.Sxvs8a_root:hover .Sxvs8a_actions,.Sxvs8a_root:focus-within .Sxvs8a_actions,
.gdEzaW_userStack:hover .p-xYUq_actions,.gdEzaW_userStack:focus-within .p-xYUq_actions,
.osXY9a_root:hover .p-xYUq_actions,.osXY9a_root:focus-within .p-xYUq_actions,
.gdEzaW_userRow:hover .p-xYUq_actions,.gdEzaW_userRow:focus-within .p-xYUq_actions{opacity:1}
/* 每轮进程摘要条 */
.tp-strip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 60%,transparent);margin:2px 0}
.tp-dot{width:6px;height:6px;border-radius:50%;flex:none}
.tp-running .tp-dot{background:var(--dsw-alias-brand-primary);animation:tp-pulse 1.6s ease-in-out infinite}
.tp-done .tp-dot{background:var(--dsw-alias-state-success-primary)}
@keyframes tp-pulse{0%,100%{opacity:1}50%{opacity:.35}}
/* 新手引导 */
.guide-backdrop{position:fixed;inset:0;z-index:9996;background:rgba(5,6,10,.62);display:flex;align-items:center;justify-content:center;padding:24px}
.guide-card{width:520px;max-width:100%;max-height:86vh;overflow-y:auto;border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2));background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));border-radius:16px;box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.5));padding:22px 24px}
.guide-title{font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0 0 6px}
.guide-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.6;margin:0 0 16px}
.guide-keyrow{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12.5px}
.guide-keyrow-ok{color:var(--dsw-alias-state-success-primary)}
.guide-keyrow-bad{color:var(--dsw-alias-state-warn-label)}
.guide-keyrow .grow{flex:1}
.guide-feat{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.guide-feat:last-child{border-bottom:none}
.guide-feat-icon{width:30px;height:30px;border-radius:8px;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:14px;background:var(--dsw-alias-interactive-bg-hover)}
.guide-feat-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:18px}
.guide-feat-desc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:17px}
.guide-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
.guide-btn{border:none;border-radius:9px;padding:8px 16px;font-size:13px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}
.guide-btn:hover{filter:brightness(1.08)}
.guide-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2)}
.guide-btn-ghost:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ux-help-btn{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);height:28px;min-width:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0 6px;font-size:13px}
.ux-help-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.wiz-label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary);margin:10px 0 4px}
.wiz-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 10px;font-size:13px;outline:none}
.wiz-input:focus{border-color:var(--dsw-alias-brand-primary)}
.wiz-model-row{display:flex;gap:8px;align-items:center}
.wiz-model-row .wiz-input{flex:1}
.wiz-probe{white-space:nowrap;flex:none;padding:7px 12px}
.wiz-note{font-size:11.5px;color:var(--dsw-alias-label-tertiary);line-height:1.6;margin:10px 0 0}
`;
		const CSS_ID = "@harness/studio-ux/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@harness/studio-ux";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── turn progress strip ────────────────────────────────────────────────
		function fmtDuration(ms) {
			if (ms < 60000) return Math.round(ms / 1000) + "s";
			const minutes = Math.floor(ms / 60000);
			const seconds = Math.round((ms % 60000) / 1000);
			return minutes + "m " + seconds + "s";
		}

		function TurnProgressStrip({ turn, seq, t }) {
			const start = turn?.start?.time;
			const end = turn?.end?.time;
			const running = typeof start === "number" && end === undefined;
			const [now, setNow] = react.useState(() => Date.now());
			react.useEffect(() => {
				if (!running) return;
				const id = setInterval(() => setNow(Date.now()), 1000);
				return () => clearInterval(id);
			}, [running]);
			if (typeof start !== "number") return null;
			const seqN = typeof seq === "number" ? seq : 0;
			// 短任务保持安静：只有多步任务才显示摘要
			if (!running && (typeof end !== "number" || end - start < 8000) && seqN < 2) return null;
			if (running && seqN < 2) return null;
			const ms = running ? now - start : end - start;
			return jsxRuntime.jsxs("span", {
				className: "tp-strip" + (running ? " tp-running" : " tp-done"),
				title: running ? t("strip.running") : t("strip.done"),
				children: [
					jsxRuntime.jsx("span", { className: "tp-dot", "aria-hidden": true }),
					running ? t("strip.running") : t("strip.done"),
					" · ",
					fmtDuration(ms),
					" · ",
					seqN,
					" ",
					t("strip.steps")
				]
			});
		}

		// ── first-run guide ─────────────────────────────────────────────────────
		const FEATURES = [
			{ icon: "📎", titleKey: "guide.f1t", descKey: "guide.f1d" },
			{ icon: "🎨", titleKey: "guide.f2t", descKey: "guide.f2d" },
			{ icon: "📦", titleKey: "guide.f3t", descKey: "guide.f3d" },
			{ icon: "⚡", titleKey: "guide.f4t", descKey: "guide.f4d" }
		];

		function GuideCard({ guide, onSettings, onDone, onClose, t, standalone }) {
			return jsxRuntime.jsx("div", {
				className: "guide-backdrop",
				onClick: (event) => {
					if (event.target === event.currentTarget && standalone) onClose?.();
				},
				children: jsxRuntime.jsx("div", {
					className: "guide-card",
					role: "dialog",
					"aria-label": t("guide.title"),
					children: [
						jsxRuntime.jsx("h2", { className: "guide-title", children: t("guide.title") }),
						jsxRuntime.jsx("p", { className: "guide-sub", children: t("guide.sub") }),
						jsxRuntime.jsxs("div", {
							className: "guide-keyrow" + (guide.hasCredentials ? " guide-keyrow-ok" : " guide-keyrow-bad"),
							children: [
								jsxRuntime.jsx("span", { children: guide.hasCredentials ? "🔑" : "⚠️" }),
								jsxRuntime.jsx("span", {
									className: "grow",
									children: guide.hasCredentials ? t("guide.keyOk") : t("guide.keyMissing")
								}),
								guide.hasCredentials ? null : jsxRuntime.jsx("button", {
									type: "button",
									className: "guide-btn-ghost guide-btn",
									onClick: onSettings,
									children: t("guide.goSettings")
								})
							]
						}),
						FEATURES.map((feature) => jsxRuntime.jsxs("div", {
							className: "guide-feat",
							key: feature.titleKey,
							children: [
								jsxRuntime.jsx("span", { className: "guide-feat-icon", "aria-hidden": true, children: feature.icon }),
								jsxRuntime.jsxs("div", {
									className: "grow",
									children: [
										jsxRuntime.jsx("div", { className: "guide-feat-title", children: t(feature.titleKey) }),
										jsxRuntime.jsx("div", { className: "guide-feat-desc", children: t(feature.descKey) })
									]
								})
							]
						})),
						jsxRuntime.jsxs("div", {
							className: "guide-actions",
							children: [
								standalone ? jsxRuntime.jsx("button", {
									type: "button",
									className: "guide-btn-ghost guide-btn",
									onClick: onClose,
									children: t("guide.close")
								}) : null,
								jsxRuntime.jsx("button", {
									type: "button",
									className: "guide-btn",
									onClick: onDone,
									children: t("guide.start")
								})
							]
						})
					]
				})
			});
		}

		async function fetchGuide() {
			try {
				const res = await fetch("/ux/guide");
				const body = await res.json();
				if (body && typeof body.seen === "boolean") return { seen: body.seen, hasCredentials: body.hasCredentials === true };
			} catch (_) { /* offline — assume unseen but don't block */ }
			return { seen: false, hasCredentials: false };
		}

		function OnboardingStep({ complete, openSection, t }) {
			const [guide, setGuide] = react.useState(null);
			const finishedRef = react.useRef(false);
			const finish = react.useCallback(() => {
				if (finishedRef.current) return;
				finishedRef.current = true;
				complete();
			}, [complete]);
			react.useEffect(() => {
				let alive = true;
				void fetchGuide().then((state) => {
					if (!alive) return;
					if (state.seen) finish();
					else setGuide(state);
				});
				return () => {
					alive = false;
				};
			}, [finish]);
			const done = async () => {
				try {
					await fetch("/ux/guide", { method: "POST" });
				} catch (_) { /* non-fatal */ }
				finish();
			};
			if (guide === null) return null;
			return jsxRuntime.jsx(GuideCard, {
				guide,
				onSettings: () => {
					openSection?.("models");
				},
				onDone: () => void done(),
				t,
				standalone: false
			});
		}

		function HelpButton({ t }) {
			const [open, setOpen] = react.useState(false);
			const [guide, setGuide] = react.useState(null);
			const openGuide = () => {
				void fetchGuide().then((state) => {
					setGuide(state);
					setOpen(true);
				});
			};
			const close = () => setOpen(false);
			return jsxRuntime.jsxs(react.Fragment, {
				children: [
					jsxRuntime.jsx("button", {
						type: "button",
						className: "ux-help-btn",
						onClick: openGuide,
						title: t("guide.help"),
						"aria-label": t("guide.help"),
						children: "?"
					}),
					open && guide !== null ? jsxRuntime.jsx(GuideCard, {
						guide,
						onSettings: () => void 0,
						onDone: close,
						onClose: close,
						t,
						standalone: true
					}) : null
				]
			});
		}

		// ── model wizard (first-run provider setup) ────────────────────────────
		const PROVIDERS = [
			{ route: "openai", name: "OpenAI", protocol: "openai-completions", baseURL: "https://api.openai.com/v1", model: "gpt-4.1" },
			{ route: "anthropic", name: "Anthropic Claude", protocol: "anthropic-messages", baseURL: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
			{ route: "google-gemini", name: "Google Gemini", protocol: "openai-completions", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-pro" },
			{ route: "xai", name: "xAI Grok", protocol: "openai-completions", baseURL: "https://api.x.ai/v1", model: "grok-4" },
			{ route: "moonshot", name: "Moonshot Kimi", protocol: "openai-completions", baseURL: "https://api.moonshot.cn/v1", model: "kimi-k2-0711-preview" },
			{ route: "minimax-cn", name: "MiniMax", protocol: "openai-completions", baseURL: "https://api.minimax.chat/v1", model: "MiniMax-M2" },
			{ route: "zhipu", name: "智谱 GLM", protocol: "openai-completions", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.6" },
			{ route: "mistral", name: "Mistral AI", protocol: "openai-completions", baseURL: "https://api.mistral.ai/v1", model: "mistral-large-latest" },
			{ route: "openrouter", name: "OpenRouter", protocol: "openai-completions", baseURL: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-chat" },
			{ route: "groq", name: "Groq", protocol: "openai-completions", baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
			{ route: "together", name: "Together AI", protocol: "openai-completions", baseURL: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
			{ route: "lm-studio", name: "LM Studio（本地）", protocol: "openai-completions", baseURL: "http://localhost:1234/v1", model: "", local: true },
			{ route: "ollama", name: "Ollama（本地）", protocol: "openai-completions", baseURL: "http://127.0.0.1:11434/v1", model: "", local: true },
			{ route: "openai-compatible", name: "自定义（OpenAI 兼容）", protocol: "openai-completions", baseURL: "http://localhost:8000/v1", model: "", local: true }
		];

		function ModelWizardStep({ complete, t }) {
			const [providerIdx, setProviderIdx] = react.useState(0);
			const [baseURL, setBaseURL] = react.useState(PROVIDERS[0].baseURL);
			const [modelId, setModelId] = react.useState(PROVIDERS[0].model);
			const [apiKey, setApiKey] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [probing, setProbing] = react.useState(false);
			const [probeModels, setProbeModels] = react.useState([]);
			const [error, setError] = react.useState(null);
			const finishedRef = react.useRef(false);
			const finish = react.useCallback(() => {
				if (finishedRef.current) return;
				finishedRef.current = true;
				complete();
			}, [complete]);
			const pickProvider = (index) => {
				setProviderIdx(index);
				setBaseURL(PROVIDERS[index].baseURL);
				setModelId(PROVIDERS[index].model);
				setProbeModels([]);
				setError(null);
			};
			const probeLocal = async () => {
				if (probing) return;
				setProbing(true);
				setError(null);
				try {
					const res = await fetch(`${baseURL.replace(/\/+$/, "")}/models`);
					const body = await res.json();
					const list = Array.isArray(body?.data) ? body.data.map((m) => typeof m?.id === "string" ? m.id : null).filter(Boolean) : [];
					if (list.length === 0) {
						setError(t("wizard.probeEmpty"));
					} else {
						setProbeModels(list);
						if (modelId === "") setModelId(list[0]);
					}
				} catch (err) {
					setError(t("wizard.probeFail") + (err instanceof Error ? err.message : String(err)));
				} finally {
					setProbing(false);
				}
			};
			const save = async () => {
				if (busy) return;
				const provider = PROVIDERS[providerIdx];
				if (!provider.local && apiKey.trim() === "") {
					setError(t("wizard.keyRequired"));
					return;
				}
				if (modelId.trim() === "") {
					setError(t("wizard.modelRequired"));
					return;
				}
				setBusy(true);
				setError(null);
				try {
					const provider = PROVIDERS[providerIdx];
					const res = await fetch("/ux/models", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							route: provider.route,
							displayName: provider.name,
							protocol: provider.protocol,
							baseURL,
							modelId,
							apiKey: apiKey.trim(),
							setActive: true
						})
					});
					const body = await res.json();
					if (body.ok === true) finish();
					else setError(body.error ?? "save failed");
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			};
			return jsxRuntime.jsx("div", {
				className: "guide-backdrop",
				children: jsxRuntime.jsx("div", {
					className: "guide-card",
					role: "dialog",
					"aria-label": t("wizard.title"),
					children: [
						jsxRuntime.jsx("h2", { className: "guide-title", children: t("wizard.title") }),
						jsxRuntime.jsx("p", { className: "guide-sub", children: t("wizard.sub") }),
						jsxRuntime.jsx("label", { className: "wiz-label", children: t("wizard.provider") }),
						jsxRuntime.jsx("select", {
							className: "wiz-input",
							value: providerIdx,
							onChange: (event) => pickProvider(Number(event.target.value)),
							children: PROVIDERS.map((provider, index) => jsxRuntime.jsx("option", { value: index, children: provider.name }, provider.route))
						}),
						...(PROVIDERS[providerIdx].local ? [] : [
							jsxRuntime.jsx("label", { className: "wiz-label", children: t("wizard.key") }),
							jsxRuntime.jsx("input", {
								className: "wiz-input",
								type: "password",
								value: apiKey,
								placeholder: "sk-…",
								onChange: (event) => setApiKey(event.target.value),
								autoFocus: true
							})
						]),
						jsxRuntime.jsx("label", { className: "wiz-label", children: t("wizard.baseURL") }),
						jsxRuntime.jsx("input", { className: "wiz-input", value: baseURL, onChange: (event) => setBaseURL(event.target.value) }),
						jsxRuntime.jsx("label", { className: "wiz-label", children: t("wizard.model") }),
						jsxRuntime.jsxs("div", {
							className: "wiz-model-row",
							children: [
								jsxRuntime.jsx("input", {
									className: "wiz-input",
									list: "studio-local-models",
									value: modelId,
									onChange: (event) => setModelId(event.target.value)
								}),
								jsxRuntime.jsx("datalist", {
									id: "studio-local-models",
									children: probeModels.map((m) => jsxRuntime.jsx("option", { value: m }, m))
								}),
								...(PROVIDERS[providerIdx].local ? [
									jsxRuntime.jsx("button", {
										type: "button",
										className: "guide-btn-ghost guide-btn wiz-probe",
										onClick: () => void probeLocal(),
										disabled: probing,
										children: probing ? t("wizard.probing") : t("wizard.probe")
									})
								] : [])
							]
						}),
						...(PROVIDERS[providerIdx].local ? [jsxRuntime.jsx("p", { className: "wiz-note", children: t("wizard.localHint") })] : []),
						jsxRuntime.jsx("p", { className: "wiz-note", children: t("wizard.note") }),
						error !== null ? jsxRuntime.jsx("p", { className: "as-err", role: "alert", children: error }) : null,
						jsxRuntime.jsxs("div", {
							className: "guide-actions",
							children: [
								jsxRuntime.jsx("button", { type: "button", className: "guide-btn-ghost guide-btn", onClick: finish, children: t("wizard.skip") }),
								jsxRuntime.jsx("button", { type: "button", className: "guide-btn", onClick: () => void save(), disabled: busy, children: busy ? t("wizard.saving") : t("wizard.save") })
							]
						})
					]
				})
			});
		}

		// ── locales ────────────────────────────────────────────────────────────
		const zh = {
			"strip.running": "运行中",
			"strip.done": "完成",
			"strip.steps": "步",
			"guide.title": "欢迎使用 Harness Studio 增强版",
			"guide.sub": "基于 DeepSeek Harness 的桌面客户端。先确认 API Key，然后看看为你准备好的四个增强能力。",
			"guide.keyOk": "已检测到 API Key，可以直接开始",
			"guide.keyMissing": "还没有配置 API Key，没有它我无法回答你",
			"guide.goSettings": "去配置",
			"guide.f1t": "📎 上传文件",
			"guide.f1d": "输入框左侧的曲别针按钮；文档落盘后我自动读取，图片支持拖拽和粘贴",
			"guide.f2t": "🎨 皮肤",
			"guide.f2d": "右上角调色板按钮；12 套预设深浅皮肤，也可以从任意图片生成",
			"guide.f3t": "📦 产物工坊",
			"guide.f3d": "右上角箱子按钮；浏览产物、编辑 HTML/Markdown 实时预览、查看 DOCX/PDF",
			"guide.f4t": "⚡ 安静的工作流",
			"guide.f4d": "每轮任务末尾有进程摘要；操作按钮悬停才显示；工具卡片自动把路径显示成文件名",
			"guide.start": "开始使用",
			"guide.close": "关闭",
			"guide.help": "使用帮助",
			"wizard.title": "选择模型供应商",
			"wizard.sub": "支持 11 家主流云供应商（OpenAI / Claude / Gemini / Grok / Kimi / MiniMax / 智谱 / Mistral / OpenRouter / Groq / Together）+ 本地模型（LM Studio / Ollama / 自定义 OpenAI 兼容）。Key 只保存在本机凭证库，接口地址和模型可改。",
			"wizard.provider": "供应商",
			"wizard.key": "API Key",
			"wizard.baseURL": "接口地址（可改）",
			"wizard.model": "模型 ID（可改）",
			"wizard.probe": "读取模型列表",
			"wizard.probing": "读取中…",
			"wizard.probeEmpty": "服务已连接，但没有找到已加载的模型。请先在 LM Studio / Ollama 里加载或拉取一个模型。",
			"wizard.probeFail": "无法连接本地服务，请确认 LM Studio / Ollama 已启动并开启了本地服务，或手动填写模型 ID。",
			"wizard.localHint": "本地模型不需要 API Key。点击「读取模型列表」可以从运行中的 LM Studio / Ollama 自动拉取模型 ID。",
			"wizard.note": "保存后会写入模型设置并设为当前会话默认模型。之后可随时在 设置 → Models 里修改。",
			"wizard.save": "保存并使用",
			"wizard.saving": "保存中…",
			"wizard.skip": "跳过",
			"wizard.keyRequired": "请先填写 API Key",
			"wizard.modelRequired": "请填写或选择模型 ID"
		};
		const en = {
			"strip.running": "Running",
			"strip.done": "Done",
			"strip.steps": "steps",
			"guide.title": "Welcome to Harness Studio",
			"guide.sub": "A desktop client for DeepSeek Harness. Confirm your API key, then meet the four enhancements.",
			"guide.keyOk": "API key detected — you are ready to go",
			"guide.keyMissing": "No API key configured yet — I cannot answer without one",
			"guide.goSettings": "Configure",
			"guide.f1t": "📎 Upload files",
			"guide.f1d": "The paperclip button in the composer; documents land on disk for me to read, images support drag and paste",
			"guide.f2t": "🎨 Skins",
			"guide.f2d": "The palette button in the header; 12 presets plus image-generated themes",
			"guide.f3t": "📦 Artifact studio",
			"guide.f3d": "The box button in the header; browse artifacts, edit HTML/Markdown with live preview, view DOCX/PDF",
			"guide.f4t": "⚡ Calmer workflow",
			"guide.f4d": "Per-turn progress strips, hover-only actions, and tool cards that show file names instead of long paths",
			"guide.start": "Get started",
			"guide.close": "Close",
			"guide.help": "Help",
			"wizard.title": "Choose a model provider",
			"wizard.sub": "11 cloud providers (OpenAI / Claude / Gemini / Grok / Kimi / MiniMax / Zhipu / Mistral / OpenRouter / Groq / Together) plus local models (LM Studio / Ollama / custom OpenAI-compatible). The key is stored only in the local credential store; endpoint and model are editable.",
			"wizard.provider": "Provider",
			"wizard.key": "API Key",
			"wizard.baseURL": "Endpoint (editable)",
			"wizard.model": "Model ID (editable)",
			"wizard.probe": "Fetch models",
			"wizard.probing": "Fetching…",
			"wizard.probeEmpty": "The service responded but has no loaded models. Load or pull a model in LM Studio / Ollama first.",
			"wizard.probeFail": "Cannot reach the local service. Make sure LM Studio / Ollama is running with its local server enabled, or type the model ID manually.",
			"wizard.localHint": "Local models need no API key. Use \"Fetch models\" to pull model IDs straight from a running LM Studio / Ollama.",
			"wizard.note": "Saves into model settings and sets the session default. Change any time in Settings → Models.",
			"wizard.save": "Save and use",
			"wizard.saving": "Saving…",
			"wizard.skip": "Skip",
			"wizard.keyRequired": "API key required",
			"wizard.modelRequired": "Model ID required"
		};

		// ── plugin entry ───────────────────────────────────────────────────────
		function apply(ctx) {
			ctx.locale.register("studioUx", { zh, en });
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.chat.turnTail", () => scope.slots.register({
					name: "conversation.chat.turnTail",
					id: "studio-ux-progress-strip",
					select: (opts) => (opts !== undefined && opts.turn !== undefined ? {} : null),
					locale: "studioUx",
					inject: () => ({})
				}, TurnProgressStrip));
				scope.slots.inject("settings.onboarding", () => scope.slots.register({
					name: "settings.onboarding",
					id: "studio-model-wizard",
					order: 60,
					locale: "studioUx",
					inject: () => ({})
				}, ModelWizardStep));
				scope.slots.inject("settings.onboarding", () => scope.slots.register({
					name: "settings.onboarding",
					id: "studio-features",
					order: 100,
					locale: "studioUx",
					inject: () => ({})
				}, OnboardingStep));
				scope.slots.inject("conversation.session.header.actions", () => scope.slots.register({
					name: "conversation.session.header.actions",
					id: "studio-ux-help",
					order: 2,
					locale: "studioUx",
					inject: () => ({})
				}, HelpButton));
			});
		}

		exports.apply = apply;
		exports.inject = ["locale"];
		return module.exports;
	}
});
