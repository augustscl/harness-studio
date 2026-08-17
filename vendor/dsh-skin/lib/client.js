/**
 * @harness/dsh-skin — client half (plain browser bundle).
 *
 * 🎨 skin engine for the dsh web GUI:
 *  - a palette button in the session header actions slot;
 *  - a popover listing the native appearance plus custom skins;
 *  - "create from image": pick a picture → canvas palette extraction →
 *    token theme registration + banner artwork (resized JPEG stored via the
 *    host half) → durable config under $DSH_HOME/skins.
 *
 * Theming rides the official theme service (ctx.theme): register() for the
 * token theme, setTheme() to switch, "theme/change" to keep the artwork
 * layer in sync. Artwork is a body background keyed off html[data-skin].
 */
window.__ModuleLoader__.load({
	id: "@harness/dsh-skin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const jsxRuntime = require("react/jsx-runtime");

		// ── styles ────────────────────────────────────────────────────────────
		const css = `
.sk-attach{position:relative;display:inline-flex;align-items:center}
.sk-btn{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);height:28px;min-width:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0 7px;gap:5px;font-size:12px}
.sk-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sk-pop{position:fixed;z-index:9999;min-width:260px;max-width:min(340px,calc(100vw - 24px));border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2));background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.4));padding:5px;display:flex;flex-direction:column;gap:2px}
.sk-item{display:flex;align-items:center;gap:9px;width:100%;border:none;background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 9px;font-size:13px;line-height:18px;cursor:pointer;text-align:left}
.sk-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.sk-item[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.sk-swatch{width:18px;height:18px;border-radius:6px;flex:none;border:1px solid var(--dsw-alias-border-l2);background-size:cover;background-position:center}
.sk-name{white-space:nowrap;flex:1}
.sk-check{color:var(--dsw-alias-brand-primary);flex:none;font-size:12px}
.sk-sep{height:1px;background:var(--dsw-alias-border-l1);margin:3px 6px}
.sk-desc{color:var(--dsw-alias-label-tertiary);font-size:11px;padding:2px 9px 4px}
.sk-busy{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:7px 9px;display:flex;align-items:center;gap:6px}
/* 壁纸画在框架层 + 聊天视图层（两层都有不透明背景，画在 body 上会被完全盖住） */
html[data-skin] .pI_x6G_frame,
html[data-skin] .wSkVaW_root {
	background-image:var(--dsh-skin-overlay,linear-gradient(rgba(9,10,14,.32),rgba(9,10,14,.5))),var(--dsh-skin-art);
	background-size:cover;
	background-position:center;
	background-attachment:fixed;
}
/* 注意：侧栏禁用 backdrop-filter——它会让设置面板等 position:fixed 遮罩层被困在侧栏内（成为包含块） */
html[data-skin] .pI_x6G_sidebarCol{background:color-mix(in srgb,var(--dsw-specific-sidebar-fill) 88%,transparent)}
`;
		const CSS_ID = "@harness/dsh-skin/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@harness/dsh-skin";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── small utils ────────────────────────────────────────────────────────
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

		function clamp01(x) {
			return x < 0 ? 0 : x > 1 ? 1 : x;
		}
		function hexToRgb(hex) {
			const h = hex.replace("#", "");
			const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
			const n = parseInt(full.slice(0, 6), 16);
			if (!Number.isFinite(n)) return [128, 128, 128];
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
		function rgbToHex(r, g, b) {
			const p = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
			return "#" + p(r) + p(g) + p(b);
		}
		function mix(hexA, hexB, t) {
			const a = hexToRgb(hexA);
			const b = hexToRgb(hexB);
			return rgbToHex(
				(a[0] / 255) * (1 - t) + (b[0] / 255) * t,
				(a[1] / 255) * (1 - t) + (b[1] / 255) * t,
				(a[2] / 255) * (1 - t) + (b[2] / 255) * t
			);
		}
		function saturationOf(rgb) {
			const max = Math.max(rgb[0], rgb[1], rgb[2]);
			const min = Math.min(rgb[0], rgb[1], rgb[2]);
			return max === 0 ? 0 : (max - min) / max;
		}
		function lightnessOf(rgb) {
			return (Math.max(rgb[0], rgb[1], rgb[2]) + Math.min(rgb[0], rgb[1], rgb[2])) / 510;
		}
		function loadImage(file) {
			return new Promise((resolve, reject) => {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload = () => resolve({ img, url });
				img.onerror = () => {
					URL.revokeObjectURL(url);
					reject(new Error("image load failed"));
				};
				img.src = url;
			});
		}
		function slugify(name) {
			const base = (name ?? "skin").replace(/\.[A-Za-z0-9]+$/, "");
			const ascii = base.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
			return ascii === "" ? "skin" : ascii;
		}

		// ── palette extraction (canvas) ────────────────────────────────────────
		function extractPalette(img) {
			const size = 48;
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d", { willReadFrequently: true });
			ctx.drawImage(img, 0, 0, size, size);
			const data = ctx.getImageData(0, 0, size, size).data;
			const buckets = new Map();
			for (let i = 0; i < data.length; i += 4) {
				if (data[i + 3] < 128) continue; // skip transparent
				const r = data[i] >> 4;
				const g = data[i + 1] >> 4;
				const b = data[i + 2] >> 4;
				const key = (r << 8) | (g << 4) | b;
				buckets.set(key, (buckets.get(key) ?? 0) + 1);
			}
			const clusters = [...buckets.entries()]
				.map(([key, count]) => ({
					count,
					rgb: [(key >> 8) << 4, ((key >> 4) & 15) << 4, (key & 15) << 4]
				}))
				.sort((a, b) => b.count - a.count);
			if (clusters.length === 0) return { dominant: "#0b0c10", accent: "#7c9bff" };
			const dominant = rgbToHex(...clusters[0].rgb.map((v) => v / 255));
			const top = clusters.slice(0, Math.min(15, clusters.length));
			let accent = null;
			let bestScore = 0.18;
			for (const c of top) {
				const sat = saturationOf(c.rgb);
				const light = lightnessOf(c.rgb);
				if (sat < bestScore || light < 0.14 || light > 0.88) continue;
				accent = c.rgb;
				bestScore = sat;
			}
			return {
				dominant,
				accent: accent === null ? "#7c9bff" : rgbToHex(...accent.map((v) => v / 255))
			};
		}

		function rgbaOf(hex, alpha) {
			const rgb = hexToRgb(hex);
			return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
		}

		/** Full-surface token palette: every --dsw-* color token the UI consumes. */
		function buildTokens(dominant, accent) {
			const D = dominant;
			const A = accent;
			const dark = {
				// 背景（强染色）
				"--dsw-alias-bg-base": mix(D, "#0b0c10", 0.72),
				"--dsw-alias-bg-layer-1": mix(D, "#0b0c10", 0.5),
				"--dsw-alias-bg-layer-2": mix(D, "#0b0c10", 0.34),
				"--dsw-alias-bg-layer-3": mix(D, "#0b0c10", 0.22),
				"--dsw-alias-bg-overlay": mix(D, "#0b0c10", 0.44),
				"--dsw-alias-bg-primary": mix(D, "#0b0c10", 0.56),
				"--dsw-alias-bg-module-platform": mix(D, "#0b0c10", 0.62),
				"--dsw-alias-bg-mask-1": rgbaOf(D, 0.42),
				// 边框与分隔线（带色相）
				"--dsw-alias-border-l1": rgbaOf(mix(D, "#ffffff", 0.55), 0.18),
				"--dsw-alias-border-l2": rgbaOf(mix(D, "#ffffff", 0.65), 0.3),
				"--dsw-alias-border-l3": rgbaOf(mix(D, "#ffffff", 0.7), 0.4),
				"--dsw-alias-border-l4": rgbaOf(mix(D, "#ffffff", 0.75), 0.5),
				"--dsw-alias-border-l2-darkmode-thin": rgbaOf(mix(D, "#ffffff", 0.6), 0.24),
				"--dsw-alias-border-inverted": rgbaOf(D, 0.5),
				"--dsw-alias-border-secondary": rgbaOf(mix(D, "#ffffff", 0.7), 0.34),
				"--dsw-alias-line-secondary": rgbaOf(mix(D, "#ffffff", 0.6), 0.2),
				"--dsw-alias-separator-primary": rgbaOf(mix(D, "#ffffff", 0.6), 0.2),
				// 品牌与按钮
				"--dsw-alias-brand-primary": A,
				"--dsw-alias-button-primary-fill": A,
				"--dsw-alias-button-primary-hover": mix(A, "#ffffff", 0.14),
				"--dsw-alias-button-elevated-fill": mix(D, "#0b0c10", 0.48),
				"--dsw-alias-button-floating-fill": mix(D, "#0b0c10", 0.5),
				"--dsw-alias-button-floating-hover": mix(D, "#0b0c10", 0.34),
				"--dsw-alias-button-ghost-active-fill": rgbaOf(mix(D, "#ffffff", 0.5), 0.16),
				"--dsw-alias-button-info-fill": mix(A, "#0b0c10", 0.3),
				"--dsw-alias-button-info-hover": mix(A, "#0b0c10", 0.45),
				// 填充与交互态（带色相）
				"--dsw-alias-fill-l2": rgbaOf(mix(D, "#ffffff", 0.45), 0.12),
				"--dsw-alias-fill-tsp-secondary": rgbaOf(mix(D, "#ffffff", 0.4), 0.08),
				"--dsw-alias-interactive-bg-hover": rgbaOf(mix(D, "#ffffff", 0.5), 0.14),
				"--dsw-alias-interactive-bg-active": rgbaOf(mix(D, "#ffffff", 0.55), 0.2),
				"--dsw-alias-interactive-bg-primary": rgbaOf(mix(D, "#ffffff", 0.5), 0.16),
				"--dsw-alias-interactive-bg-hover-solid": mix(D, "#0b0c10", 0.42),
				"--dsw-alias-interactive-bg-hover-danger": "rgba(229,72,77,.16)",
				// 文字（保持中性保证可读性）
				"--dsw-alias-label-primary": "#eef0f4",
				"--dsw-alias-label-secondary": "rgba(238,240,244,.66)",
				"--dsw-alias-label-tertiary": "rgba(238,240,244,.45)",
				"--dsw-alias-label-quaternary": "rgba(238,240,244,.3)",
				"--dsw-alias-label-caption": "rgba(238,240,244,.4)",
				"--dsw-alias-label-dimmed": "rgba(238,240,244,.35)",
				"--dsw-alias-label-error": "#ff8a8f",
				"--dsw-alias-label-inverse": "rgba(9,10,14,.92)",
				"--dsw-alias-label-primary-bluish": "#dfe7ff",
				"--dsw-alias-label-primary-dimmed": "rgba(238,240,244,.55)",
				"--dsw-alias-label-primary-foreground": "#0d0f14",
				"--dsw-alias-label-primary-inverted": "rgba(9,10,14,.92)",
				// 代码块
				"--dsw-alias-markdown-code-block": mix(D, "#0b0c10", 0.56),
				"--dsw-alias-markdown-code-block-banner": mix(D, "#0b0c10", 0.62),
				"--dsw-alias-markdown-citation": rgbaOf(mix(D, "#ffffff", 0.55), 0.55),
				// 滚动条与阴影
				"--dsw-alias-scrollbar-bg-l2": rgbaOf(mix(D, "#ffffff", 0.55), 0.22),
				"--dsw-alias-scrollbar-hover-l2": rgbaOf(mix(D, "#ffffff", 0.6), 0.34),
				"--dsw-shadow-lv1": "0 1px 2px rgba(0,0,0,.4)",
				"--dsw-shadow-lv2": "0 4px 12px rgba(0,0,0,.42)",
				"--dsw-shadow-lv3": "0 12px 32px rgba(0,0,0,.5)",
				// 状态色
				"--dsw-alias-state-error-primary": "#e5484d",
				"--dsw-alias-state-error-secondary": "rgba(229,72,77,.16)",
				"--dsw-alias-state-success-primary": "#2ea043",
				"--dsw-alias-state-success-secondary": "rgba(46,160,67,.16)",
				"--dsw-alias-state-success-tertiary": "rgba(46,160,67,.08)",
				"--dsw-alias-state-warn-primary": "#d98d2a",
				"--dsw-alias-state-warn-secondary": "rgba(217,141,42,.16)",
				"--dsw-alias-state-warn-tertiary": "rgba(217,141,42,.08)",
				"--dsw-alias-state-warn-label": "#f5b75f",
				"--dsw-alias-state-business-primary": "#3a6ed6",
				"--dsw-alias-state-business-tertiary": "rgba(58,110,214,.1)",
				// 特定表面（强染色）
				"--dsw-specific-bubble": mix(D, "#0b0c10", 0.52),
				"--dsw-specific-input-major": mix(D, "#0b0c10", 0.4),
				"--dsw-specific-menu": mix(D, "#0b0c10", 0.46),
				"--dsw-specific-selector": mix(D, "#0b0c10", 0.58),
				"--dsw-specific-tip": mix(D, "#0b0c10", 0.48),
				"--dsw-specific-sidebar-fill": mix(D, "#0b0c10", 0.55),
				"--dsw-specific-sidebar-nav-item-hover": rgbaOf(mix(D, "#ffffff", 0.5), 0.12),
				"--dsw-specific-sidebar-nav-item-active": rgbaOf(mix(D, "#ffffff", 0.55), 0.16),
				"--dsw-specific-sidebar-nav-item-active-accent": rgbaOf(A, 0.2)
			};
const light = {
				// 背景（强染色）
				"--dsw-alias-bg-base": mix(D, "#f7f8fa", 0.6),
				"--dsw-alias-bg-layer-1": mix(D, "#f7f8fa", 0.42),
				"--dsw-alias-bg-layer-2": mix(D, "#f7f8fa", 0.28),
				"--dsw-alias-bg-layer-3": mix(D, "#f7f8fa", 0.16),
				"--dsw-alias-bg-overlay": mix(D, "#f7f8fa", 0.36),
				"--dsw-alias-bg-primary": mix(D, "#f7f8fa", 0.5),
				"--dsw-alias-bg-module-platform": mix(D, "#f7f8fa", 0.56),
				"--dsw-alias-bg-mask-1": rgbaOf(mix(D, "#000000", 0.4), 0.28),
				// 边框与分隔线（带色相）
				"--dsw-alias-border-l1": rgbaOf(mix(D, "#000000", 0.35), 0.18),
				"--dsw-alias-border-l2": rgbaOf(mix(D, "#000000", 0.4), 0.28),
				"--dsw-alias-border-l3": rgbaOf(mix(D, "#000000", 0.45), 0.38),
				"--dsw-alias-border-l4": rgbaOf(mix(D, "#000000", 0.5), 0.48),
				"--dsw-alias-border-l2-darkmode-thin": rgbaOf(mix(D, "#000000", 0.4), 0.22),
				"--dsw-alias-border-inverted": rgbaOf(mix(D, "#f7f8fa", 0.5), 0.6),
				"--dsw-alias-border-secondary": rgbaOf(mix(D, "#000000", 0.45), 0.32),
				"--dsw-alias-line-secondary": rgbaOf(mix(D, "#000000", 0.35), 0.16),
				"--dsw-alias-separator-primary": rgbaOf(mix(D, "#000000", 0.35), 0.18),
				// 品牌与按钮
				"--dsw-alias-brand-primary": mix(A, "#000000", 0.12),
				"--dsw-alias-button-primary-fill": mix(A, "#000000", 0.1),
				"--dsw-alias-button-primary-hover": mix(A, "#000000", 0.2),
				"--dsw-alias-button-elevated-fill": mix(D, "#f7f8fa", 0.42),
				"--dsw-alias-button-floating-fill": mix(D, "#f7f8fa", 0.46),
				"--dsw-alias-button-floating-hover": mix(D, "#f7f8fa", 0.28),
				"--dsw-alias-button-ghost-active-fill": rgbaOf(mix(D, "#000000", 0.3), 0.12),
				"--dsw-alias-button-info-fill": mix(A, "#ffffff", 0.72),
				"--dsw-alias-button-info-hover": mix(A, "#ffffff", 0.55),
				// 填充与交互态（带色相）
				"--dsw-alias-fill-l2": rgbaOf(mix(D, "#000000", 0.3), 0.1),
				"--dsw-alias-fill-tsp-secondary": rgbaOf(mix(D, "#000000", 0.25), 0.06),
				"--dsw-alias-interactive-bg-hover": rgbaOf(mix(D, "#000000", 0.3), 0.1),
				"--dsw-alias-interactive-bg-active": rgbaOf(mix(D, "#000000", 0.35), 0.16),
				"--dsw-alias-interactive-bg-primary": rgbaOf(mix(D, "#000000", 0.3), 0.12),
				"--dsw-alias-interactive-bg-hover-solid": mix(D, "#f7f8fa", 0.32),
				"--dsw-alias-interactive-bg-hover-danger": "rgba(209,52,56,.1)",
				// 文字（保持中性保证可读性）
				"--dsw-alias-label-primary": "#171a21",
				"--dsw-alias-label-secondary": "rgba(23,26,33,.66)",
				"--dsw-alias-label-tertiary": "rgba(23,26,33,.45)",
				"--dsw-alias-label-quaternary": "rgba(23,26,33,.3)",
				"--dsw-alias-label-caption": "rgba(23,26,33,.4)",
				"--dsw-alias-label-dimmed": "rgba(23,26,33,.35)",
				"--dsw-alias-label-error": "#d13438",
				"--dsw-alias-label-inverse": "rgba(250,251,253,.94)",
				"--dsw-alias-label-primary-bluish": "#3a4a7a",
				"--dsw-alias-label-primary-dimmed": "rgba(23,26,33,.55)",
				"--dsw-alias-label-primary-foreground": "#ffffff",
				"--dsw-alias-label-primary-inverted": "rgba(250,251,253,.94)",
				// 代码块
				"--dsw-alias-markdown-code-block": mix(D, "#f7f8fa", 0.5),
				"--dsw-alias-markdown-code-block-banner": mix(D, "#f7f8fa", 0.58),
				"--dsw-alias-markdown-citation": rgbaOf(mix(D, "#000000", 0.4), 0.55),
				// 滚动条与阴影
				"--dsw-alias-scrollbar-bg-l2": rgbaOf(mix(D, "#000000", 0.4), 0.24),
				"--dsw-alias-scrollbar-hover-l2": rgbaOf(mix(D, "#000000", 0.45), 0.36),
				"--dsw-shadow-lv1": "0 1px 2px rgba(15,18,25,.08)",
				"--dsw-shadow-lv2": "0 4px 12px rgba(15,18,25,.1)",
				"--dsw-shadow-lv3": "0 12px 32px rgba(15,18,25,.16)",
				// 状态色
				"--dsw-alias-state-error-primary": "#d13438",
				"--dsw-alias-state-error-secondary": "rgba(209,52,56,.12)",
				"--dsw-alias-state-success-primary": "#1a7f37",
				"--dsw-alias-state-success-secondary": "rgba(26,127,55,.12)",
				"--dsw-alias-state-success-tertiary": "rgba(26,127,55,.06)",
				"--dsw-alias-state-warn-primary": "#b26a14",
				"--dsw-alias-state-warn-secondary": "rgba(178,106,20,.14)",
				"--dsw-alias-state-warn-tertiary": "rgba(178,106,20,.08)",
				"--dsw-alias-state-warn-label": "#8a5a12",
				"--dsw-alias-state-business-primary": "#2f5bb8",
				"--dsw-alias-state-business-tertiary": "rgba(47,91,184,.08)",
				// 特定表面（强染色）
				"--dsw-specific-bubble": mix(D, "#f7f8fa", 0.42),
				"--dsw-specific-input-major": mix(D, "#f7f8fa", 0.3),
				"--dsw-specific-menu": mix(D, "#f7f8fa", 0.38),
				"--dsw-specific-selector": mix(D, "#f7f8fa", 0.5),
				"--dsw-specific-tip": mix(D, "#f7f8fa", 0.4),
				"--dsw-specific-sidebar-fill": mix(D, "#f7f8fa", 0.48),
				"--dsw-specific-sidebar-nav-item-hover": rgbaOf(mix(D, "#000000", 0.3), 0.1),
				"--dsw-specific-sidebar-nav-item-active": rgbaOf(mix(D, "#000000", 0.35), 0.14),
				"--dsw-specific-sidebar-nav-item-active-accent": rgbaOf(A, 0.16)
			};
return { dark, light };
		}

		// ── skin manager ───────────────────────────────────────────────────────
		// ── bundled presets (artwork ships inside the plugin package) ──────────
		const PRESETS = [
			// 深色系
			{ id: "preset-aurora", name: "极光", tone: "dark", asset: "/skin/presets/aurora.jpg", dominant: "#143028", accent: "#34d399" },
			{ id: "preset-twilight", name: "暮山紫", tone: "dark", asset: "/skin/presets/twilight.jpg", dominant: "#2a1e3f", accent: "#a78bfa" },
			{ id: "preset-ocean", name: "深海蓝", tone: "dark", asset: "/skin/presets/ocean.jpg", dominant: "#12283f", accent: "#38bdf8" },
			{ id: "preset-sunset", name: "日落橙", tone: "dark", asset: "/skin/presets/sunset.jpg", dominant: "#33181f", accent: "#fb923c" },
			{ id: "preset-bamboo", name: "竹绿", tone: "dark", asset: "/skin/presets/bamboo.jpg", dominant: "#1a2e1f", accent: "#4ade80" },
			{ id: "preset-graphite", name: "石墨", tone: "dark", asset: "/skin/presets/graphite.jpg", dominant: "#16181d", accent: "#8ea2b8" },
			// 浅色系
			{ id: "preset-cream", name: "奶油白", tone: "light", asset: "/skin/presets/cream.jpg", dominant: "#f2ecdf", accent: "#d97757" },
			{ id: "preset-sky", name: "天空蓝", tone: "light", asset: "/skin/presets/sky.jpg", dominant: "#e3eef8", accent: "#3b82f6" },
			{ id: "preset-sakura", name: "樱花粉", tone: "light", asset: "/skin/presets/sakura.jpg", dominant: "#f7e8ee", accent: "#ec6a9c" },
			{ id: "preset-mint", name: "薄荷绿", tone: "light", asset: "/skin/presets/mint.jpg", dominant: "#e6f4ec", accent: "#10b981" },
			{ id: "preset-lavender", name: "薰衣草", tone: "light", asset: "/skin/presets/lavender.jpg", dominant: "#ede9f8", accent: "#7c6cf0" },
			{ id: "preset-sand", name: "暖沙", tone: "light", asset: "/skin/presets/sand.jpg", dominant: "#f5efe2", accent: "#c98a3b" }
		];
		const presetScheme = (preset) => preset.tone === "light" ? "light" : "dark";

		// ── skin manager ───────────────────────────────────────────────────────
		function createSkinManager(theme) {
			const store = createStore({ skins: [], presets: PRESETS, active: null, busy: false, open: false });
			let configCache = { version: 1, active: null, skins: [] };
			const userSkinById = (id) => configCache.skins.find((s) => s.id === id) ?? null;
			const presetById = (id) => PRESETS.find((s) => s.id === id) ?? null;
			const resolveSkin = (id) => userSkinById(id) ?? presetById(id);
			const isSkinId = (id) => resolveSkin(id) !== null;

			function refreshStore() {
				const cur = store.getSnapshot();
				store.set({ ...cur, skins: [...configCache.skins], presets: PRESETS, active: configCache.active });
			}

			async function loadConfig() {
				for (const preset of PRESETS) {
					try {
						theme.register({
							id: preset.id,
							colorScheme: presetScheme(preset),
							tokens: presetScheme(preset) === "light"
								? buildTokens(preset.dominant, preset.accent).light
								: buildTokens(preset.dominant, preset.accent).dark
						});
					} catch (_) { /* already registered — skip */ }
				}
				try {
					const res = await fetch("/skin/config");
					const body = await res.json();
					if (body && Array.isArray(body.skins)) {
						configCache = { version: 1, active: body.active ?? null, skins: body.skins };
					}
				} catch (_) { /* keep defaults */ }
				for (const skin of configCache.skins) {
					try {
						theme.register({
							id: skin.id,
							colorScheme: skin.theme?.colorScheme ?? "dark",
							tokens: skin.theme?.tokens ?? {}
						});
					} catch (_) { /* duplicate/malformed skin — skip */ }
				}
				refreshStore();
				if (configCache.active !== null && isSkinId(configCache.active)) {
					try {
						theme.setTheme(configCache.active);
					} catch (_) { /* unregistered — ignore */ }
				}
			}

			async function persist() {
				try {
					await fetch("/skin/config", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(configCache)
					});
				} catch (_) { /* non-fatal */ }
			}

			function paintArtwork(skin) {
				const html = document.documentElement;
				if (skin !== null && typeof skin.asset === "string" && skin.asset !== "") {
					const scheme = skin.theme?.colorScheme ?? skin.scheme ?? skin.tone ?? "dark";
					const overlay = scheme === "light"
						? "linear-gradient(rgba(250,251,253,.18),rgba(250,251,253,.38))"
						: "linear-gradient(rgba(9,10,14,.32),rgba(9,10,14,.5))";
					html.dataset.skin = skin.id;
					html.dataset.skinScheme = scheme;
					html.style.setProperty("--dsh-skin-art", "url(\"" + skin.asset + "\")");
					html.style.setProperty("--dsh-skin-overlay", overlay);
				} else {
					delete html.dataset.skin;
					delete html.dataset.skinScheme;
					html.style.removeProperty("--dsh-skin-art");
					html.style.removeProperty("--dsh-skin-overlay");
				}
			}

			/** Keep the artwork layer in sync with external theme changes. */
			function onThemeChange(snapshot) {
				const id = snapshot.active?.id;
				const skin = typeof id === "string" ? resolveSkin(id) : null;
				paintArtwork(skin);
				const cur = store.getSnapshot();
				if (cur.active !== (skin !== null ? skin.id : null)) {
					configCache.active = skin !== null ? skin.id : null;
					store.set({ ...cur, active: skin !== null ? skin.id : null });
				}
			}

			function applySkin(id) {
				const skin = resolveSkin(id);
				if (skin === null) return;
				theme.setTheme(id); // fires theme/change → onThemeChange paints artwork
				configCache.active = id;
				void persist();
				refreshStore();
			}

			function applyNative() {
				theme.setTheme("system");
				configCache.active = null;
				void persist();
				refreshStore();
			}

			function resizeToAssetBlob(img) {
				return new Promise((resolve, reject) => {
					const max = 3200;
					let w = img.naturalWidth;
					let h = img.naturalHeight;
					if (w > max) {
						h = Math.round(h * (max / w));
						w = max;
					}
					if (h > max) {
						w = Math.round(w * (max / h));
						h = max;
					}
					const canvas = document.createElement("canvas");
					canvas.width = w;
					canvas.height = h;
					canvas.getContext("2d").drawImage(img, 0, 0, w, h);
					canvas.toBlob((blob) => {
						if (blob !== null) resolve(blob);
						else reject(new Error("canvas encode failed"));
					}, "image/jpeg", 0.85);
				});
			}

			function uploadAsset(blob, name) {
				return new Promise((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.open("POST", "/skin/assets/" + encodeURIComponent(name));
					xhr.setRequestHeader("Content-Type", "application/octet-stream");
					xhr.responseType = "json";
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
					xhr.send(blob);
				});
			}

			async function createFromImage(file) {
				const cur = store.getSnapshot();
				store.set({ ...cur, busy: true });
				try {
					const { img, url } = await loadImage(file);
					try {
						const palette = extractPalette(img);
						const tokens = buildTokens(palette.dominant, palette.accent);
						const id = "skin-" + slugify(file.name) + "-" + Math.random().toString(36).slice(2, 6);
						const assetName = id + ".jpg";
						const blob = await resizeToAssetBlob(img);
						const assetRes = await uploadAsset(blob, assetName);
						const skin = {
							id,
							name: (file.name || "皮肤").replace(/\.[A-Za-z0-9]+$/, "").slice(0, 40),
							asset: assetRes.url,
							palette: { dominant: palette.dominant, accent: palette.accent },
							theme: { colorScheme: "dark", tokens: tokens.dark }
						};
						theme.register({ id: skin.id, colorScheme: "dark", tokens: tokens.dark });
						configCache = { ...configCache, skins: [...configCache.skins.filter((s) => s.id !== id), skin] };
						configCache.active = id;
						await persist();
						refreshStore();
						theme.setTheme(id);
					} finally {
						URL.revokeObjectURL(url);
					}
				} catch (error) {
					console.error("[dsh-skin] create failed:", error);
				} finally {
					const snap = store.getSnapshot();
					store.set({ ...snap, busy: false });
				}
			}

			return {
				store,
				loadConfig,
				onThemeChange,
				applySkin,
				applyNative,
				createFromImage
			};
		}

		// ── components ─────────────────────────────────────────────────────────
		function PaletteIcon() {
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
					d: "M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-2.6a2 2 0 0 0-1.5 3.4c.4.5.1 1.6-.9 1.6h-2z"
				})
			});
		}

		function SkinMenuButton({ manager, t }) {
			const state = react.useSyncExternalStore(manager.store.subscribe, manager.store.getSnapshot);
			const fileRef = react.useRef(null);
			const rootRef = react.useRef(null);
			const [pos, setPos] = react.useState(null);
			const closeMenu = () => {
				const cur = manager.store.getSnapshot();
				if (cur.open) manager.store.set({ ...cur, open: false });
				setPos(null);
			};
			react.useEffect(() => {
				if (!state.open) return;
				const onPointerDown = (event) => {
					if (!(event.target instanceof Node)) return;
					if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
					closeMenu();
				};
				const onScroll = () => closeMenu();
				const onResize = () => closeMenu();
				document.addEventListener("pointerdown", onPointerDown, true);
				window.addEventListener("scroll", onScroll, true);
				window.addEventListener("resize", onResize);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					window.removeEventListener("scroll", onScroll, true);
					window.removeEventListener("resize", onResize);
				};
			}, [state.open]);
			const toggle = () => {
				if (state.open) {
					closeMenu();
					return;
				}
				if (rootRef.current === null) return;
				const rect = rootRef.current.getBoundingClientRect();
				setPos({
					top: rect.bottom + 6,
					right: Math.max(12, Math.min(window.innerWidth - rect.right, window.innerWidth - 24))
				});
				manager.store.set({ ...manager.store.getSnapshot(), open: true });
			};
			const onFile = (event) => {
				const files = [...(event.target.files ?? [])];
				event.target.value = "";
				if (files.length === 0) return;
				closeMenu();
				void manager.createFromImage(files[0]);
			};
			const activeSkin = state.active !== null
				? state.skins.find((s) => s.id === state.active) ?? state.presets.find((s) => s.id === state.active) ?? null
				: null;
			return jsxRuntime.jsxs("span", {
				ref: rootRef,
				className: "sk-attach",
				children: [
					jsxRuntime.jsx("input", {
						ref: fileRef,
						type: "file",
						accept: "image/*",
						tabIndex: -1,
						"aria-hidden": true,
						style: { display: "none" },
						onChange: onFile
					}),
					jsxRuntime.jsx("button", {
						type: "button",
						className: "sk-btn",
						onClick: toggle,
						title: t("menu.title"),
						"aria-label": t("menu.title"),
						children: [jsxRuntime.jsx(PaletteIcon, {}), activeSkin !== null ? jsxRuntime.jsx("span", { style: { maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: activeSkin.name }) : null]
					}),
					state.open && pos !== null ? jsxRuntime.jsxs("div", {
						className: "sk-pop",
						role: "menu",
						style: { top: pos.top, right: pos.right },
						children: [
							jsxRuntime.jsx("div", { className: "sk-desc", children: t("menu.desc") }),
							jsxRuntime.jsxs("button", {
								type: "button",
								role: "menuitem",
								className: "sk-item",
								"data-active": state.active === null,
								onClick: () => {
									manager.applyNative();
									closeMenu();
								},
								children: [
									jsxRuntime.jsx("span", { className: "sk-swatch", style: { background: "#0b0c10" }, "aria-hidden": true }),
									jsxRuntime.jsx("span", { className: "sk-name", children: t("menu.native") }),
									state.active === null ? jsxRuntime.jsx("span", { className: "sk-check", children: "✓" }) : null
								]
							}),
							jsxRuntime.jsx("div", { className: "sk-sep" }),
							jsxRuntime.jsx("div", { className: "sk-desc", children: t("menu.presets") }),
							jsxRuntime.jsx("div", { className: "sk-desc", children: t("menu.dark") }),
							state.presets.filter((skin) => skin.tone === "dark").map((skin) => jsxRuntime.jsxs("button", {
								type: "button",
								role: "menuitem",
								className: "sk-item",
								"data-active": state.active === skin.id,
								key: skin.id,
								onClick: () => {
									manager.applySkin(skin.id);
									closeMenu();
								},
								children: [
									jsxRuntime.jsx("span", {
										className: "sk-swatch",
										style: { backgroundImage: "url(\"" + skin.asset + "\")" },
										"aria-hidden": true
									}),
									jsxRuntime.jsx("span", { className: "sk-name", children: skin.name }),
									state.active === skin.id ? jsxRuntime.jsx("span", { className: "sk-check", children: "✓" }) : null
								]
							})),
							jsxRuntime.jsx("div", { className: "sk-desc", children: t("menu.light") }),
							state.presets.filter((skin) => skin.tone === "light").map((skin) => jsxRuntime.jsxs("button", {
								type: "button",
								role: "menuitem",
								className: "sk-item",
								"data-active": state.active === skin.id,
								key: skin.id,
								onClick: () => {
									manager.applySkin(skin.id);
									closeMenu();
								},
								children: [
									jsxRuntime.jsx("span", {
										className: "sk-swatch",
										style: { backgroundImage: "url(\"" + skin.asset + "\")" },
										"aria-hidden": true
									}),
									jsxRuntime.jsx("span", { className: "sk-name", children: skin.name }),
									state.active === skin.id ? jsxRuntime.jsx("span", { className: "sk-check", children: "✓" }) : null
								]
							})),
							state.skins.length > 0 ? jsxRuntime.jsx("div", { className: "sk-sep" }) : null,
							state.skins.length > 0 ? jsxRuntime.jsx("div", { className: "sk-desc", children: t("menu.mine") }) : null,
							state.skins.map((skin) => jsxRuntime.jsxs("button", {
								type: "button",
								role: "menuitem",
								className: "sk-item",
								"data-active": state.active === skin.id,
								key: skin.id,
								onClick: () => {
									manager.applySkin(skin.id);
									closeMenu();
								},
								children: [
									jsxRuntime.jsx("span", {
										className: "sk-swatch",
										style: typeof skin.asset === "string" ? { backgroundImage: "url(\"" + skin.asset + "\")" } : { background: skin.palette?.dominant ?? "#333" },
										"aria-hidden": true
									}),
									jsxRuntime.jsx("span", { className: "sk-name", children: skin.name }),
									state.active === skin.id ? jsxRuntime.jsx("span", { className: "sk-check", children: "✓" }) : null
								]
							})),
							jsxRuntime.jsx("div", { className: "sk-sep" }),
							jsxRuntime.jsx("button", {
								type: "button",
								role: "menuitem",
								className: "sk-item",
								disabled: state.busy,
								onClick: () => {
									if (fileRef.current !== null) fileRef.current.click();
								},
								children: [
									jsxRuntime.jsx("span", { className: "sk-swatch", style: { background: "conic-gradient(from 0deg,#e5484d,#d98d2a,#2ea043,#3a6ed6,#7a5af8,#e5484d)" }, "aria-hidden": true }),
									jsxRuntime.jsx("span", { className: "sk-name", children: state.busy ? t("menu.generating") : t("menu.create") })
								]
							})
						]
					}) : null
				]
			});
		}

		// ── locales ────────────────────────────────────────────────────────────
		const zh = {
			"menu.title": "皮肤",
			"menu.desc": "外观皮肤",
			"menu.native": "原生界面",
			"menu.presets": "预设皮肤",
			"menu.dark": "深色",
			"menu.light": "浅色",
			"menu.mine": "我的皮肤",
			"menu.create": "➕ 从图片创建皮肤",
			"menu.generating": "生成中…"
		};
		const en = {
			"menu.title": "Skins",
			"menu.desc": "Appearance skins",
			"menu.native": "Native look",
			"menu.presets": "Preset skins",
			"menu.dark": "Dark",
			"menu.light": "Light",
			"menu.mine": "My skins",
			"menu.create": "➕ Create skin from image",
			"menu.generating": "Generating…"
		};

		// ── plugin entry ───────────────────────────────────────────────────────
		function apply(ctx) {
			ctx.locale.register("dshSkin", { zh, en });
			ctx.inject(["theme", "slots"], (scope) => {
				const manager = createSkinManager(scope.theme);
				void manager.loadConfig();
				ctx.on("theme/change", (snapshot) => manager.onThemeChange(snapshot));
				scope.slots.inject("conversation.session.header.actions", () => scope.slots.register({
					name: "conversation.session.header.actions",
					id: "dsh-skin-menu",
					order: 0,
					locale: "dshSkin",
					inject: () => ({ manager })
				}, SkinMenuButton));
			});
		}

		exports.apply = apply;
		exports.inject = ["locale"];
		return module.exports;
	}
});
