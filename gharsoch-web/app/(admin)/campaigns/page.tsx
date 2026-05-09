import { CampaignsSection } from '@/app/sections/CampaignsSection'
import { campaignService } from '@/lib/services/campaignService'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const [activeCampaigns, draftCampaigns, completedCampaigns] = await Promise.all([
    campaignService.listActive(),
    campaignService.listDrafts(),
    campaignService.listCompleted(),
  ])

  return (
    <CampaignsSection
      activeCampaigns={activeCampaigns}
      draftCampaigns={draftCampaigns}
      completedCampaigns={completedCampaigns}
    />
  )
}
