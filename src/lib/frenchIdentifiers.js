/**
 * French business identifiers — validation and derivation.
 *
 * WHY THIS EXISTS
 *   A wrong SIREN/SIRET is the #1 cause of e-invoice rejection: the Annuaire
 *   cannot route the invoice, the PA refuses it, and the accountant discovers
 *   the problem days later. Catching the typo IN THE FORM costs nothing and
 *   saves a rejection + a support case + a re-send.
 *
 *   These are the same checks the administration runs, so if it passes here it
 *   is at least structurally valid (a real INSEE lookup — S8 — will confirm the
 *   company actually exists).
 */

/**
 * Luhn checksum — the algorithm behind SIREN and SIRET.
 * Same maths as credit-card numbers: double every second digit from the right,
 * subtract 9 if the result is >9, and the total must be divisible by 10.
 */
export function luhnValid(num) {
  const digits = String(num).replace(/\D/g, '');
  if (!digits.length) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** SIREN = the COMPANY id. 9 digits, Luhn-valid. */
export function validateSiren(siren) {
  const s = String(siren || '').replace(/\D/g, '');
  if (!s) return { ok: false, error: null };                       // empty = not an error yet
  if (s.length !== 9) return { ok: false, error: 'Le SIREN doit contenir 9 chiffres.' };
  if (!luhnValid(s)) return { ok: false, error: 'Ce SIREN est invalide (clé de contrôle incorrecte).' };
  return { ok: true, error: null };
}

/**
 * SIRET = the ESTABLISHMENT id: SIREN (9) + NIC (5). 14 digits, Luhn-valid.
 * This is the one that matters most for e-invoicing: the Annuaire routes at
 * SIRET level, so a company with two shops has two SIRETs and each can sit on
 * a different platform.
 *
 * La Poste (SIREN 356000000) is the documented exception to the Luhn rule.
 */
export function validateSiret(siret, expectedSiren) {
  const s = String(siret || '').replace(/\D/g, '');
  if (!s) return { ok: false, error: null };
  if (s.length !== 14) return { ok: false, error: 'Le SIRET doit contenir 14 chiffres.' };
  if (expectedSiren && s.slice(0, 9) !== String(expectedSiren).replace(/\D/g, '')) {
    return { ok: false, error: 'Les 9 premiers chiffres du SIRET doivent correspondre au SIREN.' };
  }
  const isLaPoste = s.startsWith('356000000');
  if (!isLaPoste && !luhnValid(s)) {
    return { ok: false, error: 'Ce SIRET est invalide (clé de contrôle incorrecte).' };
  }
  return { ok: true, error: null };
}

/**
 * TVA intracommunautaire = "FR" + 2-digit key + SIREN.
 * The key is computable, so we derive it instead of asking the user to find a
 * document — one less field to get wrong.
 *   key = (12 + 3 × (SIREN mod 97)) mod 97
 */
export function deriveVatNumber(siren) {
  const s = String(siren || '').replace(/\D/g, '');
  if (s.length !== 9) return '';
  const key = (12 + 3 * (parseInt(s, 10) % 97)) % 97;
  return `FR${String(key).padStart(2, '0')}${s}`;
}

export function validateVatNumber(vat, siren) {
  const v = String(vat || '').replace(/\s/g, '').toUpperCase();
  if (!v) return { ok: false, error: null };
  if (!/^FR[0-9A-Z]{2}[0-9]{9}$/.test(v)) {
    return { ok: false, error: 'Format attendu : FR + 2 caractères + 9 chiffres (ex. FR32123456789).' };
  }
  if (siren) {
    const expected = deriveVatNumber(siren);
    if (expected && v !== expected) {
      return { ok: false, error: `Numéro incohérent avec le SIREN. Attendu : ${expected}` };
    }
  }
  return { ok: true, error: null };
}

/** NAF/APE code — 4 digits + 1 letter (ex. 5610A = restauration traditionnelle). */
export function validateNaf(naf) {
  const n = String(naf || '').replace(/[\s.]/g, '').toUpperCase();
  if (!n) return { ok: false, error: null };
  if (!/^[0-9]{4}[A-Z]$/.test(n)) {
    return { ok: false, error: 'Format attendu : 4 chiffres + 1 lettre (ex. 5610A).' };
  }
  return { ok: true, error: null };
}

/**
 * Business profiles — each one decides WHICH identifiers we ask for and what
 * the sensible VAT default is. The point is that the merchant picks the thing
 * they actually know ("je suis auto-entrepreneur"), not the thing we need.
 */
export const BUSINESS_PROFILES = [
  {
    id: 'micro',
    label: 'Micro-entrepreneur / Auto-entrepreneur',
    hint: 'Vous facturez seul, sans société créée',
    needs: { siren: true, siret: true, vat: 'optional', naf: true, legalForm: false },
    defaultVatRegime: 'franchise',
    note: "En franchise en base, vous ne facturez pas de TVA — la mention légale est ajoutée automatiquement à vos factures.",
  },
  {
    id: 'ei',
    label: 'Entreprise individuelle (EI)',
    hint: 'Artisan, commerçant en nom propre',
    needs: { siren: true, siret: true, vat: 'conditional', naf: true, legalForm: false },
    defaultVatRegime: 'reel_normal_mensuel',
    note: null,
  },
  {
    id: 'societe',
    label: 'Société (SARL, SAS, EURL, SASU, SA…)',
    hint: 'Vous avez des statuts et un Kbis',
    needs: { siren: true, siret: true, vat: true, naf: true, legalForm: true },
    defaultVatRegime: 'reel_normal_mensuel',
    note: null,
  },
  {
    id: 'liberale',
    label: 'Profession libérale',
    hint: 'Consultant, thérapeute, architecte…',
    needs: { siren: true, siret: true, vat: 'conditional', naf: true, legalForm: false },
    defaultVatRegime: 'reel_normal_mensuel',
    note: "Certaines activités libérales sont exonérées de TVA — choisissez « Franchise en base » si c'est votre cas.",
  },
  {
    id: 'association',
    label: 'Association',
    hint: 'Loi 1901, avec ou sans activité commerciale',
    needs: { siren: true, siret: true, vat: 'optional', naf: true, legalForm: false },
    defaultVatRegime: 'franchise',
    note: "Si votre association exerce une activité lucrative assujettie à la TVA, renseignez votre numéro.",
  },
];

export const LEGAL_FORMS = [
  'SARL', 'EURL', 'SAS', 'SASU', 'SA', 'SNC', 'SCI', 'SELARL', 'SCOP', 'Autre',
];

export const VAT_REGIMES = [
  { id: 'franchise', label: 'Franchise en base (pas de TVA facturée)',
    hint: "Vous ne facturez pas de TVA. Mention légale ajoutée automatiquement." },
  { id: 'reel_simplifie', label: 'Réel simplifié (déclaration annuelle CA12)',
    hint: "⚠ Ce régime disparaît au 1er janvier 2027 — vous passerez en déclarations trimestrielles." },
  { id: 'reel_normal_trimestriel', label: 'Réel normal — trimestriel (CA3)',
    hint: "Déclaration tous les trimestres." },
  { id: 'reel_normal_mensuel', label: 'Réel normal — mensuel (CA3)',
    hint: "Déclaration chaque mois. Le régime le plus courant." },
];

/** Reform calendar depends on company size — so we ask, plainly. */
export const ENTERPRISE_SIZES = [
  { id: 'tpe', label: 'Moins de 10 salariés (TPE)', emission: '1er septembre 2027' },
  { id: 'pme', label: '10 à 249 salariés (PME)', emission: '1er septembre 2027' },
  { id: 'eti', label: '250 à 4999 salariés (ETI)', emission: '1er septembre 2026' },
  { id: 'ge', label: '5000 salariés ou plus (GE)', emission: '1er septembre 2026' },
];

export function getProfile(id) {
  return BUSINESS_PROFILES.find((p) => p.id === id) || BUSINESS_PROFILES[0];
}
