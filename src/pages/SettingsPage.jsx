import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { Save, Phone, MapPin, Globe, Share2 } from 'lucide-react';

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

    useEffect(() => {
        ownerAPI.getTenant().then(res => {
            if (res.data) {
                setSettings({
                    name: res.data.name || '',
                    address: res.data.address || '',
                    phone: res.data.phone || '',
                    website: res.data.website || '',
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

    if (loading) {
        return <div className="p-8 bg-[#FDFBF7] min-h-screen">Loading settings...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 bg-[#FDFBF7] min-h-screen">
            <style>{`
                * {
                    font-family: 'Manrope', sans-serif;
                }
                h1, h2, h3 {
                    font-family: 'Cormorant Garamond', serif;
                }
            `}</style>

            <div>
                <h1 className="text-4xl font-['Cormorant_Garamond'] font-bold text-[#1C1917] mb-2">Settings</h1>
                <p className="text-[#57534E]">Manage your business profile and customer join link.</p>
            </div>

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
