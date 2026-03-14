import React, { useState, ReactNode, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  roles?: string[];
}

const resolveMediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { state, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const userRole = (state.user?.role || '').toUpperCase();
  const dashboardHref = state.user?.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard';
  const userInitials = `${state.user?.first_name?.[0] || ''}${state.user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const profileImageUrl = resolveMediaUrl(state.user?.profile_image || null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/home');
  };

  const navigation = useMemo<NavigationItem[]>(() => [
    { name: 'Dashboard', href: dashboardHref, icon: '📊' },
    { name: 'Donations', href: '/donations', icon: '🍲', roles: ['DONOR', 'NGO', 'VOLUNTEER'] },
    { name: 'AI Tools', href: '/ai-tools', icon: '🤖', roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
    { name: 'Create Donation', href: '/create-donation', icon: '➕', roles: ['DONOR'] },
    { name: 'My Donations', href: '/my-donations', icon: '📦', roles: ['DONOR'] },
    { name: 'Pickups', href: '/pickups', icon: '🚚', roles: ['NGO', 'VOLUNTEER'] },
    { name: 'Leaderboard', href: '/leaderboard', icon: '🏆', roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
    { name: 'Notifications', href: '/notifications', icon: '🔔', roles: ['DONOR', 'NGO', 'VOLUNTEER'] },
    { name: 'Analytics', href: '/analytics', icon: '📈', roles: ['ADMIN'] },
    { name: 'Feedback', href: '/feedback', icon: '📝', roles: ['ADMIN'] },
    { name: 'All Donations', href: '/admin-donations', icon: '🍱', roles: ['ADMIN'] },
    { name: 'All Pickups', href: '/admin-pickups', icon: '🚛', roles: ['ADMIN'] },
    { name: 'Profile', href: '/profile', icon: '👤' },
  ], [dashboardHref]);

  const filteredNavigation = useMemo(
    () => navigation.filter((item) => !item.roles || item.roles.includes(userRole)),
    [navigation, userRole],
  );

  // Pick up to 5 items for the mobile bottom tab bar: first 4 + Profile (always last)
  const bottomNavItems = useMemo(() => {
    if (filteredNavigation.length <= 5) return filteredNavigation;
    return [
      filteredNavigation[0],
      filteredNavigation[1],
      filteredNavigation[2],
      filteredNavigation[3],
      filteredNavigation[filteredNavigation.length - 1],
    ];
  }, [filteredNavigation]);

  const pageTitle = useMemo(() => {
    const currentItem = filteredNavigation.find((item) => location.pathname === item.href);
    if (currentItem) return `${currentItem.icon} ${currentItem.name}`;
    if (location.pathname.startsWith('/donations/')) return '🍲 Donation Details';
    if (location.pathname.startsWith('/pickups')) return '🚚 Pickup Management';
    if (location.pathname.startsWith('/notifications')) return '🔔 Notifications';
    if (location.pathname.startsWith('/admin-donations')) return '🍱 All Donations';
    if (location.pathname.startsWith('/admin-pickups')) return '🚛 All Pickups';
    return '🥗 FoodSave Workspace';
  }, [filteredNavigation, location.pathname]);

  const roleBadgeClass = (() => {
    switch (userRole) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700';
      case 'NGO':
        return 'bg-amber-100 text-amber-700';
      case 'VOLUNTEER':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-primary-100 text-primary-800';
    }
  })();

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50 overflow-x-hidden lg:block">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-200/30 blur-3xl animate-float-medium" />
        <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-secondary-200/35 blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-200/20 blur-3xl animate-float-fast" />
        <div className="absolute inset-0 bg-grid-mask opacity-[0.04]" />
      </div>
      <nav className="sticky top-0 z-40 shrink-0 border-b border-white/60 bg-white/80 backdrop-blur-xl shadow-sm lg:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <Link to={dashboardHref} className="inline-flex items-center gap-2 text-2xl font-bold text-primary-700">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-100 text-primary-700">🥗</span>
                <span>FoodSave</span>
              </Link>
            </div>

            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg
                  className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} border-t border-gray-100 bg-white/95 backdrop-blur`}>
          <div className="pt-2 pb-3 px-2 space-y-1">
            {filteredNavigation.map((item) => (
              <Link
                key={`${item.href}-${item.name}`}
                to={item.href}
                className={`block px-3 py-2.5 rounded-lg text-base font-medium transition-all ${
                  isActive(item.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-gray-200 overflow-hidden bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
                <div>
                  <div className="text-base font-medium text-gray-800">{state.user?.full_name}</div>
                  <div className="text-sm text-gray-500">{state.user?.email}</div>
                </div>
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass}`}>
                  {state.user?.role}
                </span>
              </div>
            </div>
            <div className="mt-3 px-2">
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2.5 rounded-xl text-base font-semibold text-red-600 hover:bg-red-50 min-h-[44px]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="hidden lg:flex h-screen">
        <aside className={`${isSidebarCollapsed ? 'w-24' : 'w-72'} shrink-0 border-r border-white/70 bg-white/85 backdrop-blur-xl shadow-sm transition-all duration-300`}>
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="px-4 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between gap-2">
                <Link to={dashboardHref} className={`inline-flex items-center ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-2'} text-2xl font-bold text-primary-700`}>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-100 text-primary-700">🥗</span>
                  {!isSidebarCollapsed ? <span>FoodSave</span> : null}
                </Link>
                {!isSidebarCollapsed ? (
                  <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Collapse sidebar"
                  >
                    ‹
                  </button>
                ) : null}
              </div>
              {isSidebarCollapsed ? (
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Expand sidebar"
                >
                  ›
                </button>
              ) : null}
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
              {filteredNavigation.map((item) => (
                <Link
                  key={`${item.href}-${item.name}`}
                  to={item.href}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isSidebarCollapsed ? 'justify-center' : ''
                  } ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <span>{item.icon}</span>
                  {!isSidebarCollapsed ? <span>{item.name}</span> : null}
                </Link>
              ))}
            </nav>

            <div className="border-t border-gray-100 px-4 py-4">
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3`}>
                <div className="w-10 h-10 rounded-full border border-gray-200 overflow-hidden bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
                {!isSidebarCollapsed ? (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{state.user?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{state.user?.email}</p>
                  </div>
                ) : null}
              </div>

              <div className={`mt-3 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
                {!isSidebarCollapsed ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass}`}>
                    {state.user?.role}
                  </span>
                ) : null}
                <button
                  onClick={handleLogout}
                  title={isSidebarCollapsed ? 'Logout' : undefined}
                  className={`inline-flex min-h-[38px] items-center bg-red-600 hover:bg-red-700 text-white ${isSidebarCollapsed ? 'px-3 py-2' : 'px-3.5 py-2'} rounded-lg text-xs font-semibold transition-colors`}
                >
                  {isSidebarCollapsed ? '↩' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 overflow-y-auto">
          <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center justify-between px-8 py-4">
              <p className="text-sm font-medium text-gray-500">{pageTitle}</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 font-medium">Hi, {state.user?.first_name}</span>
                <div className="w-9 h-9 rounded-full border border-gray-200 overflow-hidden bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="px-8 py-7">
            {children}
          </main>
        </div>
      </div>

      <main className="lg:hidden flex-1 overflow-y-auto">
        <div className="px-4 pt-5 pb-24 sm:px-6">
          {children}
        </div>
      </main>

      {/* ===== Mobile Bottom Navigation Bar ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch h-16">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-semibold transition-colors ${
                isActive(item.href)
                  ? 'text-primary-600 bg-primary-50/70'
                  : 'text-gray-500 hover:text-gray-700 active:bg-gray-100'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="leading-tight max-w-[56px] text-center truncate">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
