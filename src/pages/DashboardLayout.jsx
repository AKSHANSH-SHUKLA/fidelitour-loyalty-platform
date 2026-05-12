import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import BranchPillsBanner from '../components/BranchPillsBanner';
import BillingBanner from '../components/BillingBanner';
import { useAuth } from '../contexts/AuthContext';
import { ownerAPI } from '../lib/api';
import {
  Home, Users, QrCode, LogOut, BarChart3, Settings2, Palette,
  Database, BrainCircuit, Megaphone, MapPin, Sparkles, CreditCard, Shield, History, ChevronDown,
  Building2, ChevronLeft, ChevronRight
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
  { anchor: 'settings-auto-pending', label: '📥 Auto-campagnes en attente' },
  { anchor: 'settings-auto',     label: '🤖 Campagnes automatiques' },
  { anchor: 'settings-points',   label: '💰 Règle de points' },
  { anchor: 'settings-team',     label: '👥 Équipe & accès' },
  { anchor: 'settings-cleanup',  label: '🧹 Nettoyer clients inactifs' },
];

const SettingsNavLink = ({ icon: Icon, currentPath, role, collapsed }) => {
  const active = isNavActive(currentPath, '/dashboard/settings');
  const theme = themeForRole(role);
  const [open, setOpen] = React.useState(active);
  // If the user lands ON the settings page later, auto-expand for them.
  React.useEffect(() => { if (active) setOpen(true); }, [active]);

  // When the sidebar is collapsed, Settings becomes a simple icon link —
  // the inline submenu has no room. Clicking jumps straight to the settings page.
  if (collapsed) {
    return (
      <Link
        to="/dashboard/settings"
        title="Settings"
        className="relative group flex items-center justify-center px-2 py-2 rounded-lg text-[13.5px] transition-all"
        style={{
          color: active ? 'var(--ink)' : 'var(--ink-mute)',
          background: active ? 'rgba(255,255,255,0.78)' : 'transparent',
        }}
      >
        <span
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
          style={{
            background: active ? `linear-gradient(135deg, ${theme.from}1A, ${theme.to}1A)` : 'transparent',
            color: active ? theme.from : C.inkMute,
            border: active ? `1px solid ${theme.from}33` : '1px solid transparent',
          }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </span>
      </Link>
    );
  }

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
        className="w-full relative group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all"
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

const NavLink = ({ to, icon: Icon, label, currentPath, role, collapsed }) => {
  const active = isNavActive(currentPath, to);
  const theme = themeForRole(role);
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`relative group flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'} py-2 rounded-lg text-[13.5px] transition-all`}
      style={{
        color: active ? 'var(--ink)' : 'var(--ink-mute)',
        background: active ? 'rgba(255,255,255,0.78)' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(28,25,23,0.03)' : 'none',
        fontWeight: active ? 500 : 400,
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
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
};

// Same visual treatment as NavLink, but a button that triggers logout.
// Placed inline within each role's nav so it sits directly under Settings
// (or last nav item for roles without Settings).
const SignOutNavItem = ({ onClick, collapsed }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? 'Sign out' : undefined}
      className={`relative group flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'} py-2 rounded-lg text-[13.5px] transition-all w-full text-left`}
      style={{ color: 'var(--ink-mute)', background: 'transparent', fontWeight: 400 }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = '#FAEDEB';
        e.currentTarget.style.color = '#8A322B';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--ink-mute)';
      }}
    >
      <span
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'inherit', border: '1px solid transparent' }}
      >
        <LogOut className="w-[18px] h-[18px]" />
      </span>
      {!collapsed && <span className="truncate">Sign out</span>}
    </button>
  );
};

/* ────────────────────────────────────────────────────────────────────────
 * UserMenu — clickable avatar in the top toolbar.
 *
 * What's inside:
 *   • Big circle with the user's initial — gradient matches the role theme.
 *   • Small dot at the bottom-right ("you're logged in" indicator — purely
 *     visual cue, lifted from the reference mockup).
 *   • Click → opens a dropdown panel showing the full email, the role label,
 *     a link into Settings, and a Sign-out button.
 *
 * Why this exists separately from the sidebar's Sign-out item: the avatar
 * is the universal "account menu" affordance every SaaS dashboard uses.
 * The patron expects to click their picture to get out — without it, the
 * status dot was decorative noise that the user noticed and asked about.
 * ──────────────────────────────────────────────────────────────────── */
function UserMenu({ user, theme, role, onLogout }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  // Close when clicking outside the menu — standard popover hygiene.
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const initial = (user?.email || '?').charAt(0).toUpperCase();
  const roleLabel =
    role === 'business_owner' ? 'Business Owner' :
    role === 'manager' ? 'Manager' :
    role === 'staff' ? 'Staff' :
    role === 'super_admin' ? 'Admin' : 'User';

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
        style={{
          background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: '0.02em',
        }}
      >
        {initial}
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
          style={{ background: 'var(--tone-success-line, #7FA269)', boxShadow: '0 0 0 2px white' }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden z-50"
          style={{
            background: 'white',
            border: '1px solid var(--hairline, #ECE8E1)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline, #ECE8E1)' }}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
                  fontWeight: 500, fontSize: 13,
                }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] truncate" style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  {user?.email || '—'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--ink-mute)' }}>
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>
          <Link
            to="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[#FAF8F4] transition-colors"
            style={{ color: 'var(--ink)' }}
          >
            <Settings2 size={14} style={{ color: 'var(--ink-mute)' }} />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[#FAEDEB] transition-colors"
            style={{ color: '#8A322B', borderTop: '1px solid var(--hairline, #ECE8E1)' }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const role = user?.role || 'default';
  const theme = themeForRole(role);

  // Collapsed-sidebar toggle (persisted across reloads). When true the
  // aside shrinks to a 72px icons-only rail; click again to expand.
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('fdt:sidebar:collapsed') === '1'; }
    catch { return false; }
  });
  React.useEffect(() => {
    try { window.localStorage.setItem('fdt:sidebar:collapsed', collapsed ? '1' : '0'); }
    catch { /* localStorage may be blocked — fine */ }
  }, [collapsed]);

  // Fetch tenant identity once — shown in the sidebar so the user always
  // knows which business account they're acting as. Prevents the "wait,
  // why isn't this scan working" tenant-mismatch confusion.
  const [tenantInfo, setTenantInfo] = React.useState(null);
  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    ownerAPI.getTenant?.()
      .then((r) => { if (alive) setTenantInfo(r.data || null); })
      .catch(() => { /* silent — keep header generic */ });
    return () => { alive = false; };
  }, [user?.email]);

  return (
    <div
      className="relative flex min-h-screen"
      style={{ background: 'linear-gradient(180deg, #FBF7EE 0%, #F5EFE0 100%)' }}
    >
      <AmbientBackdrop role={role} />

      <aside
        className={`relative z-10 ${collapsed ? 'w-[72px]' : 'w-64'} flex flex-col shrink-0 transition-[width] duration-200 ease-out`}
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(14px)',
          borderRight: `1px solid ${C.hairline}`,
        }}
      >
        {/* Collapse toggle pinned to the right edge of the aside */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: 'white',
            border: `1px solid ${C.hairline}`,
            boxShadow: '0 2px 6px rgba(28,25,23,0.08)',
            color: C.inkSoft,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand mark + role badge */}
        <div className={collapsed ? 'p-3 pb-2' : 'p-5 pb-3'}>
          <Link to="/" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm shadow-sm shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`, fontWeight: 500 }}
              title={collapsed ? `FidéliTour · ${theme.label}` : undefined}
            >
              F
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p
                  className="text-[15px] leading-none"
                  style={{ color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.015em' }}
                >
                  FidéliTour
                </p>
                <p
                  className="text-[9px] uppercase tracking-[0.16em] mt-1"
                  style={{ color: 'var(--ink-mute)', fontWeight: 500 }}
                >
                  {theme.label}
                </p>
              </div>
            )}
          </Link>

          {/* Tenant identity badge — only when expanded */}
          {!collapsed && tenantInfo && (
            <div
              className="mt-3 px-2.5 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid var(--hairline)' }}
              title={`Compte : ${tenantInfo.name || 'Sans nom'} · slug: ${tenantInfo.slug || '—'}`}
            >
              <p
                className="text-[9px] uppercase tracking-[0.16em]"
                style={{ color: 'var(--ink-mute)', fontWeight: 500 }}
              >
                Compte
              </p>
              <p
                className="text-[13px] truncate mt-0.5"
                style={{ color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.01em' }}
              >
                {tenantInfo.name || 'Sans nom'}
              </p>
              {tenantInfo.slug && (
                <p
                  className="text-[10px] font-mono truncate mt-0.5"
                  style={{ color: 'var(--ink-mute)' }}
                >
                  /join/{tenantInfo.slug}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-4">
          <div className="h-px" style={{ background: C.hairline }} />
        </div>

        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-4 space-y-0.5 overflow-y-auto`}>
          {role === 'business_owner' && (
            <>
              <NavLink to="/dashboard"               icon={Home}         label="Dashboard"     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/analytics"     icon={BarChart3}    label="Analytics"     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/insights"      icon={Sparkles}     label="Insights"      currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/customers"     icon={Users}        label="Customers"     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/map"           icon={MapPin}       label="Customer Map"  currentPath={currentPath} role={role} collapsed={collapsed} />
              {/* Scan Visit is intentionally NOT in the owner sidebar — that page
                  is the staff workspace. Owners can reach it via direct URL. */}
              <NavLink to="/dashboard/card-designer" icon={CreditCard}   label="Card Designer" currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/campaigns"     icon={Megaphone}    label="Campaigns"     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/ai-assistant"  icon={BrainCircuit} label="AI Assistant"  currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/history"       icon={History}      label="History"       currentPath={currentPath} role={role} collapsed={collapsed} />
              {/* Settings is expandable — click → dropdown of section anchors */}
              <SettingsNavLink icon={Settings2} currentPath={currentPath} role={role} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
          {role === 'manager' && (
            <>
              <NavLink to="/dashboard/analytics" icon={BarChart3} label="Analytics"    currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/insights"  icon={Sparkles}  label="Insights"     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/customers" icon={Users}     label="Customers"    currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/map"       icon={MapPin}    label="Customer Map" currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/history"   icon={History}   label="History"      currentPath={currentPath} role={role} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
          {role === 'staff' && (
            <>
              <NavLink to="/dashboard/scan" icon={QrCode} label="Scan Visit" currentPath={currentPath} role={role} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
          {role === 'super_admin' && (
            <>
              <NavLink to="/admin"               icon={Home}         label="Dashboard"          currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/analytics"     icon={BarChart3}    label="Global Analytics"   currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/insights"      icon={Sparkles}     label="Insights"           currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/tenants"       icon={Database}     label="Manage Businesses"  currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/card-designer" icon={Palette}      label="Card Designer"      currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/campaigns"     icon={Megaphone}    label="Campaigns"          currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/ai"            icon={BrainCircuit} label="AI Intelligence"    currentPath={currentPath} role={role} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* User chip — sign-out moved into the nav, directly below Settings */}
        <div className={`${collapsed ? 'p-3' : 'p-4'} mt-auto`} style={{ borderTop: `1px solid ${C.hairline}` }}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-1'}`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
              title={collapsed ? (user?.email || '') : undefined}
            >
              {(user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: C.inkDeep }}>
                  {user?.email || '—'}
                </p>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: theme.from }}>
                  {theme.label}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 overflow-auto">
        {/* Global billing health banner — only renders if there's something to
            warn about (past-due, canceled, trial ending soon). Otherwise
            invisible and out of the way. */}
        {role === 'business_owner' && <BillingBanner />}

        {/* Premium top toolbar — search + bell + avatar.
            Sits as a sticky bar across every dashboard page (matches the
            reference mockup with the search bar centered and the bell +
            user avatar pinned right). On non-owner roles we keep the bell
            slot hidden so staff don't see owner-only alerts. */}
        {role === 'business_owner' && (
          <div
            className="sticky top-0 z-30 flex items-center gap-4 px-6 lg:px-10 py-3 backdrop-blur"
            style={{
              background: 'rgba(255,255,255,0.78)',
              borderBottom: '1px solid var(--hairline, #ECE8E1)',
            }}
          >
            {/* Search — purely decorative for now (Cmd+K hook lands in a
                later pass). Looks calm and signals "this is a real product". */}
            <div
              className="flex items-center gap-2 flex-1 max-w-2xl mx-auto rounded-full px-4 py-1.5"
              style={{ background: '#FFFFFF', border: '1px solid var(--hairline, #ECE8E1)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-mute, #7A716C)' }}>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un client, une campagne…"
                aria-label="Rechercher"
                className="flex-1 bg-transparent outline-none text-[13px]"
                style={{ color: 'var(--ink, #1F1B1A)', fontWeight: 400 }}
              />
              <kbd
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: '#F4F2EE',
                  color: 'var(--ink-mute, #7A716C)',
                  border: '1px solid var(--hairline, #ECE8E1)',
                  fontWeight: 500,
                }}
              >
                ⌘K
              </kbd>
            </div>

            {/* Bell — keeps the existing NotificationBell component but lives
                in the toolbar slot instead of floating absolute. The badge
                with the unread count comes from inside NotificationBell. */}
            <div className="shrink-0">
              <NotificationBell />
            </div>

            {/* Clickable user-menu avatar — initial + status dot + dropdown
                with profile / settings / sign out. Replaces the silent
                decorative avatar we had before. */}
            <UserMenu user={user} theme={theme} role={role} onLogout={logout} />
          </div>
        )}

        <div className="px-6 py-6 lg:px-10 lg:py-6 max-w-[1600px] mx-auto">
          {/* Global branch selector — visible on EVERY dashboard page so the
              owner can pick once and have all pages filter automatically.
              Hides itself if the tenant only has one branch. */}
          {role === 'business_owner' && <BranchPillsBanner />}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
