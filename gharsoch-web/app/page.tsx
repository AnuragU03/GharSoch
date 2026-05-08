import dynamic from 'next/dynamic'

const AppContent = dynamic(() => import('./sections/AppContent'), { ssr: false })

export default function Page() {
  return <AppContent />
}
