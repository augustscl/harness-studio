import { createServer } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { findAvailablePort, isPortAvailable } from '../../src/main/port'

const servers: ReturnType<typeof createServer>[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  )
})

describe('port selection', () => {
  it('reports an occupied port as unavailable', async () => {
    const server = createServer()
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing port')

    await expect(isPortAvailable(address.port)).resolves.toBe(false)
  })

  it('returns a port that can immediately be bound on loopback', async () => {
    const port = await findAvailablePort()
    expect(port).toBeGreaterThan(1024)

    const server = createServer()
    servers.push(server)
    await expect(
      new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', resolve)
      })
    ).resolves.toBeUndefined()
  })
})
