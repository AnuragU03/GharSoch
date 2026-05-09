import { PropertiesSection } from '@/app/sections/PropertiesSection'
import { propertyService, type PropertyStatusFilter } from '@/lib/services/propertyService'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { status?: PropertyStatusFilter }
}) {
  const properties = await propertyService.list({
    status: searchParams.status,
    limit: 60,
  })

  return <PropertiesSection initialProperties={properties} />
}
