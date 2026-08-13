import { createServer } from 'node:http'

const portIndex = process.argv.indexOf('--port')
const port = Number(process.argv[portIndex + 1])
const mode = process.env.FAKE_HARNESS_MODE ?? 'ready'

console.log('fake harness preparing')

if (mode === 'exit') {
  console.error('fake harness exited before listening')
  process.exit(23)
}

if (mode !== 'timeout') {
  const delay = mode === 'delay' ? 250 : 0
  setTimeout(() => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<!doctype html><title>Fake Harness</title>ready')
    })

    server.listen(port, '127.0.0.1', () => {
      console.log(`fake harness ready at http://127.0.0.1:${port}`)
    })

    const close = () => {
      console.log('fake harness stopping')
      server.close(() => process.exit(0))
    }
    process.on('SIGTERM', close)
    process.on('SIGINT', close)
  }, delay)
}

setInterval(() => {}, 1_000)
