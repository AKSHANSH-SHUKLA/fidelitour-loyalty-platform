import React, { useEffect, useState } from 'react';
import { CreditCard, Check, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import api from '../lib/api';

/**
 * BillingCard — owner-facing subscription management.
 *
 * Surfaces the tenant's current plan, status, next billing date, and gives
 * one-tap access to Stripe Checkout (upgrade) or Customer Portal (manage).
 *
 * Why we lean on Stripe-hosted pages instead of building our own forms:
 *   - PCI compliance is theirs, not ours.
 *   - Tax, currency, payment methods (cards / SEPA / Apple Pay) all work
 *     out of the box.
 *   - Reseller can change pricing in Dashboard without our re-deploy.
 *
 * What we keep on our side:
 *   - Showing the current plan (gated by `subscription_status`).
 *   - Past-due banner that's hard to miss when payment fails.
 *   - "Configure" empty state for the case where the platform admin hasn't
 *     wired Stripe keys yet.
 */
export default function BillingCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // 'checkout-basic' | 'portal' | ...

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/billing/status')
      .then((res) => { if (!cancelled) setStatus(res.data); })
      .catch(() => { if (!cancelled) setStatus({ configured: false }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const startCheckout = async (plan) => {
    setBusy(`checkout-${plan}`);
    try {
      const res = await api.post('/billing/checkout', { plan });
      if (res.data?.url) window.location.href = res.data.url;
    } catch (e) {
      alert(e.response?.data?.detail || 'Checkout failed.');
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    try {
      const res = await api.post('/billing/portal', { return_path: '/settings' });
      if (res.data?.url) window.location.href = res.data.url;
    } catch (e) {
      alert(e.response?.data?.detail || 'Could not open billing portal.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--border, #ECEFF4)] p-5">
        <div className="text-sm text-[var(--ink-body,_#556272)]">Chargement de l'abonnement…</div>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--border, #ECEFF4)] p-5">
        <div className="flex items-start gap-3">
          <CreditCard className="text-[var(--ink-muted,_#626F7E)] flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-base font-semibold text-[var(--ink-head,_#030E1D)] mb-1">Abonnement</h3>
            <p className="text-sm text-[var(--ink-body,_#556272)]">
              La facturation n'est pas configurée. L'administrateur de la plateforme
              doit définir <code className="text-xs bg-[var(--surface-2,_#F8F9FC)] px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code> dans les
              variables d'environnement Vercel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const planName = (
    { basic: 'Starter', gold: 'Growth', vip: 'Pro', chain: 'Chain (sur devis)' }
  )[status.plan] || status.plan;

  const subStatus = status.subscription_status;
  const isPastDue = subStatus === 'past_due' || subStatus === 'unpaid';
  const isCanceled = subStatus === 'canceled';
  const isTrialing = subStatus === 'trialing';
  const isActive = subStatus === 'active' || isTrialing;

  return (
    <div className="bg-white rounded-2xl border border-[var(--border, #ECEFF4)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border, #ECEFF4)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-[var(--blue-deep,_#1453BD)]" />
          <h3 className="text-base font-semibold text-[var(--ink-head,_#030E1D)]">Abonnement</h3>
        </div>
        <span className={
          'text-xs font-medium px-2 py-1 rounded-full ' + (
            isPastDue ? 'bg-[#D93036]/10 text-[var(--red-deep,_#A81E27)]' :
            isCanceled ? 'bg-[var(--surface-2,_#F8F9FC)] text-[var(--ink-body,_#556272)]' :
            isActive ? 'bg-[#10BC4C]/10 text-[var(--green-deep,_#087A31)]' : 'bg-[var(--surface-2,_#F8F9FC)] text-[var(--ink-body,_#556272)]'
          )
        }>
          {isPastDue ? 'Paiement en retard' :
           isCanceled ? 'Annulé' :
           isTrialing ? 'Essai gratuit' :
           isActive ? 'Actif' : (subStatus || 'Aucun')}
        </span>
      </div>

      {isPastDue && (
        <div className="px-5 py-3 bg-[#D93036]/10 border-b border-[#0F6FDE]/35 flex items-start gap-2">
          <AlertCircle size={18} className="text-[var(--red-deep,_#A81E27)] flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-[var(--red-deep,_#A81E27)]">
            <p className="font-semibold">Le dernier paiement a échoué.</p>
            <p className="text-xs mt-1">
              Mettez à jour votre moyen de paiement avant la fin de la période — sinon
              l'accès aux fonctionnalités payantes sera suspendu.
            </p>
            <button
              onClick={openPortal}
              disabled={busy === 'portal'}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--red-deep,_#A81E27)] underline"
            >
              Mettre à jour le paiement
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--ink-body,_#556272)]">Formule actuelle</span>
          <span className="text-base font-semibold text-[var(--ink-head,_#030E1D)]">{planName}</span>
        </div>
        {status.current_period_end && isActive && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[var(--ink-body,_#556272)]">Prochaine facture</span>
            <span className="text-sm text-[var(--ink-head,_#030E1D)]">
              {new Date(status.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}
        {isTrialing && status.trial_end && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[var(--ink-body,_#556272)]">Fin de l'essai</span>
            <span className="text-sm text-[var(--ink-head,_#030E1D)]">
              {new Date(status.trial_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </span>
          </div>
        )}
        {status.cancel_at_period_end && (
          <p className="text-xs text-[var(--blue-deep,_#1453BD)] bg-[#D93036]/10 rounded-lg p-2 mt-2">
            L'abonnement sera annulé en fin de période. Vous pouvez le réactiver depuis le portail.
          </p>
        )}
      </div>

      <div className="p-5 border-t border-[var(--border, #ECEFF4)]">
        {(status.has_stripe_customer && (isActive || isPastDue)) ? (
          <button
            onClick={openPortal}
            disabled={busy === 'portal'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--blue,_#0F6FDE)] text-white text-sm font-semibold hover:bg-[var(--blue-pressed,_#0D62C4)] transition-colors disabled:opacity-50"
          >
            <ExternalLink size={14} />
            {busy === 'portal' ? 'Ouverture…' : 'Gérer mon abonnement'}
          </button>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-[var(--ink-muted,_#626F7E)] mb-3 font-semibold">
              Choisir une formule
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {status.available_plans.map((p) => {
                const isCurrent = status.plan === p.id;
                const disabled = !p.price_id_set || busy === `checkout-${p.id}`;
                return (
                  <button
                    key={p.id}
                    onClick={() => !isCurrent && startCheckout(p.id)}
                    disabled={disabled || isCurrent}
                    className={
                      'relative px-3 py-3 rounded-lg border-2 text-sm font-semibold transition-all ' + (
                        isCurrent
                          ? 'border-[#10BC4C]/35 bg-[#10BC4C]/10 text-[var(--green-deep,_#087A31)]'
                          : 'border-[var(--border, #ECEFF4)] hover:border-[var(--blue,_#0F6FDE)] hover:bg-[var(--tint-blue,_#E5F1FF)] text-[var(--ink-head,_#030E1D)] disabled:opacity-50'
                      )
                    }
                  >
                    {isCurrent && <Check size={14} className="absolute top-2 right-2 text-[var(--green-deep,_#087A31)]" />}
                    <div>{p.name}</div>
                    {!p.price_id_set && (
                      <div className="text-[10px] font-normal text-[var(--blue-deep,_#1453BD)] mt-1">Non configuré</div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--ink-muted,_#626F7E)] mt-3 flex items-center gap-1">
              <Sparkles size={12} className="text-[var(--blue-deep,_#1453BD)]" />
              14 jours d'essai gratuit, sans engagement.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
