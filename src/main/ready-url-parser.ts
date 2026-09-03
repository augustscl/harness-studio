import { StringDecoder } from 'node:string_decoder'

// rc.1 起 ready 行可能是 `dsh web: http://127.0.0.1:<port>/?token=…`：
// 正则必须容忍可选的 token 查询串（整行捕获，视图需要带 token 访问）。
const READY_LINE = /^dsh web: (http:\/\/127\.0\.0\.1:(?:[1-9]\d{0,4})(?:\/\?[^\s]*)?)$/u

export class ReadyUrlParser {
  readonly #decoder = new StringDecoder('utf8')
  #pending = ''

  push(chunk: Uint8Array | string): string | undefined {
    const text =
      typeof chunk === 'string' ? chunk : this.#decoder.write(Buffer.from(chunk))
    return this.#consume(`${this.#pending}${text}`)
  }

  finish(): string | undefined {
    return this.#consume(`${this.#pending}${this.#decoder.end()}`, true)
  }

  #consume(text: string, flush = false): string | undefined {
    const lines = text.split(/\r?\n/u)
    if (flush) {
      this.#pending = ''
    } else {
      this.#pending = lines.pop() ?? ''
    }

    for (const line of lines) {
      const match = READY_LINE.exec(line)
      if (!match) continue
      const candidate = match[1]
      if (!candidate) continue
      try {
        const port = Number(new URL(candidate).port)
        if (port >= 1 && port <= 65_535) return candidate
      } catch {
        // Regex validation is followed by URL parsing to reject invalid ports.
      }
    }
    return undefined
  }
}
