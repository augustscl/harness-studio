export class LogBuffer {
  readonly #limit: number
  #completed: string[] = []
  #partial = ''

  constructor(limit = 120) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('Log buffer limit must be a positive integer')
    }
    this.#limit = limit
  }

  append(chunk: string | Uint8Array): void {
    const text =
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    const pieces = `${this.#partial}${text}`.split(/\r?\n/u)
    this.#partial = pieces.pop() ?? ''
    this.#completed.push(...pieces)
    this.#trim()
  }

  lines(): string[] {
    const result = [...this.#completed]
    if (this.#partial.length > 0) result.push(this.#partial)
    return result.slice(-this.#limit)
  }

  #trim(): void {
    const overflow = this.#completed.length - this.#limit
    if (overflow > 0) this.#completed.splice(0, overflow)
  }
}
