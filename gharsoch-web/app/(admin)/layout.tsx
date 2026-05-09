import { Sidebar } from '@/components/Sidebar'
import { CommandPalette } from '@/components/CommandPalette'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="shell bg-bg">
      <Sidebar />
      <main className="main min-w-0">{children}</main>
      <CommandPalette />
    </div>
  )
}
