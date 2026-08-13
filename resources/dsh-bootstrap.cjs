'use strict'

const { pathToFileURL } = require('node:url')

const entrypoint = process.argv[2]
if (!entrypoint) {
  console.error('Harness Studio runtime: missing dsh entrypoint')
  process.exit(64)
}

// Electron consumes this variable before Node starts. Removing it here keeps
// user commands launched by the agent from mistaking an Electron binary for Node.
delete process.env.ELECTRON_RUN_AS_NODE
delete process.env.ELECTRON_RENDERER_URL
process.argv.splice(1, 2, entrypoint)

import(pathToFileURL(entrypoint).href).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
