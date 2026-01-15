import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { GlobalLoadingShadow } from '@/components/ui/loading-shadow'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  component: AdminRoot,
})

function AdminRoot() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <GlobalLoadingShadow />
    </div>
  )
}
