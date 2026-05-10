'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'

import { createCampaignAction } from '@/app/actions/campaigns'
import { toast } from '@/lib/toast'

const ASSISTANTS = ['Sunrise Property-outbound']
const SCRIPT_TEMPLATES = ['premium-pitch-v2', 'cold-outreach-v1', 're-engage-v3']

type CampaignFormState = {
  name: string
  description: string
  voice_assistant: string
  script_template: string
  start_date: string
  end_date: string
  target_filter: string
}

const INITIAL_STATE: CampaignFormState = {
  name: '',
  description: '',
  voice_assistant: ASSISTANTS[0],
  script_template: SCRIPT_TEMPLATES[0],
  start_date: '',
  end_date: '',
  target_filter: '',
}

export function NewCampaignModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(INITIAL_STATE)
      setError('')
    }
  }, [open])

  const submit = async (formData: FormData, intent: 'draft' | 'launch') => {
    formData.set('intent', intent)
    setSubmitting(true)
    setError('')
    const result = await createCampaignAction(formData)
    setSubmitting(false)

    if (!result.success) {
      setError(result.error || 'Failed to create campaign.')
      return
    }

    toast.success(intent === 'launch' ? 'Campaign launched · Conductor queued' : 'Campaign saved as draft')
    router.refresh()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-[560px]">
        <div className="modal-card">
          <div className="modal-head">
            <h3>New campaign</h3>
            <button type="button" className="drawer-close" onClick={onClose}>
              ×
            </button>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault()
              await submit(new FormData(event.currentTarget), 'draft')
            }}
          >
            <div className="modal-body">
              {error ? <div className="mb-3 text-sm font-medium text-red">{error}</div> : null}

              <div className="field">
                <label>Campaign name</label>
                <input name="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Whitefield Premium 3BHK" required />
              </div>

              <div className="field">
                <label>Description</label>
                <textarea name="description" rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Cold outreach to leads with 1.2 Cr+ budget" />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Voice assistant</label>
                  <select name="voice_assistant" value={form.voice_assistant} onChange={(event) => setForm((current) => ({ ...current, voice_assistant: event.target.value }))}>
                    {ASSISTANTS.map((assistant) => (
                      <option key={assistant} value={assistant}>{assistant}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Script template</label>
                  <select name="script_template" value={form.script_template} onChange={(event) => setForm((current) => ({ ...current, script_template: event.target.value }))}>
                    {SCRIPT_TEMPLATES.map((template) => (
                      <option key={template} value={template}>{template}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Start</label>
                  <input name="start_date" type="datetime-local" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
                </div>
                <div className="field">
                  <label>End</label>
                  <input name="end_date" type="datetime-local" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
                </div>
              </div>

              <div className="field">
                <label>Target leads</label>
                <input name="target_filter" value={form.target_filter} onChange={(event) => setForm((current) => ({ ...current, target_filter: event.target.value }))} placeholder="Filter text: Whitefield warm 3BHK" />
              </div>
            </div>

            <div className="modal-foot">
              <button type="submit" className="btn ghost" disabled={submitting}>Save draft</button>
              <button
                type="button"
                className="btn primary"
                disabled={submitting}
                onClick={(event) => {
                  const formElement = event.currentTarget.closest('form') as HTMLFormElement | null
                  if (!formElement) return
                  void submit(new FormData(formElement), 'launch')
                }}
              >
                {submitting ? 'Saving...' : 'Launch now'}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
