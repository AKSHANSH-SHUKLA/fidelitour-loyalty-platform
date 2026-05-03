import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Bell, RefreshCw, Trash2, Gift, Sparkles, ChevronRight, Store, MapPin, Phone, Globe, CheckCircle2, XCircle, Clock, ChevronDown, X } from 'lucide-react';
import api, { publicAPI } from '../lib/api';
import { ensureSubscribed, unsubscribe as unsubscribePush, isSupported as isPushSupported } from '../lib/webpush';
import TierBadge from '../components/TierBadge';
import { AuchanPreview, DEFAULT_LAYOUT as AUCHAN_DEFAULT } from '../components/AuchanCard';

// ---------------------------------------------------------------------------
// Element / stamp rendering — mirrors the owner-side designer
// ---------------------------------------------------------------------------
const ELEMENT_FALLBACK_TEXT = {
  business_name: '{business_name}',
  customer_name: '{name}',
  tier: 'Statut : {tier}',
  points: '{points} pts',
  birthday: '🎂 {birthday}',
  offer_banner: '{offer_title}',
  reward_hint: 'Encore {points_remaining} points pour une récompense',
  logo: '',
};

const substitute = (text, ctx) => {
  if (!text) return '';
  return String(text)
    .replace(/\{name\}/g, ctx.name || '')
    .replace(/\{first_name\}/g, (ctx.name || '').split(' ')[0] || '')
    .replace(/\{tier\}/g, (ctx.tier || '').charAt(0).toUpperCase() + (ctx.tier || '').slice(1))
    .replace(/\{points\}/g, ctx.points ?? 0)
    .replace(/\{points_remaining\}/g, ctx.points_remaining ?? '')
    .replace(/\{birthday\}/g, ctx.birthday || '')
    .replace(/\{business_name\}/g, ctx.business_name || '')
    .replace(/\{offer_title\}/g, ctx.offer_title || '');
};

const RenderElement = ({ id, cfg, ctx, tpl }) => {
  if (!cfg || cfg.visible === false) return null;
  const text = substitute(cfg.text ?? ELEMENT_FALLBACK_TEXT[id] ?? '', ctx);
  if (id === 'logo' && tpl.logo_url) {
    return (
      <img
        src={tpl.logo_url}
        alt=""
        className="absolute rounded-lg object-cover border-2 border-white/20 pointer-events-none"
        style={{
          left: `${cfg.x_pct}%`, top: `${cfg.y_pct}%`,
          transform: 'translate(-50%, -50%)',
          width: `${Math.max(cfg.font_size * 3, 44)}px`,
          height: `${Math.max(cfg.font_size * 3, 44)}px`,
        }}
      />
    );
  }
  if (!text) return null;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${cfg.x_pct}%`, top: `${cfg.y_pct}%`,
        transform: 'translate(-50%, -50%)',
        fontFamily: cfg.font_family || 'Inter',
        fontSize: `${cfg.font_size || 14}px`,
        fontWeight: cfg.font_weight || 'normal',
        fontStyle: cfg.font_style || 'normal',
        textDecoration: cfg.text_decoration || 'none',
        color: cfg.color || '#FFFFFF',
        textAlign: cfg.align || 'left',
        whiteSpace: 'nowrap', maxWidth: '92%',
      }}
    >{text}</div>
  );
};

const StampVisual = ({ style, filled, total, accent }) => {
  if (style === 'none') return null;
  if (style === 'bar') {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Carte de fidélité</div>
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(filled / total) * 100}%`, background: accent }} />
        </div>
        <div className="text-xs opacity-80 mt-1">{filled} / {total} visites</div>
      </div>
    );
  }
  const items = [...Array(total)];
  const cols = Math.min(total, 10);
  const renderOne = (i) => {
    const on = i < filled;
    if (style === 'hexagon') return (
      <svg key={i} viewBox="0 0 100 100" className="w-8 h-8 drop-shadow-sm" style={{ fill: on ? accent : 'transparent', stroke: accent, strokeWidth: 4 }}>
        <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" />
      </svg>
    );
    if (style === 'circles') return <div key={i} className="w-7 h-7 rounded-full border-2" style={{ background: on ? accent : 'transparent', borderColor: accent }} />;
    if (style === 'classic_dots') return <div key={i} className="w-4 h-4 rounded-full" style={{ background: on ? accent : 'rgba(255,255,255,0.2)' }} />;
    if (style === 'squares') return <div key={i} className="w-7 h-7 rounded border-2" style={{ background: on ? accent : 'transparent', borderColor: accent }} />;
    if (style === 'stars') return (
      <svg key={i} viewBox="0 0 24 24" className="w-7 h-7" style={{ fill: on ? accent : 'transparent', stroke: accent, strokeWidth: 1.5 }}>
        <polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" />
      </svg>
    );
    return null;
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] uppercase tracking-widest opacity-70">Carte de fidélité</div>
      <div className="grid gap-2 justify-items-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, auto))` }}>
        {items.map((_, i) => renderOne(i))}
      </div>
    </div>
  );
};

const MyWalletCardPage = () => {
  const { barcodeId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [tab, setTab] = useState('offers'); // offers | news | program
  const [toast, setToast] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Rate-your-visit state
  const [reviewRating, setReviewRating] = useState(8);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewThanks, setReviewThanks] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/card/${barcodeId}`);
        setData(res.data);
      } catch (e) {
        setErr(e.response?.data?.detail || 'Card not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [barcodeId]);

  // Self-healing web-push subscription: if the customer has push_enabled=true
  // (set on a previous visit) but the browser has no live subscription right
  // now — e.g. they cleared site data, switched device, or the browser rotated
  // the endpoint — silently re-register. This runs only when permission is
  // already granted, so we never prompt the user unexpectedly.
  useEffect(() => {
    if (!data?.prefs?.push_enabled) return;
    if (!isPushSupported()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const tenantSlug = data?.tenant?.slug;
    if (!tenantSlug || !barcodeId) return;
    ensureSubscribed(tenantSlug, barcodeId).catch(() => { /* silent */ });
  }, [data?.prefs?.push_enabled, data?.tenant?.slug, barcodeId]);

  // Real-time proximity push: when the wallet card page opens AND the user has
  // already granted geolocation, ping the backend with the current GPS. If the
  // customer is within the tenant's configured radius, a proximity push is
  // logged and shown as a toast. Rate-limited on the server side by the
  // tenant's geo_cooldown_days.
  useEffect(() => {
    if (!data?.customer?.id || !navigator.geolocation) return;
    // Only ping once per card view, and stay silent if permissions are denied
    // (don't pop a prompt — we let the Join flow ask for geo explicitly).
    let ignored = false;
    navigator.permissions?.query({ name: 'geolocation' }).then((perm) => {
      if (perm.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (ignored) return;
          try {
            const res = await publicAPI.proximityPing({
              customer_id: data.customer.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            if (res?.data?.status === 'sent') {
              showToast(`📍 ${res.data.title || 'Vous êtes juste à côté !'}`);
            }
          } catch (_e) { /* best-effort; ignore */ }
        },
        () => { /* user-denied or timeout — silent */ },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    }).catch(() => {});
    return () => { ignored = true; };
  }, [data?.customer?.id]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const togglePref = async (key) => {
    if (!data) return;
    setSavingPrefs(true);
    const newVal = !data.prefs[key];
    try {
      // Persist the preference flag first so the backend knows the user's intent
      const res = await api.put(`/card/${barcodeId}/prefs`, { [key]: newVal });
      setData({ ...data, prefs: res.data });

      // For the push toggle, also drive the actual browser subscription.
      // We do this AFTER the prefs save so the toggle visibly flips first.
      if (key === 'push_enabled') {
        const tenantSlug = data?.tenant?.slug;
        if (newVal) {
          if (!isPushSupported()) {
            showToast("Ce navigateur ne supporte pas les notifications push.");
          } else {
            const result = await ensureSubscribed(tenantSlug, barcodeId);
            if (result.ok) {
              showToast('Notifications activées');
            } else if (result.status === 'permission_denied') {
              showToast("Veuillez autoriser les notifications dans votre navigateur.");
            } else if (result.status === 'vapid_not_configured') {
              showToast("Notifications push non configurées (contactez le commerçant).");
            } else {
              showToast("Impossible d'activer les notifications.");
            }
          }
        } else {
          await unsubscribePush(tenantSlug, barcodeId).catch(() => {});
          showToast('Notifications désactivées');
        }
      } else {
        showToast(
          newVal ? 'Mise à jour automatique activée' : 'Mise à jour automatique désactivée'
        );
      }
    } catch (e) {
      showToast('Échec de la mise à jour');
    } finally {
      setSavingPrefs(false);
    }
  };

  const deleteCard = async () => {
    if (!window.confirm('Supprimer cette carte du wallet ? Vos visites restent enregistrées côté commerçant.')) return;
    try {
      await api.delete(`/card/${barcodeId}`);
      setDeleted(true);
    } catch (e) {
      showToast('Impossible de supprimer la carte');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#57534E]">Chargement de votre carte…</div>;
  }
  if (err) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 border border-[#E7E5E4] max-w-md text-center">
          <XCircle className="mx-auto text-[#B85C38] mb-3" size={40} />
          <p className="text-[#1C1917] font-semibold mb-2">Carte introuvable</p>
          <p className="text-[#57534E] text-sm">{err}</p>
          <Link to="/" className="inline-block mt-5 text-[#B85C38] underline">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }
  if (deleted) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 border border-[#E7E5E4] max-w-md text-center">
          <CheckCircle2 className="mx-auto text-[#4A5D23] mb-3" size={40} />
          <p className="text-[#1C1917] font-semibold mb-2">Carte supprimée</p>
          <p className="text-[#57534E] text-sm">Votre carte a bien été retirée de votre wallet.</p>
          <Link to="/" className="inline-block mt-5 text-[#B85C38] underline">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  const { customer, tenant, card, offers, prefs, notifications } = data;
  const activeOffer = card.active_offer;
  const stampsTarget = card.reward_threshold || 10;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-['Manrope'] py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-[#B85C38] text-sm">← Retour</Link>
          <TierBadge tier={customer.tier} size="sm" />
        </div>

        <div className="grid lg:grid-cols-[1fr,360px] gap-8">
          {/* LEFT: Wallet pass card — prefers Auchan layout, falls back to legacy WalletPass */}
          <section>
            {card?.auchan_layout ? (
              <div className="flex flex-col items-center">
                <AuchanPreview
                  layout={{
                    ...AUCHAN_DEFAULT,
                    ...card.auchan_layout,
                    meter: { ...AUCHAN_DEFAULT.meter, ...(card.auchan_layout.meter || {}) },
                    slots: { ...AUCHAN_DEFAULT.slots, ...(card.auchan_layout.slots || {}) },
                    push: { ...AUCHAN_DEFAULT.push, ...(card.auchan_layout.push || {}) },
                  }}
                  ctx={{
                    first_name: customer.first_name || customer.name?.split(' ')?.[0] || 'Client',
                    name: customer.name,
                    points: customer.points ?? 0,
                    birthday: customer.birthday || '',
                    tier: customer.tier,
                    loyalty_number: customer.loyalty_number || customer.barcode_id || customer.id || '—',
                    business_name: tenant.business_name || tenant.name || '',
                    stamps_earned: card.stamps_earned ?? 0,
                    stamps_target: card.reward_threshold || 10,
                  }}
                  width={420}
                />
                <button
                  onClick={() => setDetailsOpen(true)}
                  className="mt-3 text-sm text-[#B85C38] underline"
                >
                  Voir plus d’informations
                </button>
              </div>
            ) : (
              <WalletPass
                customer={customer}
                tenant={tenant}
                card={card}
                activeOffer={activeOffer}
                onOpenDetails={() => setDetailsOpen(true)}
              />
            )}

            {/* Add-to-wallet buttons */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button className="bg-black text-white py-3 rounded-xl font-medium text-sm">
                Add to Apple Wallet
              </button>
              <button className="bg-[#1C1917] text-white py-3 rounded-xl font-medium text-sm">
                Add to Google Wallet
              </button>
            </div>

            {/* Push notification preview */}
            <div className="mt-6 bg-white/70 backdrop-blur rounded-xl p-4 border border-[#E7E5E4]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-[#B85C38]" />
                <h3 className="text-sm font-semibold text-[#1C1917]">Aperçu de la notification push</h3>
              </div>
              <div className="bg-[#1C1917]/5 rounded-lg p-3 flex gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: primary, color: textColor }}>
                  {tenant.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[#1C1917]">{tenant.name}</p>
                  <p className="text-xs text-[#57534E] leading-snug">
                    {activeOffer?.active
                      ? `${activeOffer.title} — ${activeOffer.description}`
                      : 'Nouvelle offre disponible dans votre carte de fidélité'}
                  </p>
                  <p className="text-[10px] text-[#8B8680] mt-0.5">maintenant</p>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Settings + offers panel */}
          <aside className="bg-white rounded-2xl border border-[#E7E5E4] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#E7E5E4]">
              <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold ft-gradient-text-slow">Mon Programme de Fidélité</h2>
              <p className="text-xs text-[#57534E] mt-1">{customer.name} · {customer.email}</p>
            </div>

            {/* Toggle list */}
            <div className="divide-y divide-[#E7E5E4]">
              <ToggleRow
                icon={<RefreshCw size={18} />}
                label="Mise à jour automatique"
                hint="Met à jour votre carte sans action de votre part"
                value={prefs.auto_update}
                onToggle={() => togglePref('auto_update')}
                disabled={savingPrefs}
              />
              <ToggleRow
                icon={<Bell size={18} />}
                label="Autoriser les notifications"
                hint="Recevez les nouvelles offres et rappels"
                value={prefs.push_enabled}
                onToggle={() => togglePref('push_enabled')}
                disabled={savingPrefs}
              />
              <button
                onClick={deleteCard}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-[#FFF4F1] transition-colors text-[#B85C38]"
              >
                <Trash2 size={18} />
                <div>
                  <p className="font-medium text-sm">Supprimer la carte</p>
                  <p className="text-xs opacity-80">Retire la carte de votre wallet</p>
                </div>
              </button>
            </div>

            {/* Rate your visit — only shown right after a visit (<= 14 days). */}
            {(() => {
              const lastVisit = customer.last_visit_date ? new Date(customer.last_visit_date) : null;
              const recentVisit = lastVisit && (Date.now() - lastVisit.getTime()) / 86400000 <= 14;
              if (!recentVisit) return null;
              if (reviewThanks) {
                return (
                  <div className="m-3 rounded-xl border border-[#4A5D23]/40 bg-[#e8f3e5] p-4 text-center">
                    <p className="text-sm font-semibold text-[#2d5016]">Merci pour votre avis ! 🙏</p>
                    <p className="text-xs text-[#2d5016]/80 mt-1">Votre retour aide {tenant.name} à progresser.</p>
                  </div>
                );
              }
              return (
                <div className="m-3 rounded-xl border border-[#E3A869]/40 bg-[#FEF9E7] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-[#1C1917]">Comment s'est passée votre visite ?</p>
                    <span className="text-xs text-[#7B3F00]">Votre note reste anonyme</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#57534E] w-4">1</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={reviewRating}
                        onChange={(e) => setReviewRating(parseInt(e.target.value, 10))}
                        className="flex-1 accent-[#B85C38]"
                      />
                      <span className="text-xs text-[#57534E] w-6">10</span>
                    </div>
                    <p className="text-center mt-1">
                      <span className="text-3xl font-bold text-[#B85C38]">{reviewRating}</span>
                      <span className="text-sm text-[#57534E]">/10</span>
                    </p>
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
                    placeholder="Un mot pour l'équipe ? (optionnel — service, propreté, accueil…)"
                    rows={2}
                    className="w-full text-sm border border-[#E7E5E4] rounded p-2 bg-white resize-none"
                  />
                  {reviewError && (
                    <p className="text-xs text-red-600 mt-2">{reviewError}</p>
                  )}
                  <button
                    type="button"
                    disabled={reviewSubmitting}
                    onClick={async () => {
                      try {
                        setReviewSubmitting(true);
                        setReviewError(null);
                        await publicAPI.submitReview({
                          customer_id: customer.id,
                          barcode_id: customer.barcode_id,
                          rating: reviewRating,
                          text: reviewText,
                          visit_id: customer.last_visit_id || undefined,
                          branch_id: customer.branch_id || undefined,
                        });
                        setReviewThanks(true);
                        setReviewText('');
                      } catch (e) {
                        setReviewError(e?.response?.data?.detail || 'Impossible d\'envoyer votre avis.');
                      } finally {
                        setReviewSubmitting(false);
                      }
                    }}
                    className="mt-3 w-full bg-[#B85C38] text-white py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Envoi…' : 'Envoyer mon avis'}
                  </button>
                </div>
              );
            })()}

            {/* Tabs */}
            <div className="flex border-t border-[#E7E5E4] bg-[#FDFBF7]">
              <TabBtn active={tab === 'offers'}  onClick={() => setTab('offers')} label="Offres" count={offers.length} />
              <TabBtn active={tab === 'news'}    onClick={() => setTab('news')}   label="News"   count={notifications.length} />
              <TabBtn active={tab === 'program'} onClick={() => setTab('program')} label="Programme" />
            </div>

            <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
              {tab === 'offers' && (offers.length === 0 ? (
                <p className="text-sm text-[#8B8680] text-center py-8">Aucune offre active pour le moment.</p>
              ) : offers.map(o => (
                <div key={o.id} className="rounded-lg border border-[#E7E5E4] p-3 bg-white">
                  <div className="flex items-start gap-3">
                    <Gift size={18} className="text-[#B85C38] mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-[#1C1917] text-sm">{o.title}</p>
                      <p className="text-xs text-[#57534E] mt-0.5">{o.description}</p>
                      {o.valid_until && (
                        <p className="text-[10px] text-[#8B8680] mt-1">Valable jusqu'au {new Date(o.valid_until).toLocaleDateString('fr-FR')}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-[#8B8680]" />
                  </div>
                </div>
              )))}

              {tab === 'news' && (notifications.length === 0 ? (
                <p className="text-sm text-[#8B8680] text-center py-8">Aucune actualité récente.</p>
              ) : notifications.map(n => (
                <div key={n.id} className="rounded-lg border border-[#E7E5E4] p-3 bg-white">
                  <p className="font-semibold text-[#1C1917] text-sm flex items-center gap-2">
                    <Bell size={14} className="text-[#B85C38]" />
                    {n.title}
                  </p>
                  <p className="text-xs text-[#57534E] mt-1 leading-snug">{n.body}</p>
                  {n.sent_at && (
                    <p className="text-[10px] text-[#8B8680] mt-1">{new Date(n.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                  )}
                </div>
              )))}

              {tab === 'program' && (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border border-[#E7E5E4] p-3 bg-white">
                    <p className="text-xs text-[#8B8680] uppercase tracking-wider font-semibold mb-1">Récompense</p>
                    <p className="text-[#1C1917] font-medium">🎁 {card.reward_description}</p>
                    <p className="text-xs text-[#57534E] mt-1">Débloquée après {stampsTarget} visites.</p>
                  </div>
                  <div className="rounded-lg border border-[#E7E5E4] p-3 bg-white">
                    <p className="text-xs text-[#8B8680] uppercase tracking-wider font-semibold mb-1">Points par visite</p>
                    <p className="text-[#1C1917] font-medium">+{card.points_per_visit} pts à chaque passage</p>
                  </div>
                  <div className="rounded-lg border border-[#E7E5E4] p-3 bg-white">
                    <p className="text-xs text-[#8B8680] uppercase tracking-wider font-semibold mb-2">Commerçant</p>
                    <p className="flex items-center gap-2 text-[#1C1917]"><Store size={14} /> {tenant.name}</p>
                    {tenant.address && <p className="flex items-center gap-2 text-[#57534E] text-xs mt-1"><MapPin size={12} /> {tenant.address}</p>}
                    {tenant.phone && <p className="flex items-center gap-2 text-[#57534E] text-xs mt-1"><Phone size={12} /> {tenant.phone}</p>}
                    {tenant.website && <p className="flex items-center gap-2 text-[#57534E] text-xs mt-1"><Globe size={12} /> {tenant.website}</p>}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1C1917] text-white text-sm py-2.5 px-5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Tap-to-expand details drawer */}
      {detailsOpen && (
        <DetailsDrawer tenant={tenant} card={card} onClose={() => setDetailsOpen(false)} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Wallet pass — applies the modern card-template schema
// ---------------------------------------------------------------------------
const WalletPass = ({ customer, tenant, card, activeOffer, onOpenDetails }) => {
  const design = card.design || {};
  const primary = card.primary_color || design.primary_color || '#1C1917';
  const secondary = card.secondary_color || design.secondary_color || '#B85C38';
  const accent = card.accent_color || design.accent_color || '#D4A574';
  const textColor = design.text_color || '#FFFFFF';

  const elements = card.elements || {};
  const stampStyle = card.stamp_style || 'hexagon';
  const showMeter = card.show_meter !== false;
  const promotion = card.promotion || { enabled: false };
  const stampsTarget = card.reward_threshold || 10;
  const stampsEarned = Math.min(customer.visits || 0, stampsTarget);
  const pointsRemaining = Math.max(0, stampsTarget - stampsEarned);

  const ctx = {
    name: customer.name, tier: customer.tier,
    points: customer.points, points_remaining: pointsRemaining,
    birthday: customer.birthday, business_name: tenant.name,
    offer_title: activeOffer?.active ? activeOffer.title : '',
  };

  const hasElements = elements && Object.keys(elements).some(k => elements[k]?.visible !== false);

  return (
    <>
      <div className="rounded-2xl shadow-xl overflow-hidden relative" style={{ background: `linear-gradient(${design.gradient_direction || '135deg'}, ${primary} 0%, ${secondary} 100%)`, color: textColor }}>
        {/* Promotion mode — replaces the header region */}
        {promotion.enabled ? (
          <div className="p-6">
            <div className="rounded-xl px-5 py-6 text-center relative overflow-hidden" style={{ background: promotion.background_color || accent, color: promotion.text_color || '#FFFFFF', backgroundImage: promotion.image_url ? `url(${promotion.image_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              {promotion.image_url && <div className="absolute inset-0 bg-black/40" />}
              <div className="relative">
                <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Avantage exclusif fidélité</p>
                <p className="text-3xl font-black leading-tight" style={{ fontFamily: 'Cormorant Garamond' }}>{promotion.title || 'Promotion'}</p>
                {promotion.subtitle && <p className="text-sm opacity-90 mt-1 font-semibold">{promotion.subtitle}</p>}
                {promotion.body && <p className="text-xs opacity-80 mt-3 leading-snug whitespace-pre-wrap">{promotion.body}</p>}
                {promotion.link && (
                  <a href={promotion.link} target="_blank" rel="noreferrer" className="mt-4 inline-block bg-white/20 backdrop-blur text-sm font-bold px-5 py-2 rounded-full hover:bg-white/30 transition-colors">
                    {promotion.link_label || 'En savoir plus'}
                  </a>
                )}
                {promotion.expires_at && (
                  <p className="text-[10px] opacity-70 mt-3 flex items-center justify-center gap-1">
                    <Clock size={10} /> expire le {new Date(promotion.expires_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : hasElements ? (
          // Free-form element layout
          <div className="relative h-[160px] border-b border-white/10">
            {Object.keys(elements).filter(id => ['logo', 'business_name', 'customer_name'].includes(id)).map(id => (
              <RenderElement key={id} id={id} cfg={elements[id]} ctx={ctx} tpl={card} />
            ))}
          </div>
        ) : (
          // Legacy fallback header
          <div className="px-6 pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {card.logo_url ? (
                <img src={card.logo_url} alt={tenant.name} className="w-11 h-11 rounded-lg object-cover border border-white/30" />
              ) : (
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-lg" style={{ background: accent, color: secondary }}>
                  {tenant.name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <p className="font-bold text-lg leading-none">{tenant.name}</p>
                <p className="text-xs opacity-80 mt-0.5">Programme de Fidélité</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Membre depuis</p>
              <p className="text-xs font-semibold">
                {customer.member_since ? new Date(customer.member_since).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Active offer banner — only when not already in promotion mode */}
        {!promotion.enabled && activeOffer?.active && activeOffer?.title && (
          <div className="mx-6 mt-5 rounded-xl p-4 text-center" style={{ background: accent, color: secondary }}>
            <p className="text-2xl font-black tracking-tight uppercase leading-tight" style={{ fontFamily: 'Cormorant Garamond' }}>{activeOffer.title}</p>
            {activeOffer.description && <p className="text-xs mt-1 opacity-90">{activeOffer.description}</p>}
          </div>
        )}

        {/* Stamps */}
        <div className="px-6 py-5">
          <StampVisual style={stampStyle} filled={stampsEarned} total={stampsTarget} accent={accent} />
          {showMeter && stampStyle !== 'none' && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] opacity-80 mb-1">
                <span>Progression récompense</span><span>{stampsEarned}/{stampsTarget}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/20">
                <div className="h-full rounded-full" style={{ width: `${(stampsEarned / stampsTarget) * 100}%`, background: accent }} />
              </div>
              <p className="text-[11px] opacity-80 mt-2">🎁 {card.reward_description}</p>
            </div>
          )}
        </div>

        {/* Element bottom strip: points / tier / birthday / reward_hint */}
        {hasElements && (
          <div className="relative h-[110px] border-t border-white/10">
            {Object.keys(elements).filter(id => ['points', 'tier', 'birthday', 'reward_hint'].includes(id)).map(id => (
              <RenderElement key={id} id={id} cfg={elements[id]} ctx={ctx} tpl={card} />
            ))}
          </div>
        )}

        {/* QR / barcode */}
        <div className="px-6 pb-5 pt-2 text-center">
          <div className="bg-white rounded-xl p-3 mx-auto inline-block">
            <QRCodeSVG value={customer.barcode_id} size={120} />
          </div>
          <p className="mt-2 font-mono text-xs opacity-90">{customer.barcode_id}</p>
        </div>

        {/* Counter row — always shown as quick glance info */}
        {!hasElements && (
          <div className="px-6 pb-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-lg py-2">
              <p className="text-xs opacity-80">Visites</p>
              <p className="font-bold text-lg">{customer.visits}</p>
            </div>
            <div className="bg-white/10 rounded-lg py-2">
              <p className="text-xs opacity-80">Points</p>
              <p className="font-bold text-lg">{customer.points}</p>
            </div>
            <div className="bg-white/10 rounded-lg py-2">
              <p className="text-xs opacity-80">Statut</p>
              <p className="font-bold text-sm uppercase">{customer.tier}</p>
            </div>
          </div>
        )}

        {/* Tap-to-expand call-to-action */}
        <button
          onClick={onOpenDetails}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] uppercase tracking-widest border-t border-white/10 hover:bg-white/5 transition-colors"
          style={{ color: textColor }}
        >
          Touchez pour plus de détails <ChevronDown size={12} />
        </button>
      </div>

      {/* Add-to-wallet buttons */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button className="bg-black text-white py-3 rounded-xl font-medium text-sm">Ajouter à Apple Wallet</button>
        <button className="bg-[#1C1917] text-white py-3 rounded-xl font-medium text-sm">Ajouter à Google Wallet</button>
      </div>

      {/* Push notification preview */}
      <div className="mt-6 bg-white/70 backdrop-blur rounded-xl p-4 border border-[#E7E5E4]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-[#B85C38]" />
          <h3 className="text-sm font-semibold text-[#1C1917]">Aperçu de la notification push</h3>
        </div>
        <div className="bg-[#1C1917]/5 rounded-lg p-3 flex gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: primary, color: textColor }}>
            {tenant.name?.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-[#1C1917]">{tenant.name}</p>
            <p className="text-xs text-[#57534E] leading-snug">
              {promotion.enabled
                ? `${promotion.title} — ${promotion.subtitle || 'Nouvelle offre disponible'}`
                : activeOffer?.active
                ? `${activeOffer.title} — ${activeOffer.description}`
                : 'Nouvelle offre disponible dans votre carte de fidélité'}
            </p>
            <p className="text-[10px] text-[#8B8680] mt-0.5">maintenant</p>
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Details drawer — opened when customer taps "pour plus de détails"
// ---------------------------------------------------------------------------
const DetailsDrawer = ({ tenant, card, onClose }) => {
  const details = card.details || {};
  const has = (v) => v && String(v).trim().length > 0;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#E7E5E4] flex items-center justify-between px-5 py-3">
          <h2 className="font-['Playfair_Display'] text-xl font-bold text-[#1C1917]">À propos de {tenant.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F4] rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {has(details.about) && (
            <div>
              <p className="text-xs font-bold text-[#8B8680] uppercase tracking-wider mb-1">À propos</p>
              <p className="text-[#1C1917] whitespace-pre-wrap leading-relaxed">{details.about}</p>
            </div>
          )}
          {has(details.hours) && (
            <div>
              <p className="text-xs font-bold text-[#8B8680] uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12} /> Horaires</p>
              <p className="text-[#1C1917] whitespace-pre-wrap">{details.hours}</p>
            </div>
          )}
          {has(details.address || tenant.address) && (
            <div>
              <p className="text-xs font-bold text-[#8B8680] uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={12} /> Adresse</p>
              <p className="text-[#1C1917]">{details.address || tenant.address}</p>
            </div>
          )}
          {has(details.phone || tenant.phone) && (
            <div>
              <p className="text-xs font-bold text-[#8B8680] uppercase tracking-wider mb-1 flex items-center gap-1"><Phone size={12} /> Téléphone</p>
              <a href={`tel:${details.phone || tenant.phone}`} className="text-[#B85C38] underline">{details.phone || tenant.phone}</a>
            </div>
          )}
          {has(details.website || tenant.website) && (
            <div>
              <p className="text-xs font-bold text-[#8B8680] uppercase tracking-wider mb-1 flex items-center gap-1"><Globe size={12} /> Site web</p>
              <a href={details.website || tenant.website} target="_blank" rel="noreferrer" className="text-[#B85C38] underline break-all">{details.website || tenant.website}</a>
            </div>
          )}
          {(has(details.instagram) || has(details.facebook)) && (
            <div className="flex gap-3">
              {has(details.instagram) && <a href={details.instagram.startsWith('http') ? details.instagram : `https://instagram.com/${details.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#B85C38] text-sm">Instagram: {details.instagram}</a>}
              {has(details.facebook) && <a href={details.facebook.startsWith('http') ? details.facebook : `https://facebook.com/${details.facebook}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#B85C38] text-sm">Facebook: {details.facebook}</a>}
            </div>
          )}
          {(details.custom_sections || []).map((s, i) => has(s.title) || has(s.body) ? (
            <div key={i}>
              {has(s.title) && <p className="text-xs font-bold text-[#8B8680] uppercase tracking-wider mb-1">{s.title}</p>}
              <p className="text-[#1C1917] whitespace-pre-wrap leading-relaxed">{s.body}</p>
            </div>
          ) : null)}
          {!has(details.about) && !has(details.hours) && !has(details.address) && !has(details.phone) && !has(details.website) && (details.custom_sections || []).length === 0 && (
            <p className="text-sm text-[#8B8680] italic text-center py-6">Le commerçant n'a pas encore ajouté de détails.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ToggleRow = ({ icon, label, hint, value, onToggle, disabled }) => (
  <div className="flex items-center gap-3 p-4">
    <div className="text-[#B85C38]">{icon}</div>
    <div className="flex-1">
      <p className="font-medium text-sm text-[#1C1917]">{label}</p>
      <p className="text-xs text-[#57534E]">{hint}</p>
    </div>
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#4A5D23]' : 'bg-[#D6D3D1]'} ${disabled ? 'opacity-60' : ''}`}
      aria-pressed={value}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

const TabBtn = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${active ? 'bg-white text-[#B85C38] border-b-2 border-[#B85C38]' : 'text-[#8B8680] hover:text-[#1C1917]'}`}
  >
    {label}{count !== undefined ? ` (${count})` : ''}
  </button>
);

export default MyWalletCardPage;
