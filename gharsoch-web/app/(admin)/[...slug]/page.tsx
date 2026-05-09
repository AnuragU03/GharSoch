function formatTitle(slug: string[]) {
  const value = slug[slug.length - 1] ?? 'route'

  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function AdminPlaceholderPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const title = formatTitle(params.slug)

  return (
    <section className="page active">
      <div className="crumb">Reserved Route</div>
      <div className="head">
        <div>
          <h1 className="title">{title}</h1>
          <p className="sub">Coming in Phase 10.</p>
        </div>
      </div>
    </section>
  )
}
