import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Bell, RefreshCw, Trash2, Gift, Sparkles, ChevronRight, Store, MapPin, Phone, Globe, CheckCircle2, XCircle } from 'lucide-react';
import api from '../lib/api';
import TierBadge from '../components/TierBadge';

const MyWalletCardPage = () => {
  const { barcodeId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [tab, setTab] = useState('offers'); // offers | news | program
  const [toast, setToast] = useState(null);

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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const togglePref = async (key) => {
    if (!data) return;
    setSavingPrefs(true);
    const newVal = !data.prefs[key];
    try {
      const res = await api.put(`/card/${barcodeId}/prefs`, { [key]: newVal });
      setData({ ...data, prefs: res.data });
      showToast(
        key === 'auto_update'
          ? (newVal ? 'Mise à jour automatique activée' : 'Mise à jour automatique désactivée')
          : (newVal ? 'Notifications activées' : 'Notifications désactivées')
      );
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
  const offerCount = offers.filter(o => o.kind === 'primary' || o.kind === 'campaign').length;
  const usedOffers = 0; // Simulation — not tracked yet
  const design = card.design || {};
  const primary = design.primary_color || '#B85C38';
  const secondary = design.secondary_color || '#1C1917';
  const textColor = design.text_color || '#FFFFFF';
  const accent = design.accent_color || '#D4A574';
  const stampsEarned = card.stamps_earned || 0;
  const stampsTarget = card.reward_threshold || 10;
  const stampsPct = Math.min(100, Math.round((stampsEarned / stampsTarget) * 100));

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-['Manrope'] py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-[#B85C38] text-sm">← Retour</Link>
          <TierBadge tier={customer.tier} size="sm" />
        </div>

        <div className="grid lg:grid-cols-[1fr,360px] gap-8">
          {/* LEFT: Wallet pass card */}
          <section>
            <div
              className="rounded-2xl shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(${design.gradient_direction || '135deg'}, ${primary} 0%, ${secondary} 100%)` }}
            >
              {/* Header */}
              <div className="px-6 pt-6 flex items-center justify-between" style={{ color: textColor }}>
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

              {/* Active offer banner */}
              {activeOffer?.active && activeOffer?.title && (
                <div
                  className="mx-6 mt-5 rounded-xl p-5 text-center"
                  style={{ background: accent, color: secondary }}
                >
                  <p className="text-3xl font-black tracking-tight uppercase leading-tight" style={{ fontFamily: 'Cormorant Garamond' }}>
                    {activeOffer.title}
                  </p>
                  <p className="text-xs mt-1 opacity-90">{activeOffer.description}</p>
                </div>
              )}

              {/* Body */}
              <div className="px-6 py-6 text-center" style={{ color: textColor }}>
                <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Votre carte</p>
                <div className="bg-white rounded-xl p-4 mx-auto inline-block">
                  <QRCodeSVG value={customer.barcode_id} size={140} />
                </div>
                <p className="mt-3 font-mono text-sm opacity-90">{customer.barcode_id}</p>
              </div>

              {/* Stamps progress */}
              <div className="px-6 pb-4" style={{ color: textColor }}>
                <div className="flex justify-between text-xs mb-1.5 opacity-90">
                  <span>Progression récompense</span>
                  <span>{stampsEarned}/{stampsTarget}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/20">
                  <div className="h-full" style={{ width: `${stampsPct}%`, background: accent }} />
                </div>
                <p className="text-xs mt-2 opacity-80">🎁 {card.reward_description}</p>
              </div>

              {/* Counter row */}
              <div className="px-6 pb-6 grid grid-cols-3 gap-3 text-center" style={{ color: textColor }}>
                <div className="bg-white/10 rounded-lg py-2">
                  <p className="text-xs opacity-80">Visites</p>
                  <p className="font-bold text-lg">{customer.visits}</p>
                </div>
                <div className="bg-white/10 rounded-lg py-2">
                  <p className="text-xs opacity-80">Points</p>
                  <p className="font-bold text-lg">{customer.points}</p>
                </div>
                <div className="bg-white/10 rounded-lg py-2">
                  <p className="text-xs opacity-80">Offres</p>
                  <p className="font-bold text-lg">{usedOffers}/{offerCount}</p>
                </div>
              </div>
            </div>

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
              <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#1C1917]">Mon Programme de Fidélité</h2>
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
