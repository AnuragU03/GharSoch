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

export type VapiLogHook = (event: {
  stage: 'request' | 'response' | 'error' | 'validation_error'
  operation: 'triggerOutboundCall' | 'getCallDetails'
  endpoint: string
  timestamp: string
  request?: Record<string, any>
  response?: Record<string, any>
  error?: { message: string; name?: string }
}) => void

interface VapiCallResponse {
  success: boolean
  callId?: string
  status?: string
  error?: string
}

const VAPI_API_KEY = process.env.VAPI_API_KEY || ''
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || ''

/**
 * Z13/Z15: Build current datetime variables for Vapi assistant context.
 * AI references these when discussing dates with customers.
 */
function buildDateTimeVariables(): { current_datetime_iso: string; current_date_human_ist: string } {
  const now = new Date()
  const istHuman = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return {
    current_datetime_iso: now.toISOString(),
    current_date_human_ist: istHuman,
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) return '****'
  return `***${digits.slice(-4)}`
}

/**
 * Trigger an outbound phone call via Vapi.
 * Uses assistantId to reference a pre-configured Vapi assistant (NOT inline assistant).
 */
export async function triggerOutboundCall(
  params: TriggerCallParams,
  opts?: { logHook?: VapiLogHook }
): Promise<VapiCallResponse> {
  const endpoint = 'https://api.vapi.ai/call/phone'
  if (!VAPI_API_KEY) {
    opts?.logHook?.({
      stage: 'validation_error',
      operation: 'triggerOutboundCall',
      endpoint,
      timestamp: new Date().toISOString(),
      error: { message: 'VAPI_API_KEY not configured', name: 'ConfigError' },
    })
    return { success: false, error: 'VAPI_API_KEY not configured - please set up your Vapi API key' }
  }
  if (!VAPI_PHONE_NUMBER_ID) {
    opts?.logHook?.({
      stage: 'validation_error',
      operation: 'triggerOutboundCall',
      endpoint,
      timestamp: new Date().toISOString(),
      error: { message: 'VAPI_PHONE_NUMBER_ID not configured', name: 'ConfigError' },
    })
    return { success: false, error: 'VAPI_PHONE_NUMBER_ID not configured - please import your Twilio number into Vapi' }
  }
  if (!params.assistantId) {
    opts?.logHook?.({
      stage: 'validation_error',
      operation: 'triggerOutboundCall',
      endpoint,
      timestamp: new Date().toISOString(),
      error: { message: 'assistantId is missing', name: 'ValidationError' },
    })
    return { success: false, error: 'Assistant ID not configured - please create your assistants in the Vapi dashboard' }
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

    // Z13/Z15: inject current datetime so assistant knows real date/time.
    // User-provided metadata can override these if needed (rare).
    const dateTimeVars = buildDateTimeVariables()
    const finalVariableValues = {
      ...dateTimeVars,
      ...(params.metadata || {}),
    }

    // Pass metadata and tools that get injected into the assistant context
    body.assistantOverrides = {
      variableValues: finalVariableValues,
      endCallFunctionEnabled: true,
      endCallMessage: 'Thank you for your time. Have a great day!',
    }

    opts?.logHook?.({
      stage: 'request',
      operation: 'triggerOutboundCall',
      endpoint,
      timestamp: new Date().toISOString(),
      request: {
        assistantId: params.assistantId,
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        customerPhoneMasked: maskPhone(params.customerPhone),
        metadataKeys: Object.keys(params.metadata || {}),
      },
    })

    const res = await fetch(endpoint, {
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

      opts?.logHook?.({
        stage: 'response',
        operation: 'triggerOutboundCall',
        endpoint,
        timestamp: new Date().toISOString(),
        response: {
          ok: false,
          status: res.status,
          body: errorText,
        },
      })
      
      let userFriendlyError = `Vapi API error: ${res.status} ${errorText}`
      
      if (errorText.includes('assistantId must be a UUID')) {
        userFriendlyError = 'Invalid assistant ID format - please use a valid UUID from your Vapi dashboard'
      } else if (errorText.includes('Could not get assistant') || errorText.includes('Not exist')) {
        userFriendlyError = 'Assistant not found - please create the assistants in your Vapi dashboard first (see docs/VAPI_ASSISTANTS_SETUP.md)'
      }
      
      return { success: false, error: userFriendlyError }
    }

    const data = await res.json()

    opts?.logHook?.({
      stage: 'response',
      operation: 'triggerOutboundCall',
      endpoint,
      timestamp: new Date().toISOString(),
      response: {
        ok: true,
        status: res.status,
        callId: data?.id,
        callStatus: data?.status,
      },
    })

    return {
      success: true,
      callId: data.id,
      status: data.status,
    }
  } catch (error) {
    console.error('[VapiClient] Error:', error)
    opts?.logHook?.({
      stage: 'error',
      operation: 'triggerOutboundCall',
      endpoint,
      timestamp: new Date().toISOString(),
      error: {
        message: (error as Error).message,
        name: (error as Error).name,
      },
    })
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
}, propertiesContext?: string, opts?: { logHook?: VapiLogHook }): Promise<VapiCallResponse> {
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
      customer_phone: lead.phone,
      budget_range: lead.budget_range || 'Not specified',
      location_pref: lead.location_pref || 'Not specified',
      property_type: lead.property_type || 'Not specified',
      previous_notes: lead.notes || 'First contact',
      campaign_name: campaignContext?.campaign_name || 'Direct outreach',
      script_template: campaignContext?.script_template || 'General property inquiry',
      premium_properties_context: propertiesContext || 'No specific premium properties listed.',
    },
  }, opts)
}

/**
 * Trigger a reminder call for an appointment.
 */
export async function triggerReminderCall(params: {
  phone: string
  name?: string
  variables?: Record<string, string>
}, opts?: { logHook?: VapiLogHook }): Promise<VapiCallResponse> {
  const assistantId = process.env.VAPI_ASSISTANT_REMINDER_ID
  if (!assistantId) {
    return { success: false, error: 'VAPI_ASSISTANT_REMINDER_ID not configured' }
  }

  return triggerOutboundCall({
    assistantId,
    customerPhone: params.phone,
    customerName: params.name,
    metadata: params.variables || {},
  }, opts)
}

/**
 * Trigger a callback call for a customer who requested a follow-up call.
 * Uses the dedicated CALLBACK assistant (with full booking toolkit).
 * Falls back to REMINDER assistant if VAPI_ASSISTANT_CALLBACK_ID is not set.
 */
export async function triggerCallbackCall(params: {
  phone: string
  name?: string
  variables?: Record<string, string>
}, opts?: { logHook?: VapiLogHook }): Promise<VapiCallResponse> {
  const callbackId = process.env.VAPI_ASSISTANT_CALLBACK_ID
  const reminderId = process.env.VAPI_ASSISTANT_REMINDER_ID
  const assistantId = callbackId || reminderId
  if (!assistantId) {
    return { success: false, error: 'Neither VAPI_ASSISTANT_CALLBACK_ID nor VAPI_ASSISTANT_REMINDER_ID configured' }
  }
  if (!callbackId) {
    console.warn('[triggerCallbackCall] VAPI_ASSISTANT_CALLBACK_ID not set — falling back to REMINDER assistant. Customer-callback flow may have limited tools.')
  }

  return triggerOutboundCall({
    assistantId,
    customerPhone: params.phone,
    customerName: params.name,
    metadata: params.variables || {},
  }, opts)
}

/**
 * Get call details from Vapi.
 */
export async function getCallDetails(callId: string, opts?: { logHook?: VapiLogHook }) {
  if (!VAPI_API_KEY) return null

  const endpoint = `https://api.vapi.ai/call/${callId}`

  try {
    opts?.logHook?.({
      stage: 'request',
      operation: 'getCallDetails',
      endpoint,
      timestamp: new Date().toISOString(),
      request: { callId },
    })

    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    })
    if (!res.ok) return null
    const data = await res.json()

    opts?.logHook?.({
      stage: 'response',
      operation: 'getCallDetails',
      endpoint,
      timestamp: new Date().toISOString(),
      response: { ok: true, status: res.status },
    })

    return data
  } catch {
    return null
  }
}
