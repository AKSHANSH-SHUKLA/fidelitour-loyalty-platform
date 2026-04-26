import React, { useState, useEffect } from 'react';
import { Send, Plus, Filter, Users, MessageSquare, Clock, CheckCircle2, AlertCircle, Megaphone, Eye, AlertTriangle, TrendingUp, Zap, ChevronDown, ChevronUp, CalendarClock, Trash2, Pencil } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import api from '../lib/api';
import NumberInput from '../components/NumberInput';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // When set, the composer is editing an existing draft instead of creating
  // a new campaign. The id is sent to PUT /owner/campaigns/{id} on save.
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [sendConfirmation, setSendConfirmation] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedCampaignTab, setSelectedCampaignTab] = useState('by-filter'); // 'by-filter' or 'by-customers'
  const [campaignCustomers, setCampaignCustomers] = useState('');
  const [viewingTrackingId, setViewingTrackingId] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // --- Scheduling state (composer modal) ---
  const [sendMode, setSendMode] = useState('now'); // 'now' | 'schedule'
  const [scheduleAt, setScheduleAt] = useState('');      // yyyy-MM-ddTHH:mm, local TZ
  const [scheduleRecurrence, setScheduleRecurrence] = useState(''); // '' | daily | weekly | monthly
  const [scheduledCampaigns, setScheduledCampaigns] = useState([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  // --- Quick Send (filter-and-send on the main page) ---
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickSource, setQuickSource] = useState('push');
  const [quickMessage, setQuickMessage] = useState('');
  const [quickFilters, setQuickFilters] = useState({
    tiers: [],
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
    image_url: '',         // Optional hero image for the campaign
    filters: {
      tiers: [],
      minPoints: 0,
      minVisits: 0,
      postalCodes: '',
      minAmountPaid: 0,
    },
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');

  // Compresses + reads the picked image into a base64 data URL we can stash on
  // the campaign doc directly. Keeps payload under ~1.5 MB so Vercel's body
  // limit isn't hit. Mirrors the helper used in the Card Designer.
  const readImageFile = (file) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (!file.type?.startsWith('image/')) return reject(new Error('Not an image'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Image is over 5 MB. Pick a smaller one.'));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload = () => {
        const longest = Math.max(img.width, img.height);
        const maxSide = 1200;
        const scale = longest > maxSide ? maxSide / longest : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let q = 0.85;
        let dataUrl = canvas.toDataURL(mime, q);
        while (dataUrl.length > 1_500_000 && q > 0.5 && mime === 'image/jpeg') {
          q -= 0.1;
          dataUrl = canvas.toDataURL(mime, q);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    try {
      setImageUploading(true);
      const dataUrl = await readImageFile(file);
      setFormData((prev) => ({ ...prev, image_url: dataUrl }));
    } catch (ex) {
      setImageError(ex?.message || 'Upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  // Load campaigns + scheduled list on mount. Also pick up any handoff from
  // Customer Map (a list of customer IDs the user wants to campaign to).
  useEffect(() => {
    fetchCampaigns();
    fetchScheduled();
    try {
      const raw = sessionStorage.getItem('campaignHandoff');
      if (raw) {
        const handoff = JSON.parse(raw);
        sessionStorage.removeItem('campaignHandoff');
        if (handoff && Array.isArray(handoff.customer_ids) && handoff.customer_ids.length) {
          // Pre-open the composer in "by-customers" mode with the ID list baked in.
          setSelectedCampaignTab('by-customers');
          setCampaignCustomers(handoff.customer_ids.join('\n'));
          setFormData((prev) => ({
            ...prev,
            campaignName: handoff.suggested_name || 'Ciblage carte',
            message: handoff.suggested_message || '',
            source: handoff.source || 'push',
          }));
          setShowCreateModal(true);
        }
      }
    } catch (_e) { /* ignore */ }
  }, []);

  const fetchScheduled = async () => {
    try {
      setScheduledLoading(true);
      const res = await ownerAPI.listScheduled();
      setScheduledCampaigns(res.data?.scheduled || []);
    } catch (_e) { /* non-fatal */ } finally {
      setScheduledLoading(false);
    }
  };

  const cancelScheduled = async (id) => {
    if (!window.confirm('Cancel this scheduled campaign?')) return;
    try {
      await ownerAPI.deleteScheduled(id);
      await fetchScheduled();
    } catch (e) {
      alert('Failed to cancel: ' + (e?.response?.data?.detail || e.message));
    }
  };

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

  // Open the composer pre-filled with an existing draft so the user can edit it.
  const openEditDraft = (campaign) => {
    setEditingCampaignId(campaign.id);
    setSelectedCampaignTab('by-filter');     // editing = filter-based audience
    setCampaignCustomers('');
    const f = campaign.filters || {};
    setFormData({
      campaignName: campaign.name || '',
      message: campaign.content || campaign.message || '',
      source: campaign.source || 'push',
      image_url: campaign.image_url || '',
      filters: {
        tiers: Array.isArray(f.tiers) ? f.tiers : (f.tier ? [f.tier] : []),
        minPoints: Number(f.min_points || f.minPoints || 0) || 0,
        minVisits: Number(f.min_visits || f.minVisits || 0) || 0,
        postalCodes: Array.isArray(f.postal_codes)
          ? f.postal_codes.join(',')
          : (f.postal_code || f.postalCodes || ''),
        minAmountPaid: Number(f.min_amount_paid || f.minAmountPaid || 0) || 0,
      },
    });
    setImageError('');
    setSendMode('now');
    setScheduleAt('');
    setScheduleRecurrence('');
    setShowCreateModal(true);
  };

  const handleCreateCampaign = async () => {
    if (!formData.campaignName.trim() || !formData.message.trim()) {
      alert('Please fill in campaign name and message');
      return;
    }
    // Validate schedule if scheduling
    if (sendMode === 'schedule') {
      if (!scheduleAt) {
        alert('Please pick a date/time to schedule.');
        return;
      }
      const when = new Date(scheduleAt);
      if (isNaN(when.getTime()) || when.getTime() <= Date.now() - 60_000) {
        alert('Please pick a date/time in the future.');
        return;
      }
    }

    try {
      // Edit-an-existing-draft path. Skips the "send to group" / "schedule"
      // branches entirely — those are creation-only flows.
      if (editingCampaignId) {
        await ownerAPI.updateCampaign(editingCampaignId, {
          name: formData.campaignName,
          content: formData.message,
          source: formData.source || 'push',
          filters: buildFilterPayload(),
          image_url: formData.image_url || '',
        });
        resetForm();
        setEditingCampaignId(null);
        setShowCreateModal(false);
        await fetchCampaigns();
        return;
      }
      if (sendMode === 'schedule') {
        // Scheduled campaign — queue it. The daily cron (or on-demand runner)
        // will dispatch it when run_at is reached.
        if (selectedCampaignTab === 'by-customers') {
          alert('Scheduled sends currently support filter-based audiences only. Switch to "By Filter" to schedule.');
          return;
        }
        const payload = {
          name: formData.campaignName,
          content: formData.message,
          source: formData.source || 'push',
          filters: buildFilterPayload(),
          run_at: new Date(scheduleAt).toISOString(),
          recurrence: scheduleRecurrence || undefined,
        };
        await ownerAPI.scheduleCampaign(payload);
        await fetchScheduled();
      } else if (selectedCampaignTab === 'by-filter') {
        // Original filter-based flow (send now)
        const payload = {
          name: formData.campaignName,
          message: formData.message,
          source: formData.source || 'push',
          filters: buildFilterPayload(),
          image_url: formData.image_url || undefined,
        };
        await api.post('/owner/campaigns', payload);
      } else {
        // Send directly to selected customers. Campaign Map handoff sends
        // customer IDs; manual entry may send names or emails. We accept both
        // via the same endpoint and let the server reconcile.
        const customerList = campaignCustomers
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        if (customerList.length === 0) {
          alert('Please enter at least one customer');
          return;
        }

        // Heuristic: if it looks like a UUID-ish ID list (letters+digits+dashes,
        // no spaces, >12 chars), send as customer_ids — otherwise as names.
        const looksLikeIds = customerList.every(
          (s) => /^[a-zA-Z0-9_-]{10,}$/.test(s) && !s.includes('@')
        );
        const body = {
          name: formData.campaignName,
          content: formData.message,
          source: formData.source || 'push',
          image_url: formData.image_url || undefined,
        };
        if (looksLikeIds) body.customer_ids = customerList;
        else body.customer_names = customerList;

        await ownerAPI.sendCampaignToGroup(body);
      }

      resetForm();
      setCampaignCustomers('');
      setSelectedCampaignTab('by-filter');
      setShowCreateModal(false);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to ' + (sendMode === 'schedule' ? 'schedule' : 'create') + ' campaign: ' + (error?.response?.data?.detail || error.message));
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
      image_url: '',
      filters: {
        tiers: [],
        minPoints: 0,
        minVisits: 0,
        postalCodes: '',
        minAmountPaid: 0,
      },
    });
    setImageError('');
    setPreviewCount(null);
    setSendMode('now');
    setScheduleAt('');
    setScheduleRecurrence('');
    setEditingCampaignId(null);
  };

  // ---- Quick Send helpers ----
  const buildQuickFilterPayload = () => ({
    tiers: quickFilters.tiers.length > 0 ? quickFilters.tiers : undefined,
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
                    // Only the channels FidéliTour actually delivers on today.
                    // Social channels (FB/IG/TikTok) and SMS are not yet wired
                    // to a publishing pipeline, so we don't pretend to support
                    // them in the composer.
                    { key: 'push', label: 'Wallet Push' },
                    { key: 'email', label: 'Email' },
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

                {/* Min Points */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Min Points</label>
                  <NumberInput
                    min={0}
                    value={quickFilters.minPoints}
                    onChange={(n) => setQuickFilters({ ...quickFilters, minPoints: n || 0 })}
                    className="w-full px-2 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#E7E5E4' }}
                  />
                </div>

                {/* Min Visits */}
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Min Visits</label>
                  <NumberInput
                    min={0}
                    value={quickFilters.minVisits}
                    onChange={(n) => setQuickFilters({ ...quickFilters, minVisits: n || 0 })}
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
                  <NumberInput
                    min={0}
                    step={0.01}
                    value={quickFilters.minAmountPaid}
                    onChange={(n) => setQuickFilters({ ...quickFilters, minAmountPaid: n || 0 })}
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

        {/* Scheduled campaigns — upcoming sends with cancel controls */}
        {scheduledCampaigns.length > 0 && (
          <div className="mb-6 border rounded-xl p-5 bg-white" style={{ borderColor: '#E7E5E4' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} style={{ color: '#B85C38' }} />
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Scheduled campaigns ({scheduledCampaigns.length})
                </h2>
              </div>
              <button
                onClick={fetchScheduled}
                disabled={scheduledLoading}
                className="text-xs text-[#B85C38] font-semibold hover:underline disabled:opacity-50"
              >
                {scheduledLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <div className="space-y-2">
              {scheduledCampaigns
                .filter((s) => s.status === 'scheduled')
                .sort((a, b) => new Date(a.run_at) - new Date(b.run_at))
                .map((s) => {
                  const when = s.run_at ? new Date(s.run_at) : null;
                  const whenLabel = when && !isNaN(when)
                    ? when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : '—';
                  return (
                    <div key={s.id} className="p-3 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4] flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#1C1917] truncate">{s.name}</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#B85C38] text-white">
                            {s.source || 'push'}
                          </span>
                          {s.recurrence && (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E3A869] text-white">
                              Repeats {s.recurrence}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#57534E] mt-0.5">
                          <CalendarClock size={11} className="inline -mt-0.5 mr-1" />
                          Fires {whenLabel}
                        </p>
                        {s.content && (
                          <p className="text-xs text-[#8B8680] mt-1 line-clamp-1">{s.content}</p>
                        )}
                      </div>
                      <button
                        onClick={() => cancelScheduled(s.id)}
                        className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-xs font-semibold flex items-center gap-1 hover:bg-red-50"
                        title="Cancel this scheduled campaign"
                      >
                        <Trash2 size={12} /> Cancel
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

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
                  className="border rounded-lg overflow-hidden transition hover:shadow-md"
                  style={{ borderColor: '#E7E5E4', backgroundColor: '#FDFBF7' }}
                >
                  {/* Hero image strip — appears at top of the card if the campaign has one */}
                  {campaign.image_url && (
                    <div className="relative h-40 overflow-hidden border-b" style={{ borderColor: '#E7E5E4' }}>
                      <img
                        src={campaign.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider"
                           style={{ color: '#7B3F00' }}>
                        📸 With image
                      </div>
                    </div>
                  )}
                <div className="p-6">
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
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => openEditDraft(campaign)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition border"
                          style={{ borderColor: '#B85C38', color: '#B85C38', backgroundColor: '#FDFBF7' }}
                          title="Edit this draft before sending"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleSendCampaign(campaign)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition"
                          style={{ backgroundColor: '#B85C38' }}
                        >
                          <Send size={18} />
                          Send
                        </button>
                      </div>
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

                  {/* Message preview — content is the canonical field on the
                      backend; legacy clients used `message`, so fall through. */}
                  <div className="mb-4 p-4 rounded whitespace-pre-wrap" style={{ backgroundColor: '#F3EFE7' }}>
                    <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="text-sm">
                      {campaign.content || campaign.message || <span className="italic text-[#8B8680]">(no message yet)</span>}
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
                {editingCampaignId ? 'Edit Draft' : 'Create New Campaign'}
              </h2>
              {editingCampaignId && (
                <p className="text-sm text-[#57534E] mt-1" style={{ fontFamily: 'Manrope' }}>
                  Updating an unsent draft. Changes don't fire until you hit Send on the campaign card.
                </p>
              )}
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
                    // Only the channels FidéliTour actually delivers on today.
                    // Social channels (FB/IG/TikTok) and SMS are not yet wired
                    // to a publishing pipeline, so we don't pretend to support
                    // them in the composer.
                    { key: 'push', label: 'Wallet Push' },
                    { key: 'email', label: 'Email' },
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

              {/* Hero image — optional photo that appears in email + on the wallet card news feed */}
              <div className="border-t pt-6" style={{ borderColor: '#E7E5E4' }}>
                <label className="block text-sm font-semibold mb-1" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  📸 Hero image <span className="font-normal text-[#8B8680]">— optional, but doubles open rates</span>
                </label>
                <p className="text-xs text-[#57534E] mb-3" style={{ fontFamily: 'Manrope' }}>
                  Upload a photo (max 5 MB) — it appears at the top of the email and on the customer's wallet card news feed.
                </p>

                {formData.image_url ? (
                  // Image preview state
                  <div className="rounded-xl overflow-hidden border-2 relative group"
                       style={{ borderColor: '#E3A869' }}>
                    <img
                      src={formData.image_url}
                      alt="Campaign hero"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <label className="px-3 py-2 rounded-lg bg-white text-[#1C1917] font-semibold text-xs cursor-pointer hover:bg-[#F3EFE7]">
                        Replace
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, image_url: '' }))}
                        className="px-3 py-2 rounded-lg bg-red-500 text-white font-semibold text-xs hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider"
                         style={{ color: '#7B3F00' }}>
                      ✓ Image attached
                    </div>
                  </div>
                ) : (
                  // Upload prompt state
                  <label
                    className="block rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#B85C38] hover:bg-[#FEF9E7]"
                    style={{ borderColor: '#E3A869', background: '#FEFBF2' }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={imageUploading}
                    />
                    <div className="px-6 py-10 text-center">
                      <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                           style={{ background: 'linear-gradient(135deg, #FDF1DC, #E3A869)' }}>
                        <span className="text-2xl">📸</span>
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: '#7B3F00' }}>
                        {imageUploading ? 'Uploading…' : 'Click to upload a photo'}
                      </p>
                      <p className="text-xs" style={{ color: '#8B6914' }}>
                        JPG, PNG, GIF — max 5 MB. Auto-compressed to fit the email.
                      </p>
                    </div>
                  </label>
                )}
                {imageError && (
                  <p className="text-xs text-red-600 mt-2 font-semibold">⚠ {imageError}</p>
                )}
              </div>

              {/* Send timing — Send now vs. Schedule for later */}
              <div className="border-t pt-6" style={{ borderColor: '#E7E5E4' }}>
                <label className="block text-sm font-semibold mb-3" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  When should this go out?
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSendMode('now')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border flex items-center gap-2 transition ${
                      sendMode === 'now' ? 'bg-[#B85C38] text-white border-[#B85C38]' : 'bg-white text-[#57534E] border-[#E7E5E4]'
                    }`}
                  >
                    <Send size={14} /> Send now
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode('schedule')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border flex items-center gap-2 transition ${
                      sendMode === 'schedule' ? 'bg-[#B85C38] text-white border-[#B85C38]' : 'bg-white text-[#57534E] border-[#E7E5E4]'
                    }`}
                  >
                    <CalendarClock size={14} /> Schedule for later
                  </button>
                </div>
                {sendMode === 'schedule' && (
                  <div className="p-4 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4] space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Send date & time</label>
                        <input
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          className="w-full px-3 py-2 rounded border border-[#E7E5E4] text-sm bg-white"
                        />
                        <p className="text-[11px] text-[#8B8680] mt-1">Local time — stored as UTC on the server.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] uppercase mb-1">Repeat (optional)</label>
                        <select
                          value={scheduleRecurrence}
                          onChange={(e) => setScheduleRecurrence(e.target.value)}
                          className="w-full px-3 py-2 rounded border border-[#E7E5E4] text-sm bg-white"
                        >
                          <option value="">No — one-off send</option>
                          <option value="daily">Every day</option>
                          <option value="weekly">Every week</option>
                          <option value="monthly">Every month</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-[#57534E]">
                      {scheduleRecurrence
                        ? `The campaign will fire at the chosen time and repeat ${scheduleRecurrence}. Cancel anytime from "Scheduled campaigns".`
                        : 'The campaign will fire at the chosen time and then finish.'}
                    </p>
                  </div>
                )}
              </div>

              {/* By Customers Mode */}
              {selectedCampaignTab === 'by-customers' && (
                <div className="p-4 rounded border-2" style={{ borderColor: '#E3A869', backgroundColor: '#F3EFE7' }}>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Customer Names, Emails, or IDs (one per line)
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
                    Enter customer names, email addresses, or IDs (one per line). The map
                    "Send campaign" button pre-fills this with the filtered IDs.
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

                {/* Min Points */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Points
                  </label>
                  <NumberInput
                    value={formData.filters.minPoints}
                    onChange={(n) => handleFilterChange('minPoints', n || 0)}
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
                  <NumberInput
                    value={formData.filters.minVisits}
                    onChange={(n) => handleFilterChange('minVisits', n || 0)}
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
                  <NumberInput
                    value={formData.filters.minAmountPaid}
                    onChange={(n) => handleFilterChange('minAmountPaid', n || 0)}
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
                className="px-6 py-2 rounded-lg font-semibold text-white transition flex items-center gap-2"
                style={{ backgroundColor: '#B85C38' }}
              >
                {editingCampaignId
                  ? (<><Pencil size={16} /> Save Draft</>)
                  : sendMode === 'schedule'
                    ? (<><CalendarClock size={16} /> Schedule Campaign</>)
                    : 'Create Campaign'}
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
              {/* Tracking Summary — both raw count AND percentage so the
                  numbers always tell the full story. The opens/visits totals
                  are derived server-side from the per-recipient state, so
                  whatever the recipients list shows is exactly what these
                  tiles aggregate to (no more drift). */}
              {(() => {
                const targeted = trackingData.targeted_count || 0;
                const delivered = trackingData.delivered_count || 0;
                const opens = trackingData.opens_unique ?? trackingData.opens_after_count ?? 0;
                const visits = trackingData.visits_from_campaign ?? trackingData.visits_after_count ?? 0;
                const denom = delivered || (trackingData.recipients?.length || 0);
                const openPct = denom > 0 ? Math.round((opens / denom) * 100) : 0;
                const visitPct = denom > 0 ? Math.round((visits / denom) * 100) : 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                      <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Sent to</p>
                      <p className="text-2xl font-bold text-[#1C1917]">{targeted}</p>
                      <p className="text-[10px] text-[#8B8680] mt-0.5">recipients targeted</p>
                    </div>
                    <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                      <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Delivered</p>
                      <p className="text-2xl font-bold text-[#1C1917]">{delivered}</p>
                      <p className="text-[10px] text-[#8B8680] mt-0.5">
                        {targeted > 0 ? `${Math.round((delivered / targeted) * 100)}% of targeted` : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                      <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Opened</p>
                      <p className="text-2xl font-bold text-[#1C1917]">
                        {opens}<span className="text-base text-[#8B8680] font-normal"> / {denom}</span>
                      </p>
                      <p className="text-[10px] text-[#4A5D23] mt-0.5 font-semibold">{openPct}% open rate</p>
                    </div>
                    <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                      <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Visits after (15d)</p>
                      <p className="text-2xl font-bold text-[#1C1917]">
                        {visits}<span className="text-base text-[#8B8680] font-normal"> / {denom}</span>
                      </p>
                      <p className="text-[10px] text-[#B85C38] mt-0.5 font-semibold">{visitPct}% conversion</p>
                    </div>
                  </div>
                );
              })()}

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
