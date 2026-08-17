/**
 * @harness/dsh-skin — host half.
 *
 * Durable skin storage + asset serving under `$DSH_HOME/skins/`:
 *  - POST /skin/assets/<name>   raw body → skins/assets/<name> (500 MB cap,
 *    basename-only, temp-file + rename, same hygiene as the upload plugin);
 *  - GET  /skin/assets/<name>   serve a stored asset (mime by extension);
 *  - GET  /skin/config          current config JSON ({active, skins});
 *  - POST /skin/config          replace the config JSON (256 KB cap).
 *
 * The client half owns theme registration/application; this half is only
 * storage and byte hygiene.
 */
import { Service } from "@deepseek-ai/cordis";
import { createWriteStream } from "node:fs";
import { promises as fsp } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

export const MAX_ASSET_BYTES = 500 * 1024 * 1024;
export const MAX_CONFIG_BYTES = 256 * 1024;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const PRESET_ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets");
const PRESET_NAME = /^[a-z0-9][a-z0-9-]*\.jpg$/;
const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json; charset=utf-8"
};

export function skinHome() {
  return join(resolveDshHome(), "skins");
}

export function sanitizeAssetName(raw) {
  if (typeof raw !== "string" || raw.length === 0) return void 0;
  let name = raw.replaceAll("\\", "/").replace(CONTROL_CHARS, "");
  name = basename(name).trim();
  while (name.endsWith(".") || name.endsWith(" ")) name = name.slice(0, -1);
  if (name === "" || name === "." || name === ".." || name.length > 120) return void 0;
  return name;
}

function sendJson(res, status, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function readBody(req, cap) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let finished = false;
    const settle = (fn, value) => {
      if (finished) return;
      finished = true;
      fn(value);
    };
    req.on("data", (chunk) => {
      if (finished) return;
      bytes += chunk.length;
      if (bytes > cap) {
        settle(reject, new Error("payload exceeds size cap"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => settle(resolve, Buffer.concat(chunks)));
    req.on("error", (error) => settle(reject, error));
  });
}

class SkinService extends Service {
  static inject = ["webServer"];

  constructor(ctx) {
    super(ctx, "skinService");
    ctx.effect(() => ctx.webServer.register({
      kind: "prefix",
      path: "/skin",
      handler: (req, res) => this.handle(req, res)
    }), "dsh-skin: skin routes");
  }

  async #dirs() {
    const root = skinHome();
    const assets = join(root, "assets");
    await fsp.mkdir(assets, { recursive: true, mode: 0o700 });
    return { root, assets };
  }

  async handle(req, res) {
    const url = new URL(req.url ?? "/", "http://skin.local");
    const parts = url.pathname.split("/").filter(Boolean); // e.g. ["skin","assets","x.jpg"]
    if (parts[0] !== "skin") {
      sendJson(res, 404, { ok: false, error: "not found" });
      return;
    }
    try {
      if (parts[1] === "assets") {
        let segments;
        try {
          segments = parts.slice(2).map((segment) => decodeURIComponent(segment));
        } catch {
          sendJson(res, 400, { ok: false, error: "malformed path encoding" });
          return;
        }
        if (req.method === "GET" || req.method === "HEAD") return await this.#serveAsset(segments, req, res);
        if (req.method === "POST") return await this.#storeAsset(segments, req, res);
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      if (parts[1] === "presets") {
        if (req.method !== "GET" && req.method !== "HEAD") {
          sendJson(res, 405, { ok: false, error: "GET only" });
          return;
        }
        const name = parts.slice(2).join("/");
        if (!PRESET_NAME.test(name)) {
          sendJson(res, 400, { ok: false, error: "invalid preset name" });
          return;
        }
        let body;
        try {
          body = await fsp.readFile(join(PRESET_ASSET_DIR, name));
        } catch (error) {
          if (error.code === "ENOENT") {
            sendJson(res, 404, { ok: false, error: "preset not found" });
            return;
          }
          throw error;
        }
        res.writeHead(200, {
          "content-type": "image/jpeg",
          "content-length": body.length,
          "cache-control": "public, max-age=3600"
        });
        if (req.method === "GET") res.end(body);
        else res.end();
        return;
      }
      if (parts[1] === "config") {
        if (req.method === "GET" || req.method === "HEAD") return await this.#readConfig(res);
        if (req.method === "POST") return await this.#writeConfig(req, res);
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      sendJson(res, 404, { ok: false, error: "not found" });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
    }
  }

  async #serveAsset(segments, req, res) {
    const name = sanitizeAssetName(segments.join("/"));
    if (name === void 0) {
      sendJson(res, 400, { ok: false, error: "invalid asset name" });
      return;
    }
    const { assets } = await this.#dirs();
    const path = join(assets, name);
    let body;
    try {
      body = await fsp.readFile(path);
    } catch (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { ok: false, error: "asset not found" });
        return;
      }
      throw error;
    }
    const type = MIME_BY_EXT[extname(name).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, {
      "content-type": type,
      "content-length": body.length,
      "cache-control": "no-cache"
    });
    if (req.method === "GET") res.end(body);
    else res.end();
  }

  async #storeAsset(segments, req, res) {
    if (segments.length !== 1) {
      sendJson(res, 400, { ok: false, error: "exactly one asset name segment allowed" });
      return;
    }
    const name = sanitizeAssetName(segments[0]);
    if (name === void 0) {
      sendJson(res, 400, { ok: false, error: "invalid asset name" });
      return;
    }
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_ASSET_BYTES) {
      sendJson(res, 413, { ok: false, error: "asset too large" }, { connection: "close" });
      req.destroy();
      return;
    }
    const { assets } = await this.#dirs();
    const target = join(assets, name);
    const tmp = join(assets, `.#skin-${randomBytes(6).toString("hex")}.part`);
    let tooLarge = false;
    try {
      await new Promise((resolve, reject) => {
        const out = createWriteStream(tmp, { flags: "wx", mode: 0o600 });
        let bytes = 0;
        let finished = false;
        const settle = (fn, value) => {
          if (finished) return;
          finished = true;
          fn(value);
        };
        const fail = (error) => {
          settle(reject, error);
          out.destroy();
        };
        req.on("data", (chunk) => {
          if (finished) return;
          bytes += chunk.length;
          if (bytes > MAX_ASSET_BYTES) {
            tooLarge = true;
            fail(new Error("asset exceeds size limit"));
            return;
          }
          if (!out.write(chunk)) req.pause();
        });
        out.on("drain", () => {
          if (!finished) req.resume();
        });
        req.on("end", () => {
          if (finished) return;
          out.end(() => settle(resolve));
        });
        req.on("error", fail);
        out.on("error", fail);
      });
      await fsp.rename(tmp, target);
      sendJson(res, 200, { ok: true, name, url: `/skin/assets/${encodeURIComponent(name)}` });
    } catch (error) {
      await fsp.unlink(tmp).catch(() => void 0);
      if (tooLarge) {
        sendJson(res, 413, { ok: false, error: "asset too large" }, { connection: "close" });
        req.destroy();
      } else {
        sendJson(res, 500, { ok: false, error: `asset store failed: ${String(error?.message ?? error)}` });
      }
    }
  }

  async #readConfig(res) {
    const { root } = await this.#dirs();
    const path = join(root, "config.json");
    try {
      const raw = await fsp.readFile(path, "utf8");
      const parsed = JSON.parse(raw);
      sendJson(res, 200, parsed);
    } catch (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 200, { version: 1, active: null, skins: [] });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(res, 500, { ok: false, error: "config is corrupted" });
        return;
      }
      throw error;
    }
  }

  async #writeConfig(req, res) {
    const body = await readBody(req, MAX_CONFIG_BYTES);
    let parsed;
    try {
      parsed = JSON.parse(body.toString("utf8"));
    } catch {
      sendJson(res, 400, { ok: false, error: "config must be valid JSON" });
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      sendJson(res, 400, { ok: false, error: "config must be a JSON object" });
      return;
    }
    if (!Array.isArray(parsed.skins)) {
      sendJson(res, 400, { ok: false, error: "config.skins must be an array" });
      return;
    }
    if (parsed.active !== null && typeof parsed.active !== "string") {
      sendJson(res, 400, { ok: false, error: "config.active must be a string or null" });
      return;
    }
    const { root } = await this.#dirs();
    const path = join(root, "config.json");
    const tmp = `${path}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify({ version: 1, ...parsed }, null, 2) + "\n", { mode: 0o600 });
    await fsp.rename(tmp, path);
    sendJson(res, 200, { ok: true });
  }
}

export { SkinService };
export default SkinService;
