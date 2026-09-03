/**
 * @harness/studio-ux — host half.
 *
 * Routes (prefix /ux):
 *  - guide:   first-run state + mark seen (studio-guide.json under $DSH_HOME)
 *  - models:  provider write-through via settings + credentials services
 *  - tasks:   goal projections of every live session (task board data)
 *  - sessions: per-session usage snapshot (context dashboard data)
 *  - skills:  list / toggle / delete user skills under $DSH_HOME/skills
 *  - persona: read / write the user-global instruction file $DSH_HOME/AGENTS.md
 *
 * Tools:
 *  - describe_image: vision bridge for text-only models — sends an image to
 *    DeepSeek's vision model (DeepSeek-V4-Flash-Vision-Exp) with the user's
 *    own DEEPSEEK_API_KEY and returns a text description/OCR result.
 */
import { Service } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { promises as fsp } from "node:fs";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

const VISION_MODEL = "deepseek-v4-flash-vision-exp";
const VISION_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function guidePath() {
  return join(resolveDshHome(), "studio-guide.json");
}

function credentialsPath() {
  return join(resolveDshHome(), ".credentials.yaml");
}

function skillsDir() {
  return join(resolveDshHome(), "skills");
}

function personaPath() {
  return join(resolveDshHome(), "AGENTS.md");
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

/** 读取 SKILL.md 的 YAML frontmatter 中的 name/description。 */
function readSkillMeta(mdPath) {
  let raw;
  try {
    raw = readFileSync(mdPath, "utf8");
  } catch {
    return null;
  }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (m === null) return null;
  const name = /^name:\s*["']?([^"'\n]+)["']?\s*$/m.exec(m[1]);
  const desc = /^description:\s*["']?([^"'\n]+)["']?\s*$/m.exec(m[1]);
  if (name === null || desc === null) return null;
  return { name: name[1].trim(), description: desc[1].trim() };
}

export class StudioUxService extends Service {
  static inject = ["webServer", "credentials", "settings", "sessions", "sessionProjections", "tools", "systemPrompt"];

  constructor(ctx) {
    super(ctx, "studioUx");
    ctx.effect(() => ctx.webServer.register({
      kind: "prefix",
      path: "/ux",
      handler: (req, res) => this.handle(req, res)
    }), "studio-ux: ux routes");
    ctx.effect(() => {
      ctx.systemPrompt.section({
        name: "tool:describe_image",
        order: 112,
        text: `Use the describe_image tool whenever a task involves an image file you cannot see (the current model is text-only, or the image is referenced by a path such as uploads/…): it sends the image to a vision model and returns a detailed Chinese description with OCR text. Prefer it over guessing image contents.`
      });
      ctx.tools.register(defineTool({
        name: "describe_image",
        description: "Describe the contents of a local image file (or extract its text) by sending it to a vision model. Use when you need to understand an image but cannot see it directly.",
        parameters: {
          path: {
            type: "string",
            required: true,
            description: "Absolute path of the image file on disk (PNG/JPEG/WebP/GIF)."
          }
        },
        output: {
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              content: { type: "string" }
            }
          },
          render: (_args, value) => [{ type: "text", text: String(value?.content ?? "") }]
        },
        timeoutMs: 120000,
        isConcurrencySafe: () => true,
        async execute(args) {
          const filePath = typeof args?.path === "string" ? args.path.trim() : "";
          if (filePath === "" || !filePath.startsWith("/")) {
            return { content: "describe_image: 需要绝对路径 / absolute path required" };
          }
          let stat;
          try {
            stat = statSync(filePath);
          } catch {
            return { content: `describe_image: 文件不存在 / file not found: ${filePath}` };
          }
          if (!stat.isFile()) return { content: `describe_image: 不是文件 / not a file: ${filePath}` };
          if (stat.size > MAX_IMAGE_BYTES) {
            return { content: `describe_image: 图片超过 20MB 上限 / image exceeds 20MB: ${filePath}` };
          }
          const mime = filePath.toLowerCase().endsWith(".png") ? "image/png"
            : filePath.toLowerCase().endsWith(".jpg") || filePath.toLowerCase().endsWith(".jpeg") ? "image/jpeg"
            : filePath.toLowerCase().endsWith(".webp") ? "image/webp"
            : filePath.toLowerCase().endsWith(".gif") ? "image/gif"
            : "image/jpeg";
          const b64 = readFileSync(filePath).toString("base64");
          const resolved = await this.ctx.credentials.resolve("DEEPSEEK_API_KEY");
      const apiKey = typeof resolved?.value === "string" ? resolved.value : "";
          if (typeof apiKey !== "string" || apiKey === "") {
            return { content: "describe_image: 未配置 DeepSeek API Key，无法调用视觉模型。请在 设置 → Models 配置 DEEPSEEK_API_KEY 后重试 / no DEEPSEEK_API_KEY configured" };
          }
          const res = await fetch(VISION_ENDPOINT, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: VISION_MODEL,
              max_tokens: 2048,
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: "请用中文详细描述这张图片的内容：主体、场景、关键细节；如果图片里有文字（包括界面截图、文档、表格），请把可读的文字尽量完整地 OCR 出来。最后用一行总结图片用途。" },
                  { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }
                ]
              }]
            })
          });
          if (!res.ok) {
            return { content: `describe_image: 视觉接口返回 HTTP ${res.status}（${basename(filePath)}）` };
          }
          const body = await res.json();
          const text = body?.choices?.[0]?.message?.content;
          if (typeof text === "string" && text !== "") return { content: text };
          return { content: `describe_image: 视觉模型没有返回内容（${basename(filePath)}）` };
        }
      }));
    }, "studio-ux: describe_image tool");
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
        if (bytes > 256 * 1024) {
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

  /** 所有 live 会话的投影快照（goal/title/usage 等），同步读取。 */
  #snapshots() {
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
        const values = snap?.values ?? {};
        const turns = [];
        try {
          const buckets = new Map();
          // rc.1 起 Session.events 被 snapshotEvents() 取代；保留旧访问器兜底。
          const sessionEvents = typeof session.snapshotEvents === "function"
            ? session.snapshotEvents()
            : (session.events ?? []);
          for (const event of sessionEvents) {
            let turn;
            let step;
            let usage;
            if (event.type === "assistant/chunk" && event.data?.chunk?.type === "usage") {
              ({ turn, step } = event.data);
              usage = event.data.chunk.usage;
            } else if (event.type === "assistant/message" && event.data?.usage !== void 0) {
              ({ turn, step, usage } = event.data);
            } else {
              continue;
            }
            if (typeof turn !== "number" || typeof step !== "number" || typeof usage !== "object" || usage === null) continue;
            const key = turn + ":" + step;
            const b = buckets.get(key);
            const same = b !== void 0 && b.turn === turn && b.step === step && b.in === (usage.uncachedInputTokens ?? usage.inputTokens ?? 0) && b.out === (usage.outputTokens ?? 0) && b.cache === (usage.cacheReadTokens ?? 0);
            if (b !== void 0 && same) continue;
            buckets.set(key, {
              turn,
              step,
              in: usage.uncachedInputTokens ?? usage.inputTokens ?? 0,
              out: usage.outputTokens ?? 0,
              cache: usage.cacheReadTokens ?? 0
            });
          }
          for (const b of buckets.values()) turns.push(b);
          turns.sort((a, b2) => b2.turn - a.turn);
        } catch { /* events not addressable — leave turns empty */ }
        out.push({
          sessionId: typeof session.id === "string" ? session.id : "",
          turns: turns.slice(0, 30),
          title: typeof values.title === "string" && values.title !== ""
            ? values.title
            : (typeof values.title === "object" && values.title !== null && typeof values.title.text === "string"
              ? values.title.text
              : ""),
          goal: values.goal,
          usage: {
            tokenUsage: values.tokenUsage ?? null,
            contextPressure: values.contextPressure ?? null,
            contextBreakdown: values.contextBreakdown ?? null
          }
        });
      }
    } catch {
      return [];
    }
    return out;
  }

  /** 任务看板数据：有 goal 投影的会话。 */
  #tasks() {
    const rank = { active: 0, paused: 1, blocked: 2, complete: 3 };
    const tasks = [];
    for (const s of this.#snapshots()) {
      const goal = s.goal;
      if (goal === undefined || goal === null) continue;
      tasks.push({
        sessionId: s.sessionId,
        title: s.title,
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
    tasks.sort((a, b) => {
      const r = (rank[a.goal.phase] ?? 4) - (rank[b.goal.phase] ?? 4);
      if (r !== 0) return r;
      return (b.goal.updatedAt ?? 0) - (a.goal.updatedAt ?? 0);
    });
    return { ok: true, tasks };
  }

  /** 上下文仪表盘数据：所有会话的用量快照。 */
  #sessions() {
    const list = this.#snapshots().map((s) => {
      const u = s.usage;
      const pressure = u.contextPressure;
      const breakdown = u.contextBreakdown;
      const tusage = u.tokenUsage;
      const goal = s.goal;
      const hasAny = pressure !== null || breakdown !== null || tusage !== null || goal !== undefined && goal !== null;
      return {
        sessionId: s.sessionId,
        title: s.title,
        goalPhase: goal !== undefined && goal !== null ? goal.phase : null,
        turns: (s.turns ?? []).map((t) => ({
          turn: t.turn,
          inputTokens: t.in,
          outputTokens: t.out,
          cacheReadTokens: t.cache
        })),
        surfaceTokens: pressure !== null && typeof pressure.surfaceTokens === "number" ? pressure.surfaceTokens : null,
        contextWindow: pressure !== null && typeof pressure.contextWindow === "number" ? pressure.contextWindow : null,
        systemTokens: breakdown !== null && typeof breakdown.systemTokens === "number" ? breakdown.systemTokens : null,
        toolsTokens: breakdown !== null && typeof breakdown.toolsTokens === "number" ? breakdown.toolsTokens : null,
        messageTokens: breakdown !== null && typeof breakdown.messageTokens === "number" ? breakdown.messageTokens : null,
        inputTokens: tusage !== null && typeof tusage.uncachedInputTokens === "number" ? tusage.uncachedInputTokens : null,
        cacheReadTokens: tusage !== null && typeof tusage.cacheReadTokens === "number" ? tusage.cacheReadTokens : null,
        outputTokens: tusage !== null && typeof tusage.outputTokens === "number" ? tusage.outputTokens : null,
        hasAny
      };
    });
    list.sort((a, b) => {
      const pa = a.surfaceTokens ?? -1;
      const pb = b.surfaceTokens ?? -1;
      return pb - pa;
    });
    return { ok: true, sessions: list.slice(0, 50) };
  }

  /** $DSH_HOME/skills 下的技能清单；禁用 = SKILL.md 重命名为 SKILL.md.disabled。 */
  #skills() {
    const dir = skillsDir();
    const out = [];
    try {
      if (!existsSync(dir)) return out;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const md = join(dir, entry.name, "SKILL.md");
          const disabled = join(dir, entry.name, "SKILL.md.disabled");
          const meta = readSkillMeta(md) ?? readSkillMeta(disabled);
          if (meta === null) continue;
          out.push({ name: entry.name, ...meta, enabled: existsSync(md) });
        } else if (entry.name.endsWith(".md") && entry.name !== "SKILL.md") {
          const meta = readSkillMeta(join(dir, entry.name));
          if (meta === null) continue;
          out.push({ name: entry.name.replace(/\.md$/, ""), file: entry.name, ...meta, enabled: true });
        }
      }
    } catch {
      return [];
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async #skillToggle(body) {
    const name = typeof body?.name === "string" ? body.name.replace(/[^A-Za-z0-9._-]/g, "") : "";
    const enabled = body?.enabled === true;
    if (name === "") throw new Error("invalid skill name");
    const dir = skillsDir();
    const candidates = [
      { md: join(dir, name, "SKILL.md"), disabled: join(dir, name, "SKILL.md.disabled") },
      { md: join(dir, `${name}.md`), disabled: join(dir, `${name}.md.disabled`) }
    ];
    for (const c of candidates) {
      if (existsSync(c.md) || existsSync(c.disabled)) {
        if (enabled && existsSync(c.disabled)) {
          await fsp.rename(c.disabled, c.md);
          return { ok: true, name, enabled: true };
        }
        if (!enabled && existsSync(c.md)) {
          await fsp.rename(c.md, c.disabled);
          return { ok: true, name, enabled: false };
        }
        return { ok: true, name, enabled };
      }
    }
    throw new Error(`skill not found: ${name}`);
  }

  async #skillDelete(body) {
    const name = typeof body?.name === "string" ? body.name.replace(/[^A-Za-z0-9._-]/g, "") : "";
    if (name === "") throw new Error("invalid skill name");
    const dir = skillsDir();
    const candidates = [
      join(dir, name),
      join(dir, `${name}.md`),
      join(dir, `${name}.md.disabled`)
    ];
    for (const c of candidates) {
      if (existsSync(c)) {
        await fsp.rm(c, { recursive: true, force: true });
        return { ok: true, name };
      }
    }
    throw new Error(`skill not found: ${name}`);
  }

  async #personaRead() {
    try {
      return { ok: true, text: await fsp.readFile(personaPath(), "utf8") };
    } catch {
      return { ok: true, text: "" };
    }
  }

  async #personaWrite(body) {
    const text = typeof body?.text === "string" ? body.text : "";
    if (text.length > 200 * 1024) throw new Error("persona text too large (200KB cap)");
    const path = personaPath();
    const tmp = `${path}.${process.pid}.tmp`;
    await fsp.mkdir(join(tmp, ".."), { recursive: true });
    await fsp.writeFile(tmp, text, { mode: 0o600 });
    await fsp.rename(tmp, path);
    return { ok: true };
  }

  ZH_MARKER_START = "<!-- studio-zh:start -->";
  ZH_MARKER_END = "<!-- studio-zh:end -->";
  ZH_BLOCK = `${this.ZH_MARKER_START}\n请始终使用简体中文回复：思考过程、最终回答以及向用户提出的问题都使用简体中文，除非用户明确要求其他语言。\n${this.ZH_MARKER_END}\n`;

  async #prefsRead() {
    try {
      const raw = await fsp.readFile(guidePath(), "utf8");
      const data = JSON.parse(raw);
      return { ok: true, prefs: data.prefs ?? {} };
    } catch {
      return { ok: true, prefs: {} };
    }
  }

  async #prefsSave(prefs) {
    const path = guidePath();
    let data = {};
    try {
      data = JSON.parse(await fsp.readFile(path, "utf8"));
    } catch { /* fresh */ }
    data.prefs = prefs;
    const tmp = `${path}.${process.pid}.tmp`;
    await fsp.mkdir(join(tmp, ".."), { recursive: true });
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
    await fsp.rename(tmp, path);
  }

  /** 默认中文开关：通过 AGENTS.md 的标记块即时生效（新会话即用，无需重启引擎）。 */
  async #setZhReply(enabled) {
    const path = personaPath();
    let text = "";
    try {
      text = await fsp.readFile(path, "utf8");
    } catch { /* no persona yet */ }
    const startIdx = text.indexOf(this.ZH_MARKER_START);
    const endIdx = text.indexOf(this.ZH_MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.slice(0, startIdx) + text.slice(endIdx + this.ZH_MARKER_END.length).replace(/^\n/, "");
    }
    if (enabled) {
      text = text.replace(/\n*$/, "") + "\n\n" + this.ZH_BLOCK;
    }
    const tmp = `${path}.${process.pid}.tmp`;
    await fsp.mkdir(join(tmp, ".."), { recursive: true });
    await fsp.writeFile(tmp, text, { mode: 0o600 });
    await fsp.rename(tmp, path);
    return enabled;
  }

  async #writePrefs(body) {
    const next = {};
    if (typeof body?.zhReply === "boolean") {
      next.zhReply = await this.#setZhReply(body.zhReply);
    }
    if (body?.reasoningEffort !== undefined && body?.reasoningEffort !== null) {
      const effort = String(body.reasoningEffort);
      if (!["off", "low", "high", "max"].includes(effort)) throw new Error("invalid reasoning effort");
      const revision = this.#revisionOf("agent-default-model");
      await this.ctx.settings.mutate("agent-default-model", [
        { op: "set", path: ["reasoningEffort"], value: effort }
      ], revision);
      next.reasoningEffort = effort;
    }
    const current = JSON.parse(JSON.stringify((await this.#prefsRead()).prefs));
    await this.#prefsSave({ ...current, ...next });
    return { ok: true, prefs: { ...current, ...next } };
  }

  // DeepSeek 参考价目表（元/百万 tokens；以官方公布为准，可在界面查看说明）。
  // 2026-05 官方永久降价 + 峰谷定价：低谷时段（北京时间 00:30–08:30）
  // deepseek-chat 输入/输出半价、deepseek-reasoner 2.5 折。
  PRICES = {
    chat: { peak: { input: 2, cache: 0.5, output: 8 }, offpeak: { input: 1, cache: 0.25, output: 4 } },
    reasoner: { peak: { input: 4, cache: 1, output: 16 }, offpeak: { input: 1, cache: 0.25, output: 4 } }
  };

  #beijingNow() {
    const now = new Date(Date.now() + 8 * 3600 * 1000);
    return {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      day: now.getUTCDate()
    };
  }

  /** 是否处于低谷窗口（北京时间 00:30–08:30）。 */
  #isOffPeak() {
    const { hour, minute } = this.#beijingNow();
    const t = hour * 60 + minute;
    return t >= 30 && t < 510;
  }

  #activeModelKind() {
    try {
      const descriptors = this.ctx.settings.describe();
      const active = descriptors.find((item) => item.ns === "agent-default-model");
      const model = String(active?.value?.model ?? "").toLowerCase();
      return model.includes("reasoner") ? "reasoner" : "chat";
    } catch {
      return "chat";
    }
  }

  /** 会话费用估算（参考价）。 */
  #sessionCost(kind, usage) {
    const offpeak = this.#isOffPeak();
    const table = (this.PRICES[kind] ?? this.PRICES.chat)[offpeak ? "offpeak" : "peak"];
    const input = (usage?.uncachedInputTokens ?? 0) / 1e6 * table.input;
    const cache = (usage?.cacheReadTokens ?? 0) / 1e6 * table.cache;
    const output = (usage?.outputTokens ?? 0) / 1e6 * table.output;
    return { estimated: Number((input + cache + output).toFixed(4)), offpeak };
  }

  #balanceCache = null;
  #balanceFetchedAt = 0;

  async #balance() {
    if (this.#balanceCache !== null && Date.now() - this.#balanceFetchedAt < 5 * 60 * 1000) {
      return this.#balanceCache;
    }
    try {
      const resolved = await this.ctx.credentials.resolve("DEEPSEEK_API_KEY");
      const apiKey = typeof resolved?.value === "string" ? resolved.value : "";
      if (typeof apiKey !== "string" || apiKey === "") {
        this.#balanceCache = { error: "未配置 DeepSeek API Key" };
        this.#balanceFetchedAt = Date.now();
        return this.#balanceCache;
      }
      const res = await fetch("https://api.deepseek.com/user/balance", {
        headers: { authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
        this.#balanceCache = { error: `HTTP ${res.status}` };
        this.#balanceFetchedAt = Date.now();
        return this.#balanceCache;
      }
      const body = await res.json();
      const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
      this.#balanceCache = {
        available: body?.is_available === true,
        infos: infos.map((info) => ({
          currency: info.currency ?? "CNY",
          total: info.total_balance ?? "0",
          granted: info.granted_balance ?? "0",
          toppedUp: info.topped_up_balance ?? "0"
        }))
      };
      this.#balanceFetchedAt = Date.now();
      return this.#balanceCache;
    } catch (error) {
      this.#balanceCache = { error: String(error?.message ?? error) };
      this.#balanceFetchedAt = Date.now();
      return this.#balanceCache;
    }
  }

  async #cost() {
    const kind = this.#activeModelKind();
    const offpeak = this.#isOffPeak();
    const table = this.PRICES[kind];
    const rows = this.#snapshots().map((sess) => {
      const u = sess.usage.tokenUsage;
      if (u === null) return null;
      const cost = this.#sessionCost(kind, u);
      return {
        sessionId: sess.sessionId,
        title: sess.title,
        inputTokens: u.uncachedInputTokens ?? 0,
        cacheReadTokens: u.cacheReadTokens ?? 0,
        outputTokens: u.outputTokens ?? 0,
        estimatedCost: cost.estimated
      };
    }).filter((row) => row !== null);
    rows.sort((a, b) => b.estimatedCost - a.estimatedCost);
    return {
      ok: true,
      balance: await this.#balance(),
      offpeak,
      offpeakWindow: "00:30–08:30（北京时间）",
      kind,
      prices: table,
      sessions: rows.slice(0, 50)
    };
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
      if (parts[1] === "prefs") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, await this.#prefsRead());
          return;
        }
        if (req.method === "POST") {
          let body;
          try {
            body = await this.#readJsonBody(req);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: `invalid JSON: ${String(error?.message ?? error)}` });
            return;
          }
          try {
            sendJson(res, 200, await this.#writePrefs(body ?? {}));
          } catch (error) {
            sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
          }
          return;
        }
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      if (parts[1] === "cost") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, await this.#cost());
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
      if (parts[1] === "sessions") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, this.#sessions());
          return;
        }
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      if (parts[1] === "skills") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, { ok: true, skills: this.#skills() });
          return;
        }
        if (req.method === "POST") {
          let body;
          try {
            body = await this.#readJsonBody(req);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: `invalid JSON: ${String(error?.message ?? error)}` });
            return;
          }
          try {
            if (body?.action === "toggle") {
              sendJson(res, 200, await this.#skillToggle(body));
              return;
            }
            if (body?.action === "delete") {
              sendJson(res, 200, await this.#skillDelete(body));
              return;
            }
            sendJson(res, 400, { ok: false, error: "unknown action" });
          } catch (error) {
            sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
          }
          return;
        }
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      if (parts[1] === "persona") {
        if (req.method === "GET" || req.method === "HEAD") {
          sendJson(res, 200, await this.#personaRead());
          return;
        }
        if (req.method === "POST") {
          let body;
          try {
            body = await this.#readJsonBody(req);
          } catch (error) {
            sendJson(res, 400, { ok: false, error: `invalid JSON: ${String(error?.message ?? error)}` });
            return;
          }
          try {
            sendJson(res, 200, await this.#personaWrite(body));
          } catch (error) {
            sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
          }
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

export default StudioUxService;
