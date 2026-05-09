'use client'

import { useEffect, useState } from 'react'

const HELP_SECTIONS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'agents', label: 'The 9 agents' },
  { id: 'dashboard', label: 'Reading the dashboard' },
  { id: 'campaigns', label: 'Creating campaigns' },
  { id: 'knowledge-base', label: 'Knowledge Base' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'support', label: 'Contact support' },
]

export function getPlatformShortcut(platform: string) {
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘K' : 'Ctrl+K'
}

export function PlatformShortcut() {
  const [shortcut, setShortcut] = useState('⌘K')

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    setShortcut(getPlatformShortcut(nav.userAgentData?.platform || navigator.platform || navigator.userAgent))
  }, [])

  return <>{shortcut}</>
}

export function HelpNav() {
  const [activeId, setActiveId] = useState(HELP_SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible?.target.id) {
          setActiveId(visible.target.id)
        }
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: [0.1, 0.35, 0.6] }
    )

    HELP_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <nav className="help-nav" aria-label="Help table of contents">
      <div className="nav-label">Contents</div>
      {HELP_SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={activeId === section.id ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault()
            document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            history.replaceState(null, '', `#${section.id}`)
            setActiveId(section.id)
          }}
        >
          {section.label}
        </a>
      ))}
    </nav>
  )
}
