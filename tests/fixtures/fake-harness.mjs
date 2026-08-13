import { createServer } from 'node:http'

const portIndex = process.argv.indexOf('--port')
const port = Number(process.argv[portIndex + 1])
const mode = process.env.FAKE_HARNESS_MODE ?? 'ready'

console.log('fake harness preparing')
console.log(`fake harness home: ${process.env.DSH_HOME ?? 'missing'}`)

if (mode === 'exit') {
  console.error('fake harness exited before listening')
  process.exit(23)
}

if (mode !== 'timeout') {
  const delay = mode === 'delay' ? 250 : 0
  setTimeout(() => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(
        mode === 'no-marker'
          ? '<!doctype html><title>Fake Harness</title>ready'
          : '<!doctype html><script>window.__DSH_BOOT__={}</script><title>Fake Harness</title>ready'
      )
    })

    server.listen(port, '127.0.0.1', () => {
      console.log(`dsh web: http://127.0.0.1:${server.address().port}`)
    })

    const close = () => {
      if (mode === 'ignore-term') return
      console.log('fake harness stopping')
      server.close(() => process.exit(0))
    }
    process.on('SIGTERM', close)
    process.on('SIGINT', close)
    if (mode === 'crash-after-ready') {
      setTimeout(() => process.exit(41), 450)
    }
  }, delay)
}

setInterval(() => {}, 1_000)
