import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const FALLBACK_PATH = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
].join(':')

export function normalizePath(...values: Array<string | undefined>): string {
  const entries = values
    .flatMap((value) => value?.split(':') ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return [...new Set(entries)].join(':')
}

export function extractPathFromNullEnvironment(output: string): string | undefined {
  const pathEntry = output
    .split('\0')
    .filter((entry) => entry.startsWith('PATH='))
    .at(-1)
  return pathEntry?.slice('PATH='.length) || undefined
}

export async function resolveLoginShellPath(): Promise<string> {
  const configuredShell = process.env.SHELL
  const shell =
    configuredShell?.startsWith('/') && configuredShell.length < 512
      ? configuredShell
      : '/bin/zsh'

  try {
    await access(shell, constants.X_OK)
    const { stdout } = await execFileAsync(shell, ['-ilc', 'env -0'], {
      encoding: 'utf8',
      timeout: 3_000,
      maxBuffer: 1024 * 1024
    })
    return normalizePath(
      extractPathFromNullEnvironment(stdout),
      process.env.PATH,
      FALLBACK_PATH
    )
  } catch {
    return normalizePath(process.env.PATH, FALLBACK_PATH)
  }
}
