import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { Save, Phone, MapPin, Globe, Share2 } from 'lucide-react';
import { PageHeader, C as C_PS } from '../components/PageShell';

const SettingsPage = () => {
    const [settings, setSettings] = useState({
        name: '',
        address: '',
        phone: '',
        website: '',
    });
    const [joinUrl, setJoinUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    // Read-only view of the geolocalisation config (set by the super admin only).
    const [geoConfig, setGeoConfig] = useState({
        geo_enabled: false,
        vip_geo_only: false,
        geo_radius_meters: null,
        geo_cooldown_days: null,
    });

    useEffect(() => {
        ownerAPI.getTenant().then(res => {
            if (res.data) {
                setSettings({
                    name: res.data.name || '',
                    address: res.data.address || '',
                    phone: res.data.phone || '',
                    website: res.data.website || '',
                });
                setGeoConfig({
                    geo_enabled: Boolean(res.data.geo_enabled),
                    vip_geo_only: Boolean(res.data.vip_geo_only),
                    geo_radius_meters: res.data.geo_radius_meters ?? null,
                    geo_cooldown_days: res.data.geo_cooldown_days ?? null,
                });
                // Generate join URL from slug
                const slug = res.data.slug || 'your-business';
                setJoinUrl(`${window.location.origin}/join/${slug}`);
            }
            setLoading(false);
        }).catch(console.error);
    }, []);

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await ownerAPI.updateTenant(settings);
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error("Failed to save", error);
            setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(joinUrl);
        setMessage({ type: 'success', text: 'Join URL copied to clipboard!' });
        setTimeout(() => setMessage(null), 2000);
    };

    const channelLinks = [
        { key: 'qr_store',  label: 'In-store QR code',  emoji: '📱', desc: 'Print this URL as a QR code for your counter/menu.' },
        { key: 'instagram', label: 'Instagram',          emoji: '📸', desc: 'Paste as the link in your Instagram bio or stories.' },
        { key: 'facebook',  label: 'Facebook',           emoji: '👥', desc: 'Paste on your Facebook page or post links.' },
        { key: 'tiktok',    label: 'TikTok',             emoji: '🎵', desc: 'Paste as your TikTok profile link.' },
    ];

    const handleCopyChannel = (source) => {
        const url = `${joinUrl}?src=${source}`;
        navigator.clipboard.writeText(url);
        setMessage({ type: 'success', text: `${source} link copied — every signup through it will auto-tag as ${source}.` });
        setTimeout(() => setMessage(null), 2500);
    };

    if (loading) {
        return (
          <div className="flex items-center justify-center py-32">
            <div className="flex items-center gap-3 text-sm font-medium" style={{ color: C_PS.inkMute }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C_PS.ochre }} />
              Loading settings…
            </div>
          </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <PageHeader
              eyebrow="Configuration"
              title="Settings"
              description="Manage your business profile, customer join link, and delivery preferences."
              role="business_owner"
            />

            {message && (
                <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-[#e8f3e5] border-[#E7E5E4] text-[#2d5016]' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">

                {/* Business Profile Section */}
                <div className="bg-white p-8 rounded-2xl border border-[#E7E5E4] shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-[#E3A869]/10 rounded-bl-full pointer-events-none"></div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center text-[#E3A869]">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold font-['Cormorant_Garamond'] text-[#1C1917]">Business Profile</h2>
                    </div>

                    <div className="space-y-6 max-w-2xl">
                        <div>
                            <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide">Business Name</label>
                            <input
                                type="text"
                                value={settings.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="Your business name"
                                className="w-full px-4 py-3 rounded-lg border border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-[#1C1917] placeholder-[#A8A29E]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={settings.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                placeholder="+33 1 23 45 67 89"
                                className="w-full px-4 py-3 rounded-lg border border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-[#1C1917] placeholder-[#A8A29E]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                Physical Address
                            </label>
                            <input
                                type="text"
                                value={settings.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder="Street address, city, postal code"
                                className="w-full px-4 py-3 rounded-lg border border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-[#1C1917] placeholder-[#A8A29E]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Website URL
                            </label>
                            <input
                                type="url"
                                value={settings.website}
                                onChange={(e) => handleChange('website', e.target.value)}
                                placeholder="https://www.yourwebsite.com"
                                className="w-full px-4 py-3 rounded-lg border border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-[#1C1917] placeholder-[#A8A29E]"
                            />
                        </div>
                    </div>
                </div>

                {/* Join URL Section */}
                <div className="bg-white p-8 rounded-2xl border border-[#E7E5E4] shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-[#E3A869]/10 rounded-bl-full pointer-events-none"></div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center text-[#E3A869]">
                            <Share2 className="w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold font-['Cormorant_Garamond'] text-[#1C1917]">Customer Join Link</h2>
                    </div>

                    <div className="space-y-4 max-w-2xl">
                        <p className="text-sm text-[#57534E]">Share this link with customers to join your loyalty program:</p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 px-4 py-3 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4] text-sm font-mono text-[#1C1917] break-all">
                                {joinUrl}
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyUrl}
                                className="px-4 py-3 bg-[#B85C38] text-white rounded-lg hover:bg-[#9C4E2F] font-bold transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                        <p className="text-xs text-[#57534E]">Customers can scan the QR code or click this link to join your program.</p>
                    </div>

                    {/* Per-channel pre-tagged links */}
                    <div className="mt-8 pt-6 border-t border-[#E7E5E4]">
                        <h3 className="text-lg font-bold font-['Cormorant_Garamond'] text-[#1C1917] mb-2">Per-channel links (auto-tagged)</h3>
                        <p className="text-sm text-[#57534E] mb-4">
                            Use these channel-specific URLs so every signup is attributed automatically — no need for the customer to pick a source.
                            Your analytics (Customer Map, Acquisition breakdown, Campaign targeting) will update in real time.
                        </p>
                        <div className="space-y-3 max-w-2xl">
                            {channelLinks.map(({ key, label, emoji, desc }) => {
                                const url = `${joinUrl}?src=${key}`;
                                return (
                                    <div key={key} className="p-3 rounded-lg bg-[#F3EFE7] border border-[#E7E5E4]">
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl leading-none pt-1">{emoji}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-[#1C1917]">{label}</div>
                                                <div className="text-xs text-[#57534E] mb-2">{desc}</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 px-3 py-2 rounded bg-white border border-[#E7E5E4] text-xs font-mono text-[#1C1917] break-all">
                                                        {url}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyChannel(key)}
                                                        className="px-3 py-2 bg-[#B85C38] text-white rounded font-bold text-xs hover:bg-[#9C4E2F] transition-colors whitespace-nowrap"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Geolocalisation — read-only view. Only the super-admin can change this. */}
                <div className="bg-white p-8 rounded-2xl border border-[#E7E5E4] shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center text-[#E3A869]">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold font-['Cormorant_Garamond'] text-[#1C1917]">Geolocalisation</h2>
                    </div>
                    <p className="text-sm text-[#57534E] max-w-2xl mb-4">
                        Real-time push notifications when your customers open their wallet card within range of your store.
                        Managed by the FidéliTour admin team — contact us to adjust.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                        <div className={`p-4 rounded-lg border ${geoConfig.geo_enabled ? 'bg-[#e8f3e5] border-[#4A5D23]/30' : 'bg-[#F3EFE7] border-[#E7E5E4]'}`}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: geoConfig.geo_enabled ? '#2d5016' : '#57534E' }}>
                                Status
                            </p>
                            <p className="text-lg font-bold" style={{ color: geoConfig.geo_enabled ? '#2d5016' : '#8B8680' }}>
                                {geoConfig.geo_enabled ? '✓ Enabled' : '— Disabled'}
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg border ${geoConfig.vip_geo_only ? 'bg-[#FEF9E7] border-[#E3A869]/40' : 'bg-[#F3EFE7] border-[#E7E5E4]'}`}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1 text-[#7B3F00]">Audience</p>
                            <p className="text-lg font-bold text-[#7B3F00]">
                                {geoConfig.vip_geo_only
                                    ? '🎯 VIP tier only'
                                    : (geoConfig.geo_enabled ? 'All customers' : '—')}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-[#F3EFE7] border-[#E7E5E4]">
                            <p className="text-xs font-bold uppercase tracking-wider mb-1 text-[#57534E]">Push radius</p>
                            <p className="text-lg font-bold text-[#1C1917]">
                                {geoConfig.geo_radius_meters ? `${geoConfig.geo_radius_meters} m` : '—'}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-[#F3EFE7] border-[#E7E5E4]">
                            <p className="text-xs font-bold uppercase tracking-wider mb-1 text-[#57534E]">Cooldown</p>
                            <p className="text-lg font-bold text-[#1C1917]">
                                {geoConfig.geo_cooldown_days != null ? `${geoConfig.geo_cooldown_days} day(s)` : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-4 rounded-xl text-white font-bold bg-[#B85C38] hover:bg-[#9C4E2F] disabled:opacity-50 transition-all shadow-md"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </form>
        </div>
    );
};

export default SettingsPage;
