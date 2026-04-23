// Modern visual card designer — per-element styling, stamp library,
// promotion mode, tap-to-expand details, typed push notifications.
import React, { useEffect, useMemo, useState } from 'react';
import { ownerAPI } from '../lib/api';
import {
  Smartphone, Check, Image as ImageIcon, Type, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Sparkles, Gift, Bell, Megaphone,
  Info, Plus, Trash2, Star, Hexagon, Circle, Square, Minus, Eye, EyeOff,
  AlertTriangle, Calendar, Package, ShieldCheck, Zap, Newspaper
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Font & stamp catalogues
// ---------------------------------------------------------------------------
const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway',
  'Oswald', 'Bebas Neue', 'Playfair Display', 'Merriweather', 'PT Serif',
  'Lora', 'Cormorant Garamond', 'Libre Baskerville', 'Times New Roman',
  'Georgia', 'Nunito', 'Quicksand', 'Work Sans', 'Rubik', 'DM Serif Display',
  'Abril Fatface', 'Pacifico', 'Dancing Script', 'Caveat',
  'Shadows Into Light', 'Special Elite', 'Press Start 2P', 'Courier New'
];

const STAMP_STYLES = [
  { id: 'hexagon',      label: 'Alvéole hexagone', icon: Hexagon },
  { id: 'classic_dots', label: 'Points classiques', icon: Circle },
  { id: 'circles',      label: 'Cercles larges',    icon: Circle },
  { id: 'squares',      label: 'Cases',             icon: Square },
  { id: 'stars',        label: 'Étoiles',           icon: Star },
  { id: 'bar',          label: 'Barre de progression', icon: Minus },
  { id: 'none',         label: 'Aucun',             icon: EyeOff },
];

// Elements the business can style on the card. Each has sensible defaults so
// the card looks coherent before any customization.
const ELEMENT_DEFS = [
  { id: 'logo',           label: 'Logo',                 default: { x_pct: 18, y_pct: 10, font_size: 16, font_family: 'Inter',            font_weight: 'bold',   color: '#FFFFFF', align: 'left'   } },
  { id: 'business_name',  label: 'Nom du commerce',      default: { x_pct: 50, y_pct: 14, font_size: 20, font_family: 'Playfair Display', font_weight: 'bold',   color: '#FFFFFF', align: 'center', text: '{business_name}' } },
  { id: 'customer_name',  label: 'Nom du client',        default: { x_pct: 82, y_pct: 10, font_size: 12, font_family: 'Inter',            font_weight: 'bold',   color: '#FFFFFF', align: 'right',  text: '{name}' } },
  { id: 'tier',           label: 'Niveau (tier)',        default: { x_pct: 82, y_pct: 80, font_size: 12, font_family: 'Inter',            font_weight: 'bold',   color: '#FFD700', align: 'right',  text: 'Statut : {tier}' } },
  { id: 'points',         label: 'Points',               default: { x_pct: 18, y_pct: 80, font_size: 14, font_family: 'Bebas Neue',       font_weight: 'normal', color: '#FFFFFF', align: 'left',   text: '{points} pts' } },
  { id: 'birthday',       label: 'Anniversaire',         default: { x_pct: 50, y_pct: 80, font_size: 11, font_family: 'Inter',            font_weight: 'normal', color: '#FFFFFF', align: 'center', text: '🎂 {birthday}' } },
  { id: 'offer_banner',   label: 'Bannière d\'offre',    default: { x_pct: 50, y_pct: 28, font_size: 18, font_family: 'Cormorant Garamond', font_weight: 'bold', color: '#1C1917', align: 'center', text: '{offer_title}' } },
  { id: 'reward_hint',    label: 'Message récompense',   default: { x_pct: 50, y_pct: 72, font_size: 10, font_family: 'Inter',            font_weight: 'normal', color: '#FFFFFF', align: 'center', text: 'Encore {points_remaining} points pour une récompense' } },
];

const ELEMENT_DEFAULTS = Object.fromEntries(
  ELEMENT_DEFS.map(e => [e.id, {
    visible: true,
    x_pct: 50, y_pct: 50,
    font_family: 'Inter', font_size: 14,
    font_weight: 'normal', font_style: 'normal', text_decoration: 'none',
    color: '#FFFFFF', align: 'left', text: null,
    ...e.default,
  }])
);

const NOTIF_TYPES = [
  { id: 'news',           label: 'Actualité',              icon: Newspaper,    placeholder_title: 'Nouvelle collection', placeholder_body: 'Découvrez notre nouvelle collection en boutique ! ' },
  { id: 'offer',          label: 'Offre / Promotion',      icon: Gift,         placeholder_title: '-20% ce week-end',    placeholder_body: 'Profitez de 20% de réduction sur toute la boutique, du vendredi au dimanche.' },
  { id: 'flash_sale',     label: 'Vente flash',            icon: Zap,          placeholder_title: 'Vente flash !',        placeholder_body: 'Offre limitée à 24h — ne la manquez pas.' },
  { id: 'voucher_expiry', label: 'Expiration bon d\'achat', icon: AlertTriangle, placeholder_title: 'Votre bon expire bientôt', placeholder_body: 'Votre bon d\'achat expire dans 3 jours.' },
  { id: 'event',          label: 'Événement / RDV',        icon: Calendar,     placeholder_title: 'Invitation',           placeholder_body: 'Nous vous attendons samedi à 18h pour notre événement exclusif.' },
  { id: 'order_status',   label: 'Statut de commande',     icon: Package,      placeholder_title: 'Votre commande est prête', placeholder_body: 'Votre commande est prête à être retirée en boutique.' },
  { id: 'safety',         label: 'Mesures de sécurité',    icon: ShieldCheck,  placeholder_title: 'Nouvelles mesures',    placeholder_body: 'Retrouvez les dernières mesures de sécurité en boutique.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fontLabel = (f) => (f || 'Inter');
const mergeEl = (saved, id) => ({ ...ELEMENT_DEFAULTS[id], ...(saved?.[id] || {}) });

// Tiny mock substitution for the preview. Real substitution happens server-side.
const mockSub = (text, ctx) => {
  if (!text) return '';
  return String(text)
    .replace(/\{name\}/g, ctx.name)
    .replace(/\{first_name\}/g, ctx.first_name)
    .replace(/\{tier\}/g, ctx.tier)
    .replace(/\{points\}/g, ctx.points)
    .replace(/\{points_remaining\}/g, ctx.points_remaining)
    .replace(/\{birthday\}/g, ctx.birthday)
    .replace(/\{business_name\}/g, ctx.business_name)
    .replace(/\{offer_title\}/g, ctx.offer_title);
};

const PREVIEW_CTX = {
  name: 'Sophie Martin', first_name: 'Sophie', tier: 'Gold',
  points: '1 250', points_remaining: '2', birthday: '12 mars',
  business_name: 'Café Lumière', offer_title: '10€ CAGNOTTÉS',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const CardDesignerPage = () => {
  const [tpl, setTpl] = useState({
    primary_color: '#1C1917',
    secondary_color: '#E3A869',
    text_content: 'CAFÉ LUMIÈRE',
    logo_url: '',
    stamp_style: 'hexagon',
    show_meter: true,
    elements: {},
    promotion: { enabled: false, title: '', subtitle: '', body: '', background_color: '#B85C38', text_color: '#FFFFFF', link: '' },
    details: { about: '', hours: '', address: '', phone: '', website: '', instagram: '', facebook: '', custom_sections: [] },
    reward_description: 'Un café offert',
    reward_threshold_stamps: 10,
  });
  const [tab, setTab] = useState('elements');
  const [selectedEl, setSelectedEl] = useState('business_name');
  const [saving, setSaving] = useState(false);
  const [savedKind, setSavedKind] = useState('');
  const [notif, setNotif] = useState({ type: 'news', title: '', body: '', link: '', tier: '' });
  const [notifSending, setNotifSending] = useState(false);
  const [notifSent, setNotifSent] = useState(null);

  useEffect(() => {
    ownerAPI.getCardTemplate().then(r => {
      if (r.data) {
        setTpl(prev => ({
          ...prev,
          ...r.data,
          elements: r.data.elements || {},
          promotion: { ...prev.promotion, ...(r.data.promotion || {}) },
          details: { ...prev.details, ...(r.data.details || {}) },
        }));
      }
    }).catch(() => {});
  }, []);

  // Update helpers ----------------------------------------------------------
  const el = (id) => mergeEl(tpl.elements, id);
  const updateEl = (id, patch) => setTpl(t => ({
    ...t,
    elements: { ...(t.elements || {}), [id]: { ...mergeEl(t.elements, id), ...patch } }
  }));
  const updatePromo = (patch) => setTpl(t => ({ ...t, promotion: { ...t.promotion, ...patch } }));
  const updateDetails = (patch) => setTpl(t => ({ ...t, details: { ...t.details, ...patch } }));

  // Save handlers -----------------------------------------------------------
  const flashSaved = (kind) => {
    setSavedKind(kind);
    setTimeout(() => setSavedKind(''), 2500);
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await ownerAPI.saveCardTemplate(tpl);
      flashSaved('template');
    } finally { setSaving(false); }
  };

  const handleSavePromotion = async (notify = false) => {
    setSaving(true);
    try {
      await ownerAPI.savePromotion(tpl.promotion, notify);
      flashSaved(notify ? 'promotion_notified' : 'promotion');
    } finally { setSaving(false); }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await ownerAPI.saveCardDetails(tpl.details);
      flashSaved('details');
    } finally { setSaving(false); }
  };

  const handleSendNotification = async () => {
    if (!notif.title.trim() || !notif.body.trim()) return;
    setNotifSending(true);
    setNotifSent(null);
    try {
      const res = await ownerAPI.sendCardNotification({
        type: notif.type,
        title: notif.title,
        body: notif.body,
        link: notif.link || null,
        filters: notif.tier ? { tier: notif.tier } : {},
      });
      setNotifSent(res.data);
      setNotif(n => ({ ...n, title: '', body: '', link: '' }));
    } catch (e) {
      setNotifSent({ error: e?.response?.data?.detail || 'Échec de l\'envoi' });
    } finally { setNotifSending(false); }
  };

  // -----------------------------------------------------------------------
  return (
    <div className="p-6 lg:p-8 bg-[#FDFBF7] min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl lg:text-4xl font-['Playfair_Display'] font-bold text-[#1C1917]">Designer de carte</h1>
        <p className="text-[#57534E] mt-1">Positionnez et stylisez chaque élément de votre carte fidélité, exactement comme vous voulez que le client la voie.</p>
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-[#E7E5E4] mb-6">
        <TabBtn active={tab === 'elements'} onClick={() => setTab('elements')} icon={Type}       label="Éléments" />
        <TabBtn active={tab === 'stamps'}   onClick={() => setTab('stamps')}   icon={Hexagon}    label="Timbres" />
        <TabBtn active={tab === 'promo'}    onClick={() => setTab('promo')}    icon={Megaphone}  label="Promotion" />
        <TabBtn active={tab === 'details'}  onClick={() => setTab('details')}  icon={Info}       label="Détails carte" />
        <TabBtn active={tab === 'notify'}   onClick={() => setTab('notify')}   icon={Bell}       label="Notifications" />
      </nav>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* ======================= CONTROLS ======================= */}
        <div className="space-y-6">
          {tab === 'elements' && (
            <ElementsTab
              tpl={tpl} setTpl={setTpl}
              selectedEl={selectedEl} setSelectedEl={setSelectedEl}
              el={el} updateEl={updateEl}
              saving={saving} saved={savedKind === 'template'}
              onSave={handleSaveTemplate}
            />
          )}
          {tab === 'stamps' && (
            <StampsTab tpl={tpl} setTpl={setTpl} saving={saving} saved={savedKind === 'template'} onSave={handleSaveTemplate} />
          )}
          {tab === 'promo' && (
            <PromotionTab
              promo={tpl.promotion} update={updatePromo}
              saving={saving}
              savedStatus={savedKind === 'promotion' ? 'Promotion enregistrée' : savedKind === 'promotion_notified' ? 'Promotion enregistrée + notifications envoyées' : ''}
              onSave={handleSavePromotion}
            />
          )}
          {tab === 'details' && (
            <DetailsTab details={tpl.details} update={updateDetails} saving={saving} saved={savedKind === 'details'} onSave={handleSaveDetails} />
          )}
          {tab === 'notify' && (
            <NotifyTab notif={notif} setNotif={setNotif} sending={notifSending} sent={notifSent} onSend={handleSendNotification} />
          )}
        </div>

        {/* ======================= LIVE PREVIEW ======================= */}
        <div className="sticky top-4">
          <Phone>
            <Pass
              tpl={tpl}
              el={el}
              selectedEl={tab === 'elements' ? selectedEl : null}
              onSelectEl={(id) => { setTab('elements'); setSelectedEl(id); }}
            />
          </Phone>
          <p className="text-xs text-[#8B8680] text-center mt-3">Cliquez un élément du mockup pour l'éditer</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reusable controls
// ---------------------------------------------------------------------------
const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg border-b-2 -mb-px transition-colors ${active ? 'border-[#B85C38] text-[#B85C38] bg-white' : 'border-transparent text-[#57534E] hover:text-[#1C1917]'}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const FieldLabel = ({ children }) => (
  <label className="block text-[11px] font-bold text-[#57534E] uppercase tracking-wide mb-1.5">{children}</label>
);

const Card = ({ children, title, subtitle, right }) => (
  <section className="bg-white rounded-2xl border border-[#E7E5E4] shadow-sm p-5">
    {(title || right) && (
      <header className="flex items-start justify-between mb-4 gap-3">
        <div>
          {title && <h2 className="text-lg font-bold text-[#1C1917]">{title}</h2>}
          {subtitle && <p className="text-xs text-[#57534E] mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
);

const SaveBtn = ({ saving, saved, onClick, label = 'Publier sur toutes les cartes' }) => (
  <button onClick={onClick} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#B85C38] hover:bg-[#9C4E2F] disabled:opacity-60 text-white rounded-xl font-bold transition-all shadow-md">
    {saving ? 'Enregistrement…' : saved ? (<><Check className="w-5 h-5" /> Enregistré</>) : label}
  </button>
);

// ---------------------------------------------------------------------------
// Elements tab
// ---------------------------------------------------------------------------
const ElementsTab = ({ tpl, setTpl, selectedEl, setSelectedEl, el, updateEl, saving, saved, onSave }) => {
  const current = el(selectedEl);
  const def = ELEMENT_DEFS.find(d => d.id === selectedEl) || ELEMENT_DEFS[0];

  return (
    <>
      {/* Brand / background */}
      <Card title="Identité & fond" subtitle="Logo et couleurs de base de la carte">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Logo (URL de l'image)</FieldLabel>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
              <input type="text" placeholder="https://…/logo.png" value={tpl.logo_url || ''} onChange={e => setTpl(t => ({ ...t, logo_url: e.target.value }))} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
            </div>
          </div>
          <div>
            <FieldLabel>Nom affiché (par défaut)</FieldLabel>
            <input type="text" value={tpl.text_content || ''} onChange={e => setTpl(t => ({ ...t, text_content: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm font-bold outline-none" />
          </div>
          <div>
            <FieldLabel>Couleur de fond principal</FieldLabel>
            <input type="color" value={tpl.primary_color || '#1C1917'} onChange={e => setTpl(t => ({ ...t, primary_color: e.target.value }))} className="w-full h-10 rounded-lg border border-[#E7E5E4] cursor-pointer" />
          </div>
          <div>
            <FieldLabel>Couleur d'accent</FieldLabel>
            <input type="color" value={tpl.secondary_color || '#E3A869'} onChange={e => setTpl(t => ({ ...t, secondary_color: e.target.value }))} className="w-full h-10 rounded-lg border border-[#E7E5E4] cursor-pointer" />
          </div>
        </div>
      </Card>

      {/* Element picker */}
      <Card title="Éléments" subtitle="Choisissez un élément à positionner et styliser">
        <div className="flex flex-wrap gap-2 mb-4">
          {ELEMENT_DEFS.map(d => {
            const e = el(d.id);
            const sel = selectedEl === d.id;
            return (
              <button key={d.id} onClick={() => setSelectedEl(d.id)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${sel ? 'bg-[#1C1917] text-white border-[#1C1917]' : 'bg-white text-[#1C1917] border-[#E7E5E4] hover:border-[#1C1917]'}`}>
                <span className="mr-2 align-middle">{e.visible ? '●' : '○'}</span>{d.label}
              </button>
            );
          })}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Visibility + text */}
          <div className="md:col-span-2 flex items-center gap-3">
            <button onClick={() => updateEl(selectedEl, { visible: !current.visible })} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm font-medium hover:bg-gray-50">
              {current.visible ? <><Eye className="w-4 h-4" /> Visible</> : <><EyeOff className="w-4 h-4" /> Masqué</>}
            </button>
            <span className="text-xs text-[#8B8680]">Élément sélectionné : <strong className="text-[#1C1917]">{def.label}</strong></span>
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Contenu texte (variables : {'{name}'}, {'{first_name}'}, {'{tier}'}, {'{points}'}, {'{points_remaining}'}, {'{birthday}'}, {'{business_name}'})</FieldLabel>
            <input type="text" value={current.text ?? ''} onChange={e => updateEl(selectedEl, { text: e.target.value })} placeholder={def.default.text || 'Texte libre'} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
          </div>

          {/* Position */}
          <div>
            <FieldLabel>Position horizontale : {Math.round(current.x_pct)}%</FieldLabel>
            <input type="range" min="0" max="100" step="1" value={current.x_pct} onChange={e => updateEl(selectedEl, { x_pct: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <FieldLabel>Position verticale : {Math.round(current.y_pct)}%</FieldLabel>
            <input type="range" min="0" max="100" step="1" value={current.y_pct} onChange={e => updateEl(selectedEl, { y_pct: Number(e.target.value) })} className="w-full" />
          </div>

          {/* Font */}
          <div className="md:col-span-2">
            <FieldLabel>Police</FieldLabel>
            <select value={current.font_family} onChange={e => updateEl(selectedEl, { font_family: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" style={{ fontFamily: current.font_family }}>
              {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
          </div>

          <div>
            <FieldLabel>Taille : {current.font_size}px</FieldLabel>
            <input type="range" min="8" max="48" step="1" value={current.font_size} onChange={e => updateEl(selectedEl, { font_size: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <FieldLabel>Couleur</FieldLabel>
            <input type="color" value={current.color} onChange={e => updateEl(selectedEl, { color: e.target.value })} className="w-full h-10 rounded-lg border border-[#E7E5E4] cursor-pointer" />
          </div>

          {/* Style toggles */}
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <StyleToggle active={current.font_weight === 'bold'} onClick={() => updateEl(selectedEl, { font_weight: current.font_weight === 'bold' ? 'normal' : 'bold' })} icon={Bold} label="Gras" />
            <StyleToggle active={current.font_style === 'italic'} onClick={() => updateEl(selectedEl, { font_style: current.font_style === 'italic' ? 'normal' : 'italic' })} icon={Italic} label="Italique" />
            <StyleToggle active={current.text_decoration === 'underline'} onClick={() => updateEl(selectedEl, { text_decoration: current.text_decoration === 'underline' ? 'none' : 'underline' })} icon={Underline} label="Souligné" />
            <div className="w-px bg-[#E7E5E4] mx-2" />
            <StyleToggle active={current.align === 'left'} onClick={() => updateEl(selectedEl, { align: 'left' })} icon={AlignLeft} label="Gauche" />
            <StyleToggle active={current.align === 'center'} onClick={() => updateEl(selectedEl, { align: 'center' })} icon={AlignCenter} label="Centré" />
            <StyleToggle active={current.align === 'right'} onClick={() => updateEl(selectedEl, { align: 'right' })} icon={AlignRight} label="Droite" />
          </div>

          <div className="md:col-span-2">
            <button onClick={() => updateEl(selectedEl, { ...ELEMENT_DEFAULTS[selectedEl], text: ELEMENT_DEFAULTS[selectedEl].text })} className="text-xs text-[#B85C38] hover:underline font-semibold">
              ↺ Réinitialiser cet élément
            </button>
          </div>
        </div>
      </Card>

      <SaveBtn saving={saving} saved={saved} onClick={onSave} />
    </>
  );
};

const StyleToggle = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} title={label} className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${active ? 'bg-[#1C1917] text-white border-[#1C1917]' : 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#1C1917]'}`}>
    <Icon className="w-4 h-4" />
  </button>
);

// ---------------------------------------------------------------------------
// Stamps tab
// ---------------------------------------------------------------------------
const StampsTab = ({ tpl, setTpl, saving, saved, onSave }) => (
  <>
    <Card title="Type de timbre" subtitle="Choisissez comment la progression fidélité s'affiche sur la carte">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAMP_STYLES.map(s => {
          const Icon = s.icon;
          const active = (tpl.stamp_style || 'hexagon') === s.id;
          return (
            <button key={s.id} onClick={() => setTpl(t => ({ ...t, stamp_style: s.id }))} className={`flex flex-col items-center gap-2 py-5 px-3 rounded-xl border-2 transition-all ${active ? 'border-[#B85C38] bg-[#FFF4F1]' : 'border-[#E7E5E4] hover:border-[#A8A29E]'}`}>
              <Icon className={`w-7 h-7 ${active ? 'text-[#B85C38]' : 'text-[#57534E]'}`} />
              <span className="text-xs font-semibold text-[#1C1917] text-center">{s.label}</span>
            </button>
          );
        })}
      </div>
    </Card>

    <Card title="Options">
      <label className="flex items-center justify-between cursor-pointer">
        <div>
          <p className="font-semibold text-[#1C1917]">Afficher la barre de progression</p>
          <p className="text-xs text-[#57534E]">Montre « 7 / 10 » en plus des timbres</p>
        </div>
        <button onClick={() => setTpl(t => ({ ...t, show_meter: !t.show_meter }))} className={`relative w-11 h-6 rounded-full transition-colors ${tpl.show_meter ? 'bg-[#4A5D23]' : 'bg-[#D6D3D1]'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tpl.show_meter ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </label>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Récompense à</FieldLabel>
          <input type="number" min="1" max="50" value={tpl.reward_threshold_stamps || 10} onChange={e => setTpl(t => ({ ...t, reward_threshold_stamps: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
        <div>
          <FieldLabel>Description récompense</FieldLabel>
          <input type="text" value={tpl.reward_description || ''} onChange={e => setTpl(t => ({ ...t, reward_description: e.target.value }))} placeholder="Un café offert" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
      </div>
    </Card>

    <SaveBtn saving={saving} saved={saved} onClick={onSave} />
  </>
);

// ---------------------------------------------------------------------------
// Promotion tab
// ---------------------------------------------------------------------------
const PromotionTab = ({ promo, update, saving, savedStatus, onSave }) => (
  <>
    <Card
      title="Mode promotion"
      subtitle="Quand c'est activé, la zone du logo est remplacée par votre promotion"
      right={
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs font-semibold text-[#57534E]">{promo.enabled ? 'Actif' : 'Désactivé'}</span>
          <button onClick={() => update({ enabled: !promo.enabled })} className={`relative w-11 h-6 rounded-full transition-colors ${promo.enabled ? 'bg-[#4A5D23]' : 'bg-[#D6D3D1]'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${promo.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </label>
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <FieldLabel>Titre de la promotion</FieldLabel>
          <input type="text" value={promo.title || ''} onChange={e => update({ title: e.target.value })} placeholder="10€ CAGNOTTÉS" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm font-bold outline-none" />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Sous-titre</FieldLabel>
          <input type="text" value={promo.subtitle || ''} onChange={e => update({ subtitle: e.target.value })} placeholder="Dès 3 articles achetés" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <textarea rows="3" value={promo.body || ''} onChange={e => update({ body: e.target.value })} placeholder="Les détails de votre offre — limite, conditions, dates…" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none resize-none" />
        </div>
        <div>
          <FieldLabel>Lien (optionnel)</FieldLabel>
          <input type="url" value={promo.link || ''} onChange={e => update({ link: e.target.value })} placeholder="https://…" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
        <div>
          <FieldLabel>Libellé du bouton</FieldLabel>
          <input type="text" value={promo.link_label || 'En savoir plus'} onChange={e => update({ link_label: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
        <div>
          <FieldLabel>Couleur de fond</FieldLabel>
          <input type="color" value={promo.background_color || '#B85C38'} onChange={e => update({ background_color: e.target.value })} className="w-full h-10 rounded-lg border border-[#E7E5E4] cursor-pointer" />
        </div>
        <div>
          <FieldLabel>Couleur du texte</FieldLabel>
          <input type="color" value={promo.text_color || '#FFFFFF'} onChange={e => update({ text_color: e.target.value })} className="w-full h-10 rounded-lg border border-[#E7E5E4] cursor-pointer" />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Image de fond (URL — optionnel)</FieldLabel>
          <input type="url" value={promo.image_url || ''} onChange={e => update({ image_url: e.target.value })} placeholder="https://…/banner.jpg" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
        <div>
          <FieldLabel>Date d'expiration (optionnel)</FieldLabel>
          <input type="datetime-local" value={promo.expires_at ? String(promo.expires_at).slice(0, 16) : ''} onChange={e => update({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
        </div>
      </div>
    </Card>

    {savedStatus && (
      <div className="bg-[#DCFCE7] border border-[#22C55E] text-[#166534] rounded-xl p-3 text-sm font-semibold">
        <Check className="w-4 h-4 inline mr-1" /> {savedStatus}
      </div>
    )}

    <div className="grid md:grid-cols-2 gap-3">
      <SaveBtn saving={saving} saved={false} onClick={() => onSave(false)} label="Enregistrer la promotion" />
      <button onClick={() => onSave(true)} disabled={saving || !promo.enabled} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1C1917] hover:bg-black disabled:opacity-40 text-white rounded-xl font-bold transition-all">
        <Bell className="w-4 h-4" /> Enregistrer + notifier tous les clients
      </button>
    </div>
  </>
);

// ---------------------------------------------------------------------------
// Details tab
// ---------------------------------------------------------------------------
const DetailsTab = ({ details, update, saving, saved, onSave }) => {
  const addSection = () => update({ custom_sections: [ ...(details.custom_sections || []), { title: '', body: '' } ] });
  const updateSection = (i, patch) => {
    const arr = [ ...(details.custom_sections || []) ];
    arr[i] = { ...arr[i], ...patch };
    update({ custom_sections: arr });
  };
  const removeSection = (i) => {
    const arr = [ ...(details.custom_sections || []) ];
    arr.splice(i, 1);
    update({ custom_sections: arr });
  };

  return (
    <>
      <Card title="Détails au tap / clic" subtitle="Ce que le client voit quand il tape sur sa carte pour en savoir plus">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <FieldLabel>À propos</FieldLabel>
            <textarea rows="3" value={details.about || ''} onChange={e => update({ about: e.target.value })} placeholder="Une boulangerie familiale depuis 1987…" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none resize-none" />
          </div>
          <div>
            <FieldLabel>Horaires</FieldLabel>
            <textarea rows="2" value={details.hours || ''} onChange={e => update({ hours: e.target.value })} placeholder="Lun-Ven 7h-20h / Sam-Dim 8h-19h" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none resize-none" />
          </div>
          <div>
            <FieldLabel>Adresse</FieldLabel>
            <input type="text" value={details.address || ''} onChange={e => update({ address: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
          </div>
          <div>
            <FieldLabel>Téléphone</FieldLabel>
            <input type="tel" value={details.phone || ''} onChange={e => update({ phone: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
          </div>
          <div>
            <FieldLabel>Site web</FieldLabel>
            <input type="url" value={details.website || ''} onChange={e => update({ website: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
          </div>
          <div>
            <FieldLabel>Instagram</FieldLabel>
            <input type="text" value={details.instagram || ''} onChange={e => update({ instagram: e.target.value })} placeholder="@monmagasin" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
          </div>
          <div>
            <FieldLabel>Facebook</FieldLabel>
            <input type="text" value={details.facebook || ''} onChange={e => update({ facebook: e.target.value })} placeholder="facebook.com/…" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
          </div>
        </div>
      </Card>

      <Card title="Sections personnalisées" subtitle="Ajoutez autant de blocs d'info que vous voulez (ex. conditions, FAQ, politique)" right={<button onClick={addSection} className="flex items-center gap-1 text-sm text-[#B85C38] font-semibold"><Plus className="w-4 h-4" /> Ajouter</button>}>
        {(details.custom_sections || []).length === 0 && (
          <p className="text-sm text-[#8B8680] italic">Aucune section pour l'instant.</p>
        )}
        <div className="space-y-3">
          {(details.custom_sections || []).map((s, i) => (
            <div key={i} className="border border-[#E7E5E4] rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input type="text" value={s.title} onChange={e => updateSection(i, { title: e.target.value })} placeholder="Titre de la section" className="flex-1 px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm font-semibold outline-none" />
                <button onClick={() => removeSection(i)} className="p-2 text-[#B85C38] hover:bg-[#FFF4F1] rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
              <textarea rows="2" value={s.body} onChange={e => updateSection(i, { body: e.target.value })} placeholder="Contenu…" className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm outline-none resize-none" />
            </div>
          ))}
        </div>
      </Card>

      <SaveBtn saving={saving} saved={saved} onClick={onSave} label="Enregistrer les détails" />
    </>
  );
};

// ---------------------------------------------------------------------------
// Notifications tab
// ---------------------------------------------------------------------------
const NotifyTab = ({ notif, setNotif, sending, sent, onSend }) => {
  const selectedType = NOTIF_TYPES.find(t => t.id === notif.type) || NOTIF_TYPES[0];
  const Icon = selectedType.icon;

  return (
    <>
      <Card title="Type de notification" subtitle="Choisissez la catégorie — elle s'affichera sur la carte et en notification push sur le téléphone du client">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {NOTIF_TYPES.map(t => {
            const TIcon = t.icon;
            const active = notif.type === t.id;
            return (
              <button key={t.id} onClick={() => setNotif(n => ({ ...n, type: t.id }))} className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 transition-all ${active ? 'border-[#B85C38] bg-[#FFF4F1]' : 'border-[#E7E5E4] hover:border-[#A8A29E]'}`}>
                <TIcon className={`w-6 h-6 ${active ? 'text-[#B85C38]' : 'text-[#57534E]'}`} />
                <span className="text-[11px] font-semibold text-[#1C1917] text-center leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Composition" subtitle="Variables : {name}, {first_name}, {tier}, {points}, {business_name}">
        <div className="space-y-3">
          <div>
            <FieldLabel>Titre</FieldLabel>
            <input type="text" value={notif.title} onChange={e => setNotif(n => ({ ...n, title: e.target.value }))} placeholder={selectedType.placeholder_title} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm font-semibold outline-none" />
          </div>
          <div>
            <FieldLabel>Message</FieldLabel>
            <textarea rows="4" value={notif.body} onChange={e => setNotif(n => ({ ...n, body: e.target.value }))} placeholder={selectedType.placeholder_body} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none resize-none" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Lien (optionnel)</FieldLabel>
              <input type="url" value={notif.link} onChange={e => setNotif(n => ({ ...n, link: e.target.value }))} placeholder="https://…" className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none" />
            </div>
            <div>
              <FieldLabel>Cibler un niveau</FieldLabel>
              <select value={notif.tier} onChange={e => setNotif(n => ({ ...n, tier: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] text-sm outline-none">
                <option value="">Tous les clients</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Notification preview */}
      <Card title="Aperçu sur l'écran verrouillé">
        <div className="bg-[#1C1917] rounded-2xl p-5 text-white space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">{notif.title || selectedType.placeholder_title}</span>
                <span className="text-[10px] opacity-60 ml-2">maintenant</span>
              </div>
              <p className="text-white/80 text-xs mt-1 leading-snug line-clamp-3">{notif.body || selectedType.placeholder_body}</p>
            </div>
          </div>
        </div>
      </Card>

      {sent && !sent.error && (
        <div className="bg-[#DCFCE7] border border-[#22C55E] text-[#166534] rounded-xl p-3 text-sm font-semibold">
          <Check className="w-4 h-4 inline mr-1" /> {sent.sent} client(s) notifié(s) · {sent.emails_sent} email(s) envoyé(s)
        </div>
      )}
      {sent?.error && (
        <div className="bg-[#FEE2E2] border border-[#DC2626] text-[#7F1D1D] rounded-xl p-3 text-sm font-semibold">⚠ {sent.error}</div>
      )}

      <button onClick={onSend} disabled={sending || !notif.title.trim() || !notif.body.trim()} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#B85C38] hover:bg-[#9C4E2F] disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md">
        <Bell className="w-4 h-4" />{sending ? 'Envoi en cours…' : 'Envoyer la notification'}
      </button>
    </>
  );
};

// ---------------------------------------------------------------------------
// Live preview — iPhone frame + rendered pass
// ---------------------------------------------------------------------------
const Phone = ({ children }) => (
  <div className="mx-auto w-[330px] bg-[#0A0A0A] p-3 rounded-[44px] shadow-2xl border-[10px] border-black relative">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-20" />
    <div className="flex items-center justify-center gap-2 text-white/40 pt-5 pb-3 text-[10px] font-semibold">
      <Smartphone className="w-3.5 h-3.5" /> APPLE WALLET
    </div>
    <div className="bg-white rounded-[26px] overflow-hidden" style={{ minHeight: '580px' }}>
      {children}
    </div>
  </div>
);

const Pass = ({ tpl, el, selectedEl, onSelectEl }) => {
  const promo = tpl.promotion || {};
  const stampStyle = tpl.stamp_style || 'hexagon';
  const stampsFilled = 3;
  const stampsTotal = tpl.reward_threshold_stamps || 10;

  const bg = tpl.primary_color || '#1C1917';
  const accent = tpl.secondary_color || '#E3A869';

  return (
    <div className="relative" style={{ background: bg, color: '#FFFFFF', minHeight: '580px', fontFamily: 'Inter' }}>
      {/* Promotion mode replaces logo area */}
      {promo.enabled ? (
        <div className="p-5">
          <div className="rounded-xl px-4 py-5 text-center relative overflow-hidden" style={{ background: promo.background_color || accent, color: promo.text_color || '#FFFFFF', backgroundImage: promo.image_url ? `url(${promo.image_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {promo.image_url && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative">
              <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Avantage exclusif</p>
              <p className="text-3xl font-black leading-tight" style={{ fontFamily: 'Cormorant Garamond' }}>{promo.title || 'VOTRE PROMO'}</p>
              {promo.subtitle && <p className="text-xs opacity-90 mt-1">{promo.subtitle}</p>}
              {promo.body && <p className="text-xs opacity-80 mt-2 leading-snug">{promo.body}</p>}
              {promo.link && <div className="mt-3 inline-block bg-white/20 backdrop-blur text-xs font-semibold px-3 py-1.5 rounded-full">{promo.link_label || 'En savoir plus'}</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[180px] relative border-b border-white/10">
          {/* Overlay elements */}
          {['logo', 'business_name', 'customer_name'].map(id => renderElement(id, el, tpl, selectedEl, onSelectEl, 180))}
          {/* Logo image if url provided and element visible */}
          {tpl.logo_url && el('logo').visible && (
            <img src={tpl.logo_url} alt="" className="absolute w-14 h-14 rounded-lg object-cover border-2 border-white/20 pointer-events-none" style={{ left: `${el('logo').x_pct}%`, top: `${el('logo').y_pct}%`, transform: 'translate(-50%, -50%)' }} />
          )}
        </div>
      )}

      {/* Offer banner */}
      {el('offer_banner').visible && (
        <div className="relative h-[60px]">
          {renderElement('offer_banner', el, tpl, selectedEl, onSelectEl, 60)}
        </div>
      )}

      {/* Stamp area */}
      <div className="px-5 py-4">
        <StampVisual style={stampStyle} filled={stampsFilled} total={stampsTotal} accent={accent} />
        {tpl.show_meter && stampStyle !== 'none' && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] opacity-80 mb-1">
              <span>Progression</span><span>{stampsFilled}/{stampsTotal}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-white/20">
              <div className="h-full" style={{ width: `${(stampsFilled / stampsTotal) * 100}%`, background: accent }} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom info strip (points/tier/birthday/reward hint) */}
      <div className="h-[120px] relative">
        {['points', 'tier', 'birthday', 'reward_hint'].map(id => renderElement(id, el, tpl, selectedEl, onSelectEl, 120))}
      </div>

      {/* Barcode */}
      <div className="px-5 pb-5">
        <div className="bg-white rounded-lg py-3 px-4 text-center">
          <div className="mx-auto h-12 bg-[repeating-linear-gradient(90deg,#111_0_2px,transparent_2px_5px)]" />
          <p className="font-mono text-[10px] tracking-[0.3em] text-black mt-1">FT-A1B2C3D4</p>
        </div>
      </div>

      <div className="text-center text-[9px] text-white/30 tracking-widest uppercase pb-3">
        Touchez la carte pour + de détails
      </div>
    </div>
  );
};

const renderElement = (id, el, tpl, selectedEl, onSelect, regionHeight) => {
  const e = el(id);
  if (!e.visible) return null;
  const def = ELEMENT_DEFS.find(d => d.id === id);
  const text = mockSub(
    e.text ?? def?.default?.text ?? '',
    { ...PREVIEW_CTX, business_name: tpl.text_content || PREVIEW_CTX.business_name }
  );
  if (!text && id !== 'logo') return null;
  const isSelected = selectedEl === id;
  return (
    <div
      key={id}
      onClick={(ev) => { ev.stopPropagation(); onSelect && onSelect(id); }}
      className={`absolute cursor-pointer ${isSelected ? 'ring-2 ring-[#B85C38] ring-offset-1 ring-offset-transparent rounded px-1' : 'hover:ring-1 hover:ring-white/40 rounded px-0.5'}`}
      style={{
        left: `${e.x_pct}%`,
        top: `${e.y_pct}%`,
        transform: 'translate(-50%, -50%)',
        fontFamily: e.font_family,
        fontSize: `${e.font_size}px`,
        fontWeight: e.font_weight,
        fontStyle: e.font_style,
        textDecoration: e.text_decoration,
        color: e.color,
        textAlign: e.align,
        whiteSpace: 'nowrap',
        maxWidth: '92%',
      }}
    >
      {id === 'logo' && !tpl.logo_url ? (text || 'LOGO') : text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Stamp visuals
// ---------------------------------------------------------------------------
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
  const cols = total <= 10 ? 5 : Math.ceil(total / 2);

  const renderOne = (i) => {
    const on = i < filled;
    if (style === 'hexagon') {
      return (
        <svg key={i} viewBox="0 0 100 100" className="w-8 h-8 drop-shadow-sm" style={{ fill: on ? accent : 'transparent', stroke: accent, strokeWidth: 4 }}>
          <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" />
        </svg>
      );
    }
    if (style === 'circles') {
      return <div key={i} className="w-7 h-7 rounded-full border-2" style={{ background: on ? accent : 'transparent', borderColor: accent }} />;
    }
    if (style === 'classic_dots') {
      return <div key={i} className="w-4 h-4 rounded-full" style={{ background: on ? accent : 'rgba(255,255,255,0.2)' }} />;
    }
    if (style === 'squares') {
      return <div key={i} className="w-7 h-7 rounded border-2" style={{ background: on ? accent : 'transparent', borderColor: accent }} />;
    }
    if (style === 'stars') {
      return (
        <svg key={i} viewBox="0 0 24 24" className="w-7 h-7" style={{ fill: on ? accent : 'transparent', stroke: accent, strokeWidth: 1.5 }}>
          <polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] uppercase tracking-widest opacity-70">Carte de fidélité</div>
      <div className="grid gap-2 justify-items-center" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 10)}, minmax(0, auto))` }}>
        {items.map((_, i) => renderOne(i))}
      </div>
    </div>
  );
};

export default CardDesignerPage;
