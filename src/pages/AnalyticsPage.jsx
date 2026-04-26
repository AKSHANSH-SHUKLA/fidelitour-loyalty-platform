import React, { useEffect, useMemo, useState } from 'react';
import { ownerAPI } from '../lib/api';
import NumberInput from '../components/NumberInput';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, TrendingUp, Award, Smartphone, Gift, Calendar,
  Activity, X, Trophy, ArrowDown, ArrowUp, CreditCard,
  AlertCircle, Send, Megaphone, Clock, Building2, Star,
  MessageSquare, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import TierBadge from '../components/TierBadge';

const TIER_COLORS = { bronze: '#8B6914', silver: '#A8A8A8', gold: '#E3A869', vip: '#7B3F00' };
const ACQ_COLORS = ['#B85C38', '#E3A869', '#4A5D23', '#7B3F00', '#5B8DEF', '#AA6EBE', '#8B6914'];

// ------------------------------------------------------------------
// Reusable "Send Campaign" button — plants on every metric / chart card.
// Clicking opens a composer pre-filled with the given segment descriptor.
// The parent wires in openComposer(segment, presetName, presetContent).
// ------------------------------------------------------------------
const SendCampaignButton = ({ label = 'Send campaign', onClick, compact = false, icon: Icon = Send }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick && onClick();
    }}
    className={
      compact
        ? 'inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-[#B85C38]/10 text-[#B85C38] rounded-full hover:bg-[#B85C38] hover:text-white transition'
        : 'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#B85C38]/10 text-[#B85C38] rounded-full hover:bg-[#B85C38] hover:text-white transition font-medium'
    }
    title="Send a campaign to this segment"
  >
    <Icon size={compact ? 11 : 13} />
    {label}
  </button>
);

// ------------------------------------------------------------------
// KPI card with optional Send Campaign CTA in top-right corner.
// ------------------------------------------------------------------
const KPICard = ({
  icon: Icon, title, value, sublabel, onClick, accent = '#B85C38',
  segment, openComposer, presetName, presetContent,
}) => (
  <div
    onClick={onClick}
    className={`relative bg-white p-5 rounded-xl border border-[#E7E5E4] ${
      onClick ? 'cursor-pointer hover:shadow-md transition' : ''
    }`}
  >
    {segment && openComposer && (
      <div className="absolute top-2 right-2">
        <SendCampaignButton
          compact
          label="Send"
          onClick={() => openComposer(segment, presetName, presetContent)}
        />
      </div>
    )}
    <div className="flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0"
        style={{ background: accent }}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0 pr-6">
        <p className="text-xs text-[#57534E] uppercase tracking-wide font-semibold truncate">{title}</p>
        <p className="text-2xl font-bold text-[#1C1917] leading-tight">{value}</p>
        {sublabel && <p className="text-xs text-[#8B8680] mt-0.5 truncate">{sublabel}</p>}
      </div>
    </div>
  </div>
);

// ------------------------------------------------------------------
// ChartCard with optional Send CTA
// ------------------------------------------------------------------
const ChartCard = ({ title, hint, children, segment, openComposer, presetName, presetContent }) => (
  <div className="bg-white p-6 rounded-xl border border-[#E7E5E4]">
    <div className="flex items-start justify-between gap-3 mb-1">
      <h2
        className="text-xl font-semibold text-[#1C1917]"
        style={{ fontFamily: 'Cormorant Garamond' }}
      >
        {title}
      </h2>
      {segment && openComposer && (
        <SendCampaignButton
          label="Send campaign"
          onClick={() => openComposer(segment, presetName, presetContent)}
        />
      )}
    </div>
    {hint && <p className="text-xs text-[#8B8680] mt-1 mb-3">{hint}</p>}
    {children}
  </div>
);

// ------------------------------------------------------------------
// Campaign composer modal — used for every "Send campaign" CTA.
// ------------------------------------------------------------------
const CampaignComposer = ({ segment, presetName, presetContent, onClose, onSent }) => {
  const [name, setName] = useState(presetName || '');
  const [content, setContent] = useState(presetContent || '');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [scheduleMode, setScheduleMode] = useState('now'); // now | later
  const [runAt, setRunAt] = useState('');
  const [recurrence, setRecurrence] = useState('');

  useEffect(() => {
    setName(presetName || '');
    setContent(presetContent || '');
  }, [presetName, presetContent]);

  useEffect(() => {
    // Preview count for this segment
    (async () => {
      try {
        // For most segments we don't have a preview endpoint, so skip.
        // If segment is tier-based, we could call preview-segment, but it's optional UX.
        setPreview(null);
      } catch (e) { /* ignore */ }
    })();
  }, [segment]);

  const send = async () => {
    if (!name.trim() || !content.trim()) {
      alert('Merci de remplir le sujet et le message.');
      return;
    }
    setSending(true);
    try {
      if (scheduleMode === 'later') {
        if (!runAt) {
          alert('Choisissez une date d\'envoi.');
          setSending(false);
          return;
        }
        await ownerAPI.scheduleCampaign({
          name,
          content,
          run_at: new Date(runAt).toISOString(),
          segment,
          recurrence: recurrence || null,
        });
        alert(recurrence ? `Campagne programmée en récurrence (${recurrence}) ✓` : 'Campagne programmée ✓');
      } else {
        const res = await ownerAPI.sendCampaignToGroup({
          name,
          content,
          segment,
        });
        alert(`Campagne envoyée à ${res.data.targeted_count ?? 0} clients ✓`);
      }
      onSent && onSent();
      onClose();
    } catch (e) {
      alert('Erreur: ' + (e?.response?.data?.detail || e?.message || 'envoi impossible'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              <Megaphone className="inline mr-2 text-[#B85C38]" size={22} /> Composer une campagne
            </h3>
            <p className="text-xs text-[#8B8680] mt-1">
              Cible : <span className="font-medium text-[#B85C38]">{segmentLabel(segment)}</span>
              {preview != null && <span className="ml-2">({preview} destinataires)</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-[#A8A29E] hover:text-[#1C1917]"><X size={22} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Sujet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Offre spéciale {first_name} 🎁"
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Message</label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Bonjour {first_name}, il te reste {points_to_next_reward} points pour débloquer ta récompense chez {business_name} !"
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85C38] font-['Manrope']"
            />
            <p className="text-[11px] text-[#8B8680] mt-1">
              Variables : <code>{'{first_name}'}</code>, <code>{'{name}'}</code>, <code>{'{tier}'}</code>, <code>{'{points_to_next_reward}'}</code>, <code>{'{points}'}</code>, <code>{'{business_name}'}</code>
            </p>
          </div>

          <div className="p-3 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
            <div className="flex items-center gap-4 mb-2">
              <label className="inline-flex items-center gap-1 text-sm">
                <input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} />
                Envoyer maintenant
              </label>
              <label className="inline-flex items-center gap-1 text-sm">
                <input type="radio" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} />
                Programmer plus tard
              </label>
            </div>
            {scheduleMode === 'later' && (
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="datetime-local"
                  value={runAt}
                  onChange={(e) => setRunAt(e.target.value)}
                  className="px-2 py-1 border border-[#E7E5E4] rounded"
                />
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="px-2 py-1 border border-[#E7E5E4] rounded text-sm"
                >
                  <option value="">Une seule fois</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#E7E5E4] text-[#1C1917] rounded-lg hover:bg-[#F3EFE7]"
            >
              Annuler
            </button>
            <button
              disabled={sending}
              onClick={send}
              className="px-5 py-2 bg-[#B85C38] text-white rounded-lg font-medium hover:bg-[#9C4E2F] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {scheduleMode === 'later' ? <Clock size={16} /> : <Send size={16} />}
              {sending ? 'Envoi…' : scheduleMode === 'later' ? 'Programmer' : 'Envoyer maintenant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function segmentLabel(segment) {
  if (!segment) return 'Tous les clients';
  switch (segment.type) {
    case 'all': return 'Tous les clients';
    case 'tier': return `Tier ${segment.value}`;
    case 'inactive_days': return `Inactifs ${segment.value || 30} j`;
    case 'recovered': return 'Clients récupérés';
    case 'top_paying_n': return `Top ${segment.n || 20} gros payeurs`;
    case 'least_paying_n': return `${segment.n || 20} plus faibles payeurs`;
    case 'max_visits_n': return `Top ${segment.n || 20} visites`;
    case 'least_visits_n': return `${segment.n || 20} plus faibles en visites`;
    case 'birthday_month': return `Anniversaires en ${segment.value}`;
    case 'birthday_today': return 'Anniversaires aujourd\'hui';
    case 'acquisition': return `Source: ${segment.value}`;
    case 'one_visit_only': return 'Clients 1 visite seulement';
    default: return 'Segment personnalisé';
  }
}

// ------------------------------------------------------------------
// Columns for the drill-down modal when listing customers
// ------------------------------------------------------------------
const CUSTOMER_DRILL_COLUMNS = [
  { key: 'name', label: 'Customer' },
  { key: 'email', label: 'Email' },
  { key: 'tier', label: 'Tier', render: (v) => <TierBadge tier={v} /> },
  { key: 'visits', label: 'Visits' },
  { key: 'total_amount_paid', label: 'Spent', render: (v) => `€${(v ?? 0).toFixed(0)}` },
  { key: 'last_visit_date', label: 'Last visit', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
];

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------
const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cardsFilled, setCardsFilled] = useState(null);
  const [highestPaying, setHighestPaying] = useState([]);
  const [recovered, setRecovered] = useState(null);
  const [acquisition, setAcquisition] = useState([]);
  const [reviewAnalytics, setReviewAnalytics] = useState(null);

  // Branch selector — drives every API call below
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(''); // '' means "All branches"

  const [recoveryInactiveDays, setRecoveryInactiveDays] = useState(30);
  const [recoveryWindowDays, setRecoveryWindowDays] = useState(30);
  const [rankingMode, setRankingMode] = useState('top_paying'); // top_paying | least_paying | max_visits | least_visits

  // Custom threshold for "Inactive customers" KPI. Default 30 days — owner can change it.
  const [inactiveThreshold, setInactiveThreshold] = useState(30);
  const [inactiveDraft, setInactiveDraft] = useState('30');
  // Period preset for the whole page — 7/30/90 days or "all time". Applied everywhere a window makes sense.
  const [periodDays, setPeriodDays] = useState(30);
  // Free-typing buffer for the custom-period input. Decoupled from periodDays so
  // the user can clear the field and type a new number without it snapping to 1
  // on every keystroke. Only commits to periodDays on blur / Enter.
  const [periodDraft, setPeriodDraft] = useState('30');

  const [drill, setDrill] = useState(null); // { title, rows }
  const [drillLoading, setDrillLoading] = useState(false);
  const [composer, setComposer] = useState(null); // { segment, presetName, presetContent }

  const openComposer = (segment, presetName, presetContent) => {
    setComposer({ segment, presetName: presetName || '', presetContent: presetContent || '' });
  };

  // Build the param object for every API call, adding branch + period scope.
  const params = (extra = {}) => ({
    ...(branchId ? { branch_id: branchId } : {}),
    ...(periodDays && periodDays !== 30 ? { period_days: periodDays } : {}),
    ...extra,
  });

  // Commit typed period value: clamp to 1..730 and sync the preset highlight.
  const commitPeriodDraft = () => {
    const trimmed = (periodDraft || '').trim();
    if (trimmed === '') {
      // Empty → restore to the last committed value
      setPeriodDraft(String(periodDays));
      return;
    }
    const n = Math.max(1, Math.min(730, Math.round(Number(trimmed) || 0)));
    if (!n) {
      setPeriodDraft(String(periodDays));
      return;
    }
    setPeriodDays(n);
    setPeriodDraft(String(n));
  };
  const commitInactiveDraft = () => {
    const trimmed = (inactiveDraft || '').trim();
    if (trimmed === '') {
      setInactiveDraft(String(inactiveThreshold));
      return;
    }
    const n = Math.max(1, Math.min(730, Math.round(Number(trimmed) || 0)));
    if (!n) {
      setInactiveDraft(String(inactiveThreshold));
      return;
    }
    setInactiveThreshold(n);
    setInactiveDraft(String(n));
  };

  // Click-to-drill helper used by every KPI card.
  const drillCustomers = async (title, filters) => {
    setDrill({ title, rows: [], columns: CUSTOMER_DRILL_COLUMNS });
    setDrillLoading(true);
    try {
      const res = await ownerAPI.getCustomers(params(filters));
      setDrill({ title, rows: res.data || [], columns: CUSTOMER_DRILL_COLUMNS });
    } catch (e) {
      setDrill({ title, rows: [], columns: CUSTOMER_DRILL_COLUMNS, error: e?.message || 'Failed to load' });
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await ownerAPI.getBranches();
        setBranches(r.data || []);
      } catch (e) { /* no branches — owner on basic plan, fine */ }
    })();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        ownerAPI.getAnalytics(params()),
        ownerAPI.getAnalyticsSummary(params()),
        ownerAPI.getCardsFilled(params()),
        ownerAPI.getHighestPaying(params()),
        ownerAPI.getAcquisitionSources(params()),
        ownerAPI.getReviewAnalytics(params()),
      ]);
      const [a, s, cf, hp, acq, rv] = results;
      if (a.status === 'fulfilled') setAnalytics(a.value.data);
      if (s.status === 'fulfilled') setSummary(s.value.data);
      if (cf.status === 'fulfilled') setCardsFilled(cf.value.data);
      if (hp.status === 'fulfilled') setHighestPaying(hp.value.data || []);
      if (acq.status === 'fulfilled') setAcquisition(acq.value.data?.sources || []);
      if (rv.status === 'fulfilled') setReviewAnalytics(rv.value.data);
      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        const first = results[0];
        setLoadError(first.reason?.response?.status
          ? `Error ${first.reason.response.status}: ${first.reason.response.data?.detail || first.reason.message}`
          : first.reason?.message || 'Failed to load analytics');
      }
    } catch (e) {
      setLoadError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [branchId, periodDays]);

  useEffect(() => {
    (async () => {
      try {
        const r = await ownerAPI.getRecovered(params({
          inactive_days: recoveryInactiveDays,
          window_days: recoveryWindowDays,
        }));
        setRecovered(r.data);
      } catch (e) { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryInactiveDays, recoveryWindowDays, branchId]);

  const totalCustomers = analytics?.total_customers ?? summary?.total_customers ?? 0;
  const totalVisits = analytics?.total_visits ?? 0;
  const repeatRate = analytics?.repeat_rate_pct ?? 0;
  const walletPasses = analytics?.wallet_passes_issued ?? 0;
  const activeCustomers = summary?.active_customers ?? 0;
  const newThisWeek = summary?.new_this_week ?? 0;
  const cardsFilledTotal = cardsFilled?.total_cards_filled ?? 0;
  const cardsFilledThisMonth = cardsFilled?.cards_filled_this_month ?? 0;
  // New summary-backed KPIs
  const newToday = summary?.new_today_count ?? 0;
  const inactiveCount = summary?.inactive_count ?? 0;
  const aboutToLoseCount = summary?.about_to_lose_count ?? 0;
  const cardsFilledToday = summary?.cards_filled_today ?? 0;
  // New KPIs from this batch
  const rewardsRedeemedToday = summary?.rewards_redeemed_today ?? 0;
  const rewardsRedeemedMonth = summary?.rewards_redeemed_month ?? 0;
  const birthdaysThisMonth = summary?.birthdays_this_month_count ?? 0;
  const vipCount = summary?.vip_count ?? 0;
  const inactivePct = totalCustomers ? Math.round((inactiveCount / totalCustomers) * 100) : 0;
  const aboutToLosePct = totalCustomers ? Math.round((aboutToLoseCount / totalCustomers) * 100) : 0;

  const tierData = useMemo(() => {
    const td = analytics?.tier_distribution || {};
    return [
      { name: 'Bronze', value: td.bronze || 0, key: 'bronze' },
      { name: 'Silver', value: td.silver || 0, key: 'silver' },
      { name: 'Gold', value: td.gold || 0, key: 'gold' },
      { name: 'VIP', value: td.vip || 0, key: 'vip' },
    ];
  }, [analytics]);

  const visitsByDay = useMemo(() => {
    if (!analytics?.visits_by_day) return [];
    return Object.entries(analytics.visits_by_day)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [analytics]);

  const newCustomersByWeek = useMemo(() => {
    const w = analytics?.new_customers_by_week || {};
    return Object.entries(w).map(([week, count]) => ({ week, count }));
  }, [analytics]);

  // imported components
  // (NumberInput is imported at top)
  const acquisitionChart = useMemo(
    () => (acquisition || []).map((a) => ({
      name: a.label || (a.source || 'unknown').replace(/_/g, ' '),
      value: a.count || 0,
      raw: a.source,
      pct: a.percentage || 0,
    })),
    [acquisition]
  );

  // Lifetime acquisition total — sum of all per-channel counts. Used for
  // the "X customers acquired all-time" headline above the per-channel KPIs.
  const acquisitionTotal = useMemo(
    () => (acquisition || []).reduce((sum, a) => sum + (a.count || 0), 0),
    [acquisition]
  );

  // Per-source styling — consistent colors across the chart and the KPI tiles.
  const SOURCE_STYLE = {
    instagram: { color: '#E1306C', bg: 'rgba(225,48,108,0.08)', icon: '📸' },
    facebook:  { color: '#1877F2', bg: 'rgba(24,119,242,0.08)', icon: '👥' },
    tiktok:    { color: '#000000', bg: 'rgba(0,0,0,0.06)',       icon: '🎵' },
    qr_store:  { color: '#B85C38', bg: 'rgba(184,92,56,0.10)',   icon: '📍' },
  };

  const rankedCustomers = useMemo(() => {
    const list = [...(highestPaying || [])];
    switch (rankingMode) {
      case 'top_paying':
        return list.sort((a, b) => (b.total_amount_paid || 0) - (a.total_amount_paid || 0)).slice(0, 20);
      case 'least_paying':
        return list
          .filter((c) => (c.total_amount_paid || 0) > 0)
          .sort((a, b) => (a.total_amount_paid || 0) - (b.total_amount_paid || 0))
          .slice(0, 20);
      case 'max_visits':
        return list.sort((a, b) => (b.total_visits || 0) - (a.total_visits || 0)).slice(0, 20);
      case 'least_visits':
        return list
          .filter((c) => (c.total_visits || 0) > 0)
          .sort((a, b) => (a.total_visits || 0) - (b.total_visits || 0))
          .slice(0, 20);
      default:
        return list.slice(0, 20);
    }
  }, [highestPaying, rankingMode]);

  const rankingSegment = useMemo(() => {
    switch (rankingMode) {
      case 'top_paying': return { type: 'top_paying_n', n: 20 };
      case 'least_paying': return { type: 'least_paying_n', n: 20 };
      case 'max_visits': return { type: 'max_visits_n', n: 20 };
      case 'least_visits': return { type: 'least_visits_n', n: 20 };
      default: return { type: 'all' };
    }
  }, [rankingMode]);

  const rankingPreset = useMemo(() => {
    switch (rankingMode) {
      case 'top_paying':
        return {
          name: 'Merci pour votre fidélité, {first_name} 🙏',
          content: 'En tant que client privilégié ({tier}), profitez d\'une attention spéciale lors de votre prochaine visite chez {business_name}.',
        };
      case 'least_paying':
        return {
          name: 'On vous a préparé quelque chose, {first_name}',
          content: 'Un geste pour votre prochaine visite chez {business_name} : {points_to_next_reward} points vous séparent de votre récompense.',
        };
      case 'max_visits':
        return {
          name: 'Vous êtes un(e) habitué(e), {first_name} 🌟',
          content: 'Bravo pour vos {visits} visites ! Une récompense VIP vous attend chez {business_name}.',
        };
      case 'least_visits':
        return {
          name: 'Revenez bientôt, {first_name}',
          content: 'Il te reste {points_to_next_reward} points pour débloquer ta récompense chez {business_name}. À tout de suite !',
        };
      default:
        return {};
    }
  }, [rankingMode]);

  if (loading) {
    return <div className="p-8 bg-[#FDFBF7] min-h-screen text-[#57534E]">Loading analytics…</div>;
  }

  if (loadError && !analytics) {
    return (
      <div className="p-8 bg-[#FDFBF7] min-h-screen">
        <div className="max-w-xl mx-auto bg-white border border-[#E7E5E4] rounded-xl p-8 text-center">
          <AlertCircle className="mx-auto mb-2 text-[#B85C38]" size={32} />
          <h2 className="text-2xl font-bold text-[#B85C38] mb-2">Analytics failed to load</h2>
          <p className="text-[#57534E] text-sm mb-4">{loadError}</p>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-[#B85C38] text-white rounded-lg font-medium hover:bg-[#9C4E2F]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: 'Cormorant Garamond' }}>
            Analytics
          </h1>
          <p className="text-[#57534E]">
            Chaque chiffre est live. Cliquez sur n'importe quel KPI pour voir la liste de clients correspondante.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {branches.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-[#E7E5E4] rounded-xl px-3 py-2">
              <Building2 size={16} className="text-[#B85C38]" />
              <label className="text-xs font-bold text-[#57534E] uppercase tracking-wider">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="text-sm bg-transparent outline-none"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.id}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 bg-white border border-[#E7E5E4] rounded-xl px-2 py-1.5">
            <Calendar size={14} className="text-[#B85C38] mx-1" />
            <label className="text-xs font-bold text-[#57534E] uppercase tracking-wider mr-1">Period</label>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setPeriodDays(d); setPeriodDraft(String(d)); }}
                className={`text-xs px-2 py-1 rounded-md transition ${
                  periodDays === d
                    ? 'bg-[#B85C38] text-white'
                    : 'text-[#57534E] hover:bg-[#F5F4F0]'
                }`}
              >
                {d}d
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="730"
              value={periodDraft}
              onChange={(e) => setPeriodDraft(e.target.value)}
              onBlur={commitPeriodDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitPeriodDraft();
                  e.currentTarget.blur();
                }
              }}
              className="w-16 text-xs px-2 py-1 border border-[#E7E5E4] rounded-md ml-1"
              placeholder="days"
              title="Type a custom number of days and press Enter"
            />
          </div>
          <button
            onClick={() => openComposer({ type: 'all' }, 'Message à toute ma base', 'Bonjour {first_name}, une nouveauté à partager chez {business_name}…')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B85C38] text-white rounded-xl hover:bg-[#9C4E2F] font-medium"
          >
            <Megaphone size={16} /> Nouvelle campagne
          </button>
        </div>
      </header>

      {/* Row 1 — canonical KPIs. Each card is click-to-drill. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          title="Total Customers"
          value={totalCustomers.toLocaleString()}
          sublabel={`${newThisWeek} new this week${branchId ? ' · this branch' : ''} · click to view`}
          accent="#B85C38"
          onClick={() => drillCustomers('All customers', {})}
          segment={{ type: 'all' }}
          openComposer={openComposer}
          presetName="Un message pour toi, {first_name}"
          presetContent="Merci de faire partie de la famille {business_name} ! Une surprise vous attend lors de votre prochain passage."
        />
        <KPICard
          icon={Activity}
          title="Total Visits"
          value={totalVisits.toLocaleString()}
          sublabel="All time · click to view top visitors"
          accent="#4A5D23"
          onClick={() => drillCustomers('Customers with ≥ 1 visit', { min_visits: 1 })}
          segment={{ type: 'max_visits_n', n: 20 }}
          openComposer={openComposer}
          presetName="Merci pour vos {visits} visites 🙏"
          presetContent="Vos {visits} visites vous rendent VIP, {first_name}. Une attention spéciale vous attend chez {business_name}."
        />
        <KPICard
          icon={TrendingUp}
          title="Repeat Rate"
          value={`${repeatRate.toFixed(1)}%`}
          sublabel={`${activeCustomers} active (30d) · click to view repeat customers`}
          accent="#E3A869"
          onClick={() => drillCustomers('Repeat customers (≥ 2 visits)', { min_visits: 2 })}
          segment={{ type: 'inactive_days', value: 30 }}
          openComposer={openComposer}
          presetName="On vous a manqué, {first_name}"
          presetContent="Ça fait un moment… Revenez cette semaine chez {business_name} pour une offre spéciale."
        />
        <KPICard
          icon={Smartphone}
          title="Wallet Passes"
          value={walletPasses.toLocaleString()}
          sublabel={`${totalCustomers ? Math.round((walletPasses / totalCustomers) * 100) : 0}% of customers · click to view`}
          accent="#7B3F00"
          onClick={() => drillCustomers('Wallet pass holders', { has_wallet_pass: true })}
          segment={{ type: 'all' }}
          openComposer={openComposer}
          presetName="Ajoutez votre carte au wallet"
          presetContent="{first_name}, gardez {business_name} à portée de main. Ajoutez votre carte à Apple/Google Wallet."
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={CreditCard}
          title="Cards Filled"
          value={cardsFilledTotal.toLocaleString()}
          sublabel={`${cardsFilledThisMonth} this month · click to view`}
          accent="#4A5D23"
          onClick={() => drillCustomers('Customers who filled at least one card', { cards_filled: true })}
          segment={{ type: 'tier', value: 'gold' }}
          openComposer={openComposer}
          presetName="Bravo {first_name} — vous êtes {tier} !"
          presetContent="Vous avez rempli votre carte. Une récompense exclusive {business_name} vous attend."
        />
        <KPICard
          icon={Gift}
          title="Recovered Customers"
          value={(recovered?.count ?? summary?.recovered_count ?? 0).toLocaleString()}
          sublabel={`${recovered?.percentage ?? summary?.recovered_pct ?? 0}% of total · click to view`}
          onClick={() =>
            setDrill({
              title: 'Recovered Customers',
              rows: recovered?.customers || [],
              columns: [
                { key: 'name', label: 'Customer' },
                { key: 'email', label: 'Email' },
                { key: 'tier', label: 'Tier', render: (v) => <TierBadge tier={v} /> },
                { key: 'last_inactive_date', label: 'Gap started', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                { key: 'returned_date', label: 'Returned', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
              ],
            })
          }
          accent="#B85C38"
          segment={{ type: 'recovered', inactive_days: recoveryInactiveDays, window_days: recoveryWindowDays }}
          openComposer={openComposer}
          presetName="Heureux de vous revoir, {first_name} !"
          presetContent="Pour votre retour chez {business_name}, un petit bonus vous attend. {points_to_next_reward} points vous séparent de votre récompense."
        />
        <KPICard
          icon={Award}
          title="Active Customers"
          value={activeCustomers.toLocaleString()}
          sublabel="Visited in last 30 days · click to view"
          accent="#E3A869"
          onClick={() => drillCustomers('Active customers (visited in last 30 days)', { active_30d: true })}
          segment={{ type: 'tier', value: 'gold' }}
          openComposer={openComposer}
          presetName="Nos meilleurs clients ont droit à…"
          presetContent="{first_name}, parce que vous êtes {tier}, voici un avantage exclusif chez {business_name}."
        />
        <KPICard
          icon={Calendar}
          title="New This Week"
          value={newThisWeek.toLocaleString()}
          sublabel="Joined in last 7 days · click to view"
          accent="#5B8DEF"
          onClick={() => drillCustomers('New customers (last 7 days)', { created_within_days: 7 })}
          segment={{ type: 'one_visit_only' }}
          openComposer={openComposer}
          presetName="Bienvenue chez {business_name}, {first_name} !"
          presetContent="Pour votre 2e visite, une surprise vous attend. Il te reste {points_to_next_reward} points pour ta 1re récompense."
        />
      </section>

      {/* Row 1b — Retention health: first-time today, inactive (custom), about-to-lose, cards filled today */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              Retention health
            </h3>
            <p className="text-xs text-[#8B8680]">
              First-time signups today, inactive customers (your own threshold), at-risk customers about to churn, and card completions today. Click any card to see the customer list.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#57534E] uppercase tracking-wider">Inactive ≥</label>
            <div className="flex gap-1">
              {[7, 14, 21, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setInactiveThreshold(d); setInactiveDraft(String(d)); }}
                  className={`text-xs px-2 py-1 rounded-md transition ${
                    inactiveThreshold === d
                      ? 'bg-[#B85C38] text-white'
                      : 'bg-[#F5F4F0] text-[#57534E] hover:bg-[#E7E5E4]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="730"
              value={inactiveDraft}
              onChange={(e) => setInactiveDraft(e.target.value)}
              onBlur={commitInactiveDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitInactiveDraft();
                  e.currentTarget.blur();
                }
              }}
              className="w-16 text-xs px-2 py-1 border border-[#E7E5E4] rounded-md"
              title="Type a custom inactivity threshold and press Enter"
            />
            <span className="text-xs text-[#8B8680]">days</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={Users}
            title="First-time cards today"
            value={newToday.toLocaleString()}
            sublabel="Signed up today · click to view"
            accent="#4A5D23"
            onClick={() => drillCustomers('First-time cards today', { created_within_days: 1 })}
            segment={{ type: 'one_visit_only' }}
            openComposer={openComposer}
            presetName="Bienvenue chez {business_name}, {first_name} !"
            presetContent="Merci d'avoir rejoint {business_name}. Pour votre 2e visite, une attention spéciale vous attend."
          />
          <KPICard
            icon={AlertCircle}
            title={`Inactive ≥ ${inactiveThreshold}d`}
            value={inactiveCount.toLocaleString()}
            sublabel={`${inactivePct}% of base · click to view & win back`}
            accent="#B85C38"
            onClick={() =>
              drillCustomers(
                `Inactive ≥ ${inactiveThreshold} days`,
                { inactive_days_min: inactiveThreshold }
              )
            }
            segment={{ type: 'inactive_days', value: inactiveThreshold }}
            openComposer={openComposer}
            presetName="On vous a manqué, {first_name}"
            presetContent={`Ça fait plus de ${inactiveThreshold} jours… une offre flash vous attend chez {business_name}.`}
          />
          <KPICard
            icon={Clock}
            title="About to lose (14–29d)"
            value={aboutToLoseCount.toLocaleString()}
            sublabel={`${aboutToLosePct}% of base · at risk of churning`}
            accent="#E3A869"
            onClick={() =>
              drillCustomers('About to lose (14–29 days since last visit)', {
                inactive_days_min: 14,
                inactive_days_max: 29,
              })
            }
            segment={{ type: 'inactive_days', value: 14 }}
            openComposer={openComposer}
            presetName="Un petit rappel, {first_name}"
            presetContent="Ça fait quelques semaines… {business_name} vous attend avec une surprise."
          />
          <KPICard
            icon={CreditCard}
            title="Cards completed today"
            value={cardsFilledToday.toLocaleString()}
            sublabel="Card completions recorded today"
            accent="#7B3F00"
            onClick={() => drillCustomers('Customers with at least one completed card', { cards_filled: true })}
            segment={{ type: 'tier', value: 'gold' }}
            openComposer={openComposer}
            presetName="Bravo {first_name} — récompense débloquée !"
            presetContent="Vous venez de remplir votre carte chez {business_name}. Votre récompense vous attend."
          />
        </div>
      </section>

      {/* Row 1c — Rewards & celebrations: redemptions + birthdays + VIPs */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Rewards & celebrations
          </h3>
          <p className="text-xs text-[#8B8680]">
            Real-time redemption counts (staff-logged), birthdays coming up this month, and your new VIP tier.
            Click any card to drill into the customer list.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={Gift}
            title="Rewards redeemed today"
            value={rewardsRedeemedToday.toLocaleString()}
            sublabel={`${rewardsRedeemedMonth} this month · click to view history`}
            accent="#4A5D23"
            onClick={async () => {
              try {
                const res = await ownerAPI.listRedeemedRewards(params({ days: 30 }));
                setDrill({
                  title: 'Rewards redeemed (last 30 days)',
                  rows: res.data?.redemptions || [],
                  columns: [
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'reward_name', label: 'Reward' },
                    { key: 'reward_value_eur', label: 'Value (€)', render: (v) => v ? `€${Number(v).toFixed(2)}` : '—' },
                    { key: 'branch_id', label: 'Branch' },
                    { key: 'redeemed_at', label: 'Redeemed', render: (v) => v ? new Date(v).toLocaleString() : '—' },
                  ],
                });
              } catch (e) { alert('Failed to load redemptions: ' + (e?.response?.data?.detail || e.message)); }
            }}
            segment={{ type: 'all' }}
            openComposer={openComposer}
            presetName="Merci d'être fidèle, {first_name}"
            presetContent="Un grand merci pour votre fidélité chez {business_name}. Un petit bonus vous attend à votre prochaine visite."
          />
          <KPICard
            icon={Calendar}
            title="Birthdays this month"
            value={birthdaysThisMonth.toLocaleString()}
            sublabel="Customers celebrating · click to view & message them"
            accent="#E3A869"
            onClick={() => drillCustomers('Birthdays this month', { has_birthday_this_month: true })}
            segment={{ type: 'birthday_month', value: new Date().toISOString().slice(5, 7) }}
            openComposer={openComposer}
            presetName="Joyeux anniversaire, {first_name} ! 🎂"
            presetContent="Toute l'équipe {business_name} vous souhaite un joyeux anniversaire. Venez le fêter avec nous — une surprise vous attend !"
          />
          <KPICard
            icon={Award}
            title="VIP customers"
            value={vipCount.toLocaleString()}
            sublabel={`Top tier — 40+ visits or avg €60+ ticket`}
            accent="#7B3F00"
            onClick={() => drillCustomers('VIP customers', { tier: 'vip' })}
            segment={{ type: 'tier', value: 'vip' }}
            openComposer={openComposer}
            presetName="Pour nos VIPs, {first_name}"
            presetContent="En tant que membre VIP de {business_name}, un avantage exclusif vous attend lors de votre prochaine visite."
          />
          <KPICard
            icon={Gift}
            title="Rewards redeemed (month)"
            value={rewardsRedeemedMonth.toLocaleString()}
            sublabel="Total redemptions this calendar month"
            accent="#B85C38"
            onClick={async () => {
              try {
                const res = await ownerAPI.listRedeemedRewards(params({ days: 31 }));
                setDrill({
                  title: 'Rewards redeemed — this month',
                  rows: res.data?.redemptions || [],
                  columns: [
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'reward_name', label: 'Reward' },
                    { key: 'branch_id', label: 'Branch' },
                    { key: 'redeemed_at', label: 'Redeemed', render: (v) => v ? new Date(v).toLocaleString() : '—' },
                  ],
                });
              } catch (e) { alert('Failed: ' + (e?.response?.data?.detail || e.message)); }
            }}
            segment={{ type: 'all' }}
            openComposer={openComposer}
            presetName="Merci d'avoir utilisé votre récompense"
            presetContent="Nous espérons que votre récompense vous a plu ! Votre prochaine carte est déjà lancée chez {business_name}."
          />
        </div>
      </section>

      {/* Row 2 — visits by day + new customers by week */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Visits over the last 30 days"
          hint="Daily visits recorded by staff scans."
          segment={{ type: 'inactive_days', value: 14 }}
          openComposer={openComposer}
          presetName="Revenez nous voir, {first_name}"
          presetContent="Ça fait 2 semaines… une offre flash vous attend chez {business_name}."
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={visitsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="date" stroke="#57534E" tick={{ fontSize: 10 }} />
              <YAxis stroke="#57534E" />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#B85C38" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="New customers by week"
          hint="Weekly registrations over the last 12 weeks."
          segment={{ type: 'one_visit_only' }}
          openComposer={openComposer}
          presetName="Bienvenue {first_name}"
          presetContent="Merci d'avoir rejoint {business_name}. Pour votre 2e visite, une offre de bienvenue vous attend."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={newCustomersByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="week" stroke="#57534E" tick={{ fontSize: 10 }} />
              <YAxis stroke="#57534E" />
              <Tooltip />
              <Bar dataKey="count" fill="#4A5D23" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Row 3 — tier + acquisition, each tier / source wired to a send CTA */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Customer Tier Distribution" hint="How your loyalty tiers are spread. Click any tier to see its customers.">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {tierData.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => drillCustomers(`${t.name} tier customers`, { tier: t.key })}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[#E7E5E4] bg-[#FDFBF7] hover:bg-[#B85C38]/5 hover:border-[#B85C38] transition cursor-pointer text-left"
                title={`Click to view ${t.name} customers`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: TIER_COLORS[t.key] }}></span>
                  <span className="text-xs font-semibold text-[#1C1917]">{t.name}</span>
                </div>
                <span className="text-lg font-bold">{t.value}</span>
                <span className="text-[10px] text-[#8B8680]">
                  {totalCustomers ? `${Math.round((t.value / totalCustomers) * 100)}%` : '—'} · click to view
                </span>
                <SendCampaignButton
                  compact
                  label={`Send to ${t.name}`}
                  onClick={() => openComposer(
                    { type: 'tier', value: t.key },
                    `Offre exclusive ${t.name} pour {first_name}`,
                    `Parce que vous êtes ${t.name}, voici une attention spéciale de {business_name}. Il te reste {points_to_next_reward} points pour ta prochaine récompense.`
                  )}
                />
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={tierData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                labelLine={false}
                label={({ name, value }) =>
                  totalCustomers
                    ? `${name}: ${value} (${Math.round((value / totalCustomers) * 100)}%)`
                    : `${name}: ${value}`
                }
                onClick={(data) => data && drillCustomers(`${data.name} tier customers`, { tier: data.key })}
                style={{ cursor: 'pointer' }}
              >
                {tierData.map((t, i) => (
                  <Cell key={i} fill={TIER_COLORS[t.key] || '#B85C38'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Acquisition Sources" hint="Lifetime customers acquired through each channel — all-time totals.">
          {/* Lifetime headline */}
          <div className="flex items-baseline gap-3 mb-4 pb-4 border-b border-[#E7E5E4]">
            <p className="text-3xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              {acquisitionTotal}
            </p>
            <p className="text-sm text-[#57534E]">customers acquired across all channels (all-time)</p>
          </div>

          {/* Per-channel KPI tiles — count + percentage. Click to drill into customer list. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {acquisitionChart.map((a) => {
              const style = SOURCE_STYLE[a.raw] || { color: '#8B8680', bg: '#F3EFE7', icon: '•' };
              return (
                <button
                  key={a.raw}
                  type="button"
                  onClick={() => drillCustomers(
                    `Customers acquired via ${a.name}`,
                    { source: a.raw }
                  )}
                  className="text-left p-3 rounded-lg border border-[#E7E5E4] hover:border-[#B85C38] hover:shadow-sm transition"
                  style={{ backgroundColor: style.bg }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-base">{style.icon}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: style.color }}>
                      {a.name}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#1C1917] leading-tight">
                    {a.value}
                    <span className="text-sm text-[#8B8680] font-normal"> customers</span>
                  </p>
                  <p className="text-[11px] mt-0.5 font-semibold" style={{ color: style.color }}>
                    {a.pct}% of total
                  </p>
                </button>
              );
            })}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={acquisitionChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis type="number" stroke="#57534E" />
              <YAxis type="category" dataKey="name" stroke="#57534E" width={110} />
              <Tooltip
                formatter={(value, _name, p) => [`${value} customers (${p?.payload?.pct || 0}%)`, 'Acquired']}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {acquisitionChart.map((row, i) => (
                  <Cell key={i} fill={(SOURCE_STYLE[row.raw] || {}).color || ACQ_COLORS[i % ACQ_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Row 4 — Recovered Filter */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Customize Recovered Customers Filter
          </h3>
          <SendCampaignButton
            label="Send to this filtered group"
            onClick={() => openComposer(
              { type: 'recovered', inactive_days: recoveryInactiveDays, window_days: recoveryWindowDays },
              'Bon retour parmi nous, {first_name} !',
              'Merci de revenir chez {business_name}. Il te reste {points_to_next_reward} points pour ta prochaine récompense.'
            )}
          />
        </div>
        <p className="text-sm text-[#57534E] mb-4">
          "Customers who were quiet for X days and came back in the last Y days"
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#57534E]">Inactive for</label>
            <NumberInput
              min={1}
              max={730}
              emptyValue={30}
              value={recoveryInactiveDays}
              onChange={(n) => setRecoveryInactiveDays(n || 30)}
              className="w-20 px-2 py-1 border border-[#E7E5E4] rounded text-center"
            />
            <span className="text-sm text-[#57534E]">days,</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#57534E]">came back in last</label>
            <NumberInput
              min={1}
              max={730}
              emptyValue={30}
              value={recoveryWindowDays}
              onChange={(n) => setRecoveryWindowDays(n || 30)}
              className="w-20 px-2 py-1 border border-[#E7E5E4] rounded text-center"
            />
            <span className="text-sm text-[#57534E]">days</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-[#1C1917] font-medium">
            <span>
              <span className="text-[#B85C38] font-bold">{recovered?.count ?? 0}</span> customers match
              {' '}
              <span className="text-[#8B8680]">({recovered?.percentage ?? 0}% of base)</span>
            </span>
            <button
              type="button"
              disabled={!recovered?.count}
              onClick={() =>
                setDrill({
                  title: `Recovered customers — inactive ${recoveryInactiveDays}d, returned within ${recoveryWindowDays}d`,
                  rows: recovered?.customers || [],
                  columns: [
                    { key: 'name', label: 'Customer' },
                    { key: 'email', label: 'Email' },
                    { key: 'tier', label: 'Tier', render: (v) => <TierBadge tier={v} /> },
                    { key: 'total_visits', label: 'Visits' },
                    { key: 'total_amount_paid', label: 'Spent', render: (v) => `€${(v || 0).toFixed(0)}` },
                    { key: 'last_inactive_date', label: 'Gap started', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                    { key: 'returned_date', label: 'Returned', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                  ],
                })
              }
              className="px-3 py-1.5 rounded-lg border text-sm font-semibold transition disabled:opacity-40"
              style={{ borderColor: '#B85C38', color: '#B85C38' }}
              title="Show the list of customers that match the filter above"
            >
              View the {recovered?.count ?? 0} customer{recovered?.count === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </section>

      {/* Row 4b — Customer reviews & sentiment */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
              Customer reviews & sentiment
            </h3>
            <p className="text-xs text-[#8B8680] max-w-3xl mt-1">
              Every rating is /10. Customers leave ratings on their wallet card after a visit.
              Sentiment and topics are computed from the review text on submit — numbers stay up to date
              automatically whenever a new review is posted.
            </p>
          </div>
          {reviewAnalytics?.total_reviews != null && (
            <div className="flex items-center gap-2 text-xs text-[#57534E]">
              <MessageSquare size={14} /> {reviewAnalytics.total_reviews} review{reviewAnalytics.total_reviews === 1 ? '' : 's'} total
            </div>
          )}
        </div>

        {reviewAnalytics && reviewAnalytics.total_reviews === 0 ? (
          <p className="text-sm text-[#8B8680] italic">
            No reviews yet. Once customers start rating visits from their wallet card, the KPIs will appear here.
          </p>
        ) : reviewAnalytics ? (
          <>
            {/* 4 headline KPIs with meanings */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                icon={Star}
                title="Average rating"
                value={reviewAnalytics.average_rating != null ? `${reviewAnalytics.average_rating}/10` : '—'}
                sublabel="The mean rating across every review."
                accent="#E3A869"
                onClick={() => drillCustomers('All reviewers', {})}
                segment={{ type: 'all' }}
                openComposer={openComposer}
                presetName="Merci pour votre avis, {first_name}"
                presetContent="Merci d'avoir noté votre visite chez {business_name}. Continuez à nous partager votre expérience — on vous réserve une petite surprise !"
              />
              <KPICard
                icon={ThumbsDown}
                title="Negative review rate"
                value={`${reviewAnalytics.negative_review_rate_pct}%`}
                sublabel="% of reviews at 1–4 / 10. Leading indicator of churn."
                accent="#B85C38"
                onClick={async () => {
                  try {
                    const r = await ownerAPI.listReviews(params({ max_rating: 4, limit: 200 }));
                    setDrill({
                      title: 'Negative reviews (1–4 / 10)',
                      rows: r.data?.reviews || [],
                      columns: [
                        { key: 'customer_name', label: 'Customer' },
                        { key: 'rating', label: 'Rating', render: (v) => `${v}/10` },
                        { key: 'sentiment', label: 'Sentiment' },
                        { key: 'topics', label: 'Topics', render: (v) => (v || []).join(', ') || '—' },
                        { key: 'text', label: 'Text', render: (v) => v || '—' },
                        { key: 'created_at', label: 'When', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                      ],
                    });
                  } catch (e) { alert('Failed: ' + e.message); }
                }}
                segment={{ type: 'all' }}
                openComposer={openComposer}
                presetName="On peut mieux faire, {first_name}"
                presetContent="Merci pour votre retour. Nous prenons note et aimerions vous inviter à revenir chez {business_name} — une attention vous attend."
              />
              <KPICard
                icon={ThumbsUp}
                title="Sentiment score"
                value={`${reviewAnalytics.sentiment_score > 0 ? '+' : ''}${reviewAnalytics.sentiment_score}`}
                sublabel="Positive % minus negative %. -100 = all bad, +100 = all good."
                accent="#4A5D23"
                onClick={async () => {
                  try {
                    const r = await ownerAPI.listReviews(params({ sentiment: 'negative', limit: 200 }));
                    setDrill({
                      title: 'Negative-sentiment reviews',
                      rows: r.data?.reviews || [],
                      columns: [
                        { key: 'customer_name', label: 'Customer' },
                        { key: 'rating', label: 'Rating', render: (v) => `${v}/10` },
                        { key: 'text', label: 'Text', render: (v) => v || '—' },
                        { key: 'topics', label: 'Topics', render: (v) => (v || []).join(', ') || '—' },
                      ],
                    });
                  } catch (e) { alert('Failed: ' + e.message); }
                }}
                segment={{ type: 'all' }}
                openComposer={openComposer}
                presetName="Vos retours comptent, {first_name}"
                presetContent="Votre expérience chez {business_name} compte. Dites-nous ce qu'on peut améliorer — on vous offre un petit geste à votre prochaine visite."
              />
              <KPICard
                icon={TrendingUp}
                title="Review velocity"
                value={`${reviewAnalytics.review_velocity.last_30d}`}
                sublabel={
                  reviewAnalytics.review_velocity.delta_pct >= 0
                    ? `+${reviewAnalytics.review_velocity.delta_pct}% vs. the 30 days before (${reviewAnalytics.review_velocity.prev_30d})`
                    : `${reviewAnalytics.review_velocity.delta_pct}% vs. the 30 days before (${reviewAnalytics.review_velocity.prev_30d})`
                }
                accent="#7B3F00"
                onClick={async () => {
                  try {
                    const r = await ownerAPI.listReviews(params({ limit: 30 }));
                    setDrill({
                      title: 'Recent reviews (last 30)',
                      rows: r.data?.reviews || [],
                      columns: [
                        { key: 'customer_name', label: 'Customer' },
                        { key: 'rating', label: 'Rating', render: (v) => `${v}/10` },
                        { key: 'sentiment', label: 'Sentiment' },
                        { key: 'text', label: 'Text', render: (v) => v || '—' },
                        { key: 'created_at', label: 'When', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                      ],
                    });
                  } catch (e) { alert('Failed: ' + e.message); }
                }}
                segment={{ type: 'all' }}
                openComposer={openComposer}
                presetName="Gardez le cap, {first_name}"
                presetContent="Nous adorons vos retours chez {business_name}. Un petit mot après votre prochaine visite ?"
              />
            </div>

            {/* Rating distribution + topic breakdown side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              {/* Rating distribution (1-10 histogram) */}
              <div className="border border-[#E7E5E4] rounded-lg p-4">
                <p className="text-sm font-bold text-[#1C1917] mb-2 flex items-center gap-2">
                  <Star size={14} /> Rating distribution
                </p>
                <p className="text-xs text-[#8B8680] mb-3">
                  How many reviews landed at each score. Bars show share of total.
                </p>
                <div className="space-y-1">
                  {(() => {
                    const dist = reviewAnalytics.rating_distribution || {};
                    const max = Math.max(1, ...Object.values(dist).map(v => +v || 0));
                    return [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => {
                      const v = dist[String(n)] || 0;
                      const pct = Math.round((v / max) * 100);
                      const color = n >= 8 ? '#4A5D23' : n >= 5 ? '#E3A869' : '#B85C38';
                      return (
                        <div key={n} className="flex items-center gap-2 text-xs">
                          <span className="w-6 text-right font-semibold text-[#1C1917]">{n}</span>
                          <div className="flex-1 bg-[#F3EFE7] rounded h-4 overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="w-8 text-right text-[#57534E]">{v}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Topic breakdown */}
              <div className="border border-[#E7E5E4] rounded-lg p-4">
                <p className="text-sm font-bold text-[#1C1917] mb-2 flex items-center gap-2">
                  <Activity size={14} /> Topic / theme breakdown
                </p>
                <p className="text-xs text-[#8B8680] mb-3">
                  Which themes customers mention and the average rating per theme. Lets you see
                  <em> why</em> ratings move — not just that they did.
                </p>
                {(reviewAnalytics.topic_breakdown || []).length === 0 ? (
                  <p className="text-xs text-[#8B8680] italic">No text mentions to cluster yet.</p>
                ) : (
                  <div className="space-y-2">
                    {reviewAnalytics.topic_breakdown.map((t) => {
                      const label = {
                        speed: '⚡ Service speed',
                        cleanliness: '🧼 Cleanliness',
                        staff: '🤝 Staff friendliness',
                        price: '💶 Price / value',
                        wait_time: '⏱ Wait time',
                      }[t.topic] || t.topic;
                      const avgColor = t.avg_rating >= 8 ? '#4A5D23' : t.avg_rating >= 6 ? '#E3A869' : '#B85C38';
                      return (
                        <div key={t.topic} className="p-2 rounded bg-[#FDFBF7] border border-[#E7E5E4]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#1C1917]">{label}</span>
                            <span style={{ color: avgColor }} className="font-bold">{t.avg_rating}/10 · {t.count} mention{t.count === 1 ? '' : 's'}</span>
                          </div>
                          <div className="mt-1 flex h-1.5 rounded overflow-hidden">
                            <div style={{ width: `${t.positive_pct}%`, backgroundColor: '#4A5D23' }} />
                            <div style={{ width: `${100 - t.positive_pct - t.negative_pct}%`, backgroundColor: '#E3A869' }} />
                            <div style={{ width: `${t.negative_pct}%`, backgroundColor: '#B85C38' }} />
                          </div>
                          <p className="text-[10px] text-[#8B8680] mt-1">
                            {t.positive_pct}% positive · {t.negative_pct}% negative · {t.mention_pct}% of reviews mention this
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent reviews feed */}
            {(reviewAnalytics.recent || []).length > 0 && (
              <div className="border border-[#E7E5E4] rounded-lg p-4">
                <p className="text-sm font-bold text-[#1C1917] mb-2">Most recent reviews</p>
                <div className="space-y-2">
                  {reviewAnalytics.recent.map((r) => (
                    <div key={r.id} className="p-3 rounded bg-[#FDFBF7] border border-[#E7E5E4] flex items-start gap-3">
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white`}
                           style={{ backgroundColor: r.rating >= 8 ? '#4A5D23' : r.rating >= 5 ? '#E3A869' : '#B85C38' }}>
                        {r.rating}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-semibold text-[#1C1917]">{r.sentiment}</span>
                          {r.topics?.length > 0 && (
                            <span className="text-[#8B8680]">· {r.topics.join(', ')}</span>
                          )}
                          <span className="text-[#8B8680] ml-auto">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        {r.text && <p className="text-sm text-[#1C1917] mt-1">"{r.text}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[#8B8680]">Loading review data…</p>
        )}
      </section>

      {/* Row 5 — Ranking Tabs */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-xl font-semibold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Customer Ranking
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'top_paying', label: 'Top Paying', icon: Trophy },
              { key: 'least_paying', label: 'Least Paying', icon: ArrowDown },
              { key: 'max_visits', label: 'Max Visits', icon: ArrowUp },
              { key: 'least_visits', label: 'Least Visits', icon: ArrowDown },
            ].map((t) => {
              const Icon = t.icon;
              const active = rankingMode === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setRankingMode(t.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-[#B85C38] text-white'
                      : 'bg-[#F3EFE7] text-[#57534E] hover:bg-[#E7E5E4]'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
            <SendCampaignButton
              label="Send to this ranking"
              onClick={() => openComposer(rankingSegment, rankingPreset.name, rankingPreset.content)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E7E5E4] text-[#57534E]">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Tier</th>
                <th className="py-2 px-3 text-right">Visits</th>
                <th className="py-2 px-3 text-right">Spent</th>
              </tr>
            </thead>
            <tbody>
              {rankedCustomers.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-[#8B8680]">No customers to rank yet.</td></tr>
              ) : (
                rankedCustomers.map((c, i) => (
                  <tr key={c.id || i} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7]">
                    <td className="py-2 px-3 text-[#8B8680]">{i + 1}</td>
                    <td className="py-2 px-3 font-medium text-[#1C1917]">{c.name || '—'}</td>
                    <td className="py-2 px-3 text-[#57534E] text-xs">{c.email || '—'}</td>
                    <td className="py-2 px-3"><TierBadge tier={c.tier} /></td>
                    <td className="py-2 px-3 text-right">{c.total_visits ?? 0}</td>
                    <td className="py-2 px-3 text-right">€{(c.total_amount_paid ?? 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drill-down modal */}
      {drill && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDrill(null)}
        >
          <div
            className="bg-white rounded-xl max-w-5xl w-full max-h-[85vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
                {drill.title}
              </h3>
              <button onClick={() => setDrill(null)} className="text-[#A8A29E] hover:text-[#1C1917]">
                <X size={22} />
              </button>
            </div>
            {drillLoading ? (
              <p className="text-[#57534E] py-8 text-center">Loading customers…</p>
            ) : drill.error ? (
              <p className="text-[#B85C38] py-8 text-center">Error: {drill.error}</p>
            ) : (!drill.rows || drill.rows.length === 0) ? (
              <p className="text-[#57534E] py-8 text-center">No matching records.</p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E7E5E4] text-[#57534E]">
                    {drill.columns.map((c) => (
                      <th key={c.key} className="py-2 px-3">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drill.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[#E7E5E4]">
                      {drill.columns.map((c) => (
                        <td key={c.key} className="py-2 px-3 text-[#1C1917]">
                          {c.render ? c.render(r[c.key]) : (r[c.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Campaign composer */}
      {composer && (
        <CampaignComposer
          segment={composer.segment}
          presetName={composer.presetName}
          presetContent={composer.presetContent}
          onClose={() => setComposer(null)}
          onSent={loadAll}
        />
      )}
    </div>
  );
};

export default AnalyticsPage;
