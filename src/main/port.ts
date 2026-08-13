import { createServer } from 'node:net'

const LOOPBACK_HOST = '127.0.0.1'

function probePort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once('error', () => resolve(null))
    server.listen(port, LOOPBACK_HOST, () => {
      const address = server.address()
      const selectedPort =
        address && typeof address !== 'string' ? address.port : null
      server.close(() => resolve(selectedPort))
    })
  })
}

export async function isPortAvailable(port: number): Promise<boolean> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return false
  return (await probePort(port)) === port
}

export async function findAvailablePort(): Promise<number> {
  const port = await probePort(0)
  if (port === null) {
    throw new Error('Could not allocate a loopback port')
  }
  return port
}
