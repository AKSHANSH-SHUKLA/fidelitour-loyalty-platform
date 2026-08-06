/**
 * Mission-control primitives: ambient canvas, animated counters, glass cards.
 *
 * TRANSLATOR SAFETY: this app runs a DOM-walking translator that replaces text
 * nodes in place; React then crashes on insertBefore if it patches those same
 * nodes. Every dynamic string here is rendered inside an element KEYED BY ITS
 * OWN CONTENT, so a change remounts the node instead of patching it.
 */
import { useEffect, useRef, useState } from 'react';
import { MC, glass, EASE } from './mc';

/** Slow-drifting light blobs — the "room" the control tower sits in. */
export function AmbientCanvas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden"
         style={{ background: `radial-gradient(120% 90% at 50% -10%, #0D1428 0%, ${MC.bg} 45%, ${MC.bgDeep} 100%)` }}>
      <style>{`
        @keyframes mcFloatA{0%,100%{transform:translate3d(-6%,-4%,0) scale(1)}50%{transform:translate3d(6%,6%,0) scale(1.12)}}
        @keyframes mcFloatB{0%,100%{transform:translate3d(5%,3%,0) scale(1.05)}50%{transform:translate3d(-7%,-6%,0) scale(.95)}}
        @keyframes mcRise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
        @keyframes mcPulse{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){
          [data-mc-blob],[data-mc-rise]{animation:none !important}
        }
      `}</style>
      <div data-mc-blob style={{ position: 'absolute', top: '-18%', left: '4%', width: 620, height: 620,
        background: 'radial-gradient(circle, rgba(124,124,248,.30), transparent 62%)',
        filter: 'blur(48px)', animation: 'mcFloatA 26s ease-in-out infinite' }} />
      <div data-mc-blob style={{ position: 'absolute', bottom: '-24%', right: '-6%', width: 680, height: 680,
        background: 'radial-gradient(circle, rgba(56,217,232,.20), transparent 62%)',
        filter: 'blur(56px)', animation: 'mcFloatB 32s ease-in-out infinite' }} />
      <div data-mc-blob style={{ position: 'absolute', top: '34%', right: '26%', width: 420, height: 420,
        background: 'radial-gradient(circle, rgba(199,125,255,.14), transparent 65%)',
        filter: 'blur(60px)', animation: 'mcFloatA 38s ease-in-out infinite reverse' }} />
    </div>
  );
}

/** Entrance wrapper — staggered rise, the house motion. */
export function Rise({ delay = 0, children, className = '', style }) {
  return (
    <div data-mc-rise className={className}
         style={{ animation: `mcRise .5s ${EASE} both`, animationDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/** Counts up to `value`. Keyed by the rendered text so the translator can't
    fight React over the digits. */
export function AnimatedNumber({ value = 0, duration = 900, suffix = '', className = '', style }) {
  const [shown, setShown] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const target = Number(value) || 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(target); return; }
    const t0 = performance.now();
    const from = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  const text = `${shown.toLocaleString('fr-FR')}${suffix}`;
  return <span key={text} className={className} style={style}>{text}</span>;
}

/** A glass stat tile with a big animated number. Acts as a FILTER when
    `onClick` is given: `active` shows which slice the list below is showing. */
export function StatTile({ label, value, tone, suffix = '', delay = 0, onClick, active }) {
  const c = { danger: MC.red, warn: MC.amber, ok: MC.green }[tone] || MC.ink;
  return (
    <Rise delay={delay}>
      <button onClick={onClick} disabled={!onClick} aria-pressed={onClick ? !!active : undefined}
              className="w-full text-left p-4 transition-transform duration-200 disabled:cursor-default relative"
              style={{ ...glass(tone), cursor: onClick ? 'pointer' : 'default',
                       outline: active ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
              onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: c, lineHeight: 1.05 }}>
          <AnimatedNumber value={value} suffix={suffix} />
        </div>
        <div key={label} style={{ fontSize: 11.5, color: active ? c : MC.ink3, marginTop: 4,
                                  fontWeight: active ? 700 : 400 }}>{label}</div>
        {onClick && !active && (
          <div style={{ position: 'absolute', right: 12, top: 12, fontSize: 10, color: MC.ink3 }}>filtrer</div>
        )}
      </button>
    </Rise>
  );
}

/** Glass panel with an optional title row. */
export function Panel({ title, right, children, tone, delay = 0, className = '', style }) {
  return (
    <Rise delay={delay} className={className} style={style}>
      <section style={{ ...glass(tone), padding: 16 }}>
        {(title || right) && (
          <header className="flex items-center gap-3 mb-3">
            {title && <h3 key={title} style={{ fontSize: 13, fontWeight: 600, color: MC.ink, letterSpacing: '.01em' }}>{title}</h3>}
            <div className="ml-auto">{right}</div>
          </header>
        )}
        {children}
      </section>
    </Rise>
  );
}

/** Small status pill. */
export function Pill({ children, tone = 'idle' }) {
  const map = {
    danger: [MC.red, 'rgba(255,107,107,.14)'], warn: [MC.amber, 'rgba(245,184,81,.14)'],
    ok: [MC.green, 'rgba(61,220,151,.14)'], accent: [MC.indigo, 'rgba(124,124,248,.16)'],
    idle: [MC.ink3, 'rgba(255,255,255,.06)'],
  };
  const [fg, bg] = map[tone] || map.idle;
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : undefined;
  return (
    <span key={text} style={{ color: fg, background: bg, fontSize: 11, fontWeight: 700,
      padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
  );
}

/** Primary / ghost button in the mission-control language. */
export function McButton({ children, onClick, variant = 'primary', size = 'md', style, ...rest }) {
  const base = {
    borderRadius: 12, fontWeight: 600, cursor: 'pointer',
    transition: `transform .18s ${EASE}, background .18s ${EASE}, box-shadow .18s ${EASE}`,
    fontSize: size === 'sm' ? 12 : 13.5, padding: size === 'sm' ? '7px 12px' : '10px 16px',
  };
  const variants = {
    primary: { background: `linear-gradient(135deg, ${MC.indigo}, #5B5BE8)`, color: '#fff',
               boxShadow: '0 10px 26px -14px rgba(124,124,248,.9)' },
    danger: { background: `linear-gradient(135deg, ${MC.red}, #E14B4B)`, color: '#fff',
              boxShadow: '0 10px 26px -14px rgba(255,107,107,.9)' },
    ok: { background: 'rgba(61,220,151,.14)', color: MC.green, border: '1px solid rgba(61,220,151,.35)' },
    ghost: { background: 'rgba(255,255,255,.06)', color: MC.ink2, border: `1px solid ${MC.stroke}` },
  };
  return (
    <button onClick={onClick} {...rest}
            style={{ ...base, ...variants[variant], ...style }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'none')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}>
      {children}
    </button>
  );
}

/** "Live" dot — signals the agent is on watch. */
export function LiveDot({ color = MC.green }) {
  return (
    <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999,
      background: color, boxShadow: `0 0 10px ${color}`, animation: 'mcPulse 2.4s ease-in-out infinite' }} />
  );
}
