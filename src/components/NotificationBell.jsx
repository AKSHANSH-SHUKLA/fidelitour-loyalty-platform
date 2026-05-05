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
import { Bell, AlertTriangle, TrendingDown, TrendingUp, Sparkles, X } from 'lucide-react';
import { ownerAPI } from '../lib/api';

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
  const wrapperRef = useRef(null);

  // Fetch alerts on mount + every 5 minutes while page is open
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await ownerAPI.getProactiveAlerts({});
        if (!cancelled) setAlerts(Array.isArray(res.data?.alerts) ? res.data.alerts : (res.data || []));
      } catch (_e) { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
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
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-[#FAF8F4]"
        style={{ border: '1px solid #EFE9E0' }}
        aria-label="Notifications"
      >
        <Bell size={18} style={{ color: '#1C1917' }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #B85C38, #D77FA0)', boxShadow: '0 2px 6px rgba(184,92,56,0.55)' }}
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
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#EFE9E0' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: '#1C1917', fontFamily: 'Cormorant Garamond' }}>
                Résumé intelligent
              </p>
              <p className="text-[10px]" style={{ color: '#8B8680' }}>
                Toutes vos boutiques · mis à jour toutes les 5 min
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full hover:bg-[#FAF8F4] flex items-center justify-center"
              aria-label="Close"
            >
              <X size={14} style={{ color: '#57534E' }} />
            </button>
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
                      <p className="text-sm font-bold leading-tight" style={{ color: '#1C1917' }}>
                        {a.title}
                      </p>
                      {a.body && (
                        <p className="text-xs mt-1 leading-snug" style={{ color: '#57534E' }}>
                          {a.body}
                        </p>
                      )}
                      {a.branch_name && (
                        <p className="text-[10px] mt-1.5 font-bold uppercase tracking-widest" style={{ color }}>
                          📍 {a.branch_name}
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
