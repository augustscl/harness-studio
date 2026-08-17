/**
 * @harness/artifact-studio — client half (plain browser bundle).
 *
 * 📦 button in the session header actions → floating artifact panel:
 *  - list of produced files in the session workspace (newest first);
 *  - HTML/Markdown: editor with live preview and save-back;
 *  - images / PDF: inline preview;
 *  - DOCX: dependency-free host-side parse → rendered HTML.
 */
window.__ModuleLoader__.load({
	id: "@harness/artifact-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const jsxRuntime = require("react/jsx-runtime");

		// ── styles ────────────────────────────────────────────────────────────
		const css = `
.as-attach{position:relative;display:inline-flex;align-items:center}
.as-btn{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);height:28px;min-width:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0 7px;gap:5px;font-size:12px}
.as-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.as-panel{position:fixed;z-index:9990;width:420px;max-width:calc(100vw - 24px);height:min(72vh,640px);display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2));background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));border-radius:14px;box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.4));overflow:hidden}
.as-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.as-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);flex:1}
.as-headbtn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:3px 8px;font-size:12px}
.as-headbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.as-list{flex:1;overflow-y:auto;padding:6px}
.as-row{display:flex;align-items:center;gap:9px;width:100%;border:none;background:transparent;color:var(--dsw-alias-label-primary);border-radius:9px;padding:8px 10px;cursor:pointer;text-align:left}
.as-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.as-icon{width:26px;height:26px;border-radius:7px;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.3px}
.as-ic-html{background:rgba(229,72,77,.15);color:#e5484d}
.as-ic-md{background:rgba(58,110,214,.16);color:#3a6ed6}
.as-ic-pdf{background:rgba(217,141,42,.16);color:#d98d2a}
.as-ic-img{background:rgba(46,160,67,.15);color:#2ea043}
.as-ic-docx{background:rgba(207,97,166,.16);color:#cf61a6}
.as-ic-txt{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.as-ic-video{background:rgba(122,90,248,.15);color:#7a5af8}
.as-row-main{min-width:0;flex:1}
.as-row-name{font-size:12.5px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.as-row-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.as-detail{flex:1;min-height:0;display:flex;flex-direction:column}
.as-detail-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.as-back{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:3px 8px;font-size:12px;flex:none}
.as-back:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.as-file{font-size:12.5px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.as-view{flex:1;min-height:0;overflow:auto;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base))}
.as-view iframe{width:100%;height:100%;border:none;display:block}
.as-view img{max-width:100%;display:block}
.as-editor{width:100%;height:100%;box-sizing:border-box;border:none;outline:none;resize:none;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-mono,monospace);font-size:12.5px;line-height:1.6;padding:14px}
.as-actions{display:flex;gap:6px;align-items:center}
.as-pill{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:7px;padding:3px 10px;font-size:12px}
.as-pill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.as-pill[data-on="true"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}
.as-empty{color:var(--dsw-alias-label-tertiary);font-size:12.5px;text-align:center;padding:32px 16px;line-height:1.7}
.as-err{color:var(--dsw-alias-state-error-primary);font-size:12px;padding:2px 12px 8px}
`;
		const CSS_ID = "@harness/artifact-studio/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@harness/artifact-studio";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── utils ──────────────────────────────────────────────────────────────
		function sizeText(bytes) {
			if (bytes < 1024) return bytes + " B";
			if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
			return (bytes / (1024 * 1024)).toFixed(2) + " MB";
		}
		function timeText(ms) {
			const d = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
		}
		function mdToHtml(src) {
			const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			const inline = (t) => esc(t)
				.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
				.replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
				.replace(/`([^`\n]+)`/g, "<code>$1</code>")
				.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
			const lines = src.split("\n");
			const out = [];
			let inCode = false;
			let codeBuf = [];
			let listOpen = false;
			const closeList = () => {
				if (listOpen) {
					out.push("</ul>");
					listOpen = false;
				}
			};
			for (const line of lines) {
				if (line.startsWith("```")) {
					if (inCode) {
						out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
						codeBuf = [];
						inCode = false;
					} else {
						closeList();
						inCode = true;
					}
					continue;
				}
				if (inCode) {
					codeBuf.push(line);
					continue;
				}
				const h = /^(#{1,6}) (.*)$/.exec(line);
				if (h !== null) {
					closeList();
					out.push("<h" + h[1].length + ">" + inline(h[2]) + "</h" + h[1].length + ">");
					continue;
				}
				if (/^[-*] /.test(line)) {
					if (!listOpen) {
						out.push("<ul>");
						listOpen = true;
					}
					out.push("<li>" + inline(line.slice(2)) + "</li>");
					continue;
				}
				closeList();
				if (line.trim() === "") continue;
				out.push("<p>" + inline(line) + "</p>");
			}
			if (inCode) out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
			closeList();
			return out.join("\n");
		}
		const DOC_WRAPPER = "<!doctype html><html><head><meta charset='utf-8'><style>body{font-family:-apple-system,sans-serif;max-width:760px;margin:0 auto;padding:24px;line-height:1.7;color:#1b1e26}h1,h2,h3{line-height:1.3}pre{background:#f2f3f6;padding:10px 14px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace;background:#f2f3f6;padding:1px 4px;border-radius:4px}li{margin:3px 0}img{max-width:100%}</style></head><body>";
		const MD_WRAPPER = "<!doctype html><html><head><meta charset='utf-8'><style>body{font-family:-apple-system,sans-serif;max-width:760px;margin:0 auto;padding:24px;line-height:1.7;color:#1b1e26}h1,h2,h3,h4,h5,h6{line-height:1.3}pre{background:#f2f3f6;padding:10px 14px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace;background:#f2f3f6;padding:1px 4px;border-radius:4px}li{margin:3px 0}img{max-width:100%}</style></head><body>";

		const KIND_ICON = {
			html: ["HTML", "as-ic-html"],
			markdown: ["MD", "as-ic-md"],
			pdf: ["PDF", "as-ic-pdf"],
			image: ["IMG", "as-ic-img"],
			docx: ["DOC", "as-ic-docx"],
			video: ["VID", "as-ic-video"],
			text: ["TXT", "as-ic-txt"]
		};

		// ── components ─────────────────────────────────────────────────────────
		function BoxIcon() {
			return jsxRuntime.jsx("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: jsxRuntime.jsxs("g", {
					children: [
						jsxRuntime.jsx("path", { d: "M21 8l-9-5-9 5v8l9 5 9-5V8z" }),
						jsxRuntime.jsx("path", { d: "M3.3 7.5L12 12l8.7-4.5" }),
						jsxRuntime.jsx("path", { d: "M12 12v9" })
					]
				})
			});
		}

		function ArtifactPanel({ sessionId, state, onClose, onRefresh, onOpen, onBack, onToggleMode, onDraft, onSave, onRetry, t }) {
			if (!state.open) return null;
			const selected = state.selected;
			let body = null;
			if (selected === null) {
				body = state.files.length === 0
					? jsxRuntime.jsx("div", { className: "as-empty", children: state.loading ? t("panel.loading") : t("panel.empty") })
					: jsxRuntime.jsx("div", {
						className: "as-list",
						children: state.files.map((file) => {
							const icon = KIND_ICON[file.kind] ?? KIND_ICON.text;
							return jsxRuntime.jsxs("button", {
								type: "button",
								className: "as-row",
								key: file.path,
								onClick: () => onOpen(file),
								children: [
									jsxRuntime.jsx("span", { className: "as-icon " + icon[1], "aria-hidden": true, children: icon[0] }),
									jsxRuntime.jsxs("span", { className: "as-row-main", children: [
										jsxRuntime.jsx("div", { className: "as-row-name", children: file.name }),
										jsxRuntime.jsx("div", { className: "as-row-meta", children: file.path + " · " + sizeText(file.size) + " · " + timeText(file.mtime) })
									] })
								]
							});
						})
					});
			} else {
				const editable = selected.kind === "html" || selected.kind === "markdown";
				const editing = editable && state.mode === "edit";
				let view = null;
				if (editing) {
					view = jsxRuntime.jsx("textarea", {
						className: "as-editor",
						value: state.draft,
						onChange: (event) => onDraft(event.target.value),
						spellCheck: false
					});
				} else if (state.error !== null) {
					view = jsxRuntime.jsxs("div", {
						className: "as-view",
						children: [
							jsxRuntime.jsx("div", { className: "as-err", children: state.error }),
							jsxRuntime.jsx("button", { type: "button", className: "as-pill", onClick: onRetry, children: t("panel.retry") })
						]
					});
				} else if (selected.kind === "image") {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: jsxRuntime.jsx("img", { src: "/artifacts/preview?sessionId=" + encodeURIComponent(sessionId ?? "") + "&path=" + encodeURIComponent(selected.path), alt: selected.name })
					});
				} else if (selected.kind === "pdf") {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: jsxRuntime.jsx("iframe", { src: "/artifacts/preview?sessionId=" + encodeURIComponent(sessionId ?? "") + "&path=" + encodeURIComponent(selected.path), title: selected.name })
					});
				} else if (selected.kind === "video") {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: jsxRuntime.jsx("video", {
							src: "/artifacts/preview?sessionId=" + encodeURIComponent(sessionId ?? "") + "&path=" + encodeURIComponent(selected.path),
							controls: true,
							style: { width: "100%", display: "block" }
						})
					});
				} else if (selected.kind === "docx") {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: state.html === null ? jsxRuntime.jsx("div", { className: "as-empty", children: t("panel.loading") }) : jsxRuntime.jsx("iframe", { srcDoc: DOC_WRAPPER + state.html + "</body></html>", title: selected.name })
					});
				} else if (selected.kind === "markdown") {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: jsxRuntime.jsx("iframe", { srcDoc: MD_WRAPPER + mdToHtml(state.content ?? "") + "</body></html>", title: selected.name })
					});
				} else if (selected.kind === "html") {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: jsxRuntime.jsx("iframe", { srcDoc: state.content ?? "", title: selected.name })
					});
				} else {
					view = jsxRuntime.jsx("div", {
						className: "as-view",
						children: jsxRuntime.jsx("pre", { style: { margin: 0, padding: 14, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: state.content ?? "" })
					});
				}
				body = jsxRuntime.jsxs("div", {
					className: "as-detail",
					children: [
						jsxRuntime.jsxs("div", {
							className: "as-detail-bar",
							children: [
								jsxRuntime.jsx("button", { type: "button", className: "as-back", onClick: onBack, children: "← " + t("panel.back") }),
								jsxRuntime.jsx("span", { className: "as-file", title: selected.path, children: selected.name }),
								jsxRuntime.jsx("span", {
									className: "as-actions",
									children: editable ? jsxRuntime.jsxs(jsxRuntime.Fragment, {
										children: [
											jsxRuntime.jsx("button", { type: "button", className: "as-pill", "data-on": state.mode === "preview", onClick: () => onToggleMode("preview"), children: t("panel.preview") }),
											jsxRuntime.jsx("button", { type: "button", className: "as-pill", "data-on": state.mode === "edit", onClick: () => onToggleMode("edit"), children: t("panel.edit") }),
											jsxRuntime.jsx("button", { type: "button", className: "as-pill", onClick: onSave, disabled: state.saving, children: state.saving ? t("panel.saving") : t("panel.save") })
										]
									}) : null
								})
							]
						}),
						view
					]
				});
			}
			return jsxRuntime.jsxs("div", {
				className: "as-panel",
				style: { top: state.pos.top, right: state.pos.right },
				children: [
					jsxRuntime.jsxs("div", {
						className: "as-head",
						children: [
							jsxRuntime.jsx("span", { className: "as-title", children: t("panel.title") }),
							jsxRuntime.jsx("button", { type: "button", className: "as-headbtn", onClick: onRefresh, children: t("panel.refresh") }),
							jsxRuntime.jsx("button", { type: "button", className: "as-headbtn", onClick: onClose, children: "✕" })
						]
					}),
					body
				]
			});
		}

		function ArtifactButton({ sessionId, t }) {
			const rootRef = react.useRef(null);
			const [state, setState] = react.useState({
				open: false,
				pos: { top: 0, right: 12 },
				files: [],
				loading: false,
				selected: null,
				mode: "preview",
				content: null,
				html: null,
				draft: "",
				saving: false,
				error: null,
				sessionId: sessionId
			});
			const stateRef = react.useRef(state);
			stateRef.current = state;
			const set = (patch) => setState((prev) => ({ ...prev, ...patch }));

			const refresh = react.useCallback(async () => {
				set({ loading: true, error: null });
				try {
					const res = await fetch("/artifacts/list?sessionId=" + encodeURIComponent(sessionId ?? ""));
					const body = await res.json();
					if (body.ok === true) set({ files: body.files ?? [], loading: false });
					else set({ error: body.error ?? "load failed", loading: false });
				} catch (error) {
					set({ error: error instanceof Error ? error.message : String(error), loading: false });
				}
			}, [sessionId]);

			const close = react.useCallback(() => {
				setState((prev) => ({ ...prev, open: false }));
			}, []);

			const toggle = () => {
				if (stateRef.current.open) {
					close();
					return;
				}
				if (rootRef.current === null) return;
				const rect = rootRef.current.getBoundingClientRect();
				set({ open: true, pos: { top: rect.bottom + 8, right: Math.max(12, Math.min(window.innerWidth - rect.right, window.innerWidth - 24)) } });
				void refresh();
			};

			react.useEffect(() => {
				if (!state.open) return;
				const onPointerDown = (event) => {
					if (!(event.target instanceof Node)) return;
					if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
					close();
				};
				const onKey = (event) => {
					if (event.key === "Escape") close();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, [state.open]);

			const openFile = async (file) => {
				set({ selected: file, mode: "preview", content: null, html: null, draft: "", error: null });
				if (file.kind === "html" || file.kind === "markdown" || file.kind === "text") {
					try {
						const res = await fetch("/artifacts/read?sessionId=" + encodeURIComponent(sessionId ?? "") + "&path=" + encodeURIComponent(file.path));
						const body = await res.json();
						if (body.ok === true) set({ content: body.content, draft: body.content });
						else set({ error: body.error ?? "read failed" });
					} catch (error) {
						set({ error: error instanceof Error ? error.message : String(error) });
					}
				} else if (file.kind === "docx") {
					try {
						const res = await fetch("/artifacts/docx?sessionId=" + encodeURIComponent(sessionId ?? "") + "&path=" + encodeURIComponent(file.path));
						const body = await res.json();
						if (body.ok === true) set({ html: body.html });
						else set({ error: body.error ?? "docx parse failed" });
					} catch (error) {
						set({ error: error instanceof Error ? error.message : String(error) });
					}
				}
			};

			const save = async () => {
				const cur = stateRef.current;
				if (cur.selected === null || cur.saving) return;
				set({ saving: true, error: null });
				try {
					const res = await fetch("/artifacts/save?sessionId=" + encodeURIComponent(sessionId ?? "") + "&path=" + encodeURIComponent(cur.selected.path), {
						method: "POST",
						headers: { "Content-Type": "text/plain; charset=utf-8" },
						body: cur.draft
					});
					const body = await res.json();
					if (body.ok === true) {
						set({ saving: false, content: cur.draft, mode: "preview" });
					} else {
						set({ saving: false, error: body.error ?? "save failed" });
					}
				} catch (error) {
					set({ saving: false, error: error instanceof Error ? error.message : String(error) });
				}
			};

			return jsxRuntime.jsxs("span", {
				ref: rootRef,
				className: "as-attach",
				children: [
					jsxRuntime.jsx("button", {
						type: "button",
						className: "as-btn",
						onClick: toggle,
						title: t("panel.title"),
						"aria-label": t("panel.title"),
						children: jsxRuntime.jsx(BoxIcon, {})
					}),
					jsxRuntime.jsx(ArtifactPanel, {
						sessionId,
						state,
						onClose: close,
						onRefresh: () => void refresh(),
						onOpen: (file) => void openFile(file),
						onBack: () => set({ selected: null, content: null, html: null, error: null }),
						onToggleMode: (mode) => set({ mode }),
						onDraft: (draft) => set({ draft }),
						onSave: () => void save(),
						onRetry: () => {
							if (state.selected !== null) void openFile(state.selected);
						},
						t
					})
				]
			});
		}

		// ── locales ────────────────────────────────────────────────────────────
		const zh = {
			"panel.title": "产物",
			"panel.refresh": "刷新",
			"panel.back": "返回",
			"panel.preview": "预览",
			"panel.edit": "编辑",
			"panel.save": "保存",
			"panel.saving": "保存中…",
			"panel.retry": "重试",
			"panel.loading": "正在扫描产物…",
			"panel.empty": "工作目录里还没有可预览的产物\n（HTML / Markdown / 图片 / PDF / DOCX）"
		};
		const en = {
			"panel.title": "Artifacts",
			"panel.refresh": "Refresh",
			"panel.back": "Back",
			"panel.preview": "Preview",
			"panel.edit": "Edit",
			"panel.save": "Save",
			"panel.saving": "Saving…",
			"panel.retry": "Retry",
			"panel.loading": "Scanning artifacts…",
			"panel.empty": "No previewable artifacts in the workspace yet\n(HTML / Markdown / images / PDF / DOCX)"
		};

		// ── plugin entry ───────────────────────────────────────────────────────
		function apply(ctx) {
			ctx.locale.register("artifactStudio", { zh, en });
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.session.header.actions", () => scope.slots.register({
					name: "conversation.session.header.actions",
					id: "artifact-studio-button",
					order: 1,
					locale: "artifactStudio",
					inject: (sessionId) => ({ sessionId })
				}, ArtifactButton));
			});
		}

		exports.apply = apply;
		exports.inject = ["locale"];
		return module.exports;
	}
});
