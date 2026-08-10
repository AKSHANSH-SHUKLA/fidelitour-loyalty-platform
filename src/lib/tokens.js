/**
 * tokens.js — client-side mirror of the backend's render_template().
 *
 * WHY THIS EXISTS
 *   Campaign bodies contain placeholders ({first_name}, {points}, …) that the
 *   SERVER substitutes per-recipient at send time (api/server.py :: render_template).
 *   That is correct — one body, N recipients, so the values cannot exist until
 *   the message is actually leaving.
 *
 *   But the composer's phone preview used to render the RAW body, so the owner
 *   saw a literal "{first_name}" and had no idea whether their message would
 *   read well. This module renders the same substitution locally against a
 *   reference customer, purely for display. It never touches what gets sent —
 *   the payload still carries the tokens, and the server stays the source of
 *   truth.
 *
 * KEEP IN SYNC
 *   The replacement map below mirrors api/server.py :: render_template exactly
 *   (same tokens, same fallbacks, same formatting). If you add a token on the
 *   backend, add it here too or the preview will silently drift from reality.
 */

/** Mirror of api/server.py :: _compute_points_to_next_reward. */
export function computePointsToNextReward(customer = {}, cardTemplate = {}) {
  try {
    const visitsPerStamp = Math.max(parseInt(cardTemplate.visits_per_stamp ?? 1, 10) || 1, 1);
    const thresholdStamps = Math.max(parseInt(cardTemplate.reward_threshold_stamps ?? 10, 10) || 10, 1);
    const visitsNeeded = visitsPerStamp * thresholdStamps;
    const lifetimeVisits = parseInt(customer.visits ?? 0, 10) || 0;
    const lastRedemption = parseInt(customer.visits_at_last_redemption ?? 0, 10) || 0;
    const stampsInCycle = Math.max(0, lifetimeVisits - lastRedemption);
    return Math.max(0, visitsNeeded - stampsInCycle);
  } catch (_e) {
    return 0;
  }
}

/**
 * Substitute {tokens} in `text` using `customer` + `tenant`.
 * Missing values fall back exactly like the backend does, so the preview
 * shows what the recipient will actually read — never a literal {token}.
 */
export function renderTokens(text, customer = {}, tenant = {}, cardTemplate = {}) {
  if (!text) return '';
  try {
    const name = customer.name || 'cher client';
    const firstName = name ? String(name).split(' ')[0] : 'cher client';
    const tier = String(customer.tier || 'bronze');
    const tierTitle = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    const visits = parseInt(customer.visits ?? 0, 10) || 0;
    const points = parseInt(customer.points ?? visits * 10, 10) || 0;
    const amountPaid = Math.round((parseFloat(customer.total_amount_paid ?? 0) || 0) * 100) / 100;
    const businessName = tenant.name || 'notre boutique';
    const ptnr = computePointsToNextReward(customer, cardTemplate);

    const replacements = {
      '{name}': name,
      '{first_name}': firstName,
      '{tier}': tierTitle,
      '{points}': String(points),
      '{points_remaining}': String(ptnr),
      '{points_to_next_reward}': String(ptnr),
      '{visits}': String(visits),
      '{amount_paid}': `${amountPaid.toFixed(2)}€`,
      '{business_name}': businessName,
      '{sector}': tenant.sector || '',
    };

    let rendered = String(text);
    for (const [token, value] of Object.entries(replacements)) {
      rendered = rendered.split(token).join(String(value));
    }
    return rendered;
  } catch (_e) {
    return text;
  }
}

/**
 * Reference customer used when the tenant has no customers yet (fresh signup,
 * empty demo account). Clearly fictional on purpose — the preview caption says
 * "exemple" so nobody mistakes it for a real record.
 */
export const SAMPLE_CUSTOMER = {
  id: '__sample__',
  name: 'Sophie Martin',
  tier: 'gold',
  points: 240,
  visits: 24,
  visits_at_last_redemption: 20,
  total_amount_paid: 312.5,
  __sample: true,
};

/** The tokens an owner can type, for the helper chip row under the editor. */
export const TOKEN_HELP = [
  { token: '{first_name}', label: 'Prénom' },
  { token: '{name}', label: 'Nom complet' },
  { token: '{business_name}', label: 'Votre enseigne' },
  { token: '{tier}', label: 'Palier' },
  { token: '{points}', label: 'Points' },
  { token: '{points_to_next_reward}', label: 'Points restants' },
  { token: '{visits}', label: 'Visites' },
  { token: '{amount_paid}', label: 'Total dépensé' },
];
