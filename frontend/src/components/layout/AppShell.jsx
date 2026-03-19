import { Menu, LayoutDashboard, Tickets, PlusSquare, User, Settings, BarChart3, BookOpenText, LogOut, X, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tickets', label: 'Chamados', icon: Tickets },
  { to: '/tickets/new', label: 'Novo chamado', icon: PlusSquare },
  { to: '/users', label: 'Gestao de usuarios', icon: Users, roles: ['admin', 'manager', 'attendant'] },
  { to: '/reports', label: 'Relatorios', icon: BarChart3, roles: ['admin', 'manager'] },
  { to: '/knowledge', label: 'Base de conhecimento', icon: BookOpenText },
  { to: '/profile', label: 'Perfil', icon: User },
  { to: '/settings', label: 'Configuracoes', icon: Settings, roles: ['admin', 'manager', 'attendant'] },
]

const pageTitles = {
  '/dashboard': 'Painel principal',
  '/tickets': 'Chamados',
  '/tickets/new': 'Abertura de chamado',
  '/users': 'Gestao de usuarios',
  '/reports': 'Relatorios',
  '/knowledge': 'Base de conhecimento',
  '/profile': 'Perfil do usuario',
  '/settings': 'Configuracoes da plataforma',
}

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { user, logout, hasRole } = useAuth()

  const items = useMemo(
    () => navigationItems.filter((item) => !item.roles || hasRole(item.roles)),
    [hasRole],
  )

  const title = useMemo(() => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname]
    }

    if (location.pathname.startsWith('/tickets/')) {
      return 'Detalhes do chamado'
    }

    return 'HelpDesk'
  }, [location.pathname])

  const renderNavItems = () =>
    items.map((item) => {
      const Icon = item.icon
      return (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            [
              'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-white/20 text-white shadow-lg shadow-black/20'
                : 'text-slate-200/80 hover:bg-white/10 hover:text-white',
            ].join(' ')
          }
        >
          <Icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
          {item.label}
        </NavLink>
      )
    })

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.14),_transparent_36%)]" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-white/10 bg-slate-900/80 p-6 backdrop-blur-lg lg:flex">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.24em] text-teal-300/80">HelpDesk Pro</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Central de atendimento</h1>
          </div>

          <nav className="flex flex-1 flex-col gap-2">{renderNavItems()}</nav>

          <div className="panel-surface mt-6 border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-teal-300/70">Sessao ativa</p>
            <div className="mt-3 flex items-center gap-3">
              <img
                src={user?.avatarUrl}
                alt="Avatar do usuario"
                className="h-10 w-10 rounded-xl border border-white/20 object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-xs text-slate-300">Perfil: {user?.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn-ghost mt-4 w-full justify-center border-white/20 text-slate-100 hover:bg-white/10"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((current) => !current)}
                  className="inline-flex rounded-lg border border-white/10 p-2 text-slate-100 lg:hidden"
                  aria-label="Abrir menu"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-teal-300/80">Painel</p>
                  <h2 className="text-lg font-semibold text-white sm:text-xl">{title}</h2>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 sm:inline-flex">
                <img
                  src={user?.avatarUrl}
                  alt="Avatar"
                  className="h-7 w-7 rounded-lg border border-white/20 object-cover"
                />
                {user?.name}
              </div>
            </div>
          </header>

          {mobileMenuOpen ? (
            <div className="border-b border-white/10 bg-slate-900/95 px-4 pb-4 pt-2 backdrop-blur-lg lg:hidden">
              <nav className="grid gap-2">{renderNavItems()}</nav>
              <button
                type="button"
                onClick={logout}
                className="btn-ghost mt-3 w-full justify-center border-white/20 text-slate-100 hover:bg-white/10"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
