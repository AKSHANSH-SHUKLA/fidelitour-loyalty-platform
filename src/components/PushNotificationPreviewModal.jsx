/**
 * PushNotificationPreviewModal — confirm-before-send UI with live preview.
 *
 * Used both for:
 *   - Manual campaign sends (item #5: confirm-before-send for everything)
 *   - Auto-campaign drafts (item #5: nothing fires automatically without owner OK)
 *   - Card-designer-style live preview as the owner edits (item #6)
 *
 * Renders a phone-shape with the actual notification banner — colors, logo,
 * title, body — exactly as it'll appear on the customer's lock screen.
 *
 * Props:
 *   open: bool
 *   onClose: () => void
 *   onConfirm: (finalPayload) => Promise
 *   businessName: string
 *   logoChar?: string                 (one-letter logo if no image)
 *   logoUrl?: string                  (optional)
 *   primaryColor?: string             (hex)
 *   recipientCount?: number
 *   trigger?: string                  ("Anniversaire", "Relance 30j", "Manuel"…)
 *   defaultTitle?: string
 *   defaultBody?: string
 *   editable?: bool                   (default true; if false, owner only confirms)
 */
import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, Bell, Edit3 } from 'lucide-react';

const PushNotificationPreviewModal = ({
  open,
  onClose,
  onConfirm,
  businessName = 'Votre commerce',
  logoChar,
  logoUrl,
  primaryColor = '#B85C38',
  recipientCount = 0,
  trigger = 'Manuel',
  defaultTitle = '',
  defaultBody = '',
  editable = true,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  useEffect(() => { setTitle(defaultTitle); }, [defaultTitle]);
  useEffect(() => { setBody(defaultBody); }, [defaultBody]);

  if (!open) return null;

  const initial = (logoChar || (businessName || 'F').charAt(0)).toUpperCase();

  const handleConfirm = async () => {
    setSending(true);
    try {
      await onConfirm({ title, body });
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ border: '1px solid #EFE9E0' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#EFE9E0' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              {trigger} — confirmation requise
            </p>
            <h3 className="text-xl font-bold mt-0.5" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
              Aperçu de la notification push
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-[#FAF8F4] flex items-center justify-center"
          >
            <X size={16} style={{ color: '#57534E' }} />
          </button>
        </div>

        {/* Body — split layout: editor left, phone preview right */}
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* Left — editor */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: '#57534E' }}>
                <Edit3 size={10} /> Titre de la notification
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => editable && setTitle(e.target.value.slice(0, 60))}
                disabled={!editable}
                className="w-full border rounded-lg px-3 py-2.5 text-sm font-semibold"
                style={{ borderColor: '#E7E5E4' }}
                placeholder="Ex: Bonjour Marie 👋"
                maxLength={60}
              />
              <p className="text-[10px] mt-1" style={{ color: '#8B8680' }}>
                {title.length}/60 caractères — visible sur l'écran verrouillé
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: '#57534E' }}>
                <Edit3 size={10} /> Corps du message
              </label>
              <textarea
                value={body}
                onChange={(e) => editable && setBody(e.target.value.slice(0, 180))}
                disabled={!editable}
                rows={4}
                className="w-full border rounded-lg px-3 py-2.5 text-sm leading-relaxed resize-none"
                style={{ borderColor: '#E7E5E4' }}
                placeholder="Le message principal qui apparaîtra sous le titre"
                maxLength={180}
              />
              <p className="text-[10px] mt-1" style={{ color: '#8B8680' }}>
                {body.length}/180 caractères
              </p>
            </div>

            {/* Recipient summary */}
            <div className="p-3 rounded-lg" style={{ background: `${primaryColor}10`, border: `1px solid ${primaryColor}33` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: primaryColor }}>
                Destinataires
              </p>
              <p className="text-sm font-bold" style={{ color: '#1C1917' }}>
                {recipientCount.toLocaleString()} client{recipientCount > 1 ? 's' : ''} recevront cette notification
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#57534E' }}>
                Web Push gratuit · SMS de secours pour ceux sans abonnement push
              </p>
            </div>

            {/* Brand voice tip */}
            <div className="p-3 rounded-lg flex gap-2 items-start"
                 style={{ background: '#FEF9E7', border: '1px solid #E3A86955' }}>
              <Sparkles size={14} style={{ color: '#7B3F00', marginTop: 2 }} />
              <p className="text-[11px] leading-snug" style={{ color: '#7B3F00' }}>
                <b>Astuce :</b> les notifications les plus efficaces utilisent le prénom du client
                et offrent un avantage concret. Vous pouvez modifier librement avant l'envoi.
              </p>
            </div>
          </div>

          {/* Right — live phone preview */}
          <div className="flex flex-col items-center justify-start">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8B8680' }}>
              Aperçu en temps réel
            </p>
            {/* Phone frame */}
            <div
              className="relative rounded-[40px] p-2"
              style={{
                width: 280,
                height: 480,
                background: 'linear-gradient(180deg, #1C1917 0%, #2A1C2E 100%)',
                boxShadow: '0 24px 60px rgba(28,25,23,0.4)',
              }}
            >
              {/* Notch */}
              <div
                className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full"
                style={{ width: 80, height: 18, background: '#0A0A0A' }}
              />
              {/* Screen */}
              <div
                className="w-full h-full rounded-[32px] overflow-hidden flex flex-col items-center justify-start pt-12 px-3 relative"
                style={{
                  background: 'linear-gradient(180deg, #2C3E5C 0%, #15233D 100%)',
                }}
              >
                {/* Status bar */}
                <div className="absolute top-3 left-0 right-0 px-6 flex justify-between text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <span>9:41</span>
                  <span>📶 🔋</span>
                </div>

                {/* Day / time */}
                <div className="text-center mt-4 mb-6">
                  <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    mardi 12 mai
                  </p>
                  <p className="font-bold leading-none mt-1" style={{ color: 'white', fontFamily: 'Cormorant Garamond', fontSize: 56 }}>
                    9:41
                  </p>
                </div>

                {/* The actual notification card */}
                <div
                  className="w-full rounded-2xl p-2.5 flex items-start gap-2 transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  }}
                >
                  {/* Logo */}
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-[11px] shrink-0 overflow-hidden"
                    style={{ background: primaryColor }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[10px] font-bold leading-tight truncate" style={{ color: '#1C1917' }}>
                        {businessName}
                      </p>
                      <p className="text-[9px] shrink-0" style={{ color: '#57534E' }}>maintenant</p>
                    </div>
                    <p className="text-[10.5px] font-bold leading-tight" style={{ color: '#1C1917' }}>
                      {title || 'Titre de la notification'}
                    </p>
                    <p className="text-[9.5px] mt-0.5 leading-snug" style={{ color: '#57534E' }}>
                      {body || 'Le message apparaîtra ici…'}
                    </p>
                  </div>
                </div>

                {/* Mini hint */}
                <div className="mt-auto mb-4 flex items-center gap-1.5 px-3 py-1 rounded-full"
                     style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <Bell size={9} style={{ color: 'white' }} />
                  <span className="text-[9px] font-medium" style={{ color: 'white' }}>
                    Aperçu live · se met à jour
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t" style={{ borderColor: '#EFE9E0', background: '#FDFBF7' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition hover:bg-white"
            style={{ borderColor: '#E7E5E4', color: '#57534E' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={sending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, #D77FA0)`,
              boxShadow: `0 8px 20px -6px ${primaryColor}66`,
            }}
          >
            <Send size={14} />
            {sending ? 'Envoi en cours…' : `Envoyer à ${recipientCount.toLocaleString()} client${recipientCount > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationPreviewModal;
