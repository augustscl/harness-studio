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
.tb-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.28);display:flex;justify-content:flex-end;align-items:flex-start;padding:56px 18px 0 0}
.tb-panel{width:380px;max-width:calc(100vw - 36px);max-height:70vh;overflow-y:auto;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.45);padding:16px}
.tb-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.tb-close{flex:none}
.tb-search{margin-bottom:10px}
.tb-list{display:flex;flex-direction:column;gap:10px}
.tb-empty{font-size:13px;color:var(--dsw-alias-label-tertiary);padding:14px 4px;text-align:center}
.tb-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px;background:var(--dsw-alias-bg-subtle, var(--dsw-alias-bg-base))}
.tb-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.tb-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;line-height:1.5}
.tb-badge-active{background:rgba(56,189,248,.16);color:#38bdf8}
.tb-badge-paused{background:rgba(251,191,36,.16);color:#fbbf24}
.tb-badge-blocked{background:rgba(248,113,113,.16);color:#f87171}
.tb-badge-complete{background:rgba(74,222,128,.14);color:#4ade80}
.tb-rounds{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.tb-objective{font-size:13.5px;color:var(--dsw-alias-label-primary);line-height:1.55;margin:0 0 4px;word-break:break-word}
.tb-blocked{font-size:12px;color:#f87171;line-height:1.5;margin:0 0 6px}
.tb-actions{display:flex;gap:8px;margin-top:8px}
.tb-actions .guide-btn{padding:4px 10px;font-size:12px}
.cx-title{font-size:13.5px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
.cx-bar-wrap{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.cx-bar{flex:1;height:6px;border-radius:999px;background:var(--dsw-alias-border-l2);overflow:hidden}
.cx-bar-fill{height:100%;border-radius:999px;background:#38bdf8;transition:width .4s ease}
.cx-bar-hot{background:#f87171}
.cx-meta{font-size:11.5px;color:var(--dsw-alias-label-tertiary);margin:0;line-height:1.6}
.cx-meta b{color:var(--dsw-alias-label-secondary);font-weight:600}
.sp-card{padding:14px 0;max-height:calc(100vh - 220px);overflow-y:auto}
.sp-skip{display:block;width:100%;margin-top:12px;padding:7px 12px}
.sp-h3{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);margin:14px 0 2px}
.sp-textarea{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.6;outline:none;resize:vertical;min-height:120px;font-family:inherit;margin:6px 0}
.sp-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.sp-skills{display:flex;flex-direction:column;gap:8px;margin-top:8px;max-height:360px;overflow-y:auto}
.sp-skill{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px}
.sp-skill-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.sp-skill-info b{font-size:12.5px;color:var(--dsw-alias-label-primary)}
.sp-skill-off{text-decoration:line-through;opacity:.6}
.sp-skill-desc{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}
.sp-msg{font-size:12px;color:#4ade80;margin:6px 0 0}
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

		// ── task board (goal / subagent dashboard, codex agents 思路) ─────────
		const PHASE_BADGE = {
			active: { key: "board.active", cls: "tb-badge tb-badge-active" },
			paused: { key: "board.paused", cls: "tb-badge tb-badge-paused" },
			blocked: { key: "board.blocked", cls: "tb-badge tb-badge-blocked" },
			complete: { key: "board.complete", cls: "tb-badge tb-badge-complete" }
		};

		function TaskBoardPanel({ t, onClose, goalsApi }) {
			const [tasks, setTasks] = react.useState(null);
			const [query, setQuery] = react.useState("");
			const [busy, setBusy] = react.useState(new Set());
			const [error, setError] = react.useState(null);
			const pollRef = react.useRef(null);

			const refresh = react.useCallback(async () => {
				try {
					const res = await fetch("/ux/tasks");
					const body = await res.json();
					if (body.ok === true) setTasks(body.tasks ?? []);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, []);

			react.useEffect(() => {
				void refresh();
				pollRef.current = setInterval(() => void refresh(), 3000);
				return () => {
					if (pollRef.current !== null) clearInterval(pollRef.current);
				};
			}, [refresh]);

			const runAction = async (sessionId, goal, kind) => {
				const ref = { id: goal.id, revision: goal.revision };
				setBusy((prev) => new Set(prev).add(sessionId));
				setError(null);
				try {
					const result = kind === "pause"
						? await goalsApi.pause(sessionId, ref)
						: kind === "resume"
							? await goalsApi.resume(sessionId, ref)
							: await goalsApi.clear(sessionId, ref);
					if (result !== undefined && result.ok === false) {
						setError(`${t("board.actionFail")} ${result.error?.message ?? ""} (${result.error?.code ?? ""})`);
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy((prev) => {
						const next = new Set(prev);
						next.delete(sessionId);
						return next;
					});
					void refresh();
				}
			};

			const q = query.trim().toLowerCase();
			const filtered = tasks === null ? null : tasks.filter((task) =>
				q === "" || task.goal.objective.toLowerCase().includes(q) || (task.title ?? "").toLowerCase().includes(q)
			);

			return jsxRuntime.jsxs("div", {
				className: "tb-backdrop",
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: [
					jsxRuntime.jsxs("div", {
						className: "tb-panel",
						role: "dialog",
						"aria-label": t("board.title"),
						children: [
							jsxRuntime.jsxs("div", {
								className: "tb-head",
								children: [
									jsxRuntime.jsx("h2", { className: "guide-title", children: t("board.title") }),
									jsxRuntime.jsx("button", {
										type: "button",
										className: "guide-btn-ghost guide-btn tb-close",
										onClick: onClose,
										children: t("guide.close")
									})
								]
							}),
							jsxRuntime.jsx("input", {
								className: "wiz-input tb-search",
								value: query,
								placeholder: t("board.search"),
								onChange: (event) => setQuery(event.target.value)
							}),
							error !== null ? jsxRuntime.jsx("p", { className: "as-err", role: "alert", children: error }) : null,
							jsxRuntime.jsx("div", {
								className: "tb-list",
								children: (() => {
									if (tasks === null) return jsxRuntime.jsx("p", { className: "tb-empty", children: t("board.loading") });
									if (filtered.length === 0) return jsxRuntime.jsx("p", { className: "tb-empty", children: q === "" ? t("board.empty") : t("board.noMatch") });
									return filtered.map((task) => {
										const badge = PHASE_BADGE[task.goal.phase] ?? PHASE_BADGE.active;
										const isBusy = busy.has(task.sessionId);
										return jsxRuntime.jsxs("div", {
											className: "tb-card",
											key: task.sessionId,
											children: [
												jsxRuntime.jsxs("div", {
													className: "tb-card-top",
													children: [
														jsxRuntime.jsx("span", { className: badge.cls, children: t(badge.key) }),
														task.goal.maxGoalRounds !== null && task.goal.maxGoalRounds !== undefined
															? jsxRuntime.jsx("span", {
																className: "tb-rounds",
																children: t("board.rounds").replace("{n}", String(task.goal.roundsStarted ?? 0)).replace("{m}", String(task.goal.maxGoalRounds))
															})
															: jsxRuntime.jsx("span", {
																className: "tb-rounds",
																children: t("board.roundsOpen").replace("{n}", String(task.goal.roundsStarted ?? 0))
															})
													]
												}),
												jsxRuntime.jsx("p", { className: "tb-objective", children: task.goal.objective }),
												task.goal.phase === "blocked" && task.goal.blockedReason !== null && task.goal.blockedReason !== undefined
													? jsxRuntime.jsx("p", { className: "tb-blocked", children: task.goal.blockedReason })
													: null,
												jsxRuntime.jsxs("div", {
													className: "tb-actions",
													children: [
														...(task.goal.phase === "active"
															? [jsxRuntime.jsx("button", {
																type: "button",
																className: "guide-btn-ghost guide-btn",
																disabled: isBusy,
																onClick: () => void runAction(task.sessionId, task.goal, "pause"),
																children: t("board.pause")
															})]
															: []),
														...(task.goal.phase === "paused" || task.goal.phase === "blocked"
															? [jsxRuntime.jsx("button", {
																type: "button",
																className: "guide-btn-ghost guide-btn",
																disabled: isBusy,
																onClick: () => void runAction(task.sessionId, task.goal, "resume"),
																children: t("board.resume")
															})]
															: []),
														...(task.goal.phase !== "complete"
															? [jsxRuntime.jsx("button", {
																type: "button",
																className: "guide-btn-ghost guide-btn",
																disabled: isBusy,
																onClick: () => void runAction(task.sessionId, task.goal, "clear"),
																children: t("board.stop")
															})]
															: [])
													]
												})
											]
										});
									});
								})()
							})
						]
					})
				]
			});
		}

		function TaskBoardButton({ t, goalsApi }) {
			const [open, setOpen] = react.useState(false);
			return jsxRuntime.jsxs(react.Fragment, {
				children: [
					jsxRuntime.jsx("button", {
						type: "button",
						className: "ux-help-btn",
						onClick: () => setOpen(true),
						title: t("board.title"),
						"aria-label": t("board.title"),
						children: "📋"
					}),
					open ? jsxRuntime.jsx(TaskBoardPanel, {
						t,
						goalsApi,
						onClose: () => setOpen(false)
					}) : null
				]
			});
		}

		// ── context dashboard (token / context usage per session) ──────────────
		function ContextPanel({ t, onClose }) {
			const [rows, setRows] = react.useState(null);
			const [error, setError] = react.useState(null);

			const refresh = react.useCallback(async () => {
				try {
					const res = await fetch("/ux/sessions");
					const body = await res.json();
					if (body.ok === true) setRows(body.sessions ?? []);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, []);

			react.useEffect(() => {
				void refresh();
				const timer = setInterval(() => void refresh(), 5000);
				return () => clearInterval(timer);
			}, [refresh]);

			const fmt = (n) => {
				if (n === null || n === undefined) return null;
				if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
				return String(n);
			};

			const renderRow = (row) => {
				const surface = row.surfaceTokens;
				const windowSize = row.contextWindow;
				const pct = surface !== null && windowSize !== null && windowSize > 0
					? Math.min(100, Math.round((surface / windowSize) * 100))
					: null;
				return jsxRuntime.jsxs("div", {
					className: "tb-card",
					key: row.sessionId,
					children: [
						jsxRuntime.jsxs("div", {
							className: "tb-card-top",
							children: [
								jsxRuntime.jsx("span", {
									className: "cx-title",
									children: row.title !== "" ? row.title : t("cx.untitled")
								}),
								row.goalPhase !== null && row.goalPhase !== undefined && row.goalPhase !== "complete"
									? jsxRuntime.jsx("span", { className: PHASE_BADGE[row.goalPhase]?.cls ?? "tb-badge tb-badge-active", children: t(PHASE_BADGE[row.goalPhase]?.key ?? "board.active") })
									: null
							]
						}),
						...(pct !== null
							? [jsxRuntime.jsxs("div", {
								className: "cx-bar-wrap",
								children: [
									jsxRuntime.jsx("div", {
										className: "cx-bar",
										children: jsxRuntime.jsx("div", {
											className: pct >= 80 ? "cx-bar-fill cx-bar-hot" : "cx-bar-fill",
											style: { width: `${pct}%` }
										})
									}),
									jsxRuntime.jsx("span", {
										className: "tb-rounds",
										children: `${fmt(surface)} / ${fmt(windowSize)}（${pct}%）`
									})
								]
							})]
							: []),
						jsxRuntime.jsx("p", {
							className: "cx-meta",
							children: [
								"输入 ", jsxRuntime.jsx("b", { children: fmt(row.inputTokens) ?? "–" }),
								" · 命中缓存 ", jsxRuntime.jsx("b", { children: fmt(row.cacheReadTokens) ?? "–" }),
								" · 输出 ", jsxRuntime.jsx("b", { children: fmt(row.outputTokens) ?? "–" })
							]
						})
					]
				});
			};

			return jsxRuntime.jsxs("div", {
				className: "tb-backdrop",
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: [
					jsxRuntime.jsxs("div", {
						className: "tb-panel",
						role: "dialog",
						"aria-label": t("cx.title"),
						children: [
							jsxRuntime.jsxs("div", {
								className: "tb-head",
								children: [
									jsxRuntime.jsx("h2", { className: "guide-title", children: t("cx.title") }),
									jsxRuntime.jsx("button", {
										type: "button",
										className: "guide-btn-ghost guide-btn tb-close",
										onClick: onClose,
										children: t("guide.close")
									})
								]
							}),
							error !== null ? jsxRuntime.jsx("p", { className: "as-err", role: "alert", children: error }) : null,
							jsxRuntime.jsx("div", {
								className: "tb-list",
								children: (() => {
									if (rows === null) return jsxRuntime.jsx("p", { className: "tb-empty", children: t("board.loading") });
									const visible = rows.filter((r) => r.hasAny === true);
									if (visible.length === 0) return jsxRuntime.jsx("p", { className: "tb-empty", children: t("cx.empty") });
									return visible.map(renderRow);
								})()
							})
						]
					})
				]
			});
		}

		function ContextButton({ t }) {
			const [open, setOpen] = react.useState(false);
			return jsxRuntime.jsxs(react.Fragment, {
				children: [
					jsxRuntime.jsx("button", {
						type: "button",
						className: "ux-help-btn",
						onClick: () => setOpen(true),
						title: t("cx.title"),
						"aria-label": t("cx.title"),
						children: "📊"
					}),
					open ? jsxRuntime.jsx(ContextPanel, { t, onClose: () => setOpen(false) }) : null
				]
			});
		}

		// ── skills & persona settings card ─────────────────────────────────────
		function SkillsPersonaCard({ t, complete }) {
			const [skills, setSkills] = react.useState(null);
			const [persona, setPersona] = react.useState("");
			const [personaLoaded, setPersonaLoaded] = react.useState(false);
			const [busy, setBusy] = react.useState(false);
			const [confirmDelete, setConfirmDelete] = react.useState(null);
			const [msg, setMsg] = react.useState(null);
			const finishedRef = react.useRef(false);
			const finish = react.useCallback(() => {
				if (finishedRef.current) return;
				finishedRef.current = true;
				complete?.();
			}, [complete]);
			// 已有默认模型配置（老用户）时，onboarding 卡片不再常驻：自动完成。
			react.useEffect(() => {
				let alive = true;
				void fetch("/ux/models").then((res) => res.json()).then((body) => {
					if (!alive) return;
					if (body.ok === true && body.active !== null && typeof body.active === "object" && typeof body.active.model === "string" && body.active.model !== "") finish();
				}).catch(() => { /* keep the card as a fallback */ });
				return () => { alive = false; };
			}, [finish]);
			const skipPersona = async () => {
				try { await fetch("/ux/guide", { method: "POST" }); } catch (_) { /* non-fatal */ }
				finish();
			};

			const loadSkills = react.useCallback(async () => {
				try {
					const res = await fetch("/ux/skills");
					const body = await res.json();
					if (body.ok === true) setSkills(body.skills ?? []);
				} catch { /* ignore */ }
			}, []);

			react.useEffect(() => {
				void loadSkills();
				void fetch("/ux/persona").then((r) => r.json()).then((b) => {
					if (b.ok === true) {
						setPersona(b.text ?? "");
						setPersonaLoaded(true);
					}
				}).catch(() => setPersonaLoaded(true));
			}, [loadSkills]);

			const toggle = async (name, enabled) => {
				setBusy(true);
				try {
					const res = await fetch("/ux/skills", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ action: "toggle", name, enabled })
						});
					const body = await res.json();
					if (body.ok === true) await loadSkills();
					else setMsg(body.error ?? "toggle failed");
				} finally {
					setBusy(false);
				}
			};

			const remove = async (name) => {
				if (confirmDelete !== name) {
					setConfirmDelete(name);
					return;
				}
				setConfirmDelete(null);
				setBusy(true);
				try {
					const res = await fetch("/ux/skills", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ action: "delete", name })
						});
					const body = await res.json();
					if (body.ok === true) await loadSkills();
					else setMsg(body.error ?? "delete failed");
				} finally {
					setBusy(false);
				}
			};

			const savePersona = async () => {
				setBusy(true);
				setMsg(null);
				try {
					const res = await fetch("/ux/persona", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ text: persona })
						});
					const body = await res.json();
					setMsg(body.ok === true ? t("sp.saved") : body.error ?? "save failed");
				} finally {
					setBusy(false);
				}
			};

			return jsxRuntime.jsxs("div", {
				className: "sp-card",
				children: [
					jsxRuntime.jsx("h2", { className: "guide-title", children: t("sp.title") }),
					jsxRuntime.jsx("button", {
						type: "button",
						className: "guide-btn-ghost guide-btn sp-skip",
						disabled: busy,
						onClick: () => void skipPersona(),
						children: t("sp.skip")
					}),
					jsxRuntime.jsx("p", { className: "guide-sub", children: t("sp.sub") }),
					jsxRuntime.jsx("h3", { className: "sp-h3", children: t("sp.personaTitle") }),
					jsxRuntime.jsx("p", { className: "wiz-note", children: t("sp.personaHint") }),
					jsxRuntime.jsx("textarea", {
						className: "sp-textarea",
						value: persona,
						rows: 6,
						placeholder: t("sp.personaPlaceholder"),
						disabled: !personaLoaded || busy,
						onChange: (event) => setPersona(event.target.value)
					}),
					jsxRuntime.jsx("button", {
						type: "button",
						className: "guide-btn",
						disabled: !personaLoaded || busy,
						onClick: () => void savePersona(),
						children: t("sp.save")
					}),
					jsxRuntime.jsx("h3", { className: "sp-h3", children: t("sp.skillsTitle") }),
					jsxRuntime.jsx("p", { className: "wiz-note", children: t("sp.skillsHint") }),
					msg !== null ? jsxRuntime.jsx("p", { className: "sp-msg", children: msg }) : null,
					jsxRuntime.jsx("div", {
						className: "sp-skills",
						children: skills === null
							? jsxRuntime.jsx("p", { className: "tb-empty", children: t("board.loading") })
							: skills.length === 0
								? jsxRuntime.jsx("p", { className: "tb-empty", children: t("sp.noSkills") })
								: skills.map((skill) => jsxRuntime.jsxs("div", {
									className: "sp-skill",
									key: skill.name,
									children: [
										jsxRuntime.jsxs("div", {
											className: "sp-skill-info",
											children: [
												jsxRuntime.jsx("b", {
													className: skill.enabled ? "" : "sp-skill-off",
													children: skill.name
												}),
												jsxRuntime.jsx("span", {
													className: "sp-skill-desc",
													children: skill.description.length > 60 ? `${skill.description.slice(0, 60)}…` : skill.description
												})
											]
										}),
										jsxRuntime.jsx("div", {
											className: "tb-actions",
											children: [
												jsxRuntime.jsx("button", {
													type: "button",
													className: "guide-btn-ghost guide-btn",
													disabled: busy,
													onClick: () => void toggle(skill.name, !skill.enabled),
													children: skill.enabled ? t("sp.disable") : t("sp.enable")
												}),
												jsxRuntime.jsx("button", {
													type: "button",
													className: "guide-btn-ghost guide-btn",
													disabled: busy,
													onClick: () => void remove(skill.name),
													children: confirmDelete === skill.name ? t("sp.confirmDelete") : t("sp.delete")
												})
											]
										})
									]
								}))
					})
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
			// 已有默认模型配置，或此前明确跳过时，向导不再弹出。
			react.useEffect(() => {
				let alive = true;
				try {
					if (localStorage.getItem("studio-ux.skip-model-wizard") === "1") {
						finish();
						return () => { alive = false; };
					}
				} catch (_) { /* ignore */ }
				void fetch("/ux/models").then((res) => res.json()).then((body) => {
					if (!alive) return;
					if (body.ok === true && body.active !== null && typeof body.active === "object" && typeof body.active.model === "string" && body.active.model !== "") finish();
				}).catch(() => { /* keep the wizard as a fallback */ });
				return () => { alive = false; };
			}, [finish]);
			const skip = () => {
				try { localStorage.setItem("studio-ux.skip-model-wizard", "1"); } catch (_) { /* ignore */ }
				finish();
			};
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
								jsxRuntime.jsx("button", { type: "button", className: "guide-btn-ghost guide-btn", onClick: skip, children: t("wizard.skip") }),
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
			"wizard.modelRequired": "请填写或选择模型 ID",
			"board.title": "任务看板",
			"board.search": "搜索任务…",
			"board.loading": "正在读取任务…",
			"board.empty": "当前没有运行中的任务。用 /goal 发起一个长任务试试。",
			"board.noMatch": "没有匹配的任务",
			"board.active": "进行中",
			"board.paused": "已暂停",
			"board.blocked": "已阻塞",
			"board.complete": "已完成",
			"board.rounds": "第 {n}/{m} 轮",
			"board.roundsOpen": "第 {n} 轮",
			"board.pause": "暂停",
			"board.resume": "继续",
			"board.stop": "停止",
			"board.actionFail": "操作失败：",
			"cx.title": "上下文与用量",
			"cx.untitled": "（未命名会话）",
			"cx.empty": "还没有用量数据。发几条消息后再来看。",
			"sp.title": "技能与人格",
			"sp.sub": "管理你的技能库，并给所有会话设置一条全局人格指令（写入 AGENTS.md，每个新会话自动生效）。",
			"sp.personaTitle": "全局人格指令",
			"sp.personaHint": "例如：你是我的私人助理，回答要简洁、用中文、先给结论。",
			"sp.personaPlaceholder": "在这里写下希望 AI 在所有会话里遵守的规则…",
			"sp.save": "保存人格指令",
			"sp.saved": "已保存，新会话生效",
			"sp.skillsTitle": "技能库",
			"sp.skillsHint": "技能是 AI 的专项能力包。关闭后不再被自动调用；删除不可恢复。",
			"sp.skip": "跳过，不再显示",
			"sp.noSkills": "还没有安装任何技能",
			"sp.enable": "启用",
			"sp.disable": "停用",
			"sp.delete": "删除",
			"sp.confirmDelete": "确认删除？"
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
			"wizard.modelRequired": "Model ID required",
			"board.title": "Task board",
			"board.search": "Search tasks…",
			"board.loading": "Loading tasks…",
			"board.empty": "No running tasks. Try /goal to start a long task.",
			"board.noMatch": "No matching tasks",
			"board.active": "Running",
			"board.paused": "Paused",
			"board.blocked": "Blocked",
			"board.complete": "Done",
			"board.rounds": "Round {n}/{m}",
			"board.roundsOpen": "Round {n}",
			"board.pause": "Pause",
			"board.resume": "Resume",
			"board.stop": "Stop",
			"board.actionFail": "Action failed: ",
			"cx.title": "Context & usage",
			"cx.untitled": "(untitled session)",
			"cx.empty": "No usage yet. Send a few messages first.",
			"sp.title": "Skills & persona",
			"sp.sub": "Manage your skills and set one global persona instruction (written to AGENTS.md and applied to every new session).",
			"sp.personaTitle": "Global persona",
			"sp.personaHint": "E.g. reply concisely, in Chinese, conclusion first.",
			"sp.personaPlaceholder": "Write rules for the AI to follow in every session…",
			"sp.save": "Save persona",
			"sp.saved": "Saved — new sessions will use it",
			"sp.skillsTitle": "Skills",
			"sp.skillsHint": "Skills are specialized capability packs. Disabled skills are not auto-invoked; deletion is permanent.",
			"sp.skip": "Skip, don't show again",
			"sp.noSkills": "No skills installed",
			"sp.enable": "Enable",
			"sp.disable": "Disable",
			"sp.delete": "Delete",
			"sp.confirmDelete": "Delete?"
		};

		// ── plugin entry ───────────────────────────────────────────────────────
		function apply(ctx) {
			ctx.locale.register("studioUx", { zh, en });
			const goalsApi = ctx.remote !== undefined && ctx.remote.goals !== undefined ? ctx.remote.goals : null;
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
				scope.slots.inject("conversation.session.header.actions", () => scope.slots.register({
					name: "conversation.session.header.actions",
					id: "studio-task-board",
					order: 3,
					locale: "studioUx",
					inject: () => ({})
				}, (props) => TaskBoardButton({ ...props, goalsApi })));
				scope.slots.inject("conversation.session.header.actions", () => scope.slots.register({
					name: "conversation.session.header.actions",
					id: "studio-context-dashboard",
					order: 4,
					locale: "studioUx",
					inject: () => ({})
				}, ContextButton));
				scope.slots.inject("settings.onboarding", () => scope.slots.register({
					name: "settings.onboarding",
					id: "studio-skills-persona",
					order: 80,
					locale: "studioUx",
					inject: () => ({})
				}, SkillsPersonaCard));
			});
		}

		exports.apply = apply;
		exports.inject = ["locale", "remote", "remote.goals"];
		return module.exports;
	}
});
