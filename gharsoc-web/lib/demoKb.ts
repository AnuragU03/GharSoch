import fs from 'fs/promises'
import path from 'path'

export type DemoListing = {
  id: string
  city: string
  locality: string
  builder: string
  project: string
  property_type: string
  config: string
  status: 'UnderConstruction' | 'ReadyToMove'
  price_inr: number
  area_sqft?: number
  hoa_inr_per_month?: number
  amenities?: string[]
  highlights?: string[]
  nearby?: string[]
  notes?: string
}

type DemoKb = {
  listings: DemoListing[]
  project_briefs: { id: string; title: string; content: string }[]
  playbooks: { id: string; title: string; content: string }[]
  compliance: { id: string; title: string; content: string }[]
}

let _cache: DemoKb | null = null

export async function loadDemoKb(): Promise<DemoKb> {
  if (_cache) return _cache
  const filePath = path.join(process.cwd(), 'data', 'demo-kb.json')
  const raw = await fs.readFile(filePath, 'utf8')
  _cache = JSON.parse(raw) as DemoKb
  return _cache
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s+]/g, ' ')
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function scoreText(tokens: string[], text: string): number {
  const t = text.toLowerCase()
  let score = 0
  for (const tok of tokens) {
    if (tok.length < 2) continue
    if (t.includes(tok)) score += tok.length >= 5 ? 3 : 1
  }
  return score
}

export async function searchDemoListings(params: {
  query: string
  city?: string
  maxPriceInr?: number
  limit?: number
}): Promise<{ listing: DemoListing; score: number }[]> {
  const kb = await loadDemoKb()
  const tokens = tokenize(params.query || '')
  const city = params.city?.toLowerCase()
  const limit = Math.max(1, Math.min(params.limit ?? 8, 25))

  const scored = kb.listings
    .filter(l => (city ? l.city.toLowerCase() === city : true))
    .filter(l => (params.maxPriceInr ? l.price_inr <= params.maxPriceInr : true))
    .map(listing => {
      const text = [
        listing.city,
        listing.locality,
        listing.builder,
        listing.project,
        listing.property_type,
        listing.config,
        listing.status,
        (listing.amenities || []).join(' '),
        (listing.highlights || []).join(' '),
        (listing.nearby || []).join(' '),
        listing.notes || '',
      ].join(' ')
      const score = scoreText(tokens, text)
      return { listing, score }
    })
    .filter(x => x.score > 0 || tokens.length === 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}

