#!/usr/bin/env node
// awesome-mcp-bridge: minimal stdio <-> Streamable-HTTP MCP proxy.
// Lets stdio-only MCP clients (Claude Desktop, older Cline) talk to a
// remote Streamable-HTTP MCP server. Default target: https://awesome-mcp.tools/mcp
// Override with AWESOME_MCP_URL env var.

import { stdin, stdout, stderr, env, exit } from 'node:process'
import { createInterface } from 'node:readline'

const ENDPOINT = env.AWESOME_MCP_URL || 'https://awesome-mcp.tools/mcp'
let sessionId = null
let initGate = null              // resolves once `initialize` response is back
const pending = new Set()        // in-flight forward() promises, drained on stdin EOF

function emitError(id, code, message) {
  // Return a JSON-RPC error to the client when forward() fails before a server response.
  // For notifications (no id) we can only log to stderr.
  if (id === undefined || id === null) {
    stderr.write(`[awesome-mcp-bridge] ${message}\n`)
    return
  }
  stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

async function doForward(msg) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json,text/event-stream',
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId

  let res
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(msg) })
  } catch (err) {
    return emitError(msg.id, -32000, `network error: ${err.message}`)
  }

  const sid = res.headers.get('mcp-session-id')
  if (sid) sessionId = sid

  if (res.status === 202) return // notification ack, no body
  if (!res.ok) {
    return emitError(msg.id, -32000, `HTTP ${res.status} from ${ENDPOINT}`)
  }

  const ct = res.headers.get('content-type') || ''
  const body = await res.text()
  if (ct.includes('text/event-stream')) {
    // Minimal SSE event framing: blank line separates events, multiple `data:` lines
    // within one event are concatenated with "\n". Strips one optional leading space
    // after "data:". Comments and unknown fields are ignored.
    for (const rawEvent of body.split(/\r?\n\r?\n/)) {
      const dataLines = []
      for (const rawLine of rawEvent.split(/\r?\n/)) {
        if (!rawLine.startsWith('data:')) continue
        dataLines.push(rawLine.slice(5).replace(/^ /, ''))
      }
      if (dataLines.length) stdout.write(dataLines.join('\n') + '\n')
    }
  } else if (body.trim()) {
    stdout.write(body.trim() + '\n')
  }
}

async function forward(msg) {
  // Serialize on initialize so the session id is captured before any other request goes out.
  if (msg.method === 'initialize') {
    let resolve
    initGate = new Promise((r) => { resolve = r })
    try { await doForward(msg) } finally { resolve(); initGate = null }
    return
  }
  if (initGate) await initGate
  await doForward(msg)
}

const rl = createInterface({ input: stdin, crlfDelay: Infinity })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch (err) {
    return emitError(null, -32700, `invalid JSON-RPC: ${err.message}`)
  }
  const p = forward(msg).catch((err) => {
    emitError(msg && msg.id, -32000, `forward error: ${err.message}`)
  })
  pending.add(p)
  p.finally(() => pending.delete(p))
})

rl.on('close', async () => {
  // Drain pending requests with a 5s cap so we don't hang on a stuck server.
  const cap = new Promise((r) => setTimeout(r, 5000))
  await Promise.race([Promise.allSettled([...pending]), cap])
  exit(0)
})
