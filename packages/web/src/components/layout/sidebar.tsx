import { Link, useLocation } from 'react-router'
import { FolderKanban, Workflow, Globe, Bot, Users, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserMenu } from './user-menu'

const navItems = [
  { to: '/projects', label: '项目', icon: FolderKanban },
  { to: '/explore', label: '探索', icon: Globe },
  { to: '/settings/agents', label: 'Agent 配置', icon: Bot },
  { to: '/settings/agent-roles', label: 'Agent 角色', icon: Users },
  { to: '/settings/skills', label: 'Skills', icon: FileText },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
  mobile?: boolean
}

export function Sidebar({ open, onClose, mobile }: SidebarProps) {
  const location = useLocation()

  const handleNavClick = () => {
    if (mobile && onClose) onClose()
  }

  const sidebarContent = (
    <aside className={cn(
      'flex h-full flex-col border-r bg-card',
      mobile ? 'w-4/5 max-w-[300px]' : 'w-64'
    )}>
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold" onClick={handleNavClick}>
          <Workflow className="h-5 w-5 text-primary" />
          <span>WorkGear</span>
        </Link>
        {mobile && (
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground"
            aria-label="关闭导航"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 font-medium transition-colors',
                mobile ? 'h-11 text-base' : 'py-2 text-sm',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-3">
        <UserMenu />
      </div>
    </aside>
  )

  // Mobile: drawer overlay
  if (mobile) {
    return (
      <>
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={onClose}
          />
        )}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </div>
      </>
    )
  }

  // Desktop: static sidebar
  return sidebarContent
}
