import React, { useState, useEffect } from 'react';
import { Send, Plus, Filter, Users, MessageSquare, Clock, CheckCircle2, AlertCircle, Megaphone, Eye, AlertTriangle, TrendingUp, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import api from '../lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedCampaignTab, setSelectedCampaignTab] = useState('by-filter'); // 'by-filter' or 'by-customers'
  const [campaignCustomers, setCampaignCustomers] = useState('');
  const [viewingTrackingId, setViewingTrackingId] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // --- Quick Send (filter-and-send on the main page) ---
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickSource, setQuickSource] = useState('push');
  const [quickMessage, setQuickMessage] = useState('');
  const [quickFilters, setQuickFilters] = useState({
    tiers: [],
    walletPassOnly: false,
    minPoints: 0,
    minVisits: 0,
    postalCodes: '',
    minAmountPaid: 0,
  });
  const [quickPreviewCount, setQuickPreviewCount] = useState(null);
  const [quickPreviewLoading, setQuickPreviewLoading] = useState(false);
  const [quickSending, setQuickSending] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    campaignName: '',
    message: '',
    source: 'push',
    filters: {
      tiers: [],
      walletPassOnly: false,
      minPoints: 0,
      minVisits: 0,
      postalCodes: '',
      minAmountPaid: 0,
    },
  });

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await ownerAPI.getCampaigns();
      setCampaigns(response.data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterChange = (filterName, value) => {
    setFormData((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterName]: value,
      },
    }));
  };

  const handleTierChange = (tier) => {
    setFormData((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        tiers: prev.filters.tiers.includes(tier)
          ? prev.filters.tiers.filter((t) => t !== tier)
          : [...prev.filters.tiers, tier],
      },
    }));
  };

  const buildFilterPayload = () => {
    return {
      tiers: formData.filters.tiers.length > 0 ? formData.filters.tiers : undefined,
      hasWalletPass: formData.filters.walletPassOnly ? true : undefined,
      minPoints: formData.filters.minPoints > 0 ? formData.filters.minPoints : undefined,
      minVisits: formData.filters.minVisits > 0 ? formData.filters.minVisits : undefined,
      postalCodes: formData.filters.postalCodes ? formData.filters.postalCodes.split(',').map((code) => code.trim()) : undefined,
      minAmountPaid: formData.filters.minAmountPaid > 0 ? formData.filters.minAmountPaid : undefined,
    };
  };

  const previewSegment = async () => {
    try {
      setPreviewLoading(true);
      const filters = buildFilterPayload();
      const response = await api.post('/owner/campaigns/preview-segment', { filters });
      setPreviewCount(response.data.count || 0);
    } catch (error) {
      console.error('Error previewing segment:', error);
      setPreviewCount(0);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!formData.campaignName.trim() || !formData.message.trim()) {
      alert('Please fill in campaign name and message');
      return;
    }

    try {
      if (selectedCampaignTab === 'by-filter') {
        // Original filter-based flow
        const payload = {
          name: formData.campaignName,
          message: formData.message,
          source: formData.source || 'push',
          filters: buildFilterPayload(),
        };
        await api.post('/owner/campaigns', payload);
      } else {
        // Send directly to selected customers
        const customerList = campaignCustomers
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        if (customerList.length === 0) {
          alert('Please enter at least one customer');
          return;
        }

        // Parse customer names or emails and send
        await ownerAPI.sendCampaignToGroup({
          customer_names: customerList,
          message: formData.message,
        });
      }

      resetForm();
      setCampaignCustomers('');
      setSelectedCampaignTab('by-filter');
      setShowCreateModal(false);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign');
    }
  };

  const fetchCampaignTracking = async (campaignId) => {
    try {
      setTrackingLoading(true);
      const res = await ownerAPI.getCampaignTracking(campaignId);
      setTrackingData(res.data);
    } catch (error) {
      console.error('Error fetching tracking:', error);
      alert('Failed to load campaign details');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleSendCampaign = (campaign) => {
    setSendConfirmation(campaign);
  };

  const confirmSendCampaign = async () => {
    try {
      await api.post(`/owner/campaigns/${sendConfirmation.id}/send`);
      setSendConfirmation(null);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Failed to send campaign');
    }
  };

  const resetForm = () => {
    setFormData({
      campaignName: '',
      message: '',
      source: 'push',
      filters: {
        tiers: [],
        walletPassOnly: false,
        minPoints: 0,
        minVisits: 0,
        postalCodes: '',
        minAmountPaid: 0,
      },
    });
    setPreviewCount(null);
  };

  // ---- Quick Send helpers ----
  const buildQuickFilterPayload = () => ({
    tiers: quickFilters.tiers.length > 0 ? quickFilters.tiers : undefined,
    hasWalletPass: quickFilters.walletPassOnly ? true : undefined,
    minPoints: quickFilters.minPoints > 0 ? quickFilters.minPoints : undefined,
    minVisits: quickFilters.minVisits > 0 ? quickFilters.minVisits : undefined,
    postalCodes: quickFilters.postalCodes
      ? quickFilters.postalCodes.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined,
    minAmountPaid: quickFilters.minAmountPaid > 0 ? quickFilters.minAmountPaid : undefined,
  });

  const quickPreview = async () => {
    try {
      setQuickPreviewLoading(true);
      const res = await api.post('/owner/campaigns/preview-segment', {
        filters: buildQuickFilterPayload(),
      });
      setQuickPreviewCount(res.data.count || 0);
    } catch (e) {
      setQuickPreviewCount(0);
    } finally {
      setQuickPreviewLoading(false);
    }
  };

  const quickToggleTier = (tier) => {
    setQuickFilters((prev) => ({
      ...prev,
      tiers: prev.tiers.includes(tier) ? prev.tiers.filter((t) => t !== tier) : [...prev.tiers, tier],
    }));
  };

  const quickSend = async () => {
    if (!quickName.trim() || !quickMessage.trim()) {
      alert('Please fill in a campaign name and message.');
      return;
    }
    if (quickPreviewCount === 0) {
      alert('No customers match these filters. Adjust them and try again.');
      return;
    }
    const recipients = quickPreviewCount != null ? quickPreviewCount : '(unknown — preview first)';
    if (!window.confirm(`Send "${quickName}" to ${recipients} customer(s) now?`)) return;
    try {
      setQuickSending(true);
      const created = await api.post('/owner/campaigns', {
        name: quickName,
        message: quickMessage,
        filters: buildQuickFilterPayload(),
        source: quickSource || 'push',
      });
      const id = created?.data?.id || created?.data?._id;
      if (id) {
        await api.post(`/owner/campaigns/${id}/send`);
      }
      setQuickName('');
      setQuickMessage('');
      setQuickFilters({
        tiers: [],
        walletPassOnly: false,
        minPoints: 0,
        minVisits: 0,
        postalCodes: '',
        minAmountPaid: 0,
      });
      setQuickPreviewCount(null);
      setQuickOpen(false);
      await fetchCampaigns();
      alert('Campaign sent.');
    } catch (e) {
      console.error('Quick send error:', e);
      alert('Failed to send: ' + (e?.response?.data?.detail || e?.message || 'unknown error'));
    } finally {
      setQuickSending(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      draft: 'bg-gray-200 text-gray-800',
      sent: 'bg-green-200 text-green-800',
      scheduled: 'bg-blue-200 text-blue-800',
    };
    return (
      <span className={`px-2 py-1 text-sm font-medium rounded ${statusStyles[status] || 'bg-gray-200 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getFilterBadges = (campaign) => {
    const badges = [];
    if (campaign.filters?.tiers?.length > 0) {
      campaign.filters.tiers.forEach((tier) => {
        badges.push(`${tier[0].toUpperCase() + tier.slice(1)} Tier`);
      });
    }
    if (campaign.filters?.hasWalletPass) {
      badges.push('Has Wallet Pass');
    }
    if (campaign.filters?.minPoints > 0) {
      badges.push(`Min ${campaign.filters.minPoints} Points`);
    }
    if (campaign.filters?.minVisits > 0) {
      badges.push(`Min ${campaign.filters.minVisits} Visits`);
    }
    if (campaign.filters?.minAmountPaid > 0) {
      badges.push(`Min €${campaign.filters.minAmountPaid}`);
    }
    return badges;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFBF7' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: '#E7E5E4', backgroundColor: '#F3EFE7' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                Campaigns
              </h1>
              <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>Create and manage loyalty campaigns for your customers</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-white transition"
              style={{ backgroundColor: '#B85C38' }}
            >
              <Plus size={20} />
              New Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ============= Quick Send panel ============= */}
        <div className="mb-6 rounded-lg border" style={{ borderColor: '#E7E5E4', backgroundColor: '#FDFBF7' }}>
          <button
            onClick={() => setQuickOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F3EFE7] transition rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#B85C38]/10 flex items-center justify-center">
                <Zap size={20} style={{ color: '#B85C38' }} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-[#1C1917]" style={{ fontFamily: 'Manrope' }}>
                  Quick Send — Filter customers and send in one shot
                </p>
                <p className="text-xs text-[#57534E]">
                  Pick filters, preview how many customers match, write your message, hit send. No drafts.
                </p>
              </div>
            </div>
            {quickOpen ? <ChevronUp size={20} style={{ color: '#57534E' }} /> : <ChevronDown size={20} style={{ color: '#57534E' }} />}
          </button>

          {quickOpen && (
            <div className="p-4 border-t" style={{ borderColor: '#E7E5E4' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="e.g. Weekend Offer"
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Message</label>
                  <input
                    type="text"
                    value={quickMessage}
                    onChange={(e) => setQuickMessage(e.target.value)}
                    placeholder="Hi {first_name}, 20% off this Saturday..."
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">
                  Channel / Source
                  <span className="ml-2 normal-case text-[10px] text-[#8B8680] font-normal">
                    (tags this campaign so you can see its performance per channel)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'push', label: 'Wallet Push' },
                    { key: 'email', label: 'Email' },
                    { key: 'instagram', label: 'Instagram' },
                    { key: 'facebook', label: 'Facebook' },
                    { key: 'tiktok', label: 'TikTok' },
                    { key: 'sms', label: 'SMS' },
                    { key: 'other', label: 'Other' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setQuickSource(s.key)}
                      className={`px-3 py-1 text-xs rounded-full border transition ${
                        quickSource === s.key
                          ? 'bg-[#B85C38] text-white border-[#B85C38]'
                          : 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#B85C38]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {/* Tiers */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Tiers</label>
                  <div className="flex gap-2">
                    {['bronze', 'silver', 'gold'].map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => quickToggleTier(tier)}
                        className={`px-2 py-1 text-xs rounded border ${
                          quickFilters.tiers.includes(tier)
                            ? 'bg-[#B85C38] text-white border-[#B85C38]'
                            : 'bg-white text-[#57534E] border-[#E7E5E4]'
                        }`}
                      >
                        {tier[0].toUpperCase() + tier.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wallet Pass */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Wallet Pass</label>
                  <button
                    type="button"
                    onClick={() => setQuickFilters({ ...quickFilters, walletPassOnly: !quickFilters.walletPassOnly })}
                    className={`w-full px-2 py-1.5 text-sm rounded-lg border transition ${
                      quickFilters.walletPassOnly
                        ? 'bg-[#B85C38] text-white border-[#B85C38]'
                        : 'bg-white text-[#57534E] border-[#E7E5E4]'
                    }`}
                  >
                    {quickFilters.walletPassOnly ? '✓ Wallet pass only' : 'Wallet pass only'}
                  </button>
                </div>

                {/* Min Points */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Min Points</label>
                  <input
                    type="number"
                    min={0}
                    value={quickFilters.minPoints}
                    onChange={(e) => setQuickFilters({ ...quickFilters, minPoints: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>

                {/* Min Visits */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Min Visits</label>
                  <input
                    type="number"
                    min={0}
                    value={quickFilters.minVisits}
                    onChange={(e) => setQuickFilters({ ...quickFilters, minVisits: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>

                {/* Postal Codes */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Postal Codes</label>
                  <input
                    type="text"
                    value={quickFilters.postalCodes}
                    onChange={(e) => setQuickFilters({ ...quickFilters, postalCodes: e.target.value })}
                    placeholder="75001,75002"
                    className="w-full px-2 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>

                {/* Min Amount Paid */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Min Paid (€)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={quickFilters.minAmountPaid}
                    onChange={(e) => setQuickFilters({ ...quickFilters, minAmountPaid: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={quickPreview}
                  disabled={quickPreviewLoading}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold flex items-center gap-2"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                >
                  <Filter size={16} />
                  {quickPreviewLoading ? 'Previewing…' : 'Preview matches'}
                </button>
                {quickPreviewCount !== null && (
                  <span className="text-sm text-[#57534E]">
                    Will reach <span className="font-bold text-[#B85C38]">{quickPreviewCount}</span> customer{quickPreviewCount === 1 ? '' : 's'}
                  </span>
                )}
                <div className="flex-1" />
                <button
                  onClick={quickSend}
                  disabled={quickSending}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: '#B85C38' }}
                >
                  <Send size={16} />
                  {quickSending ? 'Sending…' : `Send to ${quickPreviewCount ?? '…'} now`}
                </button>
              </div>
              <p className="text-xs text-[#57534E] mt-3">
                Quick Send creates the campaign and fires it immediately. For scheduled sends or drafts, use "New Campaign" in the header.
              </p>
            </div>
          )}
        </div>
        {/* ============= /Quick Send panel ============= */}

        {/* Per-channel performance summary */}
        {!loading && campaigns.length > 0 && (() => {
          const sent = campaigns.filter((c) => c.status === 'sent');
          if (sent.length === 0) return null;
          const perSource = {};
          sent.forEach((c) => {
            const src = c.source || 'push';
            if (!perSource[src]) perSource[src] = { count: 0, delivered: 0, opens: 0, visits: 0 };
            const row = perSource[src];
            row.count += 1;
            row.delivered += c.delivered_count || 0;
            row.opens += c.opens_unique || 0;
            row.visits += c.visits_from_campaign || 0;
          });
          const rows = Object.entries(perSource).sort((a, b) => b[1].delivered - a[1].delivered);
          return (
            <div className="mb-6 border rounded-xl p-5 bg-white" style={{ borderColor: '#E7E5E4' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Campaign performance by channel
                </h2>
                <span className="text-xs text-[#8B8680]">
                  How each publishing channel is performing — openings and visits in absolute numbers and %.
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {rows.map(([src, row]) => {
                  const openPct = row.delivered > 0 ? Math.round((row.opens / row.delivered) * 100) : 0;
                  const visitPct = row.delivered > 0 ? Math.round((row.visits / row.delivered) * 100) : 0;
                  const label = src === 'push' ? 'Wallet Push' : src[0].toUpperCase() + src.slice(1);
                  return (
                    <div key={src} className="p-3 rounded-lg border" style={{ borderColor: '#E7E5E4', backgroundColor: '#FDFBF7' }}>
                      <p className="text-xs font-semibold text-[#B85C38] uppercase tracking-wider">{label}</p>
                      <p className="text-2xl font-bold text-[#1C1917]">{row.count}</p>
                      <p className="text-[11px] text-[#8B8680]">campaigns · {row.delivered} delivered</p>
                      <div className="mt-2 text-xs text-[#57534E] space-y-0.5">
                        <div>Opens: <b>{row.opens}</b> <span className="text-[#8B8680]">({openPct}%)</span></div>
                        <div>Visits: <b>{row.visits}</b> <span className="text-[#8B8680]">({visitPct}%)</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Unread Campaign Warnings */}
        {!loading && campaigns.length > 0 && (() => {
          const lowOpenRateCampaigns = campaigns.filter(
            c => c.status === 'sent' &&
            c.delivered_count > 0 &&
            ((c.opens_unique || 0) / (c.delivered_count || 1)) * 100 < 15
          );
          return lowOpenRateCampaigns.length > 0 ? (
            <div className="mb-6 p-4 rounded-lg border-l-4 bg-amber-50" style={{ borderColor: '#E3A869' }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} style={{ color: '#E3A869' }} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#1C1917]">Tip: Campaigns with catchy subject lines get 2-3x more opens.</p>
                  <p className="text-sm text-[#57534E]">Try making your next subject more personal.</p>
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {loading ? (
          <div className="text-center py-12">
            <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone size={48} style={{ color: '#B85C38', margin: '0 auto 16px' }} />
            <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="text-lg">
              No campaigns yet. Create your first campaign to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const filterBadges = getFilterBadges(campaign);
              return (
                <div
                  key={campaign.id}
                  className="border rounded-lg p-6 transition hover:shadow-md"
                  style={{ borderColor: '#E7E5E4', backgroundColor: '#FDFBF7' }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                        {campaign.name}
                      </h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        {getStatusBadge(campaign.status)}
                        {campaign.source && (
                          <span
                            className="px-2 py-0.5 text-xs rounded-full font-semibold capitalize"
                            style={{
                              backgroundColor:
                                campaign.source === 'instagram' ? '#FCE4EC'
                                : campaign.source === 'facebook' ? '#E3F2FD'
                                : campaign.source === 'tiktok' ? '#111'
                                : campaign.source === 'push' ? '#F3EFE7'
                                : campaign.source === 'email' ? '#E8F5E9'
                                : campaign.source === 'sms' ? '#FFF3E0'
                                : '#F5F4F0',
                              color:
                                campaign.source === 'tiktok' ? '#fff'
                                : '#1C1917',
                            }}
                          >
                            {campaign.source === 'push' ? 'Wallet Push' : campaign.source}
                          </span>
                        )}
                        <div style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '14px' }} className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Users size={16} />
                            {campaign.targeted_count || campaign.targetedCount || 0} targeted
                          </span>
                          {campaign.status === 'sent' && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={16} />
                              {campaign.delivered_count || campaign.deliveredCount || 0} delivered
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={16} />
                            {new Date(campaign.created_at || campaign.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => handleSendCampaign(campaign)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition ml-4"
                        style={{ backgroundColor: '#B85C38' }}
                      >
                        <Send size={18} />
                        Send
                      </button>
                    )}
                  </div>

                  {/* Tracking Stats */}
                  {campaign.status === 'sent' && (
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Sent to</p>
                        <p className="text-lg font-bold text-[#1C1917]">{campaign.targeted_count || 0}</p>
                      </div>
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Delivered</p>
                        <p className="text-lg font-bold text-[#1C1917]">{campaign.delivered_count || 0}</p>
                      </div>
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Opened</p>
                        <p className="text-lg font-bold text-[#1C1917]">
                          {campaign.delivered_count > 0
                            ? Math.round(((campaign.opens_unique || 0) / campaign.delivered_count) * 100)
                            : 0}%
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Visits after</p>
                        <p className="text-lg font-bold text-[#1C1917]">
                          {campaign.delivered_count > 0
                            ? Math.round(((campaign.visits_from_campaign || 0) / campaign.delivered_count) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Message preview */}
                  <div className="mb-4 p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                    <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="text-sm">
                      {campaign.message}
                    </p>
                  </div>

                  {/* Filter badges */}
                  {filterBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {filterBadges.map((badge, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 text-sm rounded-full"
                          style={{ backgroundColor: '#E3A869', color: '#FDFBF7', fontFamily: 'Manrope' }}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* View Details Button */}
                  {campaign.status === 'sent' && (
                    <button
                      onClick={() => {
                        setViewingTrackingId(campaign.id);
                        fetchCampaignTracking(campaign.id);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded text-sm font-semibold text-[#B85C38] hover:bg-[#F3EFE7] transition"
                    >
                      <Eye size={16} />
                      View details
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto" style={{ backgroundColor: '#FDFBF7' }}>
            <div className="border-b p-6" style={{ borderColor: '#E7E5E4' }}>
              <h2 className="text-3xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                Create New Campaign
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Audience Tab Selector */}
              <div className="flex gap-4 border-b" style={{ borderColor: '#E7E5E4' }}>
                <button
                  onClick={() => setSelectedCampaignTab('by-filter')}
                  className={`pb-3 px-3 font-semibold text-sm border-b-2 transition ${
                    selectedCampaignTab === 'by-filter'
                      ? 'border-[#B85C38] text-[#B85C38]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  By filter
                </button>
                <button
                  onClick={() => setSelectedCampaignTab('by-customers')}
                  className={`pb-3 px-3 font-semibold text-sm border-b-2 transition ${
                    selectedCampaignTab === 'by-customers'
                      ? 'border-[#B85C38] text-[#B85C38]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  By selected customers
                </button>
              </div>

              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  Campaign Name
                </label>
                <input
                  type="text"
                  name="campaignName"
                  value={formData.campaignName}
                  onChange={handleInputChange}
                  placeholder="e.g. Summer Promo"
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  Message
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Your campaign message..."
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                />
              </div>

              {/* Channel / Source */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  Channel / Source
                  <span className="ml-2 text-xs text-[#8B8680] font-normal">
                    Where this campaign is published — used to measure per-channel performance.
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'push', label: 'Wallet Push' },
                    { key: 'email', label: 'Email' },
                    { key: 'instagram', label: 'Instagram' },
                    { key: 'facebook', label: 'Facebook' },
                    { key: 'tiktok', label: 'TikTok' },
                    { key: 'sms', label: 'SMS' },
                    { key: 'other', label: 'Other' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, source: s.key }))}
                      className={`px-3 py-1 text-xs rounded-full border transition ${
                        (formData.source || 'push') === s.key
                          ? 'bg-[#B85C38] text-white border-[#B85C38]'
                          : 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#B85C38]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* By Customers Mode */}
              {selectedCampaignTab === 'by-customers' && (
                <div className="p-4 rounded border-2" style={{ borderColor: '#E3A869', backgroundColor: '#F3EFE7' }}>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Customer Names or Emails (one per line)
                  </label>
                  <textarea
                    value={campaignCustomers}
                    onChange={(e) => setCampaignCustomers(e.target.value)}
                    placeholder="Marie Dubois&#10;john@example.com&#10;..."
                    rows={4}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                  <p className="text-xs text-[#57534E] mt-2" style={{ fontFamily: 'Manrope' }}>
                    Enter customer names or email addresses, one per line
                  </p>
                </div>
              )}

              {/* Audience Filters (only in by-filter mode) */}
              {selectedCampaignTab === 'by-filter' && (
              <div className="border-t pt-6" style={{ borderColor: '#E7E5E4' }}>
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Audience Filters
                </h3>

                {/* Tier */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-3" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Tier
                  </label>
                  <div className="space-y-2">
                    {['bronze', 'silver', 'gold'].map((tier) => (
                      <label key={tier} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.filters.tiers.includes(tier)}
                          onChange={() => handleTierChange(tier)}
                          className="w-4 h-4"
                        />
                        <span style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Has Wallet Pass */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.filters.walletPassOnly}
                      onChange={(e) => handleFilterChange('walletPassOnly', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-semibold" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                      Only customers with a Wallet Pass
                    </span>
                  </label>
                </div>

                {/* Min Points */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Points
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minPoints}
                    onChange={(e) => handleFilterChange('minPoints', parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                </div>

                {/* Min Visits */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Visits
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minVisits}
                    onChange={(e) => handleFilterChange('minVisits', parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                </div>

                {/* Postal Codes */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Postal Code Region
                  </label>
                  <input
                    type="text"
                    value={formData.filters.postalCodes}
                    onChange={(e) => handleFilterChange('postalCodes', e.target.value)}
                    placeholder="e.g. 75001 or 75001,75002,75003"
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                  <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '12px' }} className="mt-1">
                    Enter one or more postal codes separated by commas to target a region
                  </p>
                </div>

                {/* Min Amount Paid */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Amount Paid (€)
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minAmountPaid}
                    onChange={(e) => handleFilterChange('minAmountPaid', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                </div>

                {/* Preview Segment */}
                <button
                  onClick={previewSegment}
                  disabled={previewLoading}
                  className="w-full px-4 py-2 border rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                >
                  <Filter size={18} />
                  {previewLoading ? 'Previewing...' : 'Preview Segment'}
                </button>

                {previewCount !== null && (
                  <div className="mt-3 p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                    <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="font-semibold">
                      This campaign will reach <span style={{ color: '#B85C38' }}>{previewCount}</span> customers
                    </p>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t p-6 flex justify-end gap-3" style={{ borderColor: '#E7E5E4' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-6 py-2 rounded-lg font-semibold border transition"
                style={{ borderColor: '#E7E5E4', color: '#57534E' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                className="px-6 py-2 rounded-lg font-semibold text-white transition"
                style={{ backgroundColor: '#B85C38' }}
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {sendConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full" style={{ backgroundColor: '#FDFBF7' }}>
            <div className="border-b p-6" style={{ borderColor: '#E7E5E4' }}>
              <h2 className="text-3xl font-bold flex items-center gap-3" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                <AlertCircle size={32} style={{ color: '#B85C38' }} />
                Send Campaign
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                  Campaign Name
                </p>
                <p className="text-lg" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  {sendConfirmation.name}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                  Message
                </p>
                <div className="p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    {sendConfirmation.message}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded border" style={{ borderColor: '#E3A869', backgroundColor: '#F3EFE7' }}>
                <p className="font-semibold" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  This will be sent to <span style={{ color: '#B85C38' }}>{sendConfirmation.targeted_count || sendConfirmation.targetedCount || 0}</span> customers
                </p>
              </div>
            </div>

            <div className="border-t p-6 flex justify-end gap-3" style={{ borderColor: '#E7E5E4' }}>
              <button
                onClick={() => setSendConfirmation(null)}
                className="px-6 py-2 rounded-lg font-semibold border transition"
                style={{ borderColor: '#E7E5E4', color: '#57534E' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSendCampaign}
                className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white transition"
                style={{ backgroundColor: '#B85C38' }}
              >
                <Send size={18} />
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Details Drawer */}
      {viewingTrackingId && trackingData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto" style={{ backgroundColor: '#FDFBF7' }}>
            <div className="border-b p-6" style={{ borderColor: '#E7E5E4' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Campaign Tracking
                </h2>
                <button
                  onClick={() => {
                    setViewingTrackingId(null);
                    setTrackingData(null);
                  }}
                  className="text-[#8B8680] hover:text-[#1C1917] text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Tracking Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Sent to</p>
                  <p className="text-2xl font-bold text-[#1C1917]">{trackingData.targeted_count || 0}</p>
                </div>
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Delivered</p>
                  <p className="text-2xl font-bold text-[#1C1917]">{trackingData.delivered_count || 0}</p>
                </div>
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Opened</p>
                  <p className="text-2xl font-bold text-[#1C1917]">
                    {trackingData.delivered_count > 0
                      ? Math.round(((trackingData.opens_unique || 0) / trackingData.delivered_count) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Visited within 7d</p>
                  <p className="text-2xl font-bold text-[#1C1917]">
                    {trackingData.delivered_count > 0
                      ? Math.round(((trackingData.visits_from_campaign || 0) / trackingData.delivered_count) * 100)
                      : 0}%
                  </p>
                </div>
              </div>

              {/* Recipients List */}
              <div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Recipients
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(trackingData.recipients || []).map((recipient, idx) => (
                    <div key={idx} className="p-3 rounded flex items-center justify-between" style={{ backgroundColor: '#F3EFE7' }}>
                      <div>
                        <p className="font-semibold text-[#1C1917]">{recipient.customer_name || 'Unknown'}</p>
                        <p className="text-xs text-[#8B8680]">{recipient.email}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-sm">
                          {recipient.opened ? <CheckCircle2 size={16} style={{ color: '#4A5D23' }} /> : <AlertCircle size={16} style={{ color: '#8B8680' }} />}
                          <span style={{ color: recipient.opened ? '#4A5D23' : '#8B8680' }}>{recipient.opened ? 'Opened' : 'Not opened'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-sm">
                          {recipient.visited ? <CheckCircle2 size={16} style={{ color: '#4A5D23' }} /> : <AlertCircle size={16} style={{ color: '#8B8680' }} />}
                          <span style={{ color: recipient.visited ? '#4A5D23' : '#8B8680' }}>{recipient.visited ? 'Visited' : 'No visit'}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Toolbar */}
              <div className="pt-4 border-t flex gap-3" style={{ borderColor: '#E7E5E4' }}>
                <button
                  className="flex-1 px-4 py-2 rounded-lg border font-semibold transition"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                  onClick={() => alert('Follow-up to non-openers feature would be implemented here')}
                >
                  Follow-up to non-openers
                </button>
                <button
                  className="flex-1 px-4 py-2 rounded-lg border font-semibold transition"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                  onClick={() => alert('Follow-up to non-visitors feature would be implemented here')}
                >
                  Follow-up to non-visitors
                </button>
              </div>
            </div>

            <div className="border-t p-6" style={{ borderColor: '#E7E5E4' }}>
              <button
                onClick={() => {
                  setViewingTrackingId(null);
                  setTrackingData(null);
                }}
                className="w-full px-6 py-2 rounded-lg font-semibold text-white transition"
                style={{ backgroundColor: '#B85C38' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
