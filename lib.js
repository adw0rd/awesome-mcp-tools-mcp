import process from 'node:process'

export function usage() {
  return `awesome-mcp CLI — search MCP servers from awesome-mcp.tools

Usage:
  awesome-mcp search <query> [options]
  awesome-mcp top [options]
  awesome-mcp trending [options]
  awesome-mcp hot [options]
  awesome-mcp info <name> [--api <url>] [--json]
  awesome-mcp help

Commands:
  search <query>   Search MCP servers by name or description
  top              Show top servers by stars
  trending         Show trending servers (growing stars in last 24h)
  hot              Show hot/featured servers
  info <name>      Show details for a server (by name or slug)
  help             Show this help message

Filters:
  --source <src>       Filter by source (github, glama, mcp.so, mcpservers.com)
  --category <name>    Filter by category
  --tag <name>         Filter by tag
  --language <lang>    Filter by programming language
  --license <lic>      Filter by license

Options:
  --limit <n>      Number of results (default: 20, max: 100)
  --api <url>      API base URL (default: https://awesome-mcp.tools/api)
  --json           Output raw JSON

Examples:
  awesome-mcp search postgres
  awesome-mcp search browser --source glama --limit 20
  awesome-mcp top --language Python --limit 30
  awesome-mcp trending --category "AI Tools"
  awesome-mcp hot --tag "File Systems"
  awesome-mcp top --source github --json
  awesome-mcp info markitdown
`
}

export function parseArgs(args) {
  const out = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = args[i + 1]
      if (!val || val.startsWith('--')) {
        out[key] = true
      } else {
        out[key] = val
        i++
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

function padRight(v, w) {
  const s = String(v ?? '')
  if (s.length >= w) return s.slice(0, w)
  return s + ' '.repeat(w - s.length)
}

function truncate(v, w) {
  const s = String(v ?? '')
  if (s.length <= w) return s
  if (w <= 1) return s.slice(0, w)
  return s.slice(0, w - 1) + '…'
}

export function normalizeLimit(raw) {
  const n = Number(raw || 20)
  if (!Number.isFinite(n)) return 20
  return Math.max(1, Math.min(100, Math.floor(n)))
}

export async function fetchServers({ apiBase, source, category, tag, language, license, limit, query, sort }) {
  const url = new URL(apiBase + '/servers')
  if (query) url.searchParams.set('q', query)
  if (source) url.searchParams.set('source', source)
  if (category) url.searchParams.set('category', category)
  if (tag) url.searchParams.set('tag', tag)
  if (language) url.searchParams.set('language', language)
  if (license) url.searchParams.set('license', license)
  if (sort) url.searchParams.set('sort', sort)
  url.searchParams.set('page', '1')
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url)
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`API error ${res.status}: ${txt}`)
  }

  const data = await res.json()
  return {
    url: url.toString(),
    items: data.items || [],
    meta: data.meta || { page: 1, limit, total: 0 }
  }
}

export function renderTable(items, total, metric = 'stars') {
  if (!items.length) {
    return 'No results found.\n'
  }

  const nameW = 34
  const sourceW = 14
  const metricW = 8
  const descW = 72
  const metricLabel = metric === 'starDelta' ? 'GROWTH' : 'STARS'
  const lines = []
  lines.push(`Found ${items.length} of ${total} results\n`)
  lines.push(`${padRight('NAME', nameW)}  ${padRight('SOURCE', sourceW)}  ${padRight(metricLabel, metricW)}  ${padRight('DESCRIPTION', descW)}`)
  lines.push('-'.repeat(nameW + sourceW + metricW + descW + 6))

  for (const item of items) {
    const name = truncate(item.name || '', nameW)
    const src = truncate(item.source || '', sourceW)
    const val = metric === 'starDelta' ? `+${item.starDelta || 0}` : String(item.stars || 0)
    const desc = truncate(item.description || '', descW)
    lines.push(`${padRight(name, nameW)}  ${padRight(src, sourceW)}  ${padRight(val, metricW)}  ${desc}`)
  }

  return lines.join('\n') + '\n'
}

export async function run(argv, io = { stdout: process.stdout, stderr: process.stderr, env: process.env }) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    io.stdout.write(usage())
    return 0
  }

  const args = parseArgs(argv)
  const [cmd, ...rest] = args._
  const apiBase = String(args.api || io.env.AWESOME_MCP_API || 'https://awesome-mcp.tools/api').replace(/\/$/, '')
  const source = args.source ? String(args.source) : ''
  const category = args.category ? String(args.category) : ''
  const tag = args.tag ? String(args.tag) : ''
  const language = args.language ? String(args.language) : ''
  const license = args.license ? String(args.license) : ''
  const limit = normalizeLimit(args.limit)
  const json = Boolean(args.json)
  const filters = { source, category, tag, language, license }

  if (cmd === 'help') {
    io.stdout.write(usage())
    return 0
  }

  if (cmd === 'info') {
    const name = rest.join(' ').trim()
    if (!name) {
      io.stderr.write('Server name is required\n')
      io.stderr.write(usage())
      return 1
    }

    // Search for the server, then fetch detail by slug
    const searchOut = await fetchServers({ apiBase, source: '', limit: 10, query: name })
    const match = searchOut.items.find(
      (s) => s.slug === name || s.name?.toLowerCase() === name.toLowerCase()
    ) || searchOut.items[0]

    if (!match || !match.slug) {
      io.stderr.write(`Server not found: ${name}\n`)
      return 1
    }

    const res = await fetch(`${apiBase}/servers/${encodeURIComponent(match.slug)}`)
    if (!res.ok) {
      io.stderr.write(`API error ${res.status}\n`)
      return 1
    }
    const server = await res.json()

    if (json) {
      io.stdout.write(JSON.stringify(server, null, 2) + '\n')
      return 0
    }

    const lines = []
    lines.push(server.name || match.slug)
    lines.push('='.repeat((server.name || match.slug).length))
    if (server.description) lines.push(server.description)
    lines.push('')
    if (server.sourceUrl) lines.push(`  Repository:  ${server.sourceUrl}`)
    if (server.website) lines.push(`  Website:     ${server.website}`)
    if (server.source) lines.push(`  Source:      ${server.source}`)
    if (server.category) lines.push(`  Category:    ${server.category}`)
    if (server.language) lines.push(`  Language:    ${server.language}`)
    if (server.license) lines.push(`  License:     ${server.license}`)
    if (server.stars > 0) lines.push(`  Stars:       ${server.stars}`)
    if (server.tags?.length) lines.push(`  Tags:        ${server.tags.join(', ')}`)
    lines.push(`  Detail:      https://awesome-mcp.tools/server/${match.slug}`)
    lines.push('')
    io.stdout.write(lines.join('\n') + '\n')
    return 0
  }

  if (cmd === 'search') {
    const query = rest.join(' ').trim()
    if (!query) {
      io.stderr.write('Search query is required\n')
      io.stderr.write(usage())
      return 1
    }

    const out = await fetchServers({ apiBase, ...filters, limit, query })
    if (json) {
      io.stdout.write(JSON.stringify({ command: 'search', query, ...out }, null, 2) + '\n')
      return 0
    }
    io.stdout.write(renderTable(out.items, out.meta.total || 0))
    return 0
  }

  if (cmd === 'top') {
    const out = await fetchServers({ apiBase, ...filters, limit, query: '' })
    if (json) {
      io.stdout.write(JSON.stringify({ command: 'top', ...out }, null, 2) + '\n')
      return 0
    }
    io.stdout.write(renderTable(out.items, out.meta.total || 0))
    return 0
  }

  if (cmd === 'trending') {
    const out = await fetchServers({ apiBase, ...filters, limit, query: '', sort: 'trending' })
    if (json) {
      io.stdout.write(JSON.stringify({ command: 'trending', ...out }, null, 2) + '\n')
      return 0
    }
    io.stdout.write(renderTable(out.items, out.meta.total || 0, 'starDelta'))
    return 0
  }

  if (cmd === 'hot') {
    const out = await fetchServers({ apiBase, ...filters, limit, query: '', sort: 'hot' })
    if (json) {
      io.stdout.write(JSON.stringify({ command: 'hot', ...out }, null, 2) + '\n')
      return 0
    }
    io.stdout.write(renderTable(out.items, out.meta.total || 0))
    return 0
  }

  io.stderr.write(`Unknown command: ${cmd}\n`)
  io.stderr.write(usage())
  return 1
}
