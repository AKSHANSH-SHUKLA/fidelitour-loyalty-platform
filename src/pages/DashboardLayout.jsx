import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import BranchPillsBanner from '../components/BranchPillsBanner';
import BillingBanner from '../components/BillingBanner';
import { useAuth } from '../contexts/AuthContext';
import { ownerAPI } from '../lib/api';
import {
  Home, Users, QrCode, LogOut, BarChart3, Settings2, Palette,
  Database, BrainCircuit, Megaphone, MapPin, Sparkles, CreditCard, Shield, History, ChevronDown,
  Building2, Menu
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
  // The user's manual override (null = follow route default). It resets to
  // null every time the route changes, so:
  //   • Navigate to Analytics / Insights / any non-settings page → override
  //     clears, `open` falls back to `active === false` → dropdown collapses.
  //   • Navigate to /dashboard/settings → override clears, `open` falls back
  //     to `active === true` → dropdown auto-expands.
  //   • While on settings, click the toggle → override drives `open`.
  // This is intentionally a derived value (not synced state via useEffect)
  // so it can never get out of sync with the route.
  const [manualOverride, setManualOverride] = React.useState(null);
  React.useEffect(() => { setManualOverride(null); }, [currentPath]);
  const open = manualOverride !== null ? manualOverride : active;
  const setOpen = (next) => {
    const nextVal = typeof next === 'function' ? next(open) : next;
    setManualOverride(nextVal);
  };

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

const NavLink = ({ to, icon: Icon, label, currentPath, role, collapsed, badge }) => {
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
      {!collapsed && (
        <>
          <span className="truncate flex-1">{label}</span>
          {badge && (
            <span
              className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded font-bold shrink-0"
              style={{ background: '#FEE0CF', color: '#9C4427', letterSpacing: '0.08em' }}
            >
              {badge}
            </span>
          )}
        </>
      )}
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
  const navigate = useNavigate();
  // Global search — smart routing.
  //
  // The owner expects: "card" → Card Designer, "settings" → Settings,
  // "campaign" → Campaigns, etc. If the query matches a known
  // section/page synonym, we navigate directly there. Otherwise we treat
  // it as a customer search (barcode FT-XXXX → exact, anything else →
  // free-text q=).
  const [searchQ, setSearchQ] = React.useState('');

  // Keyword → route mapping. Each route lists the words (FR + EN) that
  // should land the user on that page. Match is case-insensitive and
  // word-boundary aware (so "carte cadeau" still routes to Card Designer
  // via "carte"). Order doesn't matter — we pick the first key whose
  // keyword list matches.
  const ROUTE_SYNONYMS = React.useMemo(() => ([
    { route: '/dashboard',                              words: ['dashboard', 'tableau de bord', 'tableau', 'accueil', 'home', 'overview', 'vue d’ensemble', 'welcome'] },
    { route: '/dashboard/analytics',                    words: ['analytics', 'analyses', 'analyse', 'kpi', 'kpis', 'stats', 'statistiques', 'rapport', 'reports', 'metrics', 'metric', 'métriques'] },
    { route: '/dashboard/settings#settings-status',     words: ['customer status', 'statut client', 'segment', 'segments', 'statuts'] },
    { route: '/dashboard/insights',                     words: ['insights', 'insight', 'reco', 'recommendations', 'recommandations', 'suggestion', 'suggestions', 'ai', 'ia'] },
    { route: '/dashboard/map',                          words: ['map', 'carte (geo)', 'geographie', 'geography', 'géographie', 'localisation', 'lieux'] },
    { route: '/dashboard/card-designer',                words: ['card designer', 'card', 'carte', 'carte de fidélité', 'loyalty card', 'design', 'pass', 'wallet', 'walletpass'] },
    { route: '/dashboard/campaigns',                    words: ['campaigns', 'campaign', 'campagnes', 'campagne', 'sms', 'push', 'message', 'messages', 'notif', 'notifications'] },
    { route: '/dashboard/ai-assistant',                 words: ['ai assistant', 'assistant', 'chatbot', 'chat', 'assistant ia', 'copilot'] },
    { route: '/dashboard/history',                      words: ['history', 'historique', 'logs', 'journal', 'activity log', 'audit'] },
    { route: '/dashboard/scan',                         words: ['scan', 'scanner', 'qr', 'qr code', 'visit', 'visite', 'check-in', 'checkin'] },
    { route: '/dashboard/customers',                    words: ['customers', 'clients', 'customer', 'client', 'liste clients'] },
    { route: '/dashboard/settings',                     words: ['settings', 'parametres', 'paramètres', 'reglages', 'réglages', 'config', 'configuration', 'preferences', 'préférences', 'compte', 'account', 'profile', 'profil', 'billing', 'facturation', 'plan', 'equipe', 'équipe', 'team', 'staff', 'utilisateurs', 'users'] },
  ]), []);

  const submitSearch = (e) => {
    e?.preventDefault?.();
    const raw = (searchQ || '').trim();
    if (!raw) {
      navigate('/dashboard/customers');
      return;
    }

    // 1) Barcode lookup — direct hit on the customer.
    const isBarcode = /^FT-?[A-Z0-9]{4,}/i.test(raw);
    if (isBarcode) {
      navigate(`/dashboard/customers?barcode_id=${encodeURIComponent(raw)}`);
      return;
    }

    // 2) Page/section synonyms — route to the matching page.
    const q = raw.toLowerCase();
    for (const entry of ROUTE_SYNONYMS) {
      for (const w of entry.words) {
        const wl = w.toLowerCase();
        // Exact match OR query starts/ends/contains the keyword as a token.
        const re = new RegExp(`(^|[^a-zà-ÿ])${wl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zà-ÿ]|$)`, 'i');
        if (q === wl || re.test(q)) {
          navigate(entry.route);
          return;
        }
      }
    }

    // 3) Fallback — free-text customer search.
    navigate(`/dashboard/customers?q=${encodeURIComponent(raw)}`);
  };
  const currentPath = location.pathname;
  const role = user?.role || 'default';
  const theme = themeForRole(role);

  // Collapsed-sidebar toggle (persisted across reloads). When true the
  // aside shrinks to a 72px icons-only rail; click again to expand.
  // Key is versioned (-v2) so a previous accidentally-collapsed state
  // doesn't override the default expanded view on the next deploy.
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('fdt:sidebar:collapsed-v2') === '1'; }
    catch { return false; }
  });
  React.useEffect(() => {
    try { window.localStorage.setItem('fdt:sidebar:collapsed-v2', collapsed ? '1' : '0'); }
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

  // Analytics v2 has a dark theme. When the current route is the Analytics
  // page, mark the dashboard root so the sidebar can flip its surface to
  // the dark token palette. The flag is a data-attribute (not a class) so
  // it never collides with the existing layout state classes.
  const isAnalyticsDark = currentPath.startsWith('/dashboard/analytics');

  return (
    <div
      className="relative flex min-h-screen fdt-dash"
      data-route-dark={isAnalyticsDark ? 'true' : undefined}
      style={{
        background: isAnalyticsDark
          ? 'hsl(226 30% 7%)'  /* matches --bg in the v2 dark palette */
          : 'linear-gradient(180deg, #FBF7EE 0%, #F5EFE0 100%)',
        transition: 'background 200ms ease',
      }}
    >
      {!isAnalyticsDark && <AmbientBackdrop role={role} />}

      <aside
        className={`sticky top-0 z-10 ${collapsed ? 'w-[72px]' : 'w-64'} h-screen flex flex-col shrink-0 transition-[width,background-color] duration-200 ease-out fd-aside fd-sidebar-host`}
        style={{
          background: isAnalyticsDark
            ? 'hsl(228 30% 9%)'  /* --sidebar-dark */
            : 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(14px)',
          borderRight: `1px solid ${isAnalyticsDark ? 'hsl(230 32% 18%)' : C.hairline}`,
          alignSelf: 'flex-start',
          color: isAnalyticsDark ? 'hsl(228 23% 97%)' : undefined,
        }}
      >
        {/* Collapse toggle — three-line hamburger pinned to the right edge.
            One symbol for both states; the colour/background flips so the
            user still gets feedback about open vs collapsed. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-6 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: collapsed ? 'white' : '#1F1B1A',
            border: `1px solid ${collapsed ? C.hairline : '#1F1B1A'}`,
            boxShadow: '0 2px 6px rgba(28,25,23,0.10)',
            color: collapsed ? C.inkSoft : '#FFFFFF',
          }}
        >
          <Menu size={14} strokeWidth={2.25} />
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
              <NavLink to="/dashboard"               icon={Home}         label="Dashboard"        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/analytics"     icon={BarChart3}    label="Analytics"        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/settings#settings-status" icon={Shield} label="Customer Status"  currentPath={currentPath} role={role} collapsed={collapsed} badge="Nouveau" />
              <NavLink to="/dashboard/insights"      icon={Sparkles}     label="Insights"         currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/customers"     icon={Users}        label="Customers"        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/map"           icon={MapPin}       label="Customer Map"     currentPath={currentPath} role={role} collapsed={collapsed} />
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
            className="sticky top-0 z-30 flex items-center gap-3 px-6 lg:px-8 py-2.5 backdrop-blur"
            style={{
              background: 'rgba(255,255,255,0.82)',
              borderBottom: '1px solid var(--hairline, #ECE8E1)',
            }}
          >
            {/* Global search — Enter routes to /dashboard/customers with
                the query. Barcode-style inputs (FT-XXXX) hit the customer
                page filter by barcode_id; everything else hits the free
                text search. */}
            <form
              onSubmit={submitSearch}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 shrink-0 w-[200px] lg:w-[280px]"
              style={{ background: '#FFFFFF', border: '1px solid var(--hairline, #ECE8E1)' }}
            >
              <button type="submit" aria-label="Lancer la recherche" className="shrink-0" style={{ lineHeight: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-mute, #7A716C)' }}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </button>
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Rechercher un client, un code FT-…"
                aria-label="Rechercher un client"
                className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px]"
                style={{ color: 'var(--ink, #1F1B1A)', fontWeight: 400 }}
              />
              {searchQ && (
                <button
                  type="button"
                  onClick={() => setSearchQ('')}
                  aria-label="Effacer"
                  className="shrink-0 text-[10px] px-1 py-0.5 rounded hover:bg-[#F4F2EE]"
                  style={{ color: 'var(--ink-mute, #7A716C)' }}
                >✕</button>
              )}
              <kbd
                className="text-[9.5px] px-1 py-0.5 rounded shrink-0"
                style={{
                  background: '#F4F2EE',
                  color: 'var(--ink-mute, #7A716C)',
                  border: '1px solid var(--hairline, #ECE8E1)',
                  fontWeight: 500,
                }}
                title="Entrée pour rechercher"
              >
                ↵
              </kbd>
            </form>

            {/* Branch banner inline — fills the middle */}
            <div className="flex-1 min-w-0 px-2">
              <BranchPillsBanner compact />
            </div>

            {/* Bell */}
            <div className="shrink-0">
              <NotificationBell />
            </div>

            {/* Help icon */}
            <button
              type="button"
              aria-label="Aide"
              title="Aide"
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'transparent', border: '1px solid var(--hairline, #ECE8E1)', color: 'var(--ink-mute, #7A716C)' }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#F4F2EE'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            {/* User menu avatar */}
            <UserMenu user={user} theme={theme} role={role} onLogout={logout} />
          </div>
        )}

        <div className="px-6 py-5 lg:px-8 lg:py-5 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
