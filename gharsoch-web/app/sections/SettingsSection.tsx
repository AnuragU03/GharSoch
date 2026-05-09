'use client'

import { useState, useTransition } from 'react'
import { Pill } from '@/components/Pill'
import { toast } from '@/lib/toast'
import { updateSettingAction } from '@/app/actions/settings'
import type { SystemConfig, ConfigKey, IntegrationStatus } from '@/lib/services/systemConfigService'
import type { PillVariant } from '@/components/Pill'

/* ── toggle switch ──────────────────────────────────────── */

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  id: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--accent)' : 'var(--surface-3)',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

/* ── toggle row ─────────────────────────────────────────── */

function ToggleRow({
  id,
  configKey,
  label,
  description,
  checked,
  onSave,
}: {
  id: string
  configKey: ConfigKey
  label: string
  description: string
  checked: boolean
  onSave: (key: ConfigKey, value: boolean) => Promise<void>
}) {
  const [optimistic, setOptimistic] = useState(checked)
  const [pending, startTransition] = useTransition()

  const handleChange = (newVal: boolean) => {
    const prev = optimistic
    setOptimistic(newVal) // optimistic update
    startTransition(async () => {
      try {
        await onSave(configKey, newVal)
        toast(`${label}: ${newVal ? 'Enabled' : 'Disabled'}`)
      } catch {
        setOptimistic(prev) // revert
        toast(`Failed to save "${label}". Please retry.`)
      }
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{description}</div>
      </div>
      <ToggleSwitch
        id={id}
        checked={optimistic}
        onChange={handleChange}
        disabled={pending}
      />
    </div>
  )
}

/* ── read-only row ──────────────────────────────────────── */

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 18px',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

/* ── integration row ────────────────────────────────────── */

function IntegrationRow({ integration }: { integration: IntegrationStatus }) {
  const variant: PillVariant =
    integration.status === 'connected' ? 'success' :
    integration.status === 'error' ? 'failed' : 'idle'

  const label =
    integration.status === 'connected' ? 'Connected' :
    integration.status === 'error' ? 'Error' : 'Not configured'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{integration.name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{integration.meta}</div>
      </div>
      <Pill variant={variant}>{label}</Pill>
    </div>
  )
}

/* ── panel wrapper ──────────────────────────────────────── */

function SettingsPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
      <div className="panel-body p-0">
        {children}
      </div>
    </div>
  )
}

/* ── main section ───────────────────────────────────────── */

export function SettingsSection({ config }: { config: SystemConfig }) {
  async function handleSave(key: ConfigKey, value: boolean) {
    await updateSettingAction(key, value)
  }

  const agentTriggers: Array<{ key: ConfigKey; label: string; description: string }> = [
    {
      key: 'matchmaker_on_new_client',
      label: 'Matchmaker on new client',
      description: 'Automatically run the matchmaker agent when a new client is created or a lead is converted.',
    },
    {
      key: 'price_drop_on_patch',
      label: 'Price-drop negotiator on property PATCH',
      description: 'Trigger price-drop agent when a property price is updated downward.',
    },
    {
      key: 'auto_call_hot_leads',
      label: 'Auto-call hot leads',
      description: 'Immediately initiate a Vapi call for leads scored "hot" by the matchmaker.',
    },
    {
      key: 'reasoning_summaries_enabled',
      label: 'Reasoning summaries',
      description: 'Generate natural-language reasoning summaries for each agent run (adds ~1s per run).',
    },
  ]

  return (
    <section className="page active">
      <div className="crumb">System · Settings</div>
      <div className="head">
        <div>
          <h1 className="title">Settings</h1>
          <p className="sub">Platform configuration, compliance controls, and integration status.</p>
        </div>
        {config.updated_at && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Last saved {new Date(config.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </div>
        )}
      </div>

      {/* Agent triggers */}
      <SettingsPanel title="Agent triggers">
        {agentTriggers.map(trigger => (
          <ToggleRow
            key={trigger.key}
            id={`toggle-${trigger.key}`}
            configKey={trigger.key}
            label={trigger.label}
            description={trigger.description}
            checked={config[trigger.key] as boolean}
            onSave={handleSave}
          />
        ))}
      </SettingsPanel>

      {/* Compliance */}
      <SettingsPanel title="Compliance">
        <ReadOnlyRow
          label="TRAI calling window"
          value={`${config.trai_window_start} – ${config.trai_window_end} IST`}
        />
        <ToggleRow
          id="toggle-dnc_enforcement"
          configKey="dnc_enforcement"
          label="DNC list enforcement"
          description="Block all outbound calls to numbers in the Do Not Call registry. Disabling this violates TRAI guidelines."
          checked={config.dnc_enforcement}
          onSave={handleSave}
        />
        <ReadOnlyRow
          label="Data retention"
          value={`${config.data_retention_days} days`}
        />
      </SettingsPanel>

      {/* Integrations */}
      <SettingsPanel title="Integrations">
        {config.integrations.map(integration => (
          <IntegrationRow key={integration.name} integration={integration} />
        ))}
      </SettingsPanel>
    </section>
  )
}

export default SettingsSection
