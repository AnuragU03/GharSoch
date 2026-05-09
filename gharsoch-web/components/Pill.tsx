import { cn } from '@/lib/utils'

export type PillVariant = 'success' | 'failed' | 'running' | 'idle' | 'warm' | 'violet' | 'amber'

export function Pill({
  variant,
  children,
  className,
}: {
  variant: PillVariant
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn('pill', variant, className)}>{children}</span>
}
