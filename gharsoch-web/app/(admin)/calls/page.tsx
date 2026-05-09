import { callService } from '@/lib/services/callService'
import { CallLogsSection } from '@/app/sections/CallLogsSection'

export const dynamic = 'force-dynamic'

export default async function CallsPage() {
  const [calls, strip] = await Promise.all([
    callService.list({ limit: 100 }),
    callService.getStripData(),
  ])

  return <CallLogsSection calls={calls} strip={strip} />
}
