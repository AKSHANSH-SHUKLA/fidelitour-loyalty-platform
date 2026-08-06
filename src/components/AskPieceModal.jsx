/**
 * AskPieceModal — "Demander une pièce" as a proper, elegant form.
 *
 * Replaces the browser window.prompt() chain (label → email → phone → confirm)
 * that looked broken and unprofessional. Everything is selectable where
 * possible: pièce type, month, year, channel — typing only where it truly
 * can't be avoided (email/phone/precision).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const PIECES = [
  'Relevé bancaire',
  'Facture fournisseur',
  'Justificatif de TVA',
  'Ticket Z de caisse',
  'Note de frais',
  'Contrat / bail',
  'Bulletin de salaire',
  'Autre…',
];
const MOIS = ['—', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
  'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const L = { display: 'block', fontSize: 12, fontWeight: 600, color: '#57534E', marginBottom: 4 };
const I = { width: '100%', border: '1px solid #E0DCE8', borderRadius: 12, padding: '10px 12px',
            fontSize: 14, background: '#FBFAFE', color: '#1C1917', outline: 'none' };

export default function AskPieceModal({ clientName, onClose, onSubmit }) {
  const now = new Date();
  const [piece, setPiece] = useState(PIECES[0]);
  const [autre, setAutre] = useState('');
  const [mois, setMois] = useState(MOIS[now.getMonth() === 0 ? 12 : now.getMonth()]); // previous month
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [due, setDue] = useState(() => {
    const d = new Date(Date.now() + 7 * 864e5); return d.toISOString().slice(0, 10);
  });
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('auto');
  const [busy, setBusy] = useState(false);

  const label = (piece === 'Autre…' ? (autre || 'Pièce') : piece)
    + (mois !== '—' ? ` ${mois.toLowerCase()} ${annee}` : '');

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ label, due_date: due,
                       client_email: email.trim() || undefined,
                       client_phone: phone.trim() || undefined,
                       channel: phone.trim() ? channel : 'email' });
      onClose();
    } catch { /* parent toasts */ }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(28,25,23,.45)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: '#EFECF6' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: '#E8EDFB' }}>📨</span>
          <div>
            <div className="font-bold text-[15px] text-[#1C1917]">Demander une pièce</div>
            <div className="text-[11px] text-[#8B8680]">
              {clientName ? `à ${clientName} — ` : ''}l'agent relancera tout seul au bon moment
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label style={L}>Quelle pièce ?</label>
              <select style={I} value={piece} onChange={(e) => setPiece(e.target.value)}>
                {PIECES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            {piece === 'Autre…' && (
              <div className="col-span-2">
                <label style={L}>Précisez</label>
                <input style={I} value={autre} onChange={(e) => setAutre(e.target.value)}
                       placeholder="ex. Attestation URSSAF" />
              </div>
            )}
            <div>
              <label style={L}>Mois concerné</label>
              <select style={I} value={mois} onChange={(e) => setMois(e.target.value)}>
                {MOIS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Année</label>
              <select style={I} value={annee} onChange={(e) => setAnnee(e.target.value)}>
                {[0, 1, 2].map((d) => {
                  const y = String(now.getFullYear() - d);
                  return <option key={y}>{y}</option>;
                })}
              </select>
            </div>
            <div className="col-span-2">
              <label style={L}>À recevoir avant le</label>
              <input type="date" style={I} value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl p-3.5 space-y-3" style={{ background: '#F7F5FC' }}>
            <div className="text-[11.5px] font-bold text-[#57534E]">Comment joindre le client ?</div>
            <div>
              <label style={L}>Email <span style={{ fontWeight: 400 }}>(vide = compte client connu)</span></label>
              <input type="email" style={I} value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="patron@boulangerie.fr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={L}>WhatsApp <span style={{ fontWeight: 400 }}>(optionnel)</span></label>
                <input type="tel" style={I} value={phone} onChange={(e) => setPhone(e.target.value)}
                       placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label style={L}>Canal de relance</label>
                <select style={I} value={channel} onChange={(e) => setChannel(e.target.value)}
                        disabled={!phone.trim()}>
                  <option value="auto">Auto (WhatsApp si actif)</option>
                  <option value="whatsapp">WhatsApp d'abord</option>
                  <option value="email">Email uniquement</option>
                </select>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#8B8680] px-1">
            Sera enregistré : <b className="text-[#4E1F44]">{label}</b>
          </div>
        </div>

        {/* shadcn/ui Button — first live use of the design-system layer.
            Keeps FidClic's blue via className so nothing looks off-brand. */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy || (piece === 'Autre…' && !autre.trim())}
                  className="flex-1 rounded-xl text-white hover:opacity-90"
                  style={{ background: '#2F6FB3' }}>
            {busy ? 'Enregistrement…' : 'Demander la pièce'}
          </Button>
        </div>
      </div>
    </div>
  );
}
