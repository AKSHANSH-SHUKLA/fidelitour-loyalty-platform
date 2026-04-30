import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { History, Send, Bell, Mail, Clock, Users, MousePointerClick, Eye } from 'lucide-react';
import { PageHeader, C as C_PS } from '../components/PageShell';

/**
 * History — past campaigns + push notifications, segregated.
 *
 * Reads from the additive backend modules:
 *   GET /api/owner/history/summary
 *   GET /api/owner/history/campaigns?days=N&status=...
 *   GET /api/owner/history/pushes?days=N&push_type=...
 *
 * Does not depend on or alter any existing page or endpoint.
 */
const HistoryPage = () => {
  const [summary, setSummary] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [pushes, setPushes] = useState([]);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [days, setDays] = useState(0);   // 0 = all-time
  const [statusFilter, setStatusFilter] = useState('');
  const [pushTypeFilter, setPushTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const summaryRes = await api.get('/owner/history/summary');
        setSummary(summaryRes.data);

        const campaignParams = {};
        if (days > 0) campaignParams.days = days;
        if (statusFilter) campaignParams.status = statusFilter;
        const campaignsRes = await api.get('/owner/history/campaigns', { params: campaignParams });
        setCampaigns(campaignsRes.data?.campaigns || []);

        const pushParams = {};
        if (days > 0) pushParams.days = days;
        if (pushTypeFilter) pushParams.push_type = pushTypeFilter;
        const pushesRes = await api.get('/owner/history/pushes', { params: pushParams });
        setPushes(pushesRes.data?.pushes || []);
      } catch (e) {
        console.error('History load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days, statusFilter, pushTypeFilter]);

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const StatPill = ({ label, value, icon: Icon }) => (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: 'white', border: `1px solid ${C_PS.hairline}` }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${C_PS.terracotta}1A`, color: C_PS.terracotta }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C_PS.inkMute }}>{label}</p>
        <p className="text-xl font-bold" style={{ color: C_PS.inkDeep }}>{value ?? '—'}</p>
      </div>
    </div>
  );

  const StatusBadge = ({ status }) => {
    const styles = {
      sent:      { bg: '#ECFDF5', fg: '#065F46', label: 'Sent' },
      scheduled: { bg: '#EFF6FF', fg: '#1E40AF', label: 'Scheduled' },
      draft:     { bg: '#F3F4F6', fg: '#374151', label: 'Draft' },
      delivered: { bg: '#ECFDF5', fg: '#065F46', label: 'Delivered' },
    }[status] || { bg: '#F3F4F6', fg: '#374151', label: status || '—' };
    return (
      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
        style={{ background: styles.bg, color: styles.fg }}>{styles.label}</span>
    );
  };

  const TypeBadge = ({ type }) => {
    const styles = {
      tier_up:  { bg: '#FEF3C7', fg: '#92400E', label: 'Tier-up' },
      campaign: { bg: '#EDE9FE', fg: '#5B21B6', label: 'Campaign' },
      birthday: { bg: '#FCE7F3', fg: '#9D174D', label: 'Birthday' },
    }[type] || { bg: '#F3F4F6', fg: '#374151', label: type || '—' };
    return (
      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
        style={{ background: styles.bg, color: styles.fg }}>{styles.label}</span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit & Compliance"
        title="History"
        description="Every campaign you've ever sent and every push notification the platform has fired — segregated by type, filterable by date."
        role="business_owner"
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatPill label="Campaigns total" value={summary?.campaigns_total ?? 0} icon={Mail} />
        <StatPill label="Sent" value={summary?.campaigns_sent_total ?? 0} icon={Send} />
        <StatPill label="Last 30 days" value={summary?.campaigns_30d ?? 0} icon={Clock} />
        <StatPill label="Pushes total" value={summary?.pushes_total ?? 0} icon={Bell} />
        <StatPill label="Pushes 30d" value={summary?.pushes_30d ?? 0} icon={Bell} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ border: `1px solid ${C_PS.hairline}` }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C_PS.inkMute }}>Time range</span>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm"
          style={{ borderColor: C_PS.hairline }}
        >
          <option value={0}>All time</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last 12 months</option>
        </select>

        {activeTab === 'campaigns' && (
          <>
            <span className="text-xs font-bold uppercase tracking-widest ml-2" style={{ color: C_PS.inkMute }}>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
              style={{ borderColor: C_PS.hairline }}
            >
              <option value="">Any</option>
              <option value="sent">Sent</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
            </select>
          </>
        )}

        {activeTab === 'pushes' && (
          <>
            <span className="text-xs font-bold uppercase tracking-widest ml-2" style={{ color: C_PS.inkMute }}>Type</span>
            <select
              value={pushTypeFilter}
              onChange={(e) => setPushTypeFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
              style={{ borderColor: C_PS.hairline }}
            >
              <option value="">Any</option>
              <option value="tier_up">Tier-up</option>
              <option value="campaign">Campaign</option>
              <option value="birthday">Birthday</option>
            </select>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: C_PS.hairline }}>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'campaigns' ? 'text-[#B85C38] border-[#B85C38]' : 'text-[#57534E] border-transparent hover:text-[#1C1917]'
          }`}
        >
          <Mail size={14} className="inline mr-2" />
          Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('pushes')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'pushes' ? 'text-[#B85C38] border-[#B85C38]' : 'text-[#57534E] border-transparent hover:text-[#1C1917]'
          }`}
        >
          <Bell size={14} className="inline mr-2" />
          Push notifications ({pushes.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-[#57534E]" style={{ border: `1px solid ${C_PS.hairline}` }}>
          Loading…
        </div>
      ) : activeTab === 'campaigns' ? (
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-[#57534E]" style={{ border: `1px solid ${C_PS.hairline}` }}>
              No campaigns found for this period.
            </div>
          )}
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-4" style={{ border: `1px solid ${C_PS.hairline}` }}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold truncate" style={{ color: C_PS.inkDeep }}>{c.name || '(untitled)'}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm" style={{ color: C_PS.inkMute }}>{c.content_preview || <em>(no content preview)</em>}</p>
                </div>
                <div className="text-right text-xs shrink-0" style={{ color: C_PS.inkMute }}>
                  {c.sent_at ? (
                    <>
                      <p className="font-semibold" style={{ color: C_PS.inkDeep }}>Sent</p>
                      <p>{fmtDate(c.sent_at)}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold" style={{ color: C_PS.inkDeep }}>Created</p>
                      <p>{fmtDate(c.created_at)}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 pt-3 border-t" style={{ borderColor: C_PS.hairline }}>
                <Stat label="Targeted" value={c.targeted_count} icon={Users} />
                <Stat label="Delivered" value={c.delivered_count} icon={Send} />
                <Stat label="Opens" value={c.opens} icon={Eye} />
                <Stat label="Clicks" value={c.clicks} icon={MousePointerClick} />
                <Stat label="Visits" value={c.visits_from_campaign} icon={History} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {pushes.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-[#57534E]" style={{ border: `1px solid ${C_PS.hairline}` }}>
              No push notifications found for this period.
            </div>
          )}
          {pushes.map((p, i) => (
            <div key={i} className="bg-white rounded-xl p-4" style={{ border: `1px solid ${C_PS.hairline}` }}>
              <div className="flex items-start justify-between gap-4 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold truncate" style={{ color: C_PS.inkDeep }}>{p.title || '(untitled)'}</h3>
                    <TypeBadge type={p.type} />
                  </div>
                  <p className="text-sm" style={{ color: C_PS.inkMute }}>{p.body || <em>(no body)</em>}</p>
                  {p.recipient_name && (
                    <p className="text-xs mt-1" style={{ color: C_PS.inkMute }}>
                      Sent to <span className="font-semibold" style={{ color: C_PS.inkDeep }}>{p.recipient_name}</span>
                      {p.previous_tier && p.new_tier && (
                        <> · {p.previous_tier} → {p.new_tier}</>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs shrink-0" style={{ color: C_PS.inkMute }}>
                  {fmtDate(p.sent_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, icon: Icon }) => (
  <div className="flex items-center gap-2">
    <Icon size={14} className="text-[#B85C38] shrink-0" />
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-bold tracking-widest text-[#57534E]">{label}</p>
      <p className="text-sm font-bold text-[#1C1917]">{value ?? 0}</p>
    </div>
  </div>
);

export default HistoryPage;
