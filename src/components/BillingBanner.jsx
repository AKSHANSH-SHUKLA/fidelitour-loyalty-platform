import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ExternalLink } from 'lucide-react';
import api from '../lib/api';

/**
 * BillingBanner — global, dismissible warning bar for past-due subscriptions.
 *
 * Renders at the very top of the dashboard layout. Stays out of the way until
 * something needs the owner's attention (failed payment, trial ending in <3
 * days, subscription canceled but still in grace period).
 *
 * Polls /billing/status once on mount and once a minute thereafter — cheap
 * because the endpoint is a single Mongo find. Silently no-ops if billing
 * isn't configured (i.e. STRIPE_SECRET_KEY not set).
 */
export default function BillingBanner() {
  const [status, setStatus] = useState(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.get('/billing/status')
        .then((res) => { if (!cancelled) setStatus(res.data); })
        .catch(() => { /* silent */ });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!status?.configured) return null;
  const sub = status.subscription_status;
  if (!sub || sub === 'active') return null;

  const isPastDue = sub === 'past_due' || sub === 'unpaid';
  const isCanceled = sub === 'canceled';
  const trialEnd = status.trial_end ? new Date(status.trial_end) : null;
  const daysToTrialEnd = trialEnd ? Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)) : null;
  const isTrialEnding = sub === 'trialing' && daysToTrialEnd !== null && daysToTrialEnd <= 3;

  // Nothing urgent → render nothing.
  if (!isPastDue && !isCanceled && !isTrialEnding) return null;

  const openPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await api.post('/billing/portal', { return_path: '/settings' });
      if (res.data?.url) window.location.href = res.data.url;
    } catch (_e) {
      // Fall back to settings page if portal won't open (e.g. no customer yet).
      window.location.href = '/settings#settings-billing';
    } finally {
      setOpeningPortal(false);
    }
  };

  const bgClass = isPastDue
    ? 'bg-[#FCEBEB] border-[#F0997B] text-[#791F1F]'
    : isCanceled
      ? 'bg-[#F2F2F2] border-[#D4D4D4] text-[#1C1917]'
      : 'bg-[#FFF7E1] border-[#EBB87C] text-[#7A4A0A]';

  return (
    <div className={`border-b ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <AlertCircle size={16} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {isPastDue && (
            <span>
              <strong>Paiement en échec.</strong> Mettez à jour votre moyen de paiement
              pour éviter la suspension de votre compte.
            </span>
          )}
          {isCanceled && (
            <span>
              <strong>Abonnement annulé.</strong> Vous gardez l'accès jusqu'à la fin de la
              période en cours. <Link to="/settings#settings-billing" className="underline">Réactivez quand vous voulez.</Link>
            </span>
          )}
          {isTrialEnding && (
            <span>
              <strong>Fin de l'essai dans {daysToTrialEnd} jour{daysToTrialEnd > 1 ? 's' : ''}.</strong>{' '}
              Choisissez une formule pour continuer sans interruption.
            </span>
          )}
        </div>
        <button
          onClick={openPortal}
          disabled={openingPortal}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white text-[#1C1917] font-semibold text-xs hover:bg-[#FAF8F4] transition-colors disabled:opacity-50 border border-[#E7E5E4]"
        >
          {openingPortal ? 'Ouverture…' : 'Gérer'}
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}
