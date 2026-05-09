'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

import { promoteToBrokerAction } from '@/app/actions/users'
import { toast } from '@/lib/toast'
import type { SerializedBrokerage, SerializedUser } from '@/lib/services/userService'

export type AssistantOption = {
  label: string
  id: string
}

export function PromoteToBrokerModal({
  user,
  brokerages,
  assistantOptions,
  open,
  onClose,
}: {
  user: SerializedUser | null
  brokerages: SerializedBrokerage[]
  assistantOptions: AssistantOption[]
  open: boolean
  onClose: () => void
}) {
  const [brokerageName, setBrokerageName] = useState('')
  const [city, setCity] = useState('')
  const [assistantId, setAssistantId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const datalistId = useMemo(() => `brokerage-options-${user?._id || 'new'}`, [user?._id])

  useEffect(() => {
    if (!open) return
    setBrokerageName('')
    setCity('')
    setAssistantId(assistantOptions[0]?.id || '')
    setNotes('')
    setError('')
  }, [assistantOptions, open])

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-[560px]">
        <DialogTitle className="sr-only">Promote user to broker</DialogTitle>
        <DialogDescription className="sr-only">
          Assign this pending user to an existing or new brokerage and activate their broker account.
        </DialogDescription>
        <div className="modal-card">
          <div className="modal-head">
            <div>
              <h3>Promote to broker</h3>
              <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                Assign {user.name || user.email} to a brokerage workspace.
              </p>
            </div>
            <button type="button" className="drawer-close" onClick={onClose}>
              ×
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              setError('')

              if (!brokerageName.trim() || !city.trim() || !assistantId) {
                setError('Brokerage name, city, and assistant are required.')
                return
              }

              startTransition(async () => {
                const result = await promoteToBrokerAction(user._id, {
                  name: brokerageName,
                  city,
                  vapi_assistant_id: assistantId,
                  notes,
                })

                if (!result.ok) {
                  setError(result.error)
                  toast.error(result.error || 'Could not promote user.')
                  return
                }

                toast.success(`${user.name || user.email} promoted to broker for ${brokerageName}`)
                onClose()
              })
            }}
          >
            <div className="modal-body">
              {error ? <div className="mb-3 text-sm font-medium text-red">{error}</div> : null}

              <div className="field">
                <label>Brokerage name</label>
                <input
                  list={datalistId}
                  value={brokerageName}
                  onChange={(event) => setBrokerageName(event.target.value)}
                  placeholder="Sunrise Realty"
                  required
                />
                <datalist id={datalistId}>
                  {brokerages.map((brokerage) => (
                    <option key={brokerage._id} value={brokerage.name} />
                  ))}
                </datalist>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>City</label>
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Bangalore"
                    required
                  />
                </div>
                <div className="field">
                  <label>Vapi assistant</label>
                  <select
                    value={assistantId}
                    onChange={(event) => setAssistantId(event.target.value)}
                    required
                  >
                    {assistantOptions.length === 0 ? (
                      <option value="">No assistant IDs configured</option>
                    ) : (
                      assistantOptions.map((assistant) => (
                        <option key={assistant.id} value={assistant.id}>
                          {assistant.label} · {assistant.id}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional onboarding context for this brokerage..."
                />
              </div>

              <div className="rounded-lg bg-warm-soft px-3 py-2 text-sm text-warm">
                This activates the user immediately. Their next session refresh will land in the broker workspace.
              </div>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={onClose} disabled={isPending}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={isPending}>
                {isPending ? 'Promoting...' : 'Promote & assign brokerage'}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
