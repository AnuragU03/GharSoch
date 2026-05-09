import { builderKBService } from '@/lib/builderKBService'
import { KnowledgeBaseSection } from '@/app/sections/KnowledgeBaseSection'

export const dynamic = 'force-dynamic'

export default async function KBPage() {
  const builders = await builderKBService.listAllBuilders()
  return <KnowledgeBaseSection builders={builders} />
}
