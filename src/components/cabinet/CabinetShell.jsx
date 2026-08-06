/**
 * CabinetShell — the frame every Espace Cabinet page sits in.
 *
 * WHY: the sidebar, the ambient canvas and the dark palette used to live only
 * on the home page, so /cabinet/revue, /cabinet/cas and /cabinet/equipe looked
 * like a different product and the nav highlight was stuck on "Accueil". One
 * shell fixes both: same chrome everywhere, and the active item is derived from
 * the route instead of being passed in by hand.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cabinetOsAPI, casesAPI, comptableAPI } from '../../lib/api';
import { MC } from './mc';
import { AmbientCanvas } from './Primitives';
import Sidebar, { useSidebar } from './Sidebar';
import LiveText from '../LiveText';

/** Route → which sidebar item is lit. */
function activeFor(pathname) {
  if (pathname.startsWith('/cabinet/revue')) return 'review';
  if (pathname.startsWith('/cabinet/cas')) return 'cases';
  if (pathname.startsWith('/cabinet/equipe')) return 'team';
  return 'home';
}

export default function CabinetShell({ title, subtitle, headerRight, children,
                                       onHomeExtra, onDossiersExtra }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [sidebarOpen, toggleSidebar] = useSidebar();
  const [counts, setCounts] = useState({ dossiers: 0, review: 0, cases: 0 });
  const [canOnboard, setCanOnboard] = useState(false);
  const [busyRelances, setBusyRelances] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (ok, msg, ms = 8000) => { setToast({ ok, msg }); setTimeout(() => setToast(null), ms); };

  const loadCounts = useCallback(() => {
    comptableAPI.clients().then((r) => setCounts((c) => ({ ...c, dossiers: r?.data?.totals?.count ?? 0 }))).catch(() => {});
    comptableAPI.reviewQueue().then((r) => setCounts((c) => ({ ...c, review: r?.data?.count ?? 0 }))).catch(() => {});
    casesAPI.list({ status: 'open' }).then((r) => setCounts((c) => ({ ...c, cases: r?.data?.counts?.open ?? 0 }))).catch(() => {});
    cabinetOsAPI.me().then((r) => setCanOnboard(!!r?.data?.can?.assign)).catch(() => {});
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const goHome = () => {
    if (location.pathname === '/cabinet') { onHomeExtra ? onHomeExtra() : window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else navigate('/cabinet');
  };

  return (
    <div className="min-h-screen relative" style={{ color: MC.ink }}>
      <AmbientCanvas />
      <div className="relative flex">
        <Sidebar
          open={sidebarOpen} onToggle={toggleSidebar}
          active={activeFor(location.pathname)} canOnboard={canOnboard} counts={counts}
          onHome={goHome}
          onDossiers={() => {
            if (location.pathname === '/cabinet' && onDossiersExtra) onDossiersExtra();
            else navigate('/cabinet');
          }}
          onReview={() => navigate('/cabinet/revue')}
          onCases={() => navigate('/cabinet/cas')}
          onTeam={() => navigate('/cabinet/equipe')}
          onNewClient={() => navigate('/cabinet?new=1')}
          exportUrl={comptableAPI.exportUrl}
          relancesBusy={busyRelances}
          onRelances={async () => {
            setBusyRelances(true);
            try {
              const r = await cabinetOsAPI.runCollection();
              flash(true, `Agent : ${r.data.emails_sent} email(s) envoyé(s), ${r.data.cases_opened} cas escaladé(s), ${r.data.waiting_not_due} en attente.`);
              loadCounts();
            } catch (e) { flash(false, e?.response?.data?.detail || 'Relances impossibles.'); }
            setBusyRelances(false);
          }}
          onImportClients={async (e) => {
            const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
            try {
              const r = await cabinetOsAPI.importClients(await f.text());
              flash(true, `${r.data.created} client(s) importé(s)` + (r.data.skipped ? `, ${r.data.skipped} ignoré(s).` : '.'));
              loadCounts();
            } catch (err) { flash(false, err?.response?.data?.detail || 'Import impossible.'); }
          }}
          onDemo={() => navigate('/cabinet?demo=1')}
          onTour={() => navigate('/cabinet?tour=1')}
          onLogout={() => { logout(); navigate('/login'); }} />

        <div className="flex-1 min-w-0">
          <main className="max-w-4xl mx-auto px-4 pb-16 pt-6">
            {toast && (
              <div className="mb-4 rounded-2xl px-4 py-3 text-sm"
                   style={toast.ok
                     ? { background: 'rgba(61,220,151,.12)', border: '1px solid rgba(61,220,151,.35)', color: MC.green }
                     : { background: 'rgba(255,107,107,.10)', border: '1px solid rgba(255,107,107,.35)', color: MC.red }}>
                <LiveText>{(toast.ok ? '✓ ' : '⚠ ') + toast.msg}</LiveText>
              </div>
            )}
            {(title || headerRight) && (
              <header className="flex items-center gap-3 mb-5 flex-wrap">
                <div>
                  {title && (
                    <h1 key={title} style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: MC.ink }}>
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p key={subtitle} style={{ fontSize: 12.5, color: MC.ink3, marginTop: 2 }}>{subtitle}</p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">{headerRight}</div>
              </header>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
