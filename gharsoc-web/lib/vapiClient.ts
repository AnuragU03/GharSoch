/**
 * Vapi Server-Side Client
 * Handles outbound call triggering via Vapi API using pre-configured assistants.
 */

interface TriggerCallParams {
  assistantId: string
  customerPhone: string
  customerName?: string
  metadata?: Record<string, string>
}

interface VapiCallResponse {
  success: boolean
  callId?: string
  status?: string
  error?: string
}

const VAPI_API_KEY = process.env.VAPI_API_KEY || ''
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || ''

/**
 * Trigger an outbound phone call via Vapi.
 * Uses assistantId to reference a pre-configured Vapi assistant (NOT inline assistant).
 */
export async function triggerOutboundCall(params: TriggerCallParams): Promise<VapiCallResponse> {
  if (!VAPI_API_KEY) {
    return { success: false, error: 'VAPI_API_KEY not configured' }
  }
  if (!VAPI_PHONE_NUMBER_ID) {
    return { success: false, error: 'VAPI_PHONE_NUMBER_ID not configured' }
  }

  try {
    const body: Record<string, any> = {
      assistantId: params.assistantId,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: params.customerPhone,
        name: params.customerName || undefined,
      },
    }

    // Pass metadata that gets injected into the assistant context
    if (params.metadata) {
      body.assistantOverrides = {
        variableValues: params.metadata,
      }
    }

    const res = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[VapiClient] Call failed:', errorText)
      return { success: false, error: `Vapi API error: ${res.status} ${errorText}` }
    }

    const data = await res.json()
    return {
      success: true,
      callId: data.id,
      status: data.status,
    }
  } catch (error) {
    console.error('[VapiClient] Error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Trigger an outbound call for a campaign lead.
 * Injects lead context into the assistant prompt via variable overrides.
 */
export async function triggerCampaignCall(lead: {
  phone: string
  name: string
  budget_range?: string
  location_pref?: string
  property_type?: string
  notes?: string
}, campaignContext?: {
  campaign_name?: string
  script_template?: string
}): Promise<VapiCallResponse> {
  const assistantId = process.env.VAPI_ASSISTANT_OUTBOUND_ID
  if (!assistantId) {
    return { success: false, error: 'VAPI_ASSISTANT_OUTBOUND_ID not configured' }
  }

  return triggerOutboundCall({
    assistantId,
    customerPhone: lead.phone,
    customerName: lead.name,
    metadata: {
      customer_name: lead.name,
      budget_range: lead.budget_range || 'Not specified',
      location_pref: lead.location_pref || 'Not specified',
      property_type: lead.property_type || 'Not specified',
      previous_notes: lead.notes || 'First contact',
      campaign_name: campaignContext?.campaign_name || 'Direct outreach',
      script_template: campaignContext?.script_template || 'General property inquiry',
    },
  })
}

/**
 * Trigger a reminder call for an appointment.
 */
export async function triggerReminderCall(appointment: {
  lead_phone: string
  lead_name: string
  property_title: string
  property_location: string
  scheduled_at: Date | string
  _id?: any
}): Promise<VapiCallResponse> {
  const assistantId = process.env.VAPI_ASSISTANT_REMINDER_ID
  if (!assistantId) {
    return { success: false, error: 'VAPI_ASSISTANT_REMINDER_ID not configured' }
  }

  const scheduledDate = new Date(appointment.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return triggerOutboundCall({
    assistantId,
    customerPhone: appointment.lead_phone,
    customerName: appointment.lead_name,
    metadata: {
      customer_name: appointment.lead_name,
      property_title: appointment.property_title,
      property_location: appointment.property_location,
      appointment_date: dateStr,
      appointment_time: timeStr,
      appointment_id: appointment._id?.toString() || '',
    },
  })
}

/**
 * Get call details from Vapi.
 */
export async function getCallDetails(callId: string) {
  if (!VAPI_API_KEY) return null

  try {
    const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
