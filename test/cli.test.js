import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeLimit, parseArgs, renderTable, run } from '../lib.js'

function ioCapture() {
  let out = ''
  let err = ''
  return {
    io: {
      stdout: { write: (s) => { out += s } },
      stderr: { write: (s) => { err += s } },
      env: {}
    },
    out: () => out,
    err: () => err
  }
}

function installFetchMock(fn) {
  const orig = globalThis.fetch
  globalThis.fetch = fn
  return () => {
    globalThis.fetch = orig
  }
}

function okResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  }
}

test('parseArgs parses flags and positionals', () => {
  const got = parseArgs(['search', 'play', '--limit', '10', '--json'])
  assert.equal(got._[0], 'search')
  assert.equal(got._[1], 'play')
  assert.equal(got.limit, '10')
  assert.equal(got.json, true)
})

test('normalizeLimit clamps values', () => {
  assert.equal(normalizeLimit('200'), 100)
  assert.equal(normalizeLimit('0'), 1)
  assert.equal(normalizeLimit('x'), 20)
})

test('renderTable has expected rows', () => {
  const txt = renderTable([{ name: 'Play MCP', source: 'github', stars: 5, description: 'desc' }], 1)
  assert.match(txt, /Found 1 of 1 results/)
  assert.match(txt, /Play MCP/)
})

test('run search play returns table output', async () => {
  const restore = installFetchMock(async (url) => {
    const u = new URL(url)
    const q = u.searchParams.get('q') || ''
    assert.equal(q, 'play')
    return okResponse({
      items: [
        { id: '1', name: 'Playwright MCP', source: 'github', stars: 1234, description: 'Browser automation server' },
        { id: '2', name: 'Player Stats MCP', source: 'glama', stars: 222, description: 'Sports and score data' }
      ],
      meta: { total: 2, page: 1, limit: 20 }
    })
  })

  const cap = ioCapture()
  try {
    const code = await run(['search', 'play', '--api', 'https://example.test/api'], cap.io)
    assert.equal(code, 0)
    assert.match(cap.out(), /Playwright MCP/)
    assert.match(cap.out(), /Found 2 of 2 results/)
  } finally {
    restore()
  }
})

test('run top --json returns json payload', async () => {
  const restore = installFetchMock(async () =>
    okResponse({
      items: [{ id: '3', name: 'Top MCP', source: 'mcp.so', stars: 9999, description: 'Top server by stars' }],
      meta: { total: 1, page: 1, limit: 20 }
    })
  )

  const cap = ioCapture()
  try {
    const code = await run(['top', '--json', '--api', 'https://example.test/api'], cap.io)
    assert.equal(code, 0)
    const parsed = JSON.parse(cap.out())
    assert.equal(parsed.command, 'top')
    assert.equal(Array.isArray(parsed.items), true)
    assert.equal(parsed.items[0].name, 'Top MCP')
  } finally {
    restore()
  }
})

test('run search --json includes query', async () => {
  const restore = installFetchMock(async () =>
    okResponse({
      items: [{ id: '1', name: 'Playwright MCP', source: 'github', stars: 1234, description: 'Browser automation server' }],
      meta: { total: 1, page: 1, limit: 20 }
    })
  )

  const cap = ioCapture()
  try {
    const code = await run(['search', 'play', '--json', '--api', 'https://example.test/api'], cap.io)
    assert.equal(code, 0)
    const parsed = JSON.parse(cap.out())
    assert.equal(parsed.command, 'search')
    assert.equal(parsed.query, 'play')
  } finally {
    restore()
  }
})
