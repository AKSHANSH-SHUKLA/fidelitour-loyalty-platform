/**
 * RightAiPanel — the sticky right rail with score, insights, quick
 * actions, and an assistant stub.
 *
 * Phase 6 wires real content. Phase 7 will add focus rings + reduced
 * motion + screen-reader labels.
 */
import React from 'react';
import { TrendingUp, AlertTriangle, Sparkles, Send, UserPlus, Download, MessageCircle } from 'lucide-react';
import ScoreWidget from './ScoreWidget';

const Eyebrow = ({ children }) => (
  <div
    style={{
      fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'hsl(228 11% 60%)', fontWeight: 500, marginBottom: 8,
    }}
  >
    {children}
  </div>
);

const Card = ({ children, glow = false }) => (
  <div
    className={`av2-card${glow ? ' av2-glow' : ''}`}
    style={{ padding: 12 }}
  >
    {children}
  </div>
);

const InsightItem = ({ icon: Icon, iconColor, title, cta, onClick }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    <Icon size={14} style={{ color: iconColor, marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
    <div style={{ fontSize: 11, color: 'hsl(228 14% 81%)', lineHeight: 1.4, minWidth: 0 }}>
      <div>{title}</div>
      {cta && (
        <button
          type="button"
          onClick={onClick}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'hsl(252 95% 85%)', font: 'inherit', fontSize: 11,
            padding: 0, marginTop: 2,
          }}
        >
          {cta} →
        </button>
      )}
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, label, primary = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 9,
      background: primary ? 'hsl(228 28% 14%)' : 'transparent',
      border: 'none', cursor: 'pointer',
      color: primary ? 'hsl(228 23% 97%)' : 'hsl(228 14% 81%)',
      font: 'inherit', fontSize: 11.5, width: '100%', textAlign: 'left',
      transition: 'background 150ms ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(258 90% 66% / .08)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = primary ? 'hsl(228 28% 14%)' : 'transparent'; }}
  >
    <Icon size={13} style={{ color: primary ? 'hsl(252 95% 85%)' : 'hsl(228 11% 60%)' }} aria-hidden="true" />
    {label}
  </button>
);

const RightAiPanel = ({
  score = 82,
  scoreDelta = 6,
  insights = [],
  onAction,
  onAssistantSubmit,
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
      <Card glow>
        <Eyebrow>Score fidélité IA</Eyebrow>
        <ScoreWidget score={score} delta={scoreDelta} />
      </Card>

      <Card>
        <Eyebrow>Insights IA</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.length === 0 ? (
            <div style={{ fontSize: 11, color: 'hsl(228 11% 41%)' }}>
              Aucune alerte cette semaine.
            </div>
          ) : insights.map((it, i) => (
            <InsightItem
              key={i}
              icon={
                it.kind === 'opportunity' ? TrendingUp
                : it.kind === 'warning' ? AlertTriangle
                : Sparkles
              }
              iconColor={
                it.kind === 'opportunity' ? 'hsl(160 84% 50%)'
                : it.kind === 'warning' ? 'hsl(38 92% 50%)'
                : 'hsl(252 95% 85%)'
              }
              title={it.text}
              cta={it.cta}
              onClick={it.onClick}
            />
          ))}
        </div>
      </Card>

      <Card>
        <Eyebrow>Actions rapides</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <QuickAction icon={Send}      label="Nouvelle campagne"     primary onClick={() => onAction?.('new-campaign')} />
          <QuickAction icon={UserPlus}  label="Importer des clients"          onClick={() => onAction?.('import-customers')} />
          <QuickAction icon={Download}  label="Exporter en CSV"               onClick={() => onAction?.('export-csv')} />
        </div>
      </Card>

      <Card>
        <Eyebrow>Assistant IA</Eyebrow>
        <div style={{ fontSize: 11, color: 'hsl(228 14% 81%)', lineHeight: 1.5, marginBottom: 8 }}>
          Demandez "Qui sont mes top 10 clients ?" ou "Pourquoi le trafic baisse mardi ?"
        </div>
        <form onSubmit={handleAssistant}>
          <label htmlFor="av2-assistant-input" style={{ position: 'absolute', left: -10000 }}>
            Question à l'assistant
          </label>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px',
              background: 'hsl(228 28% 14%)',
              border: '1px solid hsl(230 32% 18%)',
              borderRadius: 9,
            }}
          >
            <MessageCircle size={13} style={{ color: 'hsl(228 11% 41%)', flexShrink: 0 }} aria-hidden="true" />
            <input
              id="av2-assistant-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Posez une question…"
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 'none', outline: 'none',
                color: 'hsl(228 23% 97%)', font: 'inherit', fontSize: 11,
              }}
            />
          </div>
        </form>
      </Card>
    </>
  );
};

export default RightAiPanel;
