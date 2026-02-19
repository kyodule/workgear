import { useState } from 'react'
import { Outlet } from 'react-router'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { UserMenu } from './user-menu'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { cn } from '@/lib/utils'

export function MainLayout() {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile sidebar drawer */}
      {isMobile && (
        <Sidebar
          mobile
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground"
              aria-label="打开导航"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-lg font-semibold">WorkGear</span>
            <div className="w-11">
              <UserMenu />
            </div>
          </header>
        )}

        <main className={cn('flex-1 overflow-auto', isMobile && 'pt-14')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
