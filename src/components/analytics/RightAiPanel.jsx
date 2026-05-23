/**
 * RightAiPanel — sticky right rail matching the V2 mockup.
 *
 *  ┌─ AI Copilot card (purple glow) ─────────────┐
 *  │ AI Copilot   [BETA]                          │
 *  │ Score de croissance                          │
 *  │ ●──────────   82  /100                       │
 *  │ Excellent                                     │
 *  │ ↑ 12 pts vs mois précédent                    │
 *  │ [ Voir le diagnostic complet ]                │
 *  └──────────────────────────────────────────────┘
 *  ┌─ Insights IA ────────────────────────────────┐
 *  │ ✦  N insight rows                             │
 *  │ Voir tous les insights →                      │
 *  └──────────────────────────────────────────────┘
 *  ┌─ Actions rapides ────────────────────────────┐
 *  │ Créer une campagne          ↗                 │
 *  │ Segmenter des clients       ↗                 │
 *  │ Exporter un rapport         ↗                 │
 *  │ Activer le mode auto        ↗                 │
 *  └──────────────────────────────────────────────┘
 *  ┌─ Assistant IA ───────────────────────────────┐
 *  │ Posez une question sur vos données…     ↗     │
 *  └──────────────────────────────────────────────┘
 */
import React from 'react';
import { Sparkles, ChevronRight, MessageSquarePlus, Users, Download, Zap, ArrowUpRight } from 'lucide-react';
import ScoreWidget from './ScoreWidget';

const Card = ({ children, glow = false, style = {} }) => (
  <div
    className={`av2-card${glow ? ' av2-glow' : ''}`}
    style={{ padding: 14, ...style }}
  >
    {children}
  </div>
);

const SectionTitle = ({ children, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <span style={{ fontSize: 13, fontWeight: 500, color: 'hsl(228 28% 14%)' }}>{children}</span>
    {action}
  </div>
);

const InsightItem = ({ text, cta, onClick }) => (
  <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid #ECE3D2' }}>
    <div
      aria-hidden="true"
      style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: 8,
        background: 'hsl(258 90% 66% / .15)',
        display: 'grid', placeItems: 'center',
        color: 'hsl(258 90% 50%)',
      }}
    >
      <Sparkles size={13} />
    </div>
    <div style={{ minWidth: 0, fontSize: 11.5, lineHeight: 1.45 }}>
      <div style={{ color: 'hsl(228 14% 35%)' }}>{text}</div>
      {cta && (
        <button
          type="button"
          onClick={onClick}
          style={{
            background: 'transparent', border: '1px solid #ECE3D2',
            borderRadius: 8, padding: '4px 9px', marginTop: 6, cursor: 'pointer',
            color: 'hsl(228 28% 14%)', font: 'inherit', fontSize: 11, fontWeight: 500,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(258 90% 66% / .08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {cta}
        </button>
      )}
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', textAlign: 'left',
      padding: '9px 10px',
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: 'hsl(228 14% 35%)', font: 'inherit', fontSize: 12,
      borderRadius: 8,
      transition: 'background 150ms ease, color 150ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'hsl(258 90% 66% / .08)';
      e.currentTarget.style.color = 'hsl(228 28% 14%)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'hsl(228 14% 35%)';
    }}
  >
    <Icon size={14} aria-hidden="true" style={{ color: 'hsl(258 90% 50%)', flexShrink: 0 }} />
    <span style={{ flex: 1 }}>{label}</span>
    <ChevronRight size={14} aria-hidden="true" style={{ color: 'hsl(228 11% 45%)', flexShrink: 0 }} />
  </button>
);

const scoreLabel = (n) => {
  if (n >= 80) return 'Excellent';
  if (n >= 60) return 'Bon';
  if (n >= 40) return 'Moyen';
  if (n > 0)   return 'À améliorer';
  return '—';
};

const RightAiPanel = ({
  score = 82,
  scoreDelta = 12,
  insights = [],
  onDiagnostic,
  onAction,
  onAssistantSubmit,
  onAllInsights,
}) => {
  const [draft, setDraft] = React.useState('');

  const handleAssistant = (e) => {
    e?.preventDefault?.();
    const text = (draft || '').trim();
    if (!text) return;
    if (onAssistantSubmit) onAssistantSubmit(text);
    setDraft('');
  };

  return (
    <>
      {/* AI Copilot — score + diagnostic CTA */}
      <Card glow>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'hsl(228 28% 14%)' }}>
            <Sparkles size={14} aria-hidden="true" style={{ color: 'hsl(258 90% 50%)' }} />
            AI Copilot
          </span>
          <span
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: 'hsl(258 90% 50%)',
              background: 'hsl(258 90% 66% / .15)',
              border: '1px solid hsl(258 90% 66% / .35)',
              padding: '2px 6px', borderRadius: 99,
            }}
          >
            BETA
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'hsl(228 11% 45%)', marginBottom: 8 }}>
          Score de croissance
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <ScoreWidget score={score} delta={null} denominator="100" />
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'hsl(160 84% 60%)', marginBottom: 4 }}>
          {scoreLabel(score)}
        </div>
        {scoreDelta != null && isFinite(scoreDelta) && (
          <div style={{ fontSize: 11, color: 'hsl(228 14% 35%)', marginBottom: 10 }}>
            <span style={{ color: scoreDelta >= 0 ? 'hsl(160 84% 60%)' : 'hsl(351 95% 71%)' }}>
              {scoreDelta >= 0 ? '↑' : '↓'} {Math.abs(scoreDelta)} pts
            </span>{' '}
            vs mois précédent
          </div>
        )}
        <button
          type="button"
          onClick={onDiagnostic}
          style={{
            width: '100%', padding: '8px 12px',
            background: '#FFFFFF',
            border: '1px solid #ECE3D2',
            borderRadius: 9,
            color: 'hsl(228 28% 14%)', cursor: 'pointer',
            font: 'inherit', fontSize: 12, fontWeight: 500,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(258 90% 66% / .1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
        >
          Voir le diagnostic complet
        </button>
      </Card>

      {/* Insights IA */}
      <Card>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={onAllInsights}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'hsl(258 90% 50%)', font: 'inherit', fontSize: 11, fontWeight: 500,
                padding: 0,
              }}
            >
              Voir tous →
            </button>
          }
        >
          Insights IA
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {insights.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'hsl(228 11% 55%)', padding: '8px 0' }}>
              Aucun insight pour cette période.
            </div>
          ) : insights.map((it, i) => (
            <InsightItem
              key={i}
              text={it.text}
              cta={it.cta}
              onClick={it.onClick}
            />
          ))}
        </div>
      </Card>

      {/* Actions rapides */}
      <Card>
        <SectionTitle>Actions rapides</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <QuickAction icon={MessageSquarePlus} label="Créer une campagne"     onClick={() => onAction?.('new-campaign')} />
          <QuickAction icon={Users}              label="Segmenter des clients" onClick={() => onAction?.('segment-customers')} />
          <QuickAction icon={Download}           label="Exporter un rapport"   onClick={() => onAction?.('export-report')} />
          <QuickAction icon={Zap}                label="Activer le mode auto"  onClick={() => onAction?.('auto-mode')} />
        </div>
      </Card>

      {/* Assistant IA */}
      <Card>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} aria-hidden="true" style={{ color: 'hsl(258 90% 50%)' }} />
            Assistant IA
          </span>
        </SectionTitle>
        <form onSubmit={handleAssistant}>
          <label htmlFor="av2-assistant-input" style={{ position: 'absolute', left: -10000 }}>
            Question à l'assistant
          </label>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 11px',
              background: '#FFFFFF',
              border: '1px solid #ECE3D2',
              borderRadius: 9,
            }}
          >
            <input
              id="av2-assistant-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Posez une question sur vos données…"
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 'none', outline: 'none',
                color: 'hsl(228 28% 14%)', font: 'inherit', fontSize: 11.5,
              }}
            />
            <button
              type="submit"
              aria-label="Envoyer la question"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'hsl(258 90% 50%)', padding: 0,
                display: 'grid', placeItems: 'center',
              }}
            >
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
        </form>
      </Card>
    </>
  );
};

export default RightAiPanel;
