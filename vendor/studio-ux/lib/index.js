/**
 * @harness/studio-ux — host half.
 *
 * First-run guide state:
 *  - GET  /ux/guide  → { seen, hasCredentials } (seen persists in
 *    $DSH_HOME/studio-guide.json; credentials = $DSH_HOME/.credentials.yaml
 *    exists and is non-empty);
 *  - POST /ux/guide  → mark the guide seen.
 */
import { Service } from "@deepseek-ai/cordis";
import { promises as fsp } from "node:fs";
import { join } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

function guidePath() {
  return join(resolveDshHome(), "studio-guide.json");
}

function credentialsPath() {
  return join(resolveDshHome(), ".credentials.yaml");
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

class StudioUxService extends Service {
  static inject = ["webServer", "credentials", "settings", "sessions", "sessionProjections"];

  constructor(ctx) {
    super(ctx, "studioUx");
    ctx.effect(() => ctx.webServer.register({
      kind: "prefix",
      path: "/ux",
      handler: (req, res) => this.handle(req, res)
    }), "studio-ux: guide routes");
  }

  /**
   * 任务看板数据：所有会话的 goal 投影快照（目标、阶段、轮次）。
   * 宿主侧 sessions.list() + sessionProjections.snapshot(session) 同步读取，
   * 无需任何网络或进程。
   */
  #tasks() {
    const sessions = this.ctx.sessions;
    const projections = this.ctx.sessionProjections;
    const out = [];
    try {
      for (const session of sessions.list()) {
        let snap;
        try {
          snap = projections.snapshot(session);
        } catch {
          continue;
        }
        const goal = snap?.values?.goal;
        if (goal === undefined || goal === null) continue;
        out.push({
          sessionId: typeof session.id === "string" ? session.id : "",
          title: typeof snap.values.title === "string" && snap.values.title !== ""
            ? snap.values.title
            : (typeof snap.values.title === "object" && snap.values.title !== null && typeof snap.values.title.text === "string"
              ? snap.values.title.text
              : ""),
          goal: {
            id: goal.id ?? "",
            objective: goal.objective ?? "",
            phase: goal.phase ?? "active",
            revision: goal.revision ?? 0,
            maxGoalRounds: goal.maxGoalRounds ?? null,
            roundsStarted: goal.roundsStarted ?? 0,
            blockedReason: goal.blockedReason !== undefined ? String(goal.blockedReason) : null,
            createdAt: goal.createdAt ?? null,
            updatedAt: goal.updatedAt ?? null
          }
        });
      }
    } catch {
      return { ok: true, tasks: [] };
    }
    // 运行中的排前（active > paused > blocked > complete），同状态按更新时间倒序。
    const rank = { active: 0, paused: 1, blocked: 2, complete: 3 };
    out.sort((a, b) => {
      const r = (rank[a.goal.phase] ?? 4) - (rank[b.goal.phase] ?? 4);
      if (r !== 0) return r;
      return (b.goal.updatedAt ?? 0) - (a.goal.updatedAt ?? 0);
    });
    return { ok: true, tasks: out };
  }

  #readJsonBody(req) {
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
        if (bytes > 64 * 1024) {
          settle(reject, new Error("payload too large"));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          settle(resolve, JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          settle(reject, error);
        }
      });
      req.on("error", (error) => settle(reject, error));
    });
  }

  #revisionOf(ns) {
    const descriptor = this.ctx.settings.describe().find((item) => item.ns === ns);
    return descriptor?.revision ?? 0;
  }

  /**
   * Write one hand-declared pi-ai provider (or the DeepSeek official route)
   * through the official settings + credentials services, then optionally
   * switch the default model to it.
   */
  async #writeModel(body) {
    const route = typeof body.route === "string" ? body.route.trim() : "";
    const baseURL = typeof body.baseURL === "string" ? body.baseURL.trim() : "";
    const protocol = typeof body.protocol === "string" ? body.protocol.trim() : "";
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(route)) throw new Error("invalid provider route");
    if (modelId === "") throw new Error("model id required");

    if (route === "deepseek-official") {
      if (apiKey !== "") await this.ctx.credentials.set("DEEPSEEK_API_KEY", apiKey);
      const revision = this.#revisionOf("agent-default-model");
      await this.ctx.settings.mutate("agent-default-model", [
        { op: "set", path: ["provider"], value: "deepseek-official" },
        { op: "set", path: ["model"], value: modelId }
      ], revision);
      return { route, modelId };
    }

    if (!["openai-completions", "openai-responses", "anthropic-messages"].includes(protocol)) throw new Error("invalid protocol");
    if (!/^https?:\/\//.test(baseURL)) throw new Error("baseURL must start with http(s)://");
    const ref = `${route.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
    if (apiKey !== "") await this.ctx.credentials.set(ref, apiKey);
    const profile = {
      ...displayName === "" ? {} : { displayName },
      ...apiKey === "" ? {} : { apiKeyEnv: ref },
      api: protocol,
      baseURL,
      models: [{ id: modelId, name: modelId }]
    };
    const revision = this.#revisionOf("llm-pi-ai");
    await this.ctx.settings.mutate("llm-pi-ai", [
      { op: "set", path: ["providers", route], value: profile }
    ], revision);
    if (body.setActive !== false) {
      const activeRevision = this.#revisionOf("agent-default-model");
      await this.ctx.settings.mutate("agent-default-model", [
        { op: "set", path: ["provider"], value: route },
        { op: "set", path: ["model"], value: modelId }
      ], activeRevision);
    }
    return { route, modelId };
  }

  async #state() {
    let seen = false;
    try {
      const raw = await fsp.readFile(guidePath(), "utf8");
      seen = JSON.parse(raw)?.seen === true;
    } catch {
      seen = false;
    }
    let hasCredentials = false;
    try {
      const stat = await fsp.stat(credentialsPath());
      hasCredentials = stat.isFile() && stat.size > 0;
    } catch {
      hasCredentials = false;
    }
    return { seen, hasCredentials };
  }

  async handle(req, res) {
    const url = new URL(req.url ?? "/", "http://ux.local");
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (parts[1] === "guide") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, { ok: true, ...(await this.#state()) });
          return;
        }
        if (req.method === "POST") {
          const path = guidePath();
          const tmp = `${path}.${process.pid}.tmp`;
          await fsp.mkdir(join(tmp, ".."), { recursive: true });
          await fsp.writeFile(tmp, JSON.stringify({ seen: true, updatedAt: Date.now() }, null, 2) + "\n", { mode: 0o600 });
          await fsp.rename(tmp, path);
          sendJson(res, 200, { ok: true });
          return;
        }
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      if (parts[1] === "models") {
        if (req.method === "POST") {
          let body;
          try {
            body = await this.#readJsonBody(req);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: `invalid JSON: ${String(error?.message ?? error)}` });
            return;
          }
          if (body === null || typeof body !== "object") {
            sendJson(res, 400, { ok: false, error: "body must be a JSON object" });
            return;
          }
          try {
            const result = await this.#writeModel(body);
            sendJson(res, 200, { ok: true, ...result });
          } catch (error) {
            sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
          }
          return;
        }
        if (req.method === "GET" || req.method === "HEAD") {
          const descriptors = this.ctx.settings.describe();
          const pi = descriptors.find((item) => item.ns === "llm-pi-ai");
          const active = descriptors.find((item) => item.ns === "agent-default-model");
          const providers = pi !== void 0 && typeof pi.value === "object" && pi.value !== null && typeof pi.value.providers === "object" && pi.value.providers !== null
            ? Object.keys(pi.value.providers)
            : [];
          sendJson(res, 200, {
            ok: true,
            providers,
            active: active?.value !== void 0 ? { provider: active.value.provider, model: active.value.model } : null
          });
          return;
        }
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      if (parts[1] === "tasks") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, this.#tasks());
          return;
        }
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      sendJson(res, 404, { ok: false, error: "not found" });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
    }
  }
}

export { StudioUxService };
export default StudioUxService;
