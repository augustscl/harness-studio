/**
 * @harness/artifact-studio — host half.
 *
 * Serves the session workspace's produced files to the client panel:
 *  - GET  /artifacts/list    recursive scan (artifact extensions, hidden dirs
 *                            and dependency folders skipped, capped, newest
 *                            first);
 *  - GET  /artifacts/read    text file content (UTF-8, ≤ 5 MB);
 *  - POST /artifacts/save    overwrite a text file (UTF-8, ≤ 5 MB);
 *  - GET  /artifacts/docx    dependency-free DOCX → HTML (zip + word/document.xml);
 *  - GET  /artifacts/preview binary passthrough (images / pdf) with mime.
 *
 * Every path is resolved strictly inside the session workspace; absolute
 * paths and ".." escapes are rejected.
 */
import { Service } from "@deepseek-ai/cordis";
import { inflateRawSync } from "node:zlib";
import { promises as fsp } from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";

export const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_SCAN_FILES = 200;
const MAX_SCAN_DEPTH = 5;

const ARTIFACT_EXTS = new Set([
  ".html", ".htm", ".md", ".markdown", ".pdf", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".docx", ".csv", ".json", ".txt", ".svg", ".mp4", ".mov"
]);

const TEXT_EXTS = new Set([".html", ".htm", ".md", ".markdown", ".csv", ".json", ".txt", ".svg"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".markdown": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const SKIP_DIRS = new Set(["node_modules", ".git", ".tmp", ".baoyu-skills"]);

function kindOf(name) {
  const ext = extname(name).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".mp4" || ext === ".mov") return "video";
  if (ext === ".html" || ext === ".htm") return "html";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  return "text";
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
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

/** Minimal ZIP central-directory reader (stored + deflate entries only). */
function readZipEntries(buffer) {
  if (buffer.length < 22) throw new Error("not a zip file");
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65536); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip EOCD not found");
  const count = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  let cursor = cdOffset;
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compSize = buffer.readUInt32LE(cursor + 20);
    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    // local header: 30 bytes + name + extra
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buffer.subarray(dataStart, dataStart + compSize);
    entries.push({ name, method, data: method === 8 ? inflateRawSync(raw) : raw });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** DOCX (word/document.xml) → readable HTML. Paragraphs, headings 1-3, bold, lists. */
export function docxToHtml(buffer) {
  const entries = readZipEntries(buffer);
  const doc = entries.find((entry) => entry.name === "word/document.xml");
  if (doc === void 0) throw new Error("document.xml not found");
  const xml = doc.data.toString("utf8");
  const out = [];
  const paragraphs = xml.split(/<\/w:p>/);
  for (const raw of paragraphs) {
    const runs = [...raw.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
    if (runs.length === 0) continue;
    const text = runs
      .map((run) => run.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
      .join("");
    const styleMatch = /<w:pStyle w:val="([^"]+)"/.exec(raw);
    const style = styleMatch?.[1] ?? "";
    const bold = /<w:b\/>|<w:b /.test(raw);
    const list = /<w:numPr\s*\/?>/.test(raw);
    let html = escapeHtml(text);
    if (bold) html = "<strong>" + html + "</strong>";
    if (style.startsWith("Heading1") || style === "Title") html = "<h1>" + html + "</h1>";
    else if (style.startsWith("Heading2")) html = "<h2>" + html + "</h2>";
    else if (style.startsWith("Heading3")) html = "<h3>" + html + "</h3>";
    else if (list) html = "<li>" + html + "</li>";
    else html = "<p>" + html + "</p>";
    out.push(html);
  }
  return out.join("\n");
}

class ArtifactStudioService extends Service {
  static inject = ["webServer", "workspaceRegistry"];

  constructor(ctx) {
    super(ctx, "artifactStudio");
    ctx.effect(() => ctx.webServer.register({
      kind: "prefix",
      path: "/artifacts",
      handler: (req, res) => this.handle(req, res)
    }), "artifact-studio: routes");
  }

  #workspaceOf(sessionId) {
    const registry = this.ctx.workspaceRegistry;
    const pinned = typeof sessionId === "string" && sessionId.length > 0
      ? registry.host.sessionPath(sessionId)
      : void 0;
    if (typeof pinned === "string" && pinned.length > 0) return pinned;
    const first = registry.list()[0];
    if (first !== void 0 && typeof first.path === "string") return first.path;
    return process.cwd();
  }

  /** Resolve a client-supplied relative path strictly inside the workspace. */
  #resolveInside(workspace, raw) {
    if (typeof raw !== "string" || raw === "") return void 0;
    if (raw.startsWith("/") || raw.includes("\\") || raw.includes("\0")) return void 0;
    const candidate = resolve(workspace, raw);
    if (candidate !== workspace && !candidate.startsWith(workspace + sep)) return void 0;
    return candidate;
  }

  async handle(req, res) {
    const url = new URL(req.url ?? "/", "http://artifacts.local");
    const parts = url.pathname.split("/").filter(Boolean); // ["artifacts", <op>]
    const op = parts[1];
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const workspace = this.#workspaceOf(sessionId);
    try {
      if (op === "list" && (req.method === "GET" || req.method === "HEAD")) {
        return await this.#list(workspace, res);
      }
      if (op === "read" && (req.method === "GET" || req.method === "HEAD")) {
        const target = this.#resolveInside(workspace, url.searchParams.get("path"));
        if (target === void 0) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        return await this.#readText(target, res, req.method === "HEAD");
      }
      if (op === "save" && req.method === "POST") {
        const target = this.#resolveInside(workspace, url.searchParams.get("path"));
        if (target === void 0) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        return await this.#saveText(target, req, res);
      }
      if (op === "docx" && (req.method === "GET" || req.method === "HEAD")) {
        const target = this.#resolveInside(workspace, url.searchParams.get("path"));
        if (target === void 0) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        const buf = await fsp.readFile(target);
        const html = docxToHtml(buf);
        sendJson(res, 200, { ok: true, html });
        return;
      }
      if (op === "preview" && (req.method === "GET" || req.method === "HEAD")) {
        const target = this.#resolveInside(workspace, url.searchParams.get("path"));
        if (target === void 0) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        return await this.#preview(target, res, req.method === "HEAD");
      }
      sendJson(res, 404, { ok: false, error: "not found" });
    } catch (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { ok: false, error: "file not found" });
        return;
      }
      sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
    }
  }

  async #list(workspace, res) {
    const files = [];
    const walk = async (dir, depth) => {
      if (depth > MAX_SCAN_DEPTH || files.length >= MAX_SCAN_FILES) return;
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (files.length >= MAX_SCAN_FILES) return;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
          await walk(full, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (!ARTIFACT_EXTS.has(ext)) continue;
          let stat;
          try {
            stat = await fsp.stat(full);
          } catch {
            continue;
          }
          files.push({
            name: entry.name,
            path: full.slice(workspace.length + 1),
            size: stat.size,
            mtime: stat.mtimeMs,
            kind: kindOf(entry.name)
          });
        }
      }
    };
    await walk(workspace, 0);
    files.sort((a, b) => b.mtime - a.mtime);
    sendJson(res, 200, { ok: true, files: files.slice(0, MAX_SCAN_FILES) });
  }

  async #readText(target, res, headOnly) {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) {
      sendJson(res, 400, { ok: false, error: "not a file" });
      return;
    }
    if (stat.size > MAX_TEXT_BYTES) {
      sendJson(res, 413, { ok: false, error: "file too large to edit" });
      return;
    }
    if (!TEXT_EXTS.has(extname(target).toLowerCase())) {
      sendJson(res, 400, { ok: false, error: "not a text file" });
      return;
    }
    if (headOnly) {
      sendJson(res, 200, { ok: true, content: "" });
      return;
    }
    const content = await fsp.readFile(target, "utf8");
    sendJson(res, 200, { ok: true, content });
  }

  async #saveText(target, req, res) {
    if (!TEXT_EXTS.has(extname(target).toLowerCase())) {
      sendJson(res, 400, { ok: false, error: "not a text file" });
      return;
    }
    const body = await readBody(req, MAX_TEXT_BYTES);
    await fsp.mkdir(join(target, ".."), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, body, { mode: 0o600 });
    await fsp.rename(tmp, target);
    sendJson(res, 200, { ok: true });
  }

  async #preview(target, res, headOnly) {
    const stat = await fsp.stat(target);
    const ext = extname(target).toLowerCase();
    const type = MIME[ext];
    if (type === void 0 || stat.size > 200 * 1024 * 1024) {
      sendJson(res, 400, { ok: false, error: "unsupported or oversized preview" });
      return;
    }
    const body = await fsp.readFile(target);
    res.writeHead(200, {
      "content-type": type,
      "content-length": body.length,
      "cache-control": "no-cache"
    });
    if (headOnly) res.end();
    else res.end(body);
  }
}

export { ArtifactStudioService };
export default ArtifactStudioService;
