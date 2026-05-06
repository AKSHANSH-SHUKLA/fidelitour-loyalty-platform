/**
 * NotificationBell — header bell with unread count + dropdown.
 *
 * Pulls from the existing /api/owner/insights/alerts endpoint (smart alerts).
 * For multi-store franchises, alerts cover all stores by default.
 *
 * "Unread" is tracked in localStorage by alert ID hash. When the user opens
 * the dropdown, all currently-shown alerts are marked read.
 */
import React, { useEffect, useState, useRef } from 'react';
import { Bell, AlertTriangle, TrendingDown, TrendingUp, Sparkles, X, Building2 } from 'lucide-react';
import api, { ownerAPI } from '../lib/api';

const STORAGE_KEY = 'ft_read_alerts_v1';

const loadReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch { return new Set(); }
};
const saveReadIds = (set) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
};

const severityIcon = (severity) => {
  if (severity === 'critical') return AlertTriangle;
  if (severity === 'warning')  return TrendingDown;
  if (severity === 'positive') return TrendingUp;
  return Sparkles;
};
const severityColor = (severity) => {
  if (severity === 'critical') return '#B85C38';
  if (severity === 'warning')  return '#E3A869';
  if (severity === 'positive') return '#4A5D23';
  return '#8B7DC9';
};

const NotificationBell = () => {
  const [alerts, setAlerts] = useState([]);
  const [readIds, setReadIds] = useState(loadReadIds);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Account / franchise headline data — business name + list of all stores
  const [accountName, setAccountName] = useState('');
  const [stores, setStores] = useState([]);
  const wrapperRef = useRef(null);

  // Fetch alerts on mount + every 5 minutes while page is open.
  // Uses the multi-store endpoint so each alert is tagged with its branch_name —
  // the user instantly sees which store the alert refers to.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Try multi-store first; fall back to single-tenant if it 404s
        let res;
        try {
          res = await api.get('/owner/insights/alerts/multi-store');
        } catch (_e) {
          res = await ownerAPI.getProactiveAlerts({});
        }
        if (!cancelled) setAlerts(Array.isArray(res.data?.alerts) ? res.data.alerts : (res.data || []));
      } catch (_e) { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Account info — load once. Tenant name + branches for the dropdown header.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await ownerAPI.getTenant();
        if (!cancelled) setAccountName(t.data?.name || 'Mon compte');
      } catch (_e) { /* silent */ }
      try {
        const b = await ownerAPI.getBranches();
        if (!cancelled) setStores(Array.isArray(b.data) ? b.data : []);
      } catch (_e) { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Click-outside to close
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadAlerts = alerts.filter((a) => !readIds.has(a.id || a.title));
  const unreadCount = unreadAlerts.length;

  const markAllRead = () => {
    const next = new Set(readIds);
    alerts.forEach((a) => next.add(a.id || a.title));
    setReadIds(next);
    saveReadIds(next);
  };

  const handleOpen = () => {
    setOpen(true);
    // After 600ms, mark visible alerts as read so the dot doesn't disappear instantly
    setTimeout(markAllRead, 600);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Soft pulsing halo on unread — only when there's something to look at,
          otherwise the bell sits quiet so it doesn't fight for attention. */}
      {unreadCount > 0 && (
        <style>{`
          @keyframes ftBellPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(184,92,56,0.55), 0 4px 14px -4px rgba(184,92,56,0.55); }
            50%      { box-shadow: 0 0 0 6px rgba(184,92,56,0.10), 0 4px 14px -4px rgba(184,92,56,0.55); }
          }
        `}</style>
      )}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #B85C38 0%, #E3A869 100%)',
          border: '2px solid rgba(255,255,255,0.85)',
          boxShadow: unreadCount > 0
            ? '0 4px 14px -4px rgba(184,92,56,0.55)'
            : '0 2px 8px -2px rgba(184,92,56,0.35)',
          animation: unreadCount > 0 ? 'ftBellPulse 2.4s ease-in-out infinite' : 'none',
        }}
        aria-label={`Notifications — ${unreadCount} unread`}
        title={unreadCount > 0 ? `${unreadCount} alerte(s) non lue(s) · toutes les boutiques` : 'Aucune alerte · toutes les boutiques'}
      >
        <Bell size={18} style={{ color: 'white' }} fill="white" strokeWidth={2.2} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{
              background: '#FFFFFF',
              color: '#B85C38',
              border: '1.5px solid #B85C38',
              boxShadow: '0 2px 4px rgba(184,92,56,0.4)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] rounded-2xl bg-white border shadow-2xl z-50 overflow-hidden"
          style={{ borderColor: '#EFE9E0' }}
        >
          {/* Account headline — the franchise/business name + every store under it */}
          <div
            className="px-4 py-3 border-b relative overflow-hidden"
            style={{
              borderColor: '#EFE9E0',
              background: 'linear-gradient(135deg, #1C1917 0%, #2A1C2E 100%)',
              color: 'white',
            }}
          >
            <div className="flex items-start justify-between gap-2 relative">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Compte</p>
                <p className="text-base font-bold leading-tight truncate"
                   style={{ fontFamily: 'Cormorant Garamond' }}>
                  {accountName || 'Mon compte'}
                </p>
                {stores.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {stores.slice(0, 6).map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(227,168,105,0.18)', color: '#FFD7A8', border: '1px solid rgba(227,168,105,0.35)' }}
                      >
                        <Building2 size={9} /> {s.name}
                      </span>
                    ))}
                    {stores.length > 6 && (
                      <span className="text-[9px] opacity-70 self-center">+{stores.length - 6} autres</span>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] opacity-70 mt-1">Boutique unique · résumé toutes boutiques</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <X size={14} style={{ color: 'white' }} />
              </button>
            </div>
          </div>
          <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#EFE9E0', background: '#FDFBF7' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8B8680' }}>
              Résumé intelligent · toutes mes boutiques
            </p>
            <p className="text-[9px]" style={{ color: '#A8A29E' }}>
              MAJ 5 min
            </p>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#8B8680' }}>
                Chargement…
              </div>
            ) : alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#8B8680' }}>
                Tout va bien — aucune alerte aujourd'hui ✨
              </div>
            ) : (
              alerts.map((a, i) => {
                const Icon = severityIcon(a.severity);
                const color = severityColor(a.severity);
                const isUnread = !readIds.has(a.id || a.title);
                return (
                  <div
                    key={a.id || i}
                    className="px-4 py-3 border-b last:border-b-0 flex gap-3 items-start"
                    style={{
                      borderColor: '#F5F1EB',
                      background: isUnread ? `linear-gradient(90deg, ${color}0F 0%, transparent 30%)` : 'white',
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                         style={{ background: `${color}1A` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Branch badge on TOP of the alert title — the owner instantly sees which store this alert is about.
                          For tenant-wide alerts ("Toutes les boutiques"), use a distinct chip + tooltip so it's clear
                          this is a network-wide signal, not a single-store one. */}
                      {a.branch_name && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1.5"
                          style={{
                            background: a.scope === 'tenant' ? '#FCE3DC' : `${color}1A`,
                            color: a.scope === 'tenant' ? '#9C4427' : color,
                            border: `1px solid ${a.scope === 'tenant' ? '#B85C3855' : color + '33'}`,
                          }}
                          title={a.scope === 'tenant'
                            ? "Réseau entier — alerte qui couvre toutes vos boutiques"
                            : `Boutique : ${a.branch_name}`}
                        >
                          <Building2 size={9} /> {a.scope === 'tenant' ? 'Toutes mes boutiques' : a.branch_name}
                        </span>
                      )}
                      <p className="text-sm font-bold leading-tight" style={{ color: '#1C1917' }}>
                        {a.title}
                      </p>
                      {a.body && (
                        <p className="text-xs mt-1 leading-snug" style={{ color: '#57534E' }}>
                          {a.body}
                        </p>
                      )}
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t bg-[#FDFBF7] text-center" style={{ borderColor: '#EFE9E0' }}>
              <p className="text-[10px]" style={{ color: '#8B8680' }}>
                {alerts.length} résumé{alerts.length > 1 ? 's' : ''} · Cliquez sur une carte pour voir le détail
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
