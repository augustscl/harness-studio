/**
 * @harness/file-upload — host half.
 *
 * Registers `POST /upload?name=<encoded>&sessionId=<id>` on the harness web
 * server. Request body is the raw file bytes. Files land in
 * `<session workspace>/uploads/` with a sanitized, collision-free name.
 *
 * Safety notes:
 *  - the filename is reduced to a plain basename (no separators, no "..");
 *  - per-file cap (500 MB) enforced via Content-Length and again while
 *    streaming (chunked bodies);
 *  - writes go through a temp file + rename, so a failed/aborted upload
 *    never leaves a half-written target behind.
 */
import { Service } from "@deepseek-ai/cordis";
import { createWriteStream } from "node:fs";
import { promises as fsp } from "node:fs";
import { basename, extname, isAbsolute, join, relative, sep } from "node:path";
import { randomBytes } from "node:crypto";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export const MAX_NAME_LENGTH = 200;
export const UPLOADS_DIRNAME = "uploads";

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Reduce an untrusted filename to a safe plain basename, or undefined. */
export function sanitizeFilename(raw) {
  if (typeof raw !== "string" || raw.length === 0) return void 0;
  let name = raw.replaceAll("\\", "/").replace(CONTROL_CHARS, "");
  name = basename(name).trim();
  while (name.endsWith(".") || name.endsWith(" ")) name = name.slice(0, -1);
  if (name === "" || name === "." || name === "..") return void 0;
  if (name.length > MAX_NAME_LENGTH) {
    const ext = extname(name).slice(0, 16);
    const keep = MAX_NAME_LENGTH - ext.length;
    name = name.slice(0, Math.max(1, keep)) + ext;
  }
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

class FileUploadService extends Service {
  static inject = ["webServer", "workspaceRegistry"];

  /** Names currently being written in each directory (collision reservation). */
  #reserved = new Map();

  constructor(ctx) {
    super(ctx, "fileUpload");
    ctx.effect(() => ctx.webServer.register({
      kind: "exact",
      path: "/upload",
      handler: (req, res) => this.handle(req, res)
    }), "file-upload: upload route");
    ctx.effect(() => ctx.webServer.register({
      kind: "exact",
      path: "/upload/capabilities",
      handler: (req, res) => this.handleCapabilities(req, res)
    }), "file-upload: capabilities route");
  }

  /**
   * Best-effort answer to "can the session's active model see images?".
   * Conservative: any resolution failure reports false, so the client falls
   * back to the file-on-disk route instead of a doomed native image send.
   */
  async #modelSupportsImages(sessionId) {
    try {
      const sessions = this.ctx.get("sessions");
      const llm = this.ctx.get("llm");
      if (sessions === void 0 || llm === void 0 || typeof sessions.get !== "function") return false;
      const session = sessions.get(sessionId);
      if (session === void 0) return false;
      const config = session.requestHeader?.()?.config;
      const provider = config?.provider;
      const model = config?.model;
      if (typeof provider !== "string" || typeof model !== "string" || provider === "" || model === "") return false;
      const info = await llm.resolveModelInfo(provider, model, AbortSignal.timeout(4000));
      return Array.isArray(info?.inputModalities) && info.inputModalities.includes("image");
    } catch {
      return false;
    }
  }

  async handleCapabilities(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { ok: false, error: "GET only" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://upload.local");
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const supportsImages = await this.#modelSupportsImages(sessionId);
    sendJson(res, 200, { ok: true, supportsImages });
  }

  /** The session workspace directory, or a sensible fallback. */
  #workspaceOf(sessionId) {
    const registry = this.ctx.workspaceRegistry;
    const pinned = typeof sessionId === "string" && sessionId.length > 0
      ? registry.host.sessionPath(sessionId)
      : void 0;
    if (typeof pinned === "string" && pinned.length > 0) return { dir: pinned, pinned: true };
    const first = registry.list()[0];
    if (first !== void 0 && typeof first.path === "string") return { dir: first.path, pinned: false };
    return { dir: process.cwd(), pinned: false };
  }

  async #uniqueTarget(dir, name) {
    const ext = extname(name);
    const stem = name.slice(0, name.length - ext.length);
    const taken = this.#reserved.get(dir);
    const isTaken = (candidate) => {
      if (taken !== void 0 && taken.has(candidate.toLowerCase())) return true;
      return fsp.access(candidate).then(() => true, () => false);
    };
    let candidate = join(dir, name);
    for (let i = 1; await isTaken(candidate); i += 1) {
      candidate = join(dir, `${stem} (${i})${ext}`);
    }
    return candidate;
  }

  async handle(req, res) {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "POST only" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://upload.local");
    const name = sanitizeFilename(url.searchParams.get("name"));
    if (name === void 0) {
      sendJson(res, 400, { ok: false, error: "invalid filename" });
      return;
    }
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
      sendJson(res, 413, { ok: false, error: "file too large" }, { connection: "close" });
      req.destroy();
      return;
    }
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const workspace = this.#workspaceOf(sessionId);
    const dir = join(workspace.dir, UPLOADS_DIRNAME);
    let target;
    try {
      await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
      target = await this.#uniqueTarget(dir, name);
      if (!this.#reserved.has(dir)) this.#reserved.set(dir, new Set());
      this.#reserved.get(dir).add(target.toLowerCase());
    } catch (error) {
      sendJson(res, 500, { ok: false, error: `cannot prepare upload directory: ${String(error?.message ?? error)}` });
      return;
    }
    const tmp = join(dir, `.#upload-${randomBytes(6).toString("hex")}.part`);
    const release = () => {
      this.#reserved.get(dir)?.delete(target.toLowerCase());
    };
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
          if (bytes > MAX_UPLOAD_BYTES) {
            tooLarge = true;
            fail(new Error("upload exceeds size limit"));
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
      let rel;
      if (workspace.pinned) {
        const candidate = relative(workspace.dir, target);
        if (!candidate.startsWith("..") && !isAbsolute(candidate)) rel = candidate.split(sep).join("/");
      }
      sendJson(res, 200, {
        ok: true,
        name: basename(target),
        path: target,
        ...rel === void 0 ? {} : { rel }
      });
    } catch (error) {
      await fsp.unlink(tmp).catch(() => void 0);
      if (tooLarge) {
        sendJson(res, 413, { ok: false, error: "file too large" }, { connection: "close" });
        req.destroy();
      } else {
        sendJson(res, 500, { ok: false, error: `upload failed: ${String(error?.message ?? error)}` });
      }
    } finally {
      release();
    }
  }
}

export { FileUploadService };
export default FileUploadService;
