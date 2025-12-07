import {
  ClipboardList,
  Cog,
  Database,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles?: ('admin' | 'planner' | 'line_leader' | 'viewer')[];
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout, hasRole } = useAuth();

  const navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: <LayoutGrid className="w-5 h-5" /> },
    {
      path: '/production',
      label: 'Log Production',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      path: '/orders',
      label: 'Production Orders',
      icon: <ClipboardList className="w-5 h-5" />,
      roles: ['admin', 'planner'],
    },
    {
      path: '/parts',
      label: 'Parts Catalog',
      icon: <Package className="w-5 h-5" />,
      roles: ['admin', 'planner'],
    },
    {
      path: '/machines',
      label: 'Machine Admin',
      icon: <Cog className="w-5 h-5" />,
      roles: ['admin'],
    },
    {
      path: '/master-data',
      label: 'Master Data',
      icon: <Database className="w-5 h-5" />,
      roles: ['admin', 'line_leader'],
    },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.some((role) => hasRole(role))
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}
      >
        {/* Sidebar Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-slate-100 rounded"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
          {sidebarOpen && <span className="ml-3 font-semibold text-slate-800">Molding Shop</span>}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-2 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200">
          {user && sidebarOpen && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 capitalize">{user.role}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}
