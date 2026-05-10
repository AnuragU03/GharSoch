'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

import { forceRunAgent } from '@/app/actions/agents'
import { useUserRole } from '@/lib/auth/useUserRole'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { role, can } = useUserRole()
  const canCreate = role === 'admin' || role === 'tech'

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Listen for custom event from sidebar button
  React.useEffect(() => {
    const handleOpen = () => setOpen(true)
    window.addEventListener('open-command-palette', handleOpen)
    return () => window.removeEventListener('open-command-palette', handleOpen)
  }, [])

  const navigate = (path: string) => {
    setOpen(false)
    router.push(path)
  }

  const forceRun = async (agent: string) => {
    setOpen(false)
    try {
      await forceRunAgent(agent)
      router.refresh()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => navigate('/')}>Dashboard</CommandItem>
          <CommandItem onSelect={() => navigate('/pipeline')}>Leads Pipeline</CommandItem>
          <CommandItem onSelect={() => navigate('/clients')}>Clients</CommandItem>
          <CommandItem onSelect={() => navigate('/properties')}>Properties</CommandItem>
          <CommandItem onSelect={() => navigate('/campaigns')}>Campaigns</CommandItem>
          <CommandItem onSelect={() => navigate('/appointments')}>Appointments</CommandItem>
          <CommandItem onSelect={() => navigate('/calls')}>Call Logs</CommandItem>
          <CommandItem onSelect={() => navigate('/ai-operations')}>AI Operations</CommandItem>
          <CommandItem onSelect={() => navigate('/ai-operations?tab=activity')}>Live Activity</CommandItem>
          <CommandItem onSelect={() => navigate('/kb')}>KB</CommandItem>
          <CommandItem onSelect={() => navigate('/analytics')}>Analytics</CommandItem>
          <CommandItem onSelect={() => navigate('/settings')}>Settings</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {(can.forceRun || canCreate) ? (
          <CommandGroup heading="Actions">
            {can.forceRun ? (
              <>
                <CommandItem onSelect={() => forceRun('matchmaker')}>Force Run · Matchmaker</CommandItem>
                <CommandItem onSelect={() => forceRun('followup')}>Force Run · Follow-Up</CommandItem>
                <CommandItem onSelect={() => forceRun('reengage')}>Force Run · Re-engage</CommandItem>
                <CommandItem onSelect={() => forceRun('reminders')}>Force Run · Reminders</CommandItem>
                <CommandItem onSelect={() => forceRun('price-drop')}>Force Run · Price-Drop</CommandItem>
              </>
            ) : null}
            {canCreate ? (
              <>
                <CommandItem onSelect={() => {
                  setOpen(false)
                  router.push('/clients?new=true') // We can handle this in ClientsSection to open modal
                }}>
                  New Client
                </CommandItem>
                <CommandItem onSelect={() => {
                  setOpen(false)
                  alert('New Campaign modal stub')
                }}>
                  New Campaign
                </CommandItem>
              </>
            ) : null}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
