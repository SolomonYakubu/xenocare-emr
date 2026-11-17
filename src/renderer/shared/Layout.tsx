import React, { useState, useMemo, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Sun,
  Moon,
  Sparkles,
  Table2,
  Waves,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { menuItems as staticMenuItems } from '../config/menu';
import { useDynamicMenuItems } from '../hooks/useDynamicMenuItems';
import { NotificationBell } from '../components/ui/NotificationBell';
import { useTimeTheme } from '../hooks/useTimeTheme';
import { useUnreadCount } from '../modules/messaging/hooks/useMessaging';
import { GlobalPatientSearch } from '../components/shared/GlobalPatientSearch';
import {
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  useAppearance,
} from '../hooks/useAppearance';

interface SidebarItemProps {
  to: string;
  icon: React.ComponentType<{
    className?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  label: string;
  collapsed?: boolean;
  onClick?: () => void;
  /** Optional image source to use instead of icon */
  imageSrc?: string;
  /** Optional badge count to display */
  badge?: number;
}

function SidebarItem({
  to,
  icon: Icon,
  label,
  collapsed,
  onClick,
  isCrystalMode,
  surfaceDeep,
  imageSrc,
  badge,
}: SidebarItemProps & { isCrystalMode?: boolean; surfaceDeep?: boolean }) {
  const location = useLocation();
  // For root path, use exact match; for others, use startsWith
  const isActive =
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // Badge component
  const BadgeComponent =
    badge && badge > 0 ? (
      <span
        className={`absolute ${collapsed ? 'top-0 right-0' : 'top-1/2 -translate-y-1/2 right-3'} min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1 shadow-md`}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    ) : null;

  // Crystal mode - soft cream background with emerald accents
  if (isCrystalMode) {
    return (
      <Link
        to={to}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`flex items-center ${collapsed ? 'justify-center' : ''} px-3 py-2.5 rounded-[1.1rem] transition-all duration-300 group relative antialiased ${
          isActive
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-700/25 ring-1 ring-white/25'
            : 'text-stone-800 hover:bg-white/80 hover:text-[#11151C] hover:shadow-md hover:shadow-stone-200/80'
        }`}
      >
        <div
          className={`${collapsed ? '' : 'mr-3'} ${isActive ? '' : 'group-hover:scale-105'} transition-transform duration-200`}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={label}
              className="w-5 h-5 object-contain flex-shrink-0"
            />
          ) : (
            <Icon
              size={20}
              className="flex-shrink-0"
              strokeWidth={isActive ? 2.25 : 2}
            />
          )}
        </div>
        {!collapsed && (
          <span
            className={`text-[15px] leading-snug tracking-tight ${isActive ? 'font-bold' : 'font-semibold'} ${isActive ? '' : 'group-hover:font-bold'} transition-all duration-200 [text-rendering:optimizeLegibility]`}
          >
            {label}
          </span>
        )}
        {collapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-stone-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl">
            {label}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-stone-800 rotate-45" />
          </div>
        )}
        {!isActive && BadgeComponent}
        {isActive && !collapsed && !badge && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] ring-1 ring-emerald-900/10" />
        )}
      </Link>
    );
  }

  // Deep sidebar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â teal / navy / night gradient (matches main clinical banners)
  if (surfaceDeep) {
    return (
      <Link
        to={to}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`flex items-center antialiased ${collapsed ? 'justify-center px-2' : 'px-3.5 mx-1.5'} py-2.5 rounded-[1.1rem] transition-all duration-200 group relative ${
          isActive
            ? 'bg-[#E9783F] text-white shadow-[0_10px_24px_-10px_rgba(255,90,31,0.8)] ring-1 ring-white/25 font-bold'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
        }`}
      >
        <div
          className={`${collapsed ? '' : 'mr-3'} shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={label}
              className="w-[19px] h-[19px] object-contain brightness-110"
            />
          ) : (
            <Icon
              size={19}
              strokeWidth={isActive ? 2.35 : 2.05}
              className="flex-shrink-0"
            />
          )}
        </div>
        {!collapsed && (
          <span className="text-[14px] sm:text-[14.5px] leading-snug tracking-tight whitespace-nowrap [text-rendering:optimizeLegibility]">
            {label}
          </span>
        )}
        {collapsed && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-slate-700">
            {label}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-slate-700" />
          </div>
        )}
        {!isActive && BadgeComponent}
        {isActive && !collapsed && !badge && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.9)] ring-1 ring-white/40" />
        )}
      </Link>
    );
  }

  // Fallback light rail (only if neither crystal nor deep)
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center antialiased ${collapsed ? 'justify-center' : ''} px-4 py-2.5 transition-all duration-200 group relative rounded-[1.1rem] mx-1.5 shadow-sm ${
        isActive
          ? 'bg-[#E9783F]/10 text-[#11151C] border border-[#E9783F]/25 font-bold shadow-md'
          : 'text-slate-700 hover:bg-white hover:text-slate-900 border border-transparent font-semibold hover:shadow'
      }`}
    >
      <div
        className={`${collapsed ? '' : 'mr-3'} ${isActive ? 'text-[#11151C]' : 'text-slate-400 group-hover:text-[#11151C]'}`}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={label}
            className="w-5 h-5 object-contain flex-shrink-0"
          />
        ) : (
          <Icon size={20} className="flex-shrink-0" />
        )}
      </div>
      {!collapsed && (
        <span className="text-[15px] font-semibold tracking-tight [text-rendering:optimizeLegibility]">
          {label}
        </span>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl">
          {label}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45" />
        </div>
      )}
      {BadgeComponent}
    </Link>
  );
}

function PreferenceToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  isNightMode,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  isNightMode: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
        isNightMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon
          size={14}
          className={isNightMode ? 'text-slate-400' : 'text-slate-500'}
        />
        <span>
          <span
            className={`block text-xs font-semibold ${
              isNightMode ? 'text-slate-200' : 'text-slate-700'
            }`}
          >
            {label}
          </span>
          {description && (
            <span
              className={`block text-[11px] ${
                isNightMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {description}
            </span>
          )}
        </span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked
            ? 'bg-[#E9783F]'
            : isNightMode
              ? 'bg-slate-600'
              : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function Layout() {
  const { user, signOut, canAccessModule, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Dev-only E2E hook so the module sweep can exercise routes that are not
  // exposed in the sidebar (Queue, Profile, Sync Center).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      (
        window as unknown as {
          __xenoNavigate?: typeof navigate;
          __xenoSignOut?: typeof signOut;
        }
      ).__xenoNavigate = navigate;
      (
        window as unknown as {
          __xenoSignOut?: typeof signOut;
        }
      ).__xenoSignOut = signOut;
    }
  }, [navigate, signOut]);

  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('xenocare.sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem(
          'xenocare.sidebar-collapsed',
          next ? '1' : '0',
        );
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  // User-adjustable text size, table density and motion preferences.
  const {
    textSize,
    compactTables,
    reduceMotion,
    setTextSize,
    setCompactTables,
    setReduceMotion,
    resetAppearance,
  } = useAppearance();

  // Get dynamic menu items based on user's specialty
  const { menuItems } = useDynamicMenuItems();

  // Get unread message count - only when authenticated
  const unreadQuery = useUnreadCount();
  const unreadMessageCount = unreadQuery.data ?? 0;

  // Filter navigation items based on user permissions
  const accessibleNavItems = menuItems.filter((item) =>
    canAccessModule(item.module),
  );

  // Get current page title (use static items for title lookup to avoid flicker)
  const getCurrentTitle = () => {
    // First try dynamic items, then fall back to static
    const currentItem =
      menuItems.find((item) => location.pathname.startsWith(item.to)) ||
      staticMenuItems.find((item) => location.pathname.startsWith(item.to));
    return currentItem?.label || 'Dashboard';
  };

  // Get user initials
  const getUserInitials = () => {
    if (!user) return 'U';
    const name = user.user_metadata?.full_name || user.email || '';
    const parts = name.split(/[\s@]/);
    return parts
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() || '')
      .join('');
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'Guest';
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  };

  // Get user role display
  const getUserRole = () => {
    if (!user) return 'Guest';
    const role = user.user_metadata?.role || 'user';
    return role
      .split('_')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Get time-based theme
  const {
    colors: themeColors,
    isNightMode,
    themeMode,
    setThemeMode,
    toggleTheme,
  } = useTimeTheme();

  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Sync Tailwind dark: variants with the app's night mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isNightMode);
  }, [isNightMode]);

  const isCrystalMode = themeMode === 'crystal';
  const surfaceDeep = !isCrystalMode;

  const sidebarShellClass = useMemo(() => {
    const width =
      'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';
    return `${width} bg-white border-r border-slate-200/80`;
  }, []);

  const sidebarElevation = useMemo(
    () => '',
    [],
  );

  return (
    <div
      className="flex h-screen min-h-0 w-full min-w-0 overflow-x-hidden bg-[#F5F5F7]"
    >
      {/* Sidebar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â compact width, soft geometry, floating shadow stack */}
      <aside
        className={`${
          sidebarCollapsed
            ? 'w-[3.75rem]'
            : 'w-[13.5rem] sm:w-[14.5rem] lg:w-[15rem]'
        } max-h-screen flex flex-col shrink-0 relative z-20 overflow-hidden antialiased [text-rendering:optimizeLegibility] ${sidebarElevation} ${sidebarShellClass}`}
      >
        <div
          className={`flex-shrink-0 border-b ${
            isCrystalMode
              ? 'border-stone-200/70 bg-white/55'
              : 'border-slate-200 bg-white'
          } ${sidebarCollapsed ? 'px-2 pt-3 pb-2.5' : 'px-3 pt-3.5 pb-3'}`}
        >
          <div
            className={`flex ${sidebarCollapsed ? 'flex-col items-center gap-2.5' : 'items-center gap-2.5'}`}
          >
            {sidebarCollapsed ? (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#E9783F]/10 text-[9px] font-black uppercase tracking-[0.08em] text-[#D96A36]">
                XC
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold tracking-tight text-slate-900">
                  XenoCare
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={
                sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-all duration-200 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.25)] ${
                isCrystalMode
                  ? 'border-stone-200/90 bg-white text-[#11151C] hover:bg-[#E9783F]/10 hover:shadow-lg'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:shadow-sm'
              }`}
            >
              {sidebarCollapsed ? (
                <ChevronRight size={18} strokeWidth={2.35} />
              ) : (
                <ChevronLeft size={18} strokeWidth={2.35} />
              )}
            </button>
          </div>
        </div>

        <nav
          className={`mt-0.5 flex-1 overflow-y-auto space-y-1 px-1.5 pb-3 scrollbar-thin ${
            'scrollbar-thumb-slate-200'
          }`}
        >
          {accessibleNavItems.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={sidebarCollapsed}
              isCrystalMode={isCrystalMode}
              surfaceDeep={surfaceDeep}
              imageSrc={item.imageSrc}
              badge={item.to === '/messaging' ? unreadMessageCount : undefined}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col pb-5 pt-1 px-1.5">
          <button
            type="button"
            onClick={handleSignOut}
            className={`flex items-center antialiased ${sidebarCollapsed ? 'justify-center px-2' : 'mx-0 px-3'} py-2.5 text-[15px] font-semibold transition-all duration-200 group rounded-[1.1rem] border border-transparent [text-rendering:optimizeLegibility] ${
              isCrystalMode
                ? 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 hover:shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LogOut
              size={18}
              strokeWidth={2.05}
              className={`shrink-0 ${sidebarCollapsed ? '' : 'mr-2.5'} opacity-90 group-hover:opacity-100`}
            />
            {!sidebarCollapsed && (
              <span className="tracking-tight">Sign Out</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â tight gutter next to sidebar; tinted shell matches teal clinical UI */}
      <div
        className={`flex-1 flex flex-col overflow-hidden min-w-0 ${
          isCrystalMode
            ? 'bg-[#f4f7f6]'
            : isNightMode
              ? 'bg-slate-950'
              : themeMode === 'navy'
                ? 'bg-[#f4f7f6]'
                : 'bg-[#F7F6F3]'
        }`}
      >
        <header
          className={`shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-40 sticky top-0 shrink-0 min-w-0 ${isNightMode ? 'bg-slate-800' : 'bg-white'}`}
        >
          <div className="px-3 sm:px-5 md:px-6 py-3 sm:py-3.5 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:justify-between min-[520px]:items-center min-h-[4rem] sm:min-h-[4.5rem] min-w-0">
            {/* Left side Search */}
            <div className="w-full min-w-0 min-[520px]:flex-1 min-[520px]:max-w-xl">
              <div className="relative group min-w-0">
                <Search
                  className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-[18px] w-[18px] transition-colors ${isNightMode ? 'text-slate-400' : 'text-slate-400 group-hover:text-emerald-600'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowGlobalSearch(true)}
                  className={`pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 w-full min-w-0 text-left rounded-xl text-sm transition-all flex items-center justify-between font-medium outline-none ring-0 ${
                    isNightMode
                      ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      : 'bg-[#f8f9fa] text-slate-500 hover:bg-[#f0f2f1]'
                  }`}
                >
                  <span className="truncate pr-2">
                    Search patients, records or pages
                  </span>
                </button>
              </div>
            </div>

            {/* Right side Actions */}
            <div className="flex items-center justify-end gap-2 sm:gap-4 md:gap-6 shrink-0 self-end min-[520px]:self-auto w-full min-[520px]:w-auto">
              <div className="flex items-center gap-2 sm:gap-4">
                <NotificationBell />
              </div>

              <div
                className={`hidden min-[520px]:block h-6 w-px shrink-0 ${isNightMode ? 'bg-slate-600' : 'bg-slate-200'}`}
              />

              {/* Header User Avatar + Profile Menu */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Open user menu"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 rounded-full bg-[#E9783F] overflow-hidden border-2 border-white flex items-center justify-center text-white font-bold"
                >
                  {getUserInitials()}
                </button>

                {showUserMenu && (
                  <div
                    className={`absolute right-0 top-12 z-50 max-h-[80vh] w-72 overflow-y-auto rounded-2xl border shadow-xl ${isNightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                  >
                    <div
                      className={`px-4 py-3 ${isNightMode ? 'border-b border-slate-700' : 'border-b border-slate-100'}`}
                    >
                      <p
                        className={`text-sm font-semibold ${isNightMode ? 'text-slate-100' : 'text-slate-800'}`}
                      >
                        {getUserDisplayName()}
                      </p>
                      <p
                        className={`text-xs ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        {getUserRole()}
                      </p>
                    </div>

                    <div className="px-4 py-3">
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        Theme
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setThemeMode('auto')}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${themeMode === 'auto' ? 'bg-[#E9783F] text-white' : isNightMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Sun size={12} />
                            Auto
                          </span>
                        </button>
                        <button
                          onClick={() => setThemeMode('navy')}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${themeMode === 'navy' ? 'bg-[#E9783F] text-white' : isNightMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Moon size={12} />
                            Navy
                          </span>
                        </button>
                        <button
                          onClick={() => setThemeMode('crystal')}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${themeMode === 'crystal' ? 'bg-[#E9783F] text-white' : isNightMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Sparkles size={12} />
                            UI
                          </span>
                        </button>
                      </div>

                      <button
                        onClick={toggleTheme}
                        className={`w-full mt-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${isNightMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        Cycle Theme Mode
                      </button>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p
                            className={`text-xs font-semibold uppercase tracking-wide ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
                          >
                            Text size
                          </p>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${isNightMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'}`}
                          >
                            {textSize}px
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
                          >
                            A
                          </span>
                          <input
                            type="range"
                            min={TEXT_SIZE_MIN}
                            max={TEXT_SIZE_MAX}
                            step={1}
                            value={textSize}
                            onChange={(event) =>
                              setTextSize(Number(event.target.value))
                            }
                            aria-label="Text size"
                            className="h-1.5 w-full cursor-pointer accent-[#E9783F]"
                          />
                          <span
                            className={`text-base font-bold ${isNightMode ? 'text-slate-200' : 'text-slate-700'}`}
                          >
                            A
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <PreferenceToggle
                          icon={Table2}
                          label="Compact tables"
                          description="Tighter rows in data tables"
                          checked={compactTables}
                          onChange={setCompactTables}
                          isNightMode={isNightMode}
                        />
                        <PreferenceToggle
                          icon={Waves}
                          label="Reduce motion"
                          description="Turn off transitions and animation"
                          checked={reduceMotion}
                          onChange={setReduceMotion}
                          isNightMode={isNightMode}
                        />
                      </div>

                      <button
                        onClick={resetAppearance}
                        className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${isNightMode ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                      >
                        <RotateCcw size={12} />
                        Reset appearance
                      </button>
                    </div>

                    <div
                      className={`px-2 py-2 ${isNightMode ? 'border-t border-slate-700' : 'border-t border-slate-100'}`}
                    >
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          void handleSignOut();
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isNightMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Global Search Modal */}
        <GlobalPatientSearch
          externalOpen={showGlobalSearch}
          setExternalOpen={setShowGlobalSearch}
        />

        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full min-w-0 bg-transparent ${
            isCrystalMode
              ? 'px-4 sm:px-5 md:px-6 pt-3 pb-6 sm:pb-8'
              : isNightMode
                ? 'px-3 sm:px-5 md:px-6 pt-3 pb-6 sm:pb-8'
                : themeMode === 'navy'
                  ? 'px-3 sm:px-5 md:px-6 pt-3 pb-6 sm:pb-8'
                  : 'px-3 sm:px-4 md:px-5 lg:px-6 pt-2 sm:pt-3 pb-6 sm:pb-8'
          }`}
        >
          <div className="w-full min-w-0 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
