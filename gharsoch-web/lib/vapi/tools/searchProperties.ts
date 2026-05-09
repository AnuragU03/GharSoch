import type { AgentRunContext } from '@/lib/runAgent'

function formatPrice(price: number) {
  if (!Number.isFinite(price)) return 'Price on request'
  if (price >= 10_000_000) return `Rs ${(price / 10_000_000).toFixed(1)} Cr`
  if (price >= 100_000) return `Rs ${(price / 100_000).toFixed(0)} Lakhs`
  return `Rs ${price.toLocaleString('en-IN')}`
}

export async function searchPropertiesTool(args: Record<string, any>, ctx: AgentRunContext) {
  await ctx.think('evaluation', `Searching properties for ${args.location || args.city || 'unspecified location'}.`)

  const filter: Record<string, any> = { status: 'available' }
  if (args.location) filter.location = { $regex: String(args.location), $options: 'i' }
  if (args.city) filter.city = { $regex: String(args.city), $options: 'i' }
  if (args.property_type) filter.type = { $regex: String(args.property_type), $options: 'i' }
  if (typeof args.bedrooms === 'number') filter.bedrooms = args.bedrooms
  if (args.budget_min || args.budget_max) {
    filter.price = {}
    if (args.budget_min) filter.price.$gte = Number(args.budget_min)
    if (args.budget_max) filter.price.$lte = Number(args.budget_max)
  }

  const matches = (await ctx.db.findMany('properties', filter)).slice(0, 5)
  const properties = matches.map((property: any) => ({
    property_id: property._id?.toString?.() || String(property._id || ''),
    title: property.title,
    type: property.type,
    location: property.location,
    city: property.city,
    price: formatPrice(Number(property.price)),
    price_raw: property.price,
    bedrooms: property.bedrooms,
    area_sqft: property.area_sqft,
    builder: property.builder || property.builder_name,
  }))

  const message = properties.length > 0
    ? `Found ${properties.length} matching properties. Top option: ${properties[0].title} in ${properties[0].location} for ${properties[0].price}.`
    : 'No matching properties found right now.'

  await ctx.act('search_properties_complete', `Found ${properties.length} property match(es)`, {
    parameters: { filter },
    result: { found: properties.length },
  })

  return {
    found: properties.length,
    message,
    properties,
  }
}
