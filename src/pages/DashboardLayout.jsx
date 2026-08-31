import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NotificationBell from '../components/NotificationBell';
import BranchPillsBanner from '../components/BranchPillsBanner';
import BillingBanner from '../components/BillingBanner';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { ownerAPI } from '../lib/api';
import {
  Home, Users, QrCode, LogOut, BarChart3, Settings2, Palette,
  Database, BrainCircuit, Megaphone, MapPin, Sparkles, CreditCard, Shield, History, ChevronDown,
  Building2, Menu, LifeBuoy
} from 'lucide-react';
import { C, themeForRole, AmbientBackdrop } from '../components/PageShell';
import SupportModal from '../components/SupportModal';

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
// Translation keys, resolved inside the component via useTranslation.
const SETTINGS_SECTIONS = [
  { anchor: 'settings-profile',      i18nKey: 'settings.section_profile' },
  { anchor: 'settings-join',         i18nKey: 'settings.section_join_link' },
  { anchor: 'settings-geo',          i18nKey: 'settings.section_geo' },
  { anchor: 'settings-status',       i18nKey: 'settings.section_status' },
  { anchor: 'settings-dayparts',     i18nKey: 'settings.section_dayparts' },
  { anchor: 'settings-hours',        i18nKey: 'settings.section_hours' },
  { anchor: 'settings-tiers',        i18nKey: 'settings.section_tiers' },
  { anchor: 'settings-welcome',      i18nKey: 'settings.section_welcome' },
  { anchor: 'settings-auto-pending', i18nKey: 'settings.section_auto_pending' },
  { anchor: 'settings-auto',         i18nKey: 'settings.section_auto' },
  { anchor: 'settings-language',     i18nKey: 'settings.section_language' },
  { anchor: 'settings-catalog',      i18nKey: 'settings.section_catalog' },
  { anchor: 'settings-points',       i18nKey: 'settings.section_points' },
  { anchor: 'settings-team',         i18nKey: 'settings.section_team' },
  { anchor: 'settings-cleanup',      i18nKey: 'settings.section_cleanup' },
];

/* ── P6 one-shot migration ────────────────────────────────────────────
   The Minuit Doré dark theme was removed in P6. Nothing reads this key
   any more, so this is hygiene rather than a theme read: it clears the
   stale value out of the browsers of anyone who was holding 'nuit'. It
   runs at MODULE SCOPE — at import time, strictly before first render —
   rather than in an effect that would run after paint. Delete-only:
   nothing in the product ever writes this key again. */
try { window.localStorage.removeItem('flc-theme'); } catch { /* blocked storage — fine */ }

const SettingsNavLink = ({ icon: Icon, currentPath, role, collapsed }) => {
  const { t } = useTranslation();
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
        title={t('nav.settings')}
        className={`flc-nav ${active ? 'on' : ''} relative group flex items-center justify-center px-2 py-2 rounded-lg text-[13.5px] transition-all`}
      >
        <span
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
          style={{ color: 'inherit' }}
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
        className={`flc-nav ${active ? 'on' : ''} w-full relative group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all`}
        style={{ fontWeight: active ? 600 : 450 }}
      >
        <span
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'transparent', color: 'inherit' }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="truncate flex-1 text-left fd-railhide">{t('nav.settings')}</span>
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
            {t('nav.open_settings_page')}
          </Link>
          {SETTINGS_SECTIONS.map((s) => (
            <Link
              key={s.anchor}
              to={`/dashboard/settings#${s.anchor}`}
              className="block px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-white/70"
              style={{ color: C.inkSoft }}
            >
              {t(s.i18nKey)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

/* Sidebar group label — sentence case, deliberately, not capitals.
   Option B: labels drop at the seams the nav already had, so no item
   moves. Reordering the nav is an information-architecture decision,
   not a recolour, and is out of scope for P6. */
const NavGroup = ({ label, collapsed }) => (
  collapsed ? null : <p className="flc-navgroup">{label}</p>
);

const NavLink = ({ to, icon: Icon, label, currentPath, role, collapsed, badge }) => {
  const active = isNavActive(currentPath, to);
  const theme = themeForRole(role);
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`flc-nav ${active ? 'on' : ''} relative group flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'} py-2 rounded-xl text-[13.5px] transition-all`}
      style={{ fontWeight: active ? 600 : 450 }}
    >
      {/* Active: the icon sits in a solid blue filled circle with a white
          glyph. Inactive: a bare glyph in the body ink. */}
      <span
        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors"
        style={active
          ? { background: C.blue, color: '#FFFFFF' }
          : { background: 'transparent', color: 'inherit' }}
      >
        <Icon className="w-[18px] h-[18px]" />
      </span>
      {!collapsed && (
        <>
          <span className="truncate flex-1">{label}</span>
          {badge && (
            <span
              className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded font-bold shrink-0"
              style={{ background: C.tintBlue, color: C.blueDeep, letterSpacing: '0.08em' }}
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
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? t('nav.sign_out') : undefined}
      className={`relative group flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'} py-2 rounded-lg text-[13.5px] transition-all w-full text-left`}
      style={{ color: 'var(--ink-mute)', background: 'transparent', fontWeight: 400 }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'var(--surface-2, #F8F9FC)';
        e.currentTarget.style.color = C.inkDeep;
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
      {!collapsed && <span className="truncate fd-railhide">{t('nav.sign_out')}</span>}
    </button>
  );
};

// Support nav button — same visual treatment as NavLink, but opens
// the SupportModal instead of navigating. Lives next to Sign-out so
// businesses can reach the support inbox from every page.
const SupportNavItem = ({ onClick, collapsed }) => (
  <button
    type="button"
    onClick={onClick}
    title={collapsed ? 'Support' : undefined}
    className={`relative group flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'} py-2 rounded-lg text-[13.5px] transition-all w-full text-left`}
    style={{ color: 'var(--ink-mute)', background: 'transparent', fontWeight: 400 }}
    onMouseOver={(e) => {
      e.currentTarget.style.background = 'var(--surface-2, #F8F9FC)';
      e.currentTarget.style.color = C.blueDeep;
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
      <LifeBuoy className="w-[18px] h-[18px]" />
    </span>
    {!collapsed && <span className="truncate fd-railhide">Support</span>}
  </button>
);

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
  const { t } = useTranslation();
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
    role === 'business_owner' ? t('nav.business_owner') :
    role === 'manager' ? t('nav.manager') :
    role === 'staff' ? t('nav.staff') :
    role === 'super_admin' ? t('nav.admin') : t('nav.user');

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={t('nav.account_menu')}
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
        style={{
          background: C.blue,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: '0.02em',
        }}
      >
        {initial}
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
          style={{ background: 'var(--tone-success-line, #7FA269)', boxShadow: '0 0 0 2px var(--flc-card, #FFFFFF)' }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden z-50"
          style={{
            background: 'var(--flc-card, #FFFFFF)',
            border: '1px solid var(--hairline, #ECEFF4)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline, #ECEFF4)' }}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                style={{
                  background: C.blue,
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
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[#FAFAF8] transition-colors"
            style={{ color: 'var(--ink)' }}
          >
            <Settings2 size={14} style={{ color: 'var(--ink-mute)' }} />
            {t('nav.settings')}
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[#F8F9FC] transition-colors"
            style={{ color: 'var(--flc-accent-deep, #1453BD)', borderTop: '1px solid var(--hairline, #ECEFF4)' }}
          >
            <LogOut size={14} />
            {t('nav.sign_out')}
          </button>
        </div>
      )}
    </div>
  );
}

const DashboardLayout = () => {
  // P6: the Minuit Doré dark theme was REMOVED. The state, the .flc-nuit
  // class, the toggle and theme.js's observer are all gone, so nothing
  // reads localStorage['flc-theme'] any more and no returning user can
  // land on a half-removed theme. The delete-only migration at module
  // scope above just clears the stale key out of their browser.

  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // Support modal — opened from any role's sidebar; mounted once at
  // the layout root so it overlays every dashboard page.
  const [supportOpen, setSupportOpen] = React.useState(false);
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

  /* P6C-0c — ONE search implementation, two placement slots.
     This is the exact form that used to sit inline in the topbar, lifted
     into a local render unit so the sidebar and the topbar can call the
     same markup. It reads and writes the same `searchQ`, submits through
     the same `submitSearch`, and therefore carries the same synonym
     routing, FT-code detection and free-text fallback. No new state, no
     second parser, no duplicate handler. Width is deliberately absent —
     the placement slot owns it, so one unit can be 100% wide in the
     sidebar and 200/280px in the topbar. Exactly one slot is ever
     interactive; the other is display:none via Tailwind `hidden`, which
     removes it from the tab order and the accessibility tree. */
  const renderSearchForm = () => (
    <form
      onSubmit={submitSearch}
      className="fd-search flex items-center gap-1.5 rounded-lg px-2.5 py-1"
      style={{ background: 'var(--surface-2, #F8F9FC)', border: '1px solid var(--border, #ECEFF4)' }}
    >
      <button type="submit" aria-label={t('common.search')} className="shrink-0" style={{ lineHeight: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-mute, #626F7E)' }}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
      <input
        type="text"
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        placeholder={t('nav.search_placeholder')}
        aria-label={t('common.search')}
        className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px]"
        style={{ color: 'var(--ink, #030E1D)', fontWeight: 400 }}
      />
      {searchQ && (
        <button
          type="button"
          onClick={() => setSearchQ('')}
          aria-label={t('nav.search_clear')}
          className="shrink-0 text-[10px] px-1 py-0.5 rounded hover:bg-[#F8F9FC]"
          style={{ color: 'var(--ink-mute, #626F7E)' }}
        >✕</button>
      )}
      <kbd
        className="text-[9.5px] px-1 py-0.5 rounded shrink-0"
        style={{
          background: 'var(--flc-paper2, #F8F9FC)',
          color: 'var(--ink-mute, #626F7E)',
          border: '1px solid var(--hairline, #ECEFF4)',
          fontWeight: 500,
        }}
        title={t('nav.search_enter_hint')}
      >
        ↵
      </kbd>
    </form>
  );
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

  // Analytics moved to the unified light theme (av2-light-skin) — same
  // palette as the rest of the dashboard so navigating Analytics ↔
  // Customers ↔ Campaigns no longer flips colour modes. Keeping the
  // variable as `false` so a future per-route theme toggle has a single
  // place to wire in without re-introducing the dead branches.
  const isAnalyticsDark = false;

  return (
    <div
      className="relative flex min-h-screen fdt-dash flc"
      /* Card edge is a hairline OR a shadow, never both — one attribute so
         both variants can be captured without an edit between shots. */
      data-card-edge="shadow"
    >
      <AmbientBackdrop role={role} />

      <aside
        className={`sticky top-0 z-10 ${collapsed ? 'w-[72px]' : 'w-[72px] lg:w-64'} h-screen flex flex-col shrink-0 transition-[width,background-color] duration-200 ease-out fd-aside fd-sidebar-host`}
        style={{
          background: C.surface,
          borderRight: `1px solid ${C.hairline}`,
          alignSelf: 'flex-start',
        }}
      >
        {/* Collapse toggle — three-line hamburger pinned to the right edge.
            One symbol for both states; the colour/background flips so the
            user still gets feedback about open vs collapsed. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('nav.expand_sidebar') : t('nav.collapse_sidebar')}
          aria-expanded={!collapsed}
          title={collapsed ? t('nav.expand_sidebar') : t('nav.collapse_sidebar')}
          className="absolute -right-3 top-6 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: collapsed ? 'var(--flc-card, #FFFFFF)' : 'var(--flc-ink, #030E1D)',
            border: `1px solid ${collapsed ? C.hairline : 'var(--flc-ink, #030E1D)'}`,
            boxShadow: '0 2px 6px rgba(28,25,23,0.10)',
            color: collapsed ? C.inkSoft : 'var(--flc-paper, #FFFFFF)',
          }}
        >
          <Menu size={14} strokeWidth={2.25} />
        </button>

        {/* Brand mark + role badge */}
        <div className={collapsed ? 'p-3 pb-2' : 'p-5 pb-3'}>
          <Link to="/" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm shadow-sm shrink-0"
              style={{ background: C.blue, fontWeight: 500 }}
              title={collapsed ? `FidéliTour · ${theme.label}` : undefined}
            >
              F
            </div>
            {!collapsed && (
              <div className="min-w-0 fd-railhide">
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

        </div>

        {/* P6C-0c — sidebar search slot. Mounted only when the sidebar is
            expanded, and shown only at lg+ where the aside is actually 232px
            wide; below lg it is display:none via `hidden`, so the rail never
            contains a search field and the topbar slot is the live one. */}
        {role === 'business_owner' && !collapsed && (
          <div className="hidden lg:block fd-searchslot fd-searchslot--side">
            {renderSearchForm()}
          </div>
        )}

        <div className="px-4">
          <div className="h-px" style={{ background: C.hairline }} />
        </div>

        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-4 space-y-0.5 overflow-y-auto`}>
          {role === 'business_owner' && (
            <>
              <NavGroup label={t('nav.group_overview')} collapsed={collapsed} />
              <NavLink to="/dashboard"               icon={Home}         label={t('nav.dashboard')}        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/analytics"     icon={BarChart3}    label={t('nav.analytics')}        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavGroup label={t('nav.group_customers')} collapsed={collapsed} />
              <NavLink to="/dashboard/settings#settings-status" icon={Shield} label={t('nav.customer_status')}  currentPath={currentPath} role={role} collapsed={collapsed} badge={t('nav.new_badge')} />
              <NavLink to="/dashboard/insights"      icon={Sparkles}     label={t('nav.insights')}         currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/customers"     icon={Users}        label={t('nav.customers')}        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/map"           icon={MapPin}       label={t('nav.customer_map')}     currentPath={currentPath} role={role} collapsed={collapsed} />
              {/* Scan Visit is intentionally NOT in the owner sidebar — that page
                  is the staff workspace. Owners can reach it via direct URL. */}
              <NavGroup label={t('nav.group_engagement')} collapsed={collapsed} />
              <NavLink to="/dashboard/card-designer" icon={CreditCard}   label={t('nav.card_designer')} currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/campaigns"     icon={Megaphone}    label={t('nav.campaigns')}     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/ai-assistant"  icon={BrainCircuit} label={t('nav.ai_assistant')}  currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/history"       icon={History}      label={t('nav.history')}       currentPath={currentPath} role={role} collapsed={collapsed} />
              {/* Settings is expandable — click → dropdown of section anchors */}
              <SettingsNavLink icon={Settings2} currentPath={currentPath} role={role} collapsed={collapsed} />
              <SupportNavItem onClick={() => setSupportOpen(true)} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
          {role === 'manager' && (
            <>
              <NavLink to="/dashboard/analytics" icon={BarChart3} label={t('nav.analytics')}    currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/insights"  icon={Sparkles}  label={t('nav.insights')}     currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/customers" icon={Users}     label={t('nav.customers')}    currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/map"       icon={MapPin}    label={t('nav.customer_map')} currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/dashboard/history"   icon={History}   label={t('nav.history')}      currentPath={currentPath} role={role} collapsed={collapsed} />
              <SupportNavItem onClick={() => setSupportOpen(true)} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
          {role === 'staff' && (
            <>
              <NavLink to="/dashboard/scan" icon={QrCode} label={t('nav.scan_visit')} currentPath={currentPath} role={role} collapsed={collapsed} />
              <SupportNavItem onClick={() => setSupportOpen(true)} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
          {role === 'super_admin' && (
            <>
              <NavLink to="/admin"               icon={Home}         label="Dashboard"          currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/analytics"     icon={BarChart3}    label="Global Analytics"   currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/insights"      icon={Sparkles}     label="Insights"           currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/tenants"       icon={Database}     label="Manage Businesses"  currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/plans"         icon={Shield}       label="Plan Limits"        currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/card-designer" icon={Palette}      label="Card Designer"      currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/campaigns"     icon={Megaphone}    label="Campaigns"          currentPath={currentPath} role={role} collapsed={collapsed} />
              <NavLink to="/admin/ai"            icon={BrainCircuit} label="AI Intelligence"    currentPath={currentPath} role={role} collapsed={collapsed} />
              <SupportNavItem onClick={() => setSupportOpen(true)} collapsed={collapsed} />
              <SignOutNavItem onClick={logout} collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* User chip — sign-out moved into the nav, directly below Settings */}
        {/* P6C-0c — ONE workspace/account block. The tenant identity that used
            to sit in a second card up in the header now lives here, next to the
            account it belongs to. Every value is the same value as before —
            tenant name, /join slug, user email, role label — and the tenant
            card's title string is carried over so no information is lost. */}
        <div
          className={`fd-workspace ${collapsed ? 'p-3' : 'p-4'} mt-auto`}
          style={{ borderTop: `1px solid ${C.hairline}` }}
          title={!collapsed && tenantInfo
            ? `${t('nav.account')} : ${tenantInfo.name || t('nav.account_no_name')} · slug: ${tenantInfo.slug || '—'}`
            : undefined}
        >
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-1'}`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: C.blue }}
              title={collapsed ? (user?.email || '') : undefined}
            >
              {(user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 fd-railhide">
                {tenantInfo ? (
                  <p
                    className="text-[9px] uppercase tracking-[0.16em]"
                    style={{ color: 'var(--ink-mute)', fontWeight: 500 }}
                  >
                    {t('nav.account')}
                  </p>
                ) : null}
                {tenantInfo ? (
                  <p
                    className="text-[13px] truncate"
                    style={{ color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.01em' }}
                  >
                    {tenantInfo.name || t('nav.account_no_name')}
                  </p>
                ) : null}
                <p className="text-[11px] truncate" style={{ color: 'var(--ink-mute)' }}>
                  {user?.email || '—'}
                </p>
                <p className="text-[10px] tracking-[0.10em] uppercase mt-0.5" style={{ color: 'var(--ink-mute)', fontWeight: 600 }}>
                  {theme.label}
                </p>
                {tenantInfo && tenantInfo.slug && (
                  <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--ink-mute)' }}>
                    /join/{tenantInfo.slug}
                  </p>
                )}
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
            className="fd-topbar sticky top-0 z-30 flex items-center gap-3 px-6 lg:px-8 py-2.5 backdrop-blur"
            style={{
              background: 'var(--surface-1, #FFFFFF)',
              borderBottom: '1px solid var(--border, #ECEFF4)',
            }}
          >
            {/* P6C-0c — topbar search slot. Same renderSearchForm() the sidebar
                calls. Live whenever the sidebar cannot host it: manually
                collapsed at any width, or below lg where the aside is a 72px
                rail. At lg+ expanded it is display:none, so exactly one form
                is interactive at a time and neither carries its own state. */}
            <div className={`fd-searchslot fd-searchslot--top shrink-0${collapsed ? '' : ' lg:hidden'}`}>
              {renderSearchForm()}
            </div>

            {/* Branch banner inline — fills the middle */}
            <div className="flex-1 min-w-0 px-2">
              <BranchPillsBanner compact />
            </div>

            {/* P6: the day/night toggle went with the dark theme. */}

            {/* Bell */}
            <div className="shrink-0">
              <NotificationBell />
            </div>

            {/* Help icon */}
            <button
              type="button"
              aria-label={t('nav.help')}
              title={t('nav.help')}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'transparent', border: '1px solid var(--hairline, #ECEFF4)', color: 'var(--ink-mute, #626F7E)' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--flc-paper2, #F8F9FC)'; }}
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

      {/* Support modal — opened from any sidebar "Support" item, mounted
          once here so it overlays every dashboard page consistently. */}
      <SupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultEmail={user?.email || ''}
        tenantSlug={user?.tenant_slug || ''}
      />
    </div>
  );
};

export default DashboardLayout;
