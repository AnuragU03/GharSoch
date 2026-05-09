import { LeadPipelineSection } from '@/app/sections/LeadPipelineSection'
import { leadService } from '@/lib/services/leadService'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [initialColumns, stats] = await Promise.all([
    leadService.listByStage(),
    leadService.getStats(),
  ])

  return <LeadPipelineSection initialColumns={initialColumns} stats={stats} />
}
