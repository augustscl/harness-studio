/**
 * @harness/file-upload — client half (plain browser bundle).
 *
 * Registered via window.__ModuleLoader__.load; the web shell loads this
 * bundle from /plugins/@harness/file-upload/client.js and materializes it as
 * a cordis client plugin ({apply, inject} exports).
 *
 * Surfaces:
 *  - "conversation.input.left"  → attach button + hidden file input
 *  - "conversation.input.dock"  → pending-document chip rail
 *  - a window-level capture drop listener → document drag-and-drop
 *
 * Images (png/jpeg/webp/gif) ride the official draft-image channel
 * (conversation.createDraftImages + inputActions.addImages); every other
 * file streams to POST /upload and lands in <workspace>/uploads/, and an
 * "[附件] <absolute path>" line is appended to the draft.
 */
window.__ModuleLoader__.load({
	id: "@harness/file-upload",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const jsxRuntime = require("react/jsx-runtime");

		// ── styles ────────────────────────────────────────────────────────────
		const css = `
.fu-attach{position:relative;display:inline-flex;align-items:center}
.fu-btn{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.fu-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.fu-badge{position:absolute;top:-5px;right:-5px;min-width:15px;height:15px;border-radius:8px;background:#e5484d;color:#fff;font-size:10px;line-height:15px;text-align:center;padding:0 4px;box-sizing:border-box}
.fu-dock{display:flex;flex-wrap:wrap;gap:6px;padding:4px 2px}
.fu-chip{display:inline-flex;align-items:center;gap:7px;max-width:300px;padding:4px 6px 4px 8px;border:1px solid var(--dsw-alias-border-inverted);border-radius:10px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,transparent)}
.fu-thumb{width:26px;height:26px;border-radius:6px;object-fit:cover;flex:none;border:1px solid var(--dsw-alias-border-inverted)}
.fu-ext{width:26px;height:26px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;letter-spacing:.3px;flex:none}
.fu-ext-img{background:rgba(46,160,67,.15);color:#2ea043}
.fu-ext-pdf{background:rgba(229,72,77,.15);color:#e5484d}
.fu-ext-doc{background:rgba(58,110,214,.16);color:#3a6ed6}
.fu-ext-sheet{background:rgba(46,144,85,.15);color:#2e9055}
.fu-ext-zip{background:rgba(217,141,42,.16);color:#d98d2a}
.fu-ext-code{background:rgba(122,90,248,.15);color:#7a5af8}
.fu-ext-media{background:rgba(207,97,166,.16);color:#cf61a6}
.fu-ext-file{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.fu-chip-name{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fu-chip-size{color:var(--dsw-alias-label-tertiary);font-size:11px;flex:none}
.fu-chip-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;flex:none;display:inline-flex;align-items:center;gap:5px}
.fu-chip-ok{color:#2ea043}
.fu-chip-error{border-color:rgba(229,72,77,.55);color:#e5484d}
.fu-chip-error .fu-chip-meta{color:#e5484d}
.fu-progress{width:56px;height:3px;background:var(--dsw-alias-interactive-bg-hover);border-radius:2px;overflow:hidden}
.fu-progress>i{display:block;height:100%;background:var(--dsw-alias-label-secondary);transition:width .15s ease}
.fu-chip-x{border:none;background:none;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:2px 4px;border-radius:4px;display:inline-flex;align-items:center;flex:none;font-size:14px;line-height:14px}
.fu-chip-x:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
`;
		const CSS_ID = "@harness/file-upload/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@harness/file-upload";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── small utils ────────────────────────────────────────────────────────
		const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
		const FALLBACK_LIMITS = {
			maxImageBytes: 5 * 1024 * 1024,
			maxImagesPerMessage: 20,
			maxMessageImageBytes: 100 * 1024 * 1024,
			mediaTypes: IMAGE_TYPES
		};
		const isImage = (file) => IMAGE_TYPES.includes(file.type);

		function sizeText(bytes) {
			if (bytes < 1024) return bytes + " B";
			if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
			return (bytes / (1024 * 1024)).toFixed(1) + " MB";
		}

		function createStore(initial) {
			let state = initial;
			const subs = new Set();
			return {
				getSnapshot: () => state,
				subscribe: (fn) => {
					subs.add(fn);
					return () => subs.delete(fn);
				},
				set: (next) => {
					if (next === state) return;
					state = next;
					for (const fn of [...subs]) fn();
				}
			};
		}

		let chipSeq = 0;
		const nextKey = () => "fu-" + (++chipSeq);

		function uploadDoc(sessionId, file, onProgress) {
			return new Promise((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open("POST", "/upload?name=" + encodeURIComponent(file.name) + "&sessionId=" + encodeURIComponent(sessionId ?? ""));
				xhr.setRequestHeader("Content-Type", "application/octet-stream");
				xhr.responseType = "json";
				xhr.upload.onprogress = (event) => {
					if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
				};
				xhr.onload = () => {
					try {
						const body = xhr.response;
						if (xhr.status >= 200 && xhr.status < 300 && body && body.ok === true) resolve(body);
						else reject(new Error(body && body.error ? String(body.error) : "HTTP " + xhr.status));
					} catch (error) {
						reject(error instanceof Error ? error : new Error(String(error)));
					}
				};
				xhr.onerror = () => reject(new Error("network"));
				xhr.onabort = () => reject(new Error("aborted"));
				xhr.send(file);
			});
		}

		// Model image-capability probe (cached per session, 60s TTL). When the
		// active model cannot see images, image files take the disk route so the
		// agent can process them with tools (OCR, dimensions, pixel analysis).
		const capsCache = new Map();
		async function supportsImages(sessionId) {
			const key = sessionId ?? "";
			const hit = capsCache.get(key);
			if (hit !== void 0 && Date.now() - hit.ts < 60000) return hit.value;
			try {
				const res = await fetch("/upload/capabilities?sessionId=" + encodeURIComponent(key));
				const body = await res.json();
				const value = !!(body && body.ok === true && body.supportsImages === true);
				capsCache.set(key, { ts: Date.now(), value });
				return value;
			} catch (_) {
				return false;
			}
		}

		// ── per-session controller ────────────────────────────────────────────
		const controllers = new Map();
		let activeController = null;

		function controllerFor(sessionId, conversation) {
			let controller = controllers.get(sessionId);
			if (controller !== undefined) return controller;
			controller = createController(conversation);
			controllers.set(sessionId, controller);
			return controller;
		}

		function createController(conversation) {
			const store = createStore({ chips: [] });
			const kit = { sessionId: void 0, inputActions: void 0, inputState: null, limits: FALLBACK_LIMITS };
			const xhrs = new Map();

			const update = (key, patch) => {
				const cur = store.getSnapshot();
				store.set({
					chips: cur.chips.map((chip) => chip.key === key ? { ...chip, ...patch } : chip)
				});
			};
			const pushChip = (chip) => {
				const cur = store.getSnapshot();
				store.set({ chips: [...cur.chips, chip] });
			};

			function appendReference(info) {
				const ref = typeof info.rel === "string" && info.rel !== "" ? info.rel : info.path;
				const line = "📎 已上传: " + ref + "\n";
				const draft = kit.inputState?.draft ?? "";
				const next = draft === "" || draft.endsWith("\n") ? draft + line : draft + "\n" + line;
				kit.inputActions?.setDraft(next);
				return line;
			}

			function takeImages(files) {
				// Enforce the official image policy client-side (same numbers the
				// composer uses) before touching the draft-image channel.
				const limits = kit.limits;
				const currentIds = kit.inputState?.imageIds ?? [];
				let currentBytes = 0;
				try {
					currentBytes = conversation.draftImages(currentIds).reduce((sum, a) => sum + (a.file?.size ?? 0), 0);
				} catch (_) { /* registry miss — treat as empty */ }
				const errors = [];
				const accepted = [];
				for (const file of files) {
					if (file.size > limits.maxImageBytes) {
						errors.push({ name: file.name, code: "error.imageTooLarge" });
					} else if (currentIds.length + accepted.length >= limits.maxImagesPerMessage) {
						errors.push({ name: file.name, code: "error.imageTooMany" });
					} else if (currentBytes + accepted.reduce((s, f) => s + f.size, 0) + file.size > limits.maxMessageImageBytes) {
						errors.push({ name: file.name, code: "error.imageTotalTooLarge" });
					} else {
						accepted.push(file);
					}
				}
				for (const item of errors) {
					pushChip({
						key: nextKey(),
						kind: "image",
						name: item.name,
						status: "error",
						error: item.code,
						progress: 0
					});
				}
				if (accepted.length === 0) return;
				let added = 0;
				try {
					const drafts = conversation.createDraftImages(accepted);
					added = drafts.length;
					const ok = kit.inputActions?.addImages(drafts.map((d) => d.id));
					if (ok !== true) {
						for (const d of drafts) conversation.releaseDraftImage(d.id);
						added = 0;
					}
				} catch (_) {
					added = 0;
				}
				if (added === 0) {
					for (const file of accepted) {
						pushChip({
							key: nextKey(),
							kind: "image",
							name: file.name,
							status: "error",
							error: "error.imageRejected",
							progress: 0
						});
					}
				}
			}

			async function takeDocs(files) {
				for (const file of files) {
					const key = nextKey();
					let thumbUrl = null;
					if (isImage(file)) {
						try {
							thumbUrl = URL.createObjectURL(file);
						} catch (_) { /* thumb is a nicety */ }
					}
					pushChip({
						key,
						kind: "doc",
						name: file.name,
						size: file.size,
						status: "uploading",
						progress: 0,
						thumbUrl
					});
					try {
						const info = await uploadDoc(kit.sessionId, file, (progress) => {
							update(key, { progress });
						});
						const insertedText = appendReference(info);
						update(key, { status: "done", progress: 1, path: info.path, insertedText });
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						update(key, { status: "error", error: message });
					} finally {
						xhrs.delete(key);
					}
				}
			}

			return {
				store,
				kit,
				async addFiles(files) {
					if (files.length === 0) return;
					const images = files.filter(isImage);
					const docs = files.filter((file) => !isImage(file));
					let imageDocs = [];
					if (images.length > 0) {
						if (await supportsImages(kit.sessionId)) {
							takeImages(images);
						} else {
							// Text-only model: route images to disk so the agent can
							// OCR/analyze them; the native channel would fail on send.
							imageDocs = images;
						}
					}
					const allDocs = [...docs, ...imageDocs];
					if (allDocs.length > 0) void takeDocs(allDocs);
				},
				removeChip(chip) {
					if (chip.status === "uploading") {
						const xhr = xhrs.get(chip.key);
						if (xhr !== void 0) xhr.abort();
					}
					if (typeof chip.thumbUrl === "string") {
						try {
							URL.revokeObjectURL(chip.thumbUrl);
						} catch (_) { /* ignore */ }
					}
					if (chip.status === "done" && typeof chip.insertedText === "string" && chip.insertedText !== "") {
						const draft = kit.inputState?.draft ?? "";
						if (draft.includes(chip.insertedText)) {
							kit.inputActions?.setDraft(draft.replace(chip.insertedText, ""));
						}
					}
					const cur = store.getSnapshot();
					store.set({ chips: cur.chips.filter((c) => c.key !== chip.key) });
				}
			};
		}

		// ── window-level drop interception ──────────────────────────────────────
		// Intercept every file drop while a dock is active: the controller routes
		// images to the native channel only when the model can see them, so
		// pure-image drops also belong here (not just the composer).
		function onWindowDrop(event) {
			const transfer = event.dataTransfer;
			const files = [...(transfer?.files ?? [])];
			if (files.length === 0) return;
			const controller = activeController;
			if (controller === void 0) return;
			const phase = controller.kit.inputState?.phase;
			if (phase === "submitting" || phase === "adjudicating") return;
			event.preventDefault();
			event.stopPropagation();
			void controller.addFiles(files);
			// The composer's drop overlay listens on window "dragend" to reset;
			// replay it so its state never gets stuck after we consumed the drop.
			if (typeof window !== "undefined") window.dispatchEvent(new Event("dragend"));
		}

		// Image pastes (⌘V of clipboard files) also bypass the composer so a
		// text-only model never ends up with doomed native image drafts.
		function onWindowPaste(event) {
			const clipboard = event.clipboardData;
			if (clipboard === null || clipboard === void 0) return;
			let text = "";
			try {
				text = clipboard.getData("text/plain") ?? "";
			} catch (_) { /* clipboard read guard */ }
			if (text !== "") return; // text (and mixed) pastes belong to the composer
			const files = [];
			try {
				for (const item of clipboard.items ?? []) {
					if (item.kind !== "file") continue;
					const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
					if (file !== null && file !== void 0) files.push(file);
				}
			} catch (_) {
				return;
			}
			if (files.length === 0) return;
			const controller = activeController;
			if (controller === void 0) return;
			const phase = controller.kit.inputState?.phase;
			if (phase === "submitting" || phase === "adjudicating") return;
			event.preventDefault();
			event.stopPropagation();
			void controller.addFiles(files);
		}

		// ── tool-row path shortening (YouMind-style compact cards) ─────────────
		// The official tool rows (Read/Edit/Bash/Grep/…) render absolute paths in
		// their collapsed summary. Rewrite just those text nodes to the file's
		// basename ("已阅读 style"); React re-renders are re-fixed by the observer.
		// Target rows via the stable [data-disclosure-row] attribute.
		function shortenToolPaths() {
			if (typeof document === "undefined") return;
			const rows = document.querySelectorAll("[data-disclosure-row]");
			for (const row of rows) {
				for (const node of Array.from(row.childNodes)) {
					if (node.nodeType !== 3) continue;
					const text = node.nodeValue;
					if (text === null || !text.includes("/")) continue;
					const idx = text.indexOf("/");
					if (idx <= 0) continue;
					const prefix = text.slice(0, idx);
					if (prefix.trim() !== "" && !/[\s·・:：›>|｜]/.test(prefix.slice(-1))) continue;
					let path = text.slice(idx);
					path = path.replace(/\s*\([^()]*\)\s*$/, "").replace(/[)\]]+$/, "").trim();
					const looksPath = path.includes("/") || /\.[A-Za-z0-9]{1,6}$/.test(path);
					if (!looksPath) continue;
					const base = path.split("/").filter(Boolean).pop() ?? path;
					if (base === path) continue;
					node.nodeValue = prefix + base;
				}
			}
		}

		let pathScanTimer = null;
		function schedulePathScan() {
			if (pathScanTimer !== null) return;
			pathScanTimer = setTimeout(() => {
				pathScanTimer = null;
				shortenToolPaths();
			}, 120);
		}

		// ── components ─────────────────────────────────────────────────────────
		function PaperclipIcon() {
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
				children: jsxRuntime.jsx("path", {
					d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
				})
			});
		}

		function UploadButton({ controller, t }) {
			const chips = react.useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot).chips;
			const fileRef = react.useRef(null);
			react.useEffect(() => {
				// Safety net: keep a live controller even if the dock slot is absent.
				activeController = controller;
				return () => {
					if (activeController === controller) activeController = null;
				};
			}, [controller]);
			const open = () => {
				if (fileRef.current !== null) fileRef.current.click();
			};
			const onChange = (event) => {
				const files = [...(event.target.files ?? [])];
				event.target.value = "";
				if (files.length > 0) void controller.addFiles(files);
			};
			return jsxRuntime.jsxs("span", {
				className: "fu-attach",
				children: [
					jsxRuntime.jsx("input", {
						ref: fileRef,
						type: "file",
						multiple: true,
						tabIndex: -1,
						"aria-hidden": true,
						style: { display: "none" },
						onChange
					}),
					jsxRuntime.jsx("button", {
						type: "button",
						className: "fu-btn",
						onClick: open,
						title: t("attach.title"),
						"aria-label": t("attach.title"),
						children: jsxRuntime.jsx(PaperclipIcon, {})
					}),
					chips.length > 0 ? jsxRuntime.jsx("span", {
						className: "fu-badge",
						"aria-hidden": true,
						children: String(chips.length)
					}) : null
				]
			});
		}

		function CheckIcon() {
			return jsxRuntime.jsx("svg", {
				width: 11,
				height: 11,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: jsxRuntime.jsx("path", { d: "M3 8.5l3.5 3.5L13 5" })
			});
		}

		function extOf(name) {
			const m = /\.([A-Za-z0-9]{1,5})$/.exec(name ?? "");
			return m !== null ? m[1].toUpperCase() : "FILE";
		}
		function extClass(name) {
			const e = extOf(name).toLowerCase();
			if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) return "fu-ext-img";
			if (e === "pdf") return "fu-ext-pdf";
			if (["doc", "docx", "pages", "txt", "md"].includes(e)) return "fu-ext-doc";
			if (["xls", "xlsx", "csv", "numbers"].includes(e)) return "fu-ext-sheet";
			if (["zip", "rar", "7z", "tar", "gz"].includes(e)) return "fu-ext-zip";
			if (["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "sh", "swift", "c", "cpp", "java", "go", "rs"].includes(e)) return "fu-ext-code";
			if (["mp3", "wav", "m4a", "mp4", "mov", "avi"].includes(e)) return "fu-ext-media";
			return "fu-ext-file";
		}

		function ChipRow({ chip, controller, t }) {
			const remove = () => controller.removeChip(chip);
			const lead = typeof chip.thumbUrl === "string" && chip.thumbUrl !== ""
				? jsxRuntime.jsx("img", { className: "fu-thumb", src: chip.thumbUrl, alt: "", "aria-hidden": true })
				: jsxRuntime.jsx("span", { className: "fu-ext " + extClass(chip.name), "aria-hidden": true, children: extOf(chip.name) });
			let meta = null;
			if (chip.kind === "image") {
				meta = jsxRuntime.jsx("span", { className: "fu-chip-meta", children: t(chip.error ?? "error.generic") });
			} else if (chip.status === "uploading") {
				meta = jsxRuntime.jsxs("span", {
					className: "fu-chip-meta",
					children: [
						Math.round((chip.progress ?? 0) * 100) + "%",
						jsxRuntime.jsx("span", {
							className: "fu-progress",
							"aria-hidden": true,
							children: jsxRuntime.jsx("i", { style: { width: Math.round((chip.progress ?? 0) * 100) + "%" } })
						})
					]
				});
			} else if (chip.status === "done") {
				meta = jsxRuntime.jsxs("span", {
					className: "fu-chip-meta fu-chip-ok",
					children: [jsxRuntime.jsx(CheckIcon, {}), t("status.done")]
				});
			} else {
				meta = jsxRuntime.jsx("span", { className: "fu-chip-meta", children: chip.error ?? t("error.generic") });
			}
			return jsxRuntime.jsxs("span", {
				className: "fu-chip" + (chip.status === "error" ? " fu-chip-error" : ""),
				title: chip.path ?? chip.name,
				children: [
					lead,
					jsxRuntime.jsx("span", {
						className: "fu-chip-name",
						children: chip.name
					}),
					jsxRuntime.jsx("span", { className: "fu-chip-size", children: sizeText(chip.size ?? 0) }),
					meta,
					jsxRuntime.jsx("button", {
						type: "button",
						className: "fu-chip-x",
						onClick: remove,
						title: t("chip.remove"),
						"aria-label": t("chip.remove"),
						children: "×"
					})
				]
			});
		}

		function UploadDock({ controller, sessionId, useInput, inputActions, useProjection, t }) {
			const input = useInput !== void 0 ? useInput() : null;
			const projected = useProjection !== void 0 ? useProjection("imageLimits") : void 0;
			const chips = react.useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot).chips;
			// Refresh the controller's kit so drop handlers and async completions
			// see the live input state and actions.
			controller.kit.sessionId = sessionId;
			controller.kit.inputActions = inputActions;
			controller.kit.inputState = input;
			controller.kit.limits = projected ?? FALLBACK_LIMITS;
			react.useEffect(() => {
				activeController = controller;
				void supportsImages(sessionId); // warm the capability cache for paste/drop decisions
				return () => {
					if (activeController === controller) activeController = null;
				};
			}, [controller, sessionId]);
			// Sent messages clear the draft; drop chips whose references already rode along.
			react.useEffect(() => {
				if (input?.phase !== "submitting") return;
				const cur = controller.store.getSnapshot();
				if (cur.chips.some((chip) => chip.status === "done")) {
					controller.store.set({ chips: cur.chips.filter((chip) => chip.status !== "done") });
				}
			}, [input?.phase]);
			if (chips.length === 0) return null;
			return jsxRuntime.jsx("div", {
				className: "fu-dock",
				children: chips.map((chip) => jsxRuntime.jsx(ChipRow, { chip, controller, t }, chip.key))
			});
		}

		// ── locales ────────────────────────────────────────────────────────────
		const zh = {
			"attach.title": "添加附件",
			"chip.remove": "移除",
			"status.uploading": "上传中",
			"status.done": "已上传",
			"error.generic": "处理失败",
			"error.imageTooLarge": "图片超过 5 MB 大小限制",
			"error.imageTooMany": "图片数量超过单条消息限制",
			"error.imageTotalTooLarge": "图片总大小超过单条消息限制",
			"error.imageRejected": "图片无法加入草稿（可能正在发送中）"
		};
		const en = {
			"attach.title": "Attach files",
			"chip.remove": "Remove",
			"status.uploading": "Uploading",
			"status.done": "Uploaded",
			"error.generic": "Failed",
			"error.imageTooLarge": "Image exceeds the 5 MB limit",
			"error.imageTooMany": "Too many images for one message",
			"error.imageTotalTooLarge": "Total image size exceeds the per-message limit",
			"error.imageRejected": "Could not add image to the draft"
		};

		// ── plugin entry ───────────────────────────────────────────────────────
		function apply(ctx) {
			ctx.locale.register("fileUpload", { zh, en });
			ctx.effect(() => {
				if (typeof window === "undefined") return;
				window.addEventListener("drop", onWindowDrop, true);
				window.addEventListener("paste", onWindowPaste, true);
				return () => {
					window.removeEventListener("drop", onWindowDrop, true);
					window.removeEventListener("paste", onWindowPaste, true);
				};
			}, "file-upload: window drop/paste capture");
			ctx.effect(() => {
				if (typeof window === "undefined" || typeof MutationObserver === "undefined" || document.body === null || document.body === void 0) return;
				const observer = new MutationObserver(() => schedulePathScan());
				observer.observe(document.body, { childList: true, characterData: true, subtree: true });
				shortenToolPaths();
				return () => {
					observer.disconnect();
					if (pathScanTimer !== null) {
						clearTimeout(pathScanTimer);
						pathScanTimer = null;
					}
				};
			}, "file-upload: tool path shortening");
			ctx.inject(["slots", "conversation"], (scope) => {
				const conversation = scope.conversation;
				scope.slots.inject("conversation.input.left", () => scope.slots.register({
					name: "conversation.input.left",
					id: "file-upload-button",
					order: 0,
					locale: "fileUpload",
					inject: (sessionId) => ({ controller: controllerFor(sessionId, conversation) })
				}, UploadButton));
				scope.slots.inject("conversation.input.dock", () => scope.slots.register({
					name: "conversation.input.dock",
					id: "file-upload-dock",
					order: 0,
					locale: "fileUpload",
					inject: (sessionId) => ({ controller: controllerFor(sessionId, conversation) })
				}, UploadDock));
			});
		}

		exports.apply = apply;
		exports.inject = ["locale"];
		return module.exports;
	}
});
