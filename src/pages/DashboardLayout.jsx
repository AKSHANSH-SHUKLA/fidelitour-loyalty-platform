import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import BranchSelectorBar from '../components/BranchSelectorBar';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Users, QrCode, LogOut, BarChart3, Settings2, Palette,
  Database, BrainCircuit, Megaphone, MapPin, Sparkles, CreditCard, Shield, History, ChevronDown
} from 'lucide-react';
import { C, themeForRole, AmbientBackdrop } from '../components/PageShell';

/* =====================================================================
   DashboardLayout — the shell used by every authenticated page.

   Role-aware: the sidebar's brand mark, active-nav glow, and role pill
   shift their gradient to match the role theme defined in PageShell, so
   admin / owner / staff each get a visually distinct identity while
   sharing the same layout chassis.
   ===================================================================== */

// Resolves whether a given nav row is "active" given the current path.
// /dashboard and /admin are exact-match (otherwise they'd swallow every
// child route); everything else uses startsWith so subpages stay lit.
const isNavActive = (currentPath, target) => {
  if (target === '/dashboard' || target === '/admin') return currentPath === target;
  return currentPath === target || currentPath.startsWith(target + '/');
};

/* ─── Expandable sidebar Settings entry ───────────────────────────────
 * Click "Settings" → expand a dropdown of section anchors. Picking any
 * item navigates straight to /dashboard/settings#settings-{anchor},
 * which the Settings page scroll-aligns automatically.
 *
 * Clicking the parent again collapses the submenu. Auto-opens when the
 * user is already on /dashboard/settings.
 * ─────────────────────────────────────────────────────────────────── */
const SETTINGS_SECTIONS = [
  { anchor: 'settings-profile',  label: '🏪 Profil de l\'entreprise' },
  { anchor: 'settings-join',     label: '🔗 Lien d\'inscription' },
  { anchor: 'settings-geo',      label: '📍 Géolocalisation' },
  { anchor: 'settings-status',   label: '👥 Statut des clients' },
  { anchor: 'settings-dayparts', label: '⏰ Périodes de la journée' },
  { anchor: 'settings-hours',    label: '📅 Horaires & jours fériés' },
  { anchor: 'settings-tiers',    label: '🏆 Paliers de fidélité' },
  { anchor: 'settings-welcome',  label: '🎁 Message de bienvenue' },
  { anchor: 'settings-auto',     label: '🤖 Campagnes automatiques' },
  { anchor: 'settings-points',   label: '💰 Règle de points' },
  { anchor: 'settings-team',     label: '👥 Équipe & accès' },
  { anchor: 'settings-cleanup',  label: '🧹 Nettoyer clients inactifs' },
];

const SettingsNavLink = ({ icon: Icon, currentPath, role }) => {
  const active = isNavActive(currentPath, '/dashboard/settings');
  const theme = themeForRole(role);
  const [open, setOpen] = React.useState(active);
  // If the user lands ON the settings page later, auto-expand for them.
  React.useEffect(() => { if (active) setOpen(true); }, [active]);

  const toggle = (e) => {
    // A bare click on the row toggles the dropdown only — does NOT navigate.
    // The user can still hit the small "↗" pill to jump to the top of the page.
    e.preventDefault();
    setOpen((v) => !v);
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="w-full relative group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all"
        style={{
          color: active ? C.inkDeep : C.inkMute,
          background: active ? 'rgba(255,255,255,0.6)' : 'transparent',
          boxShadow: active ? '0 1px 2px rgba(28,25,23,0.04)' : 'none',
        }}
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
            style={{ background: `linear-gradient(180deg, ${theme.from}, ${theme.to})` }}
          />
        )}
        <span
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: active
              ? `linear-gradient(135deg, ${theme.from}1A, ${theme.to}1A)`
              : 'transparent',
            color: active ? theme.from : C.inkMute,
            border: active ? `1px solid ${theme.from}33` : '1px solid transparent',
          }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="truncate flex-1 text-left">Settings</span>
        <span
          aria-hidden="true"
          className="transition-transform shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown size={14} />
        </span>
      </button>

      {open && (
        <div className="ml-9 mt-1 mb-2 pl-2 space-y-0.5"
             style={{ borderLeft: `1.5px solid ${theme.from}55` }}>
          {/* Top-level link to the bare settings page */}
          <Link
            to="/dashboard/settings"
            className="block px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-white/70"
            style={{ color: theme.from }}
          >
            ↗ Open Settings page
          </Link>
          {SETTINGS_SECTIONS.map((s) => (
            <Link
              key={s.anchor}
              to={`/dashboard/settings#${s.anchor}`}
              className="block px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-white/70"
              style={{ color: C.inkSoft }}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const NavLink = ({ to, icon: Icon, label, currentPath, role }) => {
  const active = isNavActive(currentPath, to);
  const theme = themeForRole(role);
  return (
    <Link
      to={to}
      className="relative group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all"
      style={{
        color: active ? C.inkDeep : C.inkMute,
        background: active ? 'rgba(255,255,255,0.6)' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(28,25,23,0.04)' : 'none',
      }}
    >
      {/* Active indicator: gradient bar to the left of the active row */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
          style={{ background: `linear-gradient(180deg, ${theme.from}, ${theme.to})` }}
        />
      )}
      <span
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors"
        style={{
          background: active
            ? `linear-gradient(135deg, ${theme.from}1A, ${theme.to}1A)`
            : 'transparent',
          color: active ? theme.from : C.inkMute,
          border: active ? `1px solid ${theme.from}33` : '1px solid transparent',
        }}
      >
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
};

// Same visual treatment as NavLink, but a button that triggers logout.
// Placed inline within each role's nav so it sits directly under Settings
// (or last nav item for roles without Settings).
const SignOutNavItem = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all w-full text-left"
      style={{ color: C.inkMute, background: 'transparent' }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = '#FEF2F2';
        e.currentTarget.style.color = '#991B1B';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = C.inkMute;
      }}
    >
      <span
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'inherit', border: '1px solid transparent' }}
      >
        <LogOut className="w-[18px] h-[18px]" />
      </span>
      <span className="truncate">Sign out</span>
    </button>
  );
};

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const role = user?.role || 'default';
  const theme = themeForRole(role);

  return (
    <div
      className="relative flex min-h-screen font-['Manrope']"
      style={{ background: `linear-gradient(180deg, ${C.bone} 0%, ${C.cream} 100%)` }}
    >
      <AmbientBackdrop role={role} />

      <aside
        className="relative z-10 w-64 flex flex-col shrink-0"
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(14px)',
          borderRight: `1px solid ${C.hairline}`,
        }}
      >
        {/* Brand mark + role badge */}
        <div className="p-6 pb-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
              style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
            >
              F
            </div>
            <div className="min-w-0">
              <p
                className="font-['Cormorant_Garamond'] text-[22px] font-bold leading-none ft-gradient-text-slow"
              >
                FidéliTour
              </p>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mt-1"
                style={{ color: theme.from }}
              >
                {theme.label}
              </p>
            </div>
          </Link>
        </div>

        <div className="px-4">
          <div className="h-px" style={{ background: C.hairline }} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {role === 'business_owner' && (
            <>
              <NavLink to="/dashboard"               icon={Home}         label="Dashboard"     currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/analytics"     icon={BarChart3}    label="Analytics"     currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/insights"      icon={Sparkles}     label="Insights"      currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/customers"     icon={Users}        label="Customers"     currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/map"           icon={MapPin}       label="Customer Map"  currentPath={currentPath} role={role} />
              {/* Scan Visit is intentionally NOT in the owner sidebar — that page
                  is the staff workspace. Owners can reach it via direct URL. */}
              <NavLink to="/dashboard/card-designer" icon={CreditCard}   label="Card Designer" currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/campaigns"     icon={Megaphone}    label="Campaigns"     currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/ai-assistant"  icon={BrainCircuit} label="AI Assistant"  currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/history"       icon={History}      label="History"       currentPath={currentPath} role={role} />
              {/* Settings is expandable — click → dropdown of section anchors */}
              <SettingsNavLink icon={Settings2} currentPath={currentPath} role={role} />
              <SignOutNavItem onClick={logout} />
            </>
          )}
          {role === 'manager' && (
            <>
              <NavLink to="/dashboard/analytics" icon={BarChart3} label="Analytics"    currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/insights"  icon={Sparkles}  label="Insights"     currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/customers" icon={Users}     label="Customers"    currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/map"       icon={MapPin}    label="Customer Map" currentPath={currentPath} role={role} />
              <NavLink to="/dashboard/history"   icon={History}   label="History"      currentPath={currentPath} role={role} />
              <SignOutNavItem onClick={logout} />
            </>
          )}
          {role === 'staff' && (
            <>
              <NavLink to="/dashboard/scan" icon={QrCode} label="Scan Visit" currentPath={currentPath} role={role} />
              <SignOutNavItem onClick={logout} />
            </>
          )}
          {role === 'super_admin' && (
            <>
              <NavLink to="/admin"               icon={Home}         label="Dashboard"          currentPath={currentPath} role={role} />
              <NavLink to="/admin/analytics"     icon={BarChart3}    label="Global Analytics"   currentPath={currentPath} role={role} />
              <NavLink to="/admin/insights"      icon={Sparkles}     label="Insights"           currentPath={currentPath} role={role} />
              <NavLink to="/admin/tenants"       icon={Database}     label="Manage Businesses"  currentPath={currentPath} role={role} />
              <NavLink to="/admin/card-designer" icon={Palette}      label="Card Designer"      currentPath={currentPath} role={role} />
              <NavLink to="/admin/campaigns"     icon={Megaphone}    label="Campaigns"          currentPath={currentPath} role={role} />
              <NavLink to="/admin/ai"            icon={BrainCircuit} label="AI Intelligence"    currentPath={currentPath} role={role} />
              <SignOutNavItem onClick={logout} />
            </>
          )}
        </nav>

        {/* User chip — sign-out moved into the nav, directly below Settings */}
        <div className="p-4 mt-auto" style={{ borderTop: `1px solid ${C.hairline}` }}>
          <div className="flex items-center gap-2.5 px-1">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
            >
              {(user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: C.inkDeep }}>
                {user?.email || '—'}
              </p>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: theme.from }}>
                {theme.label}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 overflow-auto">
        {/* Floating bell — only for owners; staff/admin have separate views */}
        {role === 'business_owner' && (
          <div className="absolute top-4 right-6 z-20">
            <NotificationBell />
          </div>
        )}
        <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-[1600px] mx-auto">
          {/* Global branch selector — visible on EVERY dashboard page so the
              owner can pick once and have all pages filter automatically.
              Hides itself if the tenant only has one branch. */}
          {role === 'business_owner' && <BranchSelectorBar />}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
