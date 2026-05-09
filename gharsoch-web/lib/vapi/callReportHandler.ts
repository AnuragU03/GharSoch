import type { AgentRunContext } from '@/lib/runAgent'

function extractTranscript(payload: any) {
  return (
    payload?.transcript ||
    payload?.message?.transcript ||
    payload?.artifact?.transcript ||
    payload?.message?.artifact?.transcript ||
    ''
  )
}

function extractRecordingUrl(payload: any) {
  return (
    payload?.recording_url ||
    payload?.recordingUrl ||
    payload?.message?.recording_url ||
    payload?.message?.recordingUrl ||
    payload?.artifact?.recordingUrl ||
    payload?.message?.artifact?.recordingUrl ||
    ''
  )
}

function extractCallData(payload: any) {
  const call = payload?.call || payload?.message?.call || {}
  return {
    callId: payload?.callId || call?.id || payload?.message?.callId || '',
    assistantId: call?.assistantId || payload?.assistantId || '',
    customerPhone:
      call?.customer?.number ||
      payload?.customer?.number ||
      payload?.message?.customer?.number ||
      '',
    customerName:
      call?.customer?.name ||
      payload?.customer?.name ||
      payload?.message?.customer?.name ||
      '',
    duration: payload?.duration || payload?.message?.duration || call?.duration || 0,
    endedReason: payload?.ended_reason || payload?.endedReason || payload?.message?.endedReason || call?.endedReason || '',
  }
}

export async function handleEndOfCallReport(payload: any, ctx: AgentRunContext) {
  const transcript = extractTranscript(payload)
  const recordingUrl = extractRecordingUrl(payload)
  const { callId, assistantId, customerPhone, customerName, duration, endedReason } = extractCallData(payload)

  await ctx.think(
    'evaluation',
    `Persisting end-of-call report for ${callId || 'unknown_call'} with transcript length ${transcript.length}.`
  )

  const calls = await ctx.db.findMany('calls', callId ? { vapi_call_id: callId } : { _id: null })
  const existingCall = calls[0] || null
  const leads = await ctx.db.findMany('leads', customerPhone ? { phone: customerPhone } : { _id: null })
  const lead = leads[0] || null

  const callRecord = {
    lead_id: lead?._id?.toString?.() || '',
    lead_name: lead?.name || customerName || '',
    lead_phone: customerPhone,
    agent_name: 'Voice Orchestrator',
    agent_id: assistantId || '',
    campaign_id: existingCall?.campaign_id || '',
    direction: existingCall?.direction || 'outbound',
    call_type: existingCall?.call_type || 'voice_tool_call',
    duration,
    disposition: existingCall?.disposition || '',
    call_outcome: existingCall?.call_outcome || '',
    call_summary: existingCall?.call_summary || '',
    customer_availability: existingCall?.customer_availability || '',
    preferred_callback_time: existingCall?.preferred_callback_time || '',
    preferred_callback_days: existingCall?.preferred_callback_days || [],
    customer_interest_level: existingCall?.customer_interest_level || '',
    follow_up_required: existingCall?.follow_up_required || false,
    follow_up_date: existingCall?.follow_up_date || null,
    follow_up_notes: existingCall?.follow_up_notes || '',
    key_requirements: existingCall?.key_requirements || '',
    customer_objections: existingCall?.customer_objections || '',
    next_steps: existingCall?.next_steps || '',
    recording_url: recordingUrl,
    transcript,
    trai_compliant: true,
    call_status: 'completed',
    vapi_call_id: callId,
    ended_reason: endedReason,
    updated_at: new Date(),
  }

  if (existingCall?._id) {
    await ctx.db.updateOne('calls', { _id: existingCall._id }, { $set: callRecord })
  } else {
    await ctx.db.insertOne('calls', {
      ...callRecord,
      created_at: new Date(),
    })
  }

  if (lead?._id) {
    await ctx.db.updateOne(
      'leads',
      { _id: lead._id },
      { $set: { last_contacted_at: new Date(), updated_at: new Date() } }
    )
  }

  await ctx.act('call_report_saved', `Saved end-of-call report for ${callId || customerPhone || 'unknown_call'}`, {
    parameters: { call_id: callId, customer_phone: customerPhone },
    result: { updated_existing_call: Boolean(existingCall?._id), transcript_length: transcript.length },
  })

  return {
    success: true,
    message: 'Call report processed',
    callId,
  }
}
