/**
 * Mandatory content of a French invoice — the rules, in one place.
 *
 * WHY THIS FILE EXISTS
 *   A French invoice is not "a document with an amount on it". It is a legal
 *   object with ~25 required mentions (art. 242 nonies A of the CGI, art.
 *   L441-9 of the Code de commerce), and the 2026 reform ADDS several more.
 *   A missing mention means: rejected by the recipient's platform, or accepted
 *   but non-compliant in an audit. Both are expensive.
 *
 *   Keeping the rules here means the form, the validation and the future
 *   Factur-X mapping all read from the same source instead of drifting.
 */

/** VAT rates in force in mainland France. */
export const VAT_RATES = [
  { value: 20, label: '20 % — taux normal' },
  { value: 10, label: '10 % — restauration, travaux, transport' },
  { value: 5.5, label: '5,5 % — alimentation, livres, énergie' },
  { value: 2.1, label: '2,1 % — presse, médicaments remboursables' },
  { value: 0, label: '0 % — exonéré / non applicable' },
];

/**
 * NEW in 2026: every invoice must state the nature of the operation.
 * It changes when VAT becomes due, which is why the administration wants it
 * explicitly rather than inferred.
 */
export const OPERATION_CATEGORIES = [
  { id: 'services', label: 'Prestation de services',
    hint: "TVA exigible à l'encaissement (sauf option sur les débits)." },
  { id: 'goods', label: 'Livraison de biens',
    hint: 'TVA exigible à la livraison.' },
  { id: 'mixed', label: 'Opération mixte (biens + services)',
    hint: 'Les deux natures figurent sur la même facture.' },
];

/** Common payment terms — the due date is computed from the issue date. */
export const PAYMENT_TERMS = [
  { id: 'immediate', label: 'Paiement à réception', days: 0 },
  { id: 'net15', label: '15 jours', days: 15 },
  { id: 'net30', label: '30 jours', days: 30 },
  { id: 'net45', label: '45 jours fin de mois', days: 45 },
  { id: 'net60', label: '60 jours (maximum légal)', days: 60 },
];

/** Legal late-payment rate: ECB refinancing rate + 10 points (art. L441-10). */
export const DEFAULT_LATE_PENALTY_RATE = 12.25;
/** Fixed recovery indemnity, mandatory mention for B2B (art. D441-5). */
export const RECOVERY_INDEMNITY_EUR = 40;

export function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The legal mentions that must be printed on the invoice.
 * Built from the seller's situation + the buyer type, because several of them
 * only apply in some cases (franchise en base, autoliquidation, B2B penalties).
 */
export function legalMentions({ vatRegime, isCompany, operationCategory, vatOnDebits }) {
  const out = [];

  if (vatRegime === 'franchise') {
    // Without this exact wording, a franchise-en-base invoice is non-compliant.
    out.push({
      id: 'franchise',
      text: 'TVA non applicable, art. 293 B du CGI',
      required: true,
    });
  }

  if (isCompany) {
    out.push({
      id: 'penalties',
      text: `Pénalités de retard : ${DEFAULT_LATE_PENALTY_RATE} % annuel en cas de retard de paiement (art. L441-10 du Code de commerce).`,
      required: true,
    });
    out.push({
      id: 'indemnity',
      text: `Indemnité forfaitaire pour frais de recouvrement : ${RECOVERY_INDEMNITY_EUR} € (art. D441-5).`,
      required: true,
    });
    out.push({
      id: 'discount',
      text: "Escompte pour paiement anticipé : néant.",
      required: true,
    });
  }

  if (operationCategory === 'services' && vatOnDebits) {
    out.push({
      id: 'debits',
      text: 'Option pour le paiement de la TVA sur les débits.',
      required: true,
    });
  }

  return out;
}

/** Totals with a VAT breakdown per rate — required on the invoice itself. */
export function computeTotals(lines) {
  const byRate = {};
  let totalHt = 0;
  let totalVat = 0;

  for (const l of lines) {
    const qty = parseFloat(l.quantity || 0) || 0;
    const price = parseFloat(l.unit_price || 0) || 0;
    const rate = parseFloat(l.vat_rate ?? 20) || 0;
    const ht = qty * price;
    const vat = ht * (rate / 100);
    totalHt += ht;
    totalVat += vat;
    if (!byRate[rate]) byRate[rate] = { rate, base: 0, vat: 0 };
    byRate[rate].base += ht;
    byRate[rate].vat += vat;
  }

  const round = (n) => Math.round(n * 100) / 100;
  return {
    total_ht: round(totalHt),
    total_vat: round(totalVat),
    total_ttc: round(totalHt + totalVat),
    vat_breakdown: Object.values(byRate)
      .map((b) => ({ rate: b.rate, base: round(b.base), vat: round(b.vat) }))
      .sort((a, b) => b.rate - a.rate),
  };
}

/**
 * Blocking checks before an invoice may be sent.
 * These mirror what a Plateforme Agréée will reject, so the user finds out here
 * instead of two days later through a rejection notice.
 */
export function validateInvoice({ buyer, invoice, lines, sellerVatRegime }) {
  const errors = [];

  if (!buyer.name?.trim()) errors.push("Le nom du client est obligatoire.");
  if (!buyer.address?.trim()) errors.push("L'adresse du client est obligatoire sur une facture.");
  if (buyer.is_company) {
    if (!buyer.siren || buyer.siren.length !== 9) {
      errors.push("Le SIREN du client est obligatoire pour une facture B2B (réforme 2026).");
    }
  }
  if (!invoice.issue_date) errors.push("La date d'émission est obligatoire.");
  if (!invoice.supply_date) {
    errors.push("La date de la vente ou de la prestation est obligatoire (distincte de la date d'émission).");
  }
  if (!invoice.due_date) errors.push("La date d'échéance est obligatoire.");
  if (invoice.due_date && invoice.issue_date && invoice.due_date < invoice.issue_date) {
    errors.push("L'échéance ne peut pas précéder la date d'émission.");
  }
  if (!invoice.operation_category) errors.push("La catégorie d'opération est obligatoire (réforme 2026).");

  const valid = lines.filter((l) => l.description?.trim() && parseFloat(l.unit_price || 0) > 0);
  if (!valid.length) errors.push("Au moins une ligne avec une description et un montant est requise.");
  if (sellerVatRegime === 'franchise' && lines.some((l) => parseFloat(l.vat_rate || 0) > 0)) {
    errors.push("En franchise en base, aucune TVA ne peut être facturée (0 % obligatoire).");
  }

  return errors;
}
