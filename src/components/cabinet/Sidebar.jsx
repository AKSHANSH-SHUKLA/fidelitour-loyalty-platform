/**
 * Sidebar — the cabinet's permanent navigation rail.
 *
 * Why: every action used to live in one crowded header row, so nothing had a
 * home and nothing could be found twice. The rail groups them by intent —
 * PILOTAGE (what needs me), DONNÉES (getting data in and out), AIDE (learn) —
 * and collapses to icons for people who already know their way around.
 *
 * The collapsed/expanded choice is remembered per browser.
 */
import { useState } from 'react';
import {
  LayoutDashboard, FolderOpen, CheckCircle2, AlertTriangle, Users,
  Upload, Download, Send, PlayCircle, HelpCircle, LogOut, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { MC, EASE } from './mc';

const KEY = 'fidclic:sidebar';

export function useSidebar() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(KEY) !== 'closed'; } catch { return true; }
  });
  const toggle = () => setOpen((v) => {
    const nv = !v;
    try { localStorage.setItem(KEY, nv ? 'open' : 'closed'); } catch { /* ignore */ }
    return nv;
  });
  return [open, toggle];
}

function Item({ icon: Icon, label, badge, badgeTone = 'danger', active, open, onClick, tourId, as, htmlFor, children }) {
  const Wrapper = as || 'button';
  const tone = { danger: MC.red, warn: MC.amber, ok: MC.green, accent: MC.indigo }[badgeTone] || MC.red;
  return (
    <Wrapper
      {...(as === 'label' ? { htmlFor } : { onClick, type: 'button' })}
      data-tour={tourId}
      title={!open ? label : undefined}
      className="w-full flex items-center gap-3 rounded-xl transition-colors duration-200 cursor-pointer"
      style={{
        padding: open ? '9px 11px' : '10px 0',
        justifyContent: open ? 'flex-start' : 'center',
        background: active ? 'rgba(124,124,248,.16)' : 'transparent',
        color: active ? '#CFCBFF' : MC.ink2,
        border: `1px solid ${active ? 'rgba(124,124,248,.35)' : 'transparent'}`,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Icon size={17} className="shrink-0" />
      {open && <span key={label} style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
      {open && badge > 0 && (
        <span key={`b-${label}-${badge}`} className="ml-auto"
              style={{ fontSize: 10.5, fontWeight: 800, color: '#0B0F1C', background: tone,
                       borderRadius: 999, padding: '1px 7px' }}>{badge}</span>
      )}
      {!open && badge > 0 && (
        <span aria-hidden style={{ position: 'absolute', marginLeft: 18, marginTop: -14, width: 7, height: 7,
          borderRadius: 999, background: tone, boxShadow: `0 0 8px ${tone}` }} />
      )}
      {children}
    </Wrapper>
  );
}

function GroupLabel({ children, open }) {
  if (!open) return <div style={{ height: 10 }} />;
  return (
    <div key={children} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em',
      color: MC.ink3, textTransform: 'uppercase', padding: '14px 11px 6px' }}>{children}</div>
  );
}

export default function Sidebar({
  open, onToggle, active = 'home', counts = {},
  onHome, onDossiers, onReview, onCases, onTeam,
  onImportClients, exportUrl, onRelances, relancesBusy,
  onNewClient, onDemo, onTour, onLogout, canOnboard,
}) {
  return (
    <aside className="shrink-0 sticky top-0 h-screen flex flex-col"
           style={{ width: open ? 232 : 64, transition: `width .32s ${EASE}`,
                    borderRight: `1px solid ${MC.stroke}`, background: 'rgba(8,11,24,.55)',
                    backdropFilter: 'blur(16px)', padding: 12, gap: 2, overflow: 'hidden' }}>

      <div className="flex items-center gap-2 mb-2" style={{ padding: open ? '4px 6px' : '4px 0',
           justifyContent: open ? 'flex-start' : 'center' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: `linear-gradient(135deg, ${MC.indigo}, #5B5BE8)`,
                      boxShadow: '0 8px 22px -10px rgba(124,124,248,.9)', color: '#fff',
                      fontWeight: 800, fontSize: 13 }}>F</div>
        {open && <span style={{ fontWeight: 700, color: MC.ink, fontSize: 14 }}>FidClic</span>}
        {open && (
          <button onClick={onToggle} aria-label="Réduire le menu" className="ml-auto cursor-pointer"
                  style={{ color: MC.ink3 }}><PanelLeftClose size={16} /></button>
        )}
      </div>
      {!open && (
        <button onClick={onToggle} aria-label="Déplier le menu"
                className="cursor-pointer flex justify-center mb-1" style={{ color: MC.ink3 }}>
          <PanelLeft size={16} />
        </button>
      )}

      <GroupLabel open={open}>Pilotage</GroupLabel>
      <Item icon={LayoutDashboard} label="Accueil" open={open} active={active === 'home'}
            onClick={onHome} tourId="nav-home" />
      <Item icon={FolderOpen} label="Mes dossiers" open={open} badge={counts.dossiers}
            badgeTone="accent" active={active === 'dossiers'} onClick={onDossiers} tourId="nav-dossiers" />
      <Item icon={CheckCircle2} label="À valider" open={open} badge={counts.review}
            badgeTone="ok" active={active === 'review'} onClick={onReview} tourId="nav-review" />
      <Item icon={AlertTriangle} label="Cas ouverts" open={open} badge={counts.cases}
            active={active === 'cases'} onClick={onCases} tourId="nav-cases" />
      <Item icon={Users} label="Mon équipe" open={open} active={active === 'team'}
            onClick={onTeam} tourId="nav-team" />

      <GroupLabel open={open}>Données</GroupLabel>
      {canOnboard && (
        <Item icon={Send} label={relancesBusy ? 'Envoi…' : 'Lancer les relances'} open={open}
              onClick={onRelances} tourId="nav-relances" />
      )}
      {canOnboard && (
        <Item icon={Users} label="+ Nouveau client" open={open} onClick={onNewClient} tourId="nav-newclient" />
      )}
      {canOnboard && (
        <Item as="label" htmlFor="sb-import-clients" icon={Upload} label="Importer clients"
              open={open} tourId="nav-import">
          <input id="sb-import-clients" type="file" accept=".csv,.txt" className="hidden"
                 onChange={onImportClients} />
        </Item>
      )}
      <Item icon={Download} label="Exporter tout (CSV)" open={open}
            as="a" htmlFor={undefined} tourId="nav-export"
            onClick={() => { window.location.href = exportUrl; }} />

      <GroupLabel open={open}>Aide</GroupLabel>
      <Item icon={PlayCircle} label="Mode démo" open={open} onClick={onDemo} tourId="nav-demo" />
      <Item icon={HelpCircle} label="Visite guidée" open={open} onClick={onTour} tourId="nav-tour" />

      <div className="mt-auto">
        <Item icon={LogOut} label="Se déconnecter" open={open} onClick={onLogout} />
      </div>
    </aside>
  );
}
