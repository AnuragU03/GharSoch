import {
  Bot,
  Building2,
  CalendarClock,
  Megaphone,
  Mic,
  RotateCw,
  Sparkles,
  Target,
  TrendingDown,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface AgentVisual {
  icon: LucideIcon
  tone: string
  label: string
}

export const AGENT_VISUALS: Record<string, AgentVisual> = {
  matchmaker: { icon: Target, tone: 'sky', label: 'The Matchmaker' },
  campaign_conductor: { icon: Megaphone, tone: 'orange', label: 'Campaign Conductor' },
  follow_up_agent: { icon: RotateCw, tone: 'green', label: 'Follow-Up Agent' },
  follow_up: { icon: RotateCw, tone: 'green', label: 'Follow-Up Agent' },
  followup: { icon: RotateCw, tone: 'green', label: 'Follow-Up Agent' },
  appointment_guardian: { icon: CalendarClock, tone: 'amber', label: 'Appointment Guardian' },
  re_engager: { icon: Zap, tone: 'rose', label: 'Re-engager' },
  dead_lead_reengager: { icon: Zap, tone: 'rose', label: 'Re-engager' },
  price_drop_negotiator: { icon: TrendingDown, tone: 'red', label: 'Price Drop Negotiator' },
  voice_orchestrator: { icon: Mic, tone: 'violet', label: 'Voice Orchestrator' },
  client_lead_converter: { icon: Sparkles, tone: 'blue', label: 'Lead Converter' },
  builder_reputation_refiner: { icon: Building2, tone: 'stone', label: 'Builder Refiner' },
}

export function getAgentVisual(agentId: string): AgentVisual {
  return AGENT_VISUALS[agentId] ?? { icon: Bot, tone: 'gray', label: agentId }
}
