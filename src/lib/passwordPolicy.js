/**
 * Password policy — mirror of api/services/password_policy.py.
 *
 * The browser copy exists for INSTANT feedback (a user should see the rules
 * turn green as they type, not after a failed submit). The server copy is the
 * one that actually protects anything — this file can be bypassed and that is
 * fine, as long as the two stay in sync. If you change a rule, change both.
 */

export const MIN_LENGTH = 10;
const SPECIALS = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~`'"\\]/;

const BLOCKLIST = [
  'password', 'motdepasse', 'azerty', 'qwerty', '123456', '123456789',
  'azertyuiop', 'qwertyuiop', 'admin', 'administrateur', 'welcome',
  'bienvenue', 'letmein', 'iloveyou', 'fidelitour', 'fidclic',
];

/** Individual rules, so the UI can render a live checklist. */
export function passwordRules(pw = '') {
  const lowered = pw.toLowerCase();
  return [
    { id: 'len', label: `Au moins ${MIN_LENGTH} caractères`, ok: pw.length >= MIN_LENGTH },
    { id: 'lower', label: 'Une minuscule (a-z)', ok: /[a-z]/.test(pw) },
    { id: 'upper', label: 'Une majuscule (A-Z)', ok: /[A-Z]/.test(pw) },
    { id: 'digit', label: 'Un chiffre (0-9)', ok: /[0-9]/.test(pw) },
    { id: 'special', label: 'Un caractère spécial (! ? @ # -)', ok: SPECIALS.test(pw) },
    {
      id: 'common', label: 'Pas un mot de passe courant',
      ok: pw.length > 0 && !BLOCKLIST.some((b) => (b.length >= 6 ? lowered.includes(b) : lowered === b)),
    },
  ];
}

export function passwordValid(pw = '') {
  return passwordRules(pw).every((r) => r.ok);
}

/**
 * A rough strength score (0-4) for the visual bar.
 * Deliberately simple: rules met + a bonus for real length. The bar is
 * encouragement, the rules are the gate.
 */
export function passwordStrength(pw = '') {
  if (!pw) return 0;
  const met = passwordRules(pw).filter((r) => r.ok).length;
  const lengthBonus = pw.length >= 16 ? 1 : 0;
  return Math.min(4, Math.max(0, met - 2 + lengthBonus));
}

export const STRENGTH_LABELS = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];
export const STRENGTH_COLORS = ['#C0392B', '#E0A92B', '#E3A869', '#88B27E', '#2F7A52'];
