import React, { useState, useEffect } from 'react';
import { ChevronDown, Save, AlertCircle, Upload, Palette, Type, Eye, Check, Sparkles } from 'lucide-react';
import api from '../lib/api';

const AdminCardDesignerPage = () => {
  // Google Fonts loader
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter&family=Playfair+Display&family=Montserrat&family=Poppins&family=Roboto&family=Open+Sans&family=Lato&family=Merriweather&family=Raleway&family=Oswald&family=Lora&family=Source+Sans+Pro&family=Nunito&family=Rubik&family=PT+Sans&family=Ubuntu&family=Quicksand&family=Cabin&family=Fira+Sans&family=Mukta&family=Barlow&family=Karla&family=DM+Sans&display=swap';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // State management
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [activeTier, setActiveTier] = useState('bronze');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [template, setTemplate] = useState({
    logo_url: '',
    active_offer_url: '',
    active_offer_title: '',
    active_offer_description: '',
    active_offer_active: false,
    design_mode: 'hexagon_stamps',
    points_per_visit: 10,
    visits_per_stamp: 1,
    reward_threshold_stamps: 10,
    reward_description: 'Un café gratuit',
    notify_before_reward: 1,
    bronze_design: {
      primary_color: '#B85C38',
      secondary_color: '#1C1917',
      text_color: '#FFFFFF',
      accent_color: '#D4A574',
      font_family: 'Inter',
      gradient_direction: '135deg',
      background_image_url: '',
      hexagon_color: '#D4A574',
      hexagon_filled_color: '#B85C38',
    },
    silver_design: {
      primary_color: '#A0A0A0',
      secondary_color: '#5C5C5C',
      text_color: '#FFFFFF',
      accent_color: '#C0C0C0',
      font_family: 'Inter',
      gradient_direction: '135deg',
      background_image_url: '',
      hexagon_color: '#E0E0E0',
      hexagon_filled_color: '#A0A0A0',
    },
    gold_design: {
      primary_color: '#D4A574',
      secondary_color: '#8B6F47',
      text_color: '#FFFFFF',
      accent_color: '#FFD700',
      font_family: 'Playfair Display',
      gradient_direction: '135deg',
      background_image_url: '',
      hexagon_color: '#FFE4B5',
      hexagon_filled_color: '#D4A574',
    },
    show_customer_name: true,
    show_customer_birthday: true,
    show_points: true,
    show_progress_meter: true,
  });

  const fontOptions = [
    'Inter', 'Playfair Display', 'Montserrat', 'Poppins', 'Roboto', 'Open Sans',
    'Lato', 'Merriweather', 'Raleway', 'Oswald', 'Lora', 'Source Sans Pro',
    'Nunito', 'Rubik', 'PT Sans', 'Ubuntu', 'Quicksand', 'Cabin', 'Fira Sans',
    'Mukta', 'Barlow', 'Karla', 'DM Sans',
  ];

  const gradientDirections = ['0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'];

  const designPresets = {
    bronze: [
      {
        name: 'Warm Terracotta',
        colors: {
          primary_color: '#A85A2F',
          secondary_color: '#6B4423',
          text_color: '#FFFEF9',
          accent_color: '#D4A574',
          hexagon_color: '#D4A574',
          hexagon_filled_color: '#A85A2F',
          font_family: 'Montserrat',
          gradient_direction: '135deg',
        },
      },
      {
        name: 'Midnight Luxe',
        colors: {
          primary_color: '#1A1A1A',
          secondary_color: '#3A3A3A',
          text_color: '#FFFFFF',
          accent_color: '#C9A876',
          hexagon_color: '#C9A876',
          hexagon_filled_color: '#1A1A1A',
          font_family: 'Montserrat',
          gradient_direction: '90deg',
        },
      },
      {
        name: 'Rose Elegance',
        colors: {
          primary_color: '#8B6B6B',
          secondary_color: '#C8B8B8',
          text_color: '#FFFFFF',
          accent_color: '#E8D5D5',
          hexagon_color: '#E8D5D5',
          hexagon_filled_color: '#8B6B6B',
          font_family: 'Merriweather',
          gradient_direction: '45deg',
        },
      },
      {
        name: 'Minimal Cream',
        colors: {
          primary_color: '#F5EFE7',
          secondary_color: '#D4A574',
          text_color: '#1C1917',
          accent_color: '#B85C38',
          hexagon_color: '#B85C38',
          hexagon_filled_color: '#F5EFE7',
          font_family: 'Inter',
          gradient_direction: '0deg',
        },
      },
    ],
    silver: [
      {
        name: 'Royal Silver',
        colors: {
          primary_color: '#8FA3AF',
          secondary_color: '#4A5568',
          text_color: '#FFFFFF',
          accent_color: '#B8D4E8',
          hexagon_color: '#D4E4F0',
          hexagon_filled_color: '#8FA3AF',
          font_family: 'Raleway',
          gradient_direction: '135deg',
        },
      },
      {
        name: 'Midnight Luxe',
        colors: {
          primary_color: '#1A1A1A',
          secondary_color: '#3A3A3A',
          text_color: '#FFFFFF',
          accent_color: '#A8C0D0',
          hexagon_color: '#A8C0D0',
          hexagon_filled_color: '#1A1A1A',
          font_family: 'Montserrat',
          gradient_direction: '90deg',
        },
      },
      {
        name: 'Ice Blue',
        colors: {
          primary_color: '#6B9FB5',
          secondary_color: '#B8E0E8',
          text_color: '#FFFFFF',
          accent_color: '#E0F2F7',
          hexagon_color: '#E0F2F7',
          hexagon_filled_color: '#6B9FB5',
          font_family: 'Inter',
          gradient_direction: '180deg',
        },
      },
      {
        name: 'Modern Minimal',
        colors: {
          primary_color: '#EFEFEF',
          secondary_color: '#A0A0A0',
          text_color: '#333333',
          accent_color: '#C0C0C0',
          hexagon_color: '#C0C0C0',
          hexagon_filled_color: '#EFEFEF',
          font_family: 'Inter',
          gradient_direction: '0deg',
        },
      },
    ],
    gold: [
      {
        name: 'Royal Gold',
        colors: {
          primary_color: '#1C2B4C',
          secondary_color: '#D4AF37',
          text_color: '#FDFBF7',
          accent_color: '#FFE4B5',
          hexagon_color: '#FFE4B5',
          hexagon_filled_color: '#D4AF37',
          font_family: 'Playfair Display',
          gradient_direction: '135deg',
        },
      },
      {
        name: 'Midnight Luxe',
        colors: {
          primary_color: '#1A1A1A',
          secondary_color: '#4A4A2A',
          text_color: '#FFFFFF',
          accent_color: '#FFD700',
          hexagon_color: '#FFD700',
          hexagon_filled_color: '#1A1A1A',
          font_family: 'Playfair Display',
          gradient_direction: '90deg',
        },
      },
      {
        name: 'Champagne Elegance',
        colors: {
          primary_color: '#9B8B6F',
          secondary_color: '#E8D4A8',
          text_color: '#FFFFFF',
          accent_color: '#F0E68C',
          hexagon_color: '#F0E68C',
          hexagon_filled_color: '#9B8B6F',
          font_family: 'Playfair Display',
          gradient_direction: '45deg',
        },
      },
      {
        name: 'Minimal Cream',
        colors: {
          primary_color: '#F5EFE7',
          secondary_color: '#D4A574',
          text_color: '#1C1917',
          accent_color: '#FFD700',
          hexagon_color: '#FFD700',
          hexagon_filled_color: '#F5EFE7',
          font_family: 'Playfair Display',
          gradient_direction: '0deg',
        },
      },
    ],
  };

  // Fetch tenants on mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/tenants');
        setTenants(response.data || []);
        if (response.data && response.data.length > 0) {
          setSelectedTenantId(response.data[0].id);
        }
      } catch (err) {
        setError('Failed to load tenants: ' + (err.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // Fetch template when tenant changes
  useEffect(() => {
    if (!selectedTenantId) return;

    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/card-template/${selectedTenantId}`);
        if (response.data) {
          setTemplate({ ...template, ...response.data });
        }
      } catch (err) {
        console.log('No template found, using defaults');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [selectedTenantId]);

  // Update template field
  const updateTemplate = (field, value) => {
    setTemplate({ ...template, [field]: value });
  };

  // Update tier design
  const updateTierDesign = (tier, field, value) => {
    const tierKey = `${tier}_design`;
    setTemplate({
      ...template,
      [tierKey]: { ...template[tierKey], [field]: value },
    });
  };

  // Handle logo/offer image upload
  const handleImageUpload = (field, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateTemplate(field, reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Apply preset
  const applyPreset = (preset) => {
    const tierKey = `${activeTier}_design`;
    setTemplate({
      ...template,
      [tierKey]: { ...template[tierKey], ...preset.colors },
    });
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!selectedTenantId) {
      setError('Please select a tenant');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await api.post(`/admin/card-template/${selectedTenantId}`, template);
      setSuccess('Card template saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save template: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Render hexagon SVG
  const renderHexagon = (filled, color) => {
    const points = '50,10 93.3,35 93.3,85 50,110 6.7,85 6.7,35';
    return (
      <svg viewBox="0 0 100 120" className="w-8 h-8">
        <polygon
          points={points}
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? '0' : '2'}
        />
      </svg>
    );
  };

  // Render loyalty card preview
  const renderCardPreview = (tier) => {
    const tierDesign = template[`${tier}_design`];
    const filledStamps = 7;
    const totalStamps = template.reward_threshold_stamps;
    const progressPercent = (filledStamps / totalStamps) * 100;

    return (
      <div
        className="w-full h-full rounded-3xl overflow-hidden flex flex-col p-6 justify-between"
        style={{
          background: `linear-gradient(${tierDesign.gradient_direction}, ${tierDesign.primary_color} 0%, ${tierDesign.secondary_color} 100%)`,
          backgroundImage: tierDesign.background_image_url
            ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${tierDesign.background_image_url})`
            : undefined,
          backgroundSize: tierDesign.background_image_url ? 'cover' : 'auto',
          backgroundPosition: 'center',
          color: tierDesign.text_color,
          fontFamily: tierDesign.font_family,
        }}
      >
        {/* Top: Logo or Offer */}
        <div className="flex flex-col items-center mb-4">
          {template.active_offer_active ? (
            <div className="text-center">
              <h3
                className="text-lg font-bold mb-1"
                style={{ color: tierDesign.accent_color }}
              >
                {template.active_offer_title || 'Special Offer'}
              </h3>
              <p className="text-xs opacity-90">
                {template.active_offer_description || 'Tap to learn more'}
              </p>
            </div>
          ) : template.logo_url ? (
            <img
              src={template.logo_url}
              alt="Logo"
              className="w-20 h-20 object-contain rounded-lg"
              onError={(e) => (e.target.style.display = 'none')}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: tierDesign.accent_color, color: tierDesign.primary_color }}
            >
              LOGO
            </div>
          )}
        </div>

        {/* Business name */}
        <p className="text-center text-sm font-semibold opacity-90 mb-2">Café Lumière</p>

        {/* Customer info */}
        {(template.show_customer_name || template.show_customer_birthday) && (
          <div className="text-center mb-3 text-xs opacity-85">
            {template.show_customer_name && <p>Marie Dubois</p>}
            {template.show_customer_birthday && <p>🎂 12 Mai</p>}
          </div>
        )}

        {/* Stamps grid */}
        <div className="flex justify-center mb-4">
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: totalStamps }).map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                {renderHexagon(i < filledStamps, i < filledStamps ? tierDesign.hexagon_filled_color : tierDesign.hexagon_color)}
              </div>
            ))}
          </div>
        </div>

        {/* Progress info */}
        {template.show_progress_meter && (
          <div className="mb-3">
            <p className="text-xs text-center opacity-85 mb-1">
              {filledStamps} / {totalStamps} stamps
            </p>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${progressPercent}%`, backgroundColor: tierDesign.accent_color }}
              />
            </div>
          </div>
        )}

        {/* Points */}
        {template.show_points && (
          <p className="text-center text-xs opacity-85 mb-3">⭐ 120 points</p>
        )}

        {/* Tier badge */}
        <div className="text-center mb-3">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              backgroundColor: tierDesign.accent_color,
              color: tierDesign.primary_color,
            }}
          >
            {tier.toUpperCase()}
          </span>
        </div>

        {/* Barcode */}
        <div className="flex justify-center gap-0.5 mb-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-6"
              style={{
                width: Math.random() > 0.5 ? '2px' : '3px',
                backgroundColor: tierDesign.text_color,
              }}
            />
          ))}
        </div>

        {/* Card ID */}
        <p className="text-center text-xs opacity-75 font-mono">#FT-2847291</p>
      </div>
    );
  };

  if (loading && tenants.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] to-[#F3EFE7] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-[#B85C38] border-t-transparent rounded-full mb-4" />
          <p className="text-lg text-[#57534E] font-semibold">Loading card designer...</p>
        </div>
      </div>
    );
  }

  const currentTierDesign = template[`${activeTier}_design`];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] to-[#F3EFE7] p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-8 h-8 text-[#B85C38]" />
            <h1 className="text-4xl font-bold text-[#1C1917]">Card Designer</h1>
          </div>
          <p className="text-[#57534E] text-base">Professional, tier-specific loyalty cards with hexagon stamps</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 font-medium">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column - Controls */}
          <div className="lg:col-span-2 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Tenant Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E5E4] p-6 backdrop-blur-xl bg-white/80">
              <label className="block text-sm font-bold text-[#1C1917] mb-3">Select Tenant</label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full px-4 py-3 border border-[#E7E5E4] rounded-xl bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
              >
                <option value="">-- Select a tenant --</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {selectedTenantId && (
                <>
                  {/* Loyalty Mechanics Section */}
                  <div className="mt-8 pt-8 border-t border-[#E7E5E4]">
                    <h3 className="text-lg font-bold text-[#1C1917] mb-4">Loyalty Mechanics</h3>

                    {/* Design Mode */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-3">Design Mode</label>
                      <div className="space-y-2">
                        {['hexagon_stamps', 'points', 'classic'].map((mode) => (
                          <label key={mode} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="design_mode"
                              value={mode}
                              checked={template.design_mode === mode}
                              onChange={(e) => updateTemplate('design_mode', e.target.value)}
                              className="w-4 h-4"
                            />
                            <span className="text-[#1C1917]">
                              {mode === 'hexagon_stamps' && 'Hexagon Stamps'}
                              {mode === 'points' && 'Points Counter'}
                              {mode === 'classic' && 'Classic Points'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Points per visit */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-2">
                        Points Earned Per Visit
                      </label>
                      <input
                        type="number"
                        value={template.points_per_visit}
                        onChange={(e) => updateTemplate('points_per_visit', parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        min="1"
                      />
                    </div>

                    {/* Visits per stamp */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-2">
                        Visits Needed To Fill One Stamp
                      </label>
                      <input
                        type="number"
                        value={template.visits_per_stamp}
                        onChange={(e) => updateTemplate('visits_per_stamp', parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        min="1"
                      />
                      <p className="text-xs text-[#57534E] mt-1">
                        For some businesses 1 visit = 1 stamp, others require 2 or 3
                      </p>
                    </div>

                    {/* Reward threshold */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-2">
                        Stamps Needed For A Reward
                      </label>
                      <input
                        type="number"
                        value={template.reward_threshold_stamps}
                        onChange={(e) => updateTemplate('reward_threshold_stamps', parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        min="1"
                      />
                      <p className="text-xs text-[#57534E] mt-1">
                        When a customer fills this many stamps, they get a free reward
                      </p>
                    </div>

                    {/* Reward description */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-2">
                        Reward Description
                      </label>
                      <input
                        type="text"
                        value={template.reward_description}
                        onChange={(e) => updateTemplate('reward_description', e.target.value)}
                        className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        placeholder="e.g., Un café gratuit"
                      />
                    </div>

                    {/* Notify before reward */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-2">
                        Notify When N Stamps Away From Reward
                      </label>
                      <input
                        type="number"
                        value={template.notify_before_reward}
                        onChange={(e) => updateTemplate('notify_before_reward', parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        min="0"
                      />
                      <p className="text-xs text-[#57534E] mt-1">
                        E.g., if set to 1, customer is notified on their 9th stamp when threshold is 10
                      </p>
                    </div>
                  </div>

                  {/* Offer Banner Section */}
                  <div className="mt-8 pt-8 border-t border-[#E7E5E4]">
                    <h3 className="text-lg font-bold text-[#1C1917] mb-4">Offer Banner</h3>

                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <input
                        type="checkbox"
                        checked={template.active_offer_active}
                        onChange={(e) => updateTemplate('active_offer_active', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-[#1C1917] font-semibold">Activate Offer Banner</span>
                    </label>

                    {template.active_offer_active && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-[#1C1917] mb-2">Offer Title</label>
                          <input
                            type="text"
                            value={template.active_offer_title}
                            onChange={(e) => updateTemplate('active_offer_title', e.target.value)}
                            className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                            placeholder="e.g., Happy Hour -50%"
                          />
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-[#1C1917] mb-2">Offer Description</label>
                          <input
                            type="text"
                            value={template.active_offer_description}
                            onChange={(e) => updateTemplate('active_offer_description', e.target.value)}
                            className="w-full px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                            placeholder="e.g., Every Friday 5-7 PM"
                          />
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-[#1C1917] mb-2">Offer Image URL</label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              id="offer-upload"
                              accept="image/png,image/jpeg"
                              onChange={(e) => handleImageUpload('active_offer_url', e)}
                              className="hidden"
                            />
                            <label
                              htmlFor="offer-upload"
                              className="px-4 py-2 bg-[#B85C38] text-white rounded-xl cursor-pointer font-semibold hover:shadow-lg transition-shadow text-sm"
                            >
                              Upload Image
                            </label>
                            <input
                              type="text"
                              value={template.active_offer_url}
                              onChange={(e) => updateTemplate('active_offer_url', e.target.value)}
                              className="flex-1 px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                              placeholder="Or paste URL"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-[#57534E] mb-4">
                          When active, the offer image replaces the logo on all customer cards. Turn off to revert to logo.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Tier Designs Section */}
                  <div className="mt-8 pt-8 border-t border-[#E7E5E4]">
                    <h3 className="text-lg font-bold text-[#1C1917] mb-4">Tier Designs</h3>

                    {/* Tier tabs */}
                    <div className="flex gap-2 mb-6 border-b border-[#E7E5E4]">
                      {['bronze', 'silver', 'gold'].map((tier) => (
                        <button
                          key={tier}
                          onClick={() => setActiveTier(tier)}
                          className={`px-4 py-2 font-semibold text-sm border-b-2 transition-all ${
                            activeTier === tier
                              ? 'border-[#B85C38] text-[#B85C38]'
                              : 'border-transparent text-[#57534E]'
                          }`}
                        >
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tier-specific controls */}
                    <div className="space-y-4">
                      {/* Primary Color */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Primary Color</label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={currentTierDesign.primary_color}
                            onChange={(e) => updateTierDesign(activeTier, 'primary_color', e.target.value)}
                            className="w-14 h-10 rounded-lg cursor-pointer border border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={currentTierDesign.primary_color}
                            onChange={(e) => updateTierDesign(activeTier, 'primary_color', e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      {/* Secondary Color */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Secondary Color</label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={currentTierDesign.secondary_color}
                            onChange={(e) => updateTierDesign(activeTier, 'secondary_color', e.target.value)}
                            className="w-14 h-10 rounded-lg cursor-pointer border border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={currentTierDesign.secondary_color}
                            onChange={(e) => updateTierDesign(activeTier, 'secondary_color', e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      {/* Text Color */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Text Color</label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={currentTierDesign.text_color}
                            onChange={(e) => updateTierDesign(activeTier, 'text_color', e.target.value)}
                            className="w-14 h-10 rounded-lg cursor-pointer border border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={currentTierDesign.text_color}
                            onChange={(e) => updateTierDesign(activeTier, 'text_color', e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      {/* Accent Color */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Accent Color</label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={currentTierDesign.accent_color}
                            onChange={(e) => updateTierDesign(activeTier, 'accent_color', e.target.value)}
                            className="w-14 h-10 rounded-lg cursor-pointer border border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={currentTierDesign.accent_color}
                            onChange={(e) => updateTierDesign(activeTier, 'accent_color', e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      {/* Hexagon Color */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Empty Hexagon Color</label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={currentTierDesign.hexagon_color}
                            onChange={(e) => updateTierDesign(activeTier, 'hexagon_color', e.target.value)}
                            className="w-14 h-10 rounded-lg cursor-pointer border border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={currentTierDesign.hexagon_color}
                            onChange={(e) => updateTierDesign(activeTier, 'hexagon_color', e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      {/* Hexagon Filled Color */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Filled Hexagon Color</label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={currentTierDesign.hexagon_filled_color}
                            onChange={(e) => updateTierDesign(activeTier, 'hexagon_filled_color', e.target.value)}
                            className="w-14 h-10 rounded-lg cursor-pointer border border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={currentTierDesign.hexagon_filled_color}
                            onChange={(e) => updateTierDesign(activeTier, 'hexagon_filled_color', e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm font-mono text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      {/* Font Family */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Font Family</label>
                        <select
                          value={currentTierDesign.font_family}
                          onChange={(e) => updateTierDesign(activeTier, 'font_family', e.target.value)}
                          className="w-full px-4 py-2 border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        >
                          {fontOptions.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Gradient Direction */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Gradient Direction</label>
                        <select
                          value={currentTierDesign.gradient_direction}
                          onChange={(e) => updateTierDesign(activeTier, 'gradient_direction', e.target.value)}
                          className="w-full px-4 py-2 border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        >
                          {gradientDirections.map((dir) => (
                            <option key={dir} value={dir}>
                              {dir}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Background Image URL */}
                      <div>
                        <label className="block text-sm font-semibold text-[#1C1917] mb-2">Background Image URL (Optional)</label>
                        <input
                          type="text"
                          value={currentTierDesign.background_image_url || ''}
                          onChange={(e) => updateTierDesign(activeTier, 'background_image_url', e.target.value)}
                          className="w-full px-4 py-2 border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          placeholder="Paste image URL"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="mt-6 pt-6 border-t border-[#E7E5E4]">
                      <label className="block text-sm font-semibold text-[#1C1917] mb-3">Quick Presets</label>
                      <div className="grid grid-cols-2 gap-2">
                        {designPresets[activeTier].map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => applyPreset(preset)}
                            className="p-3 border border-[#E7E5E4] rounded-lg hover:bg-[#F3EFE7] transition-colors text-sm font-semibold text-[#1C1917]"
                          >
                            <div
                              className="w-full h-6 rounded-md mb-2"
                              style={{
                                background: `linear-gradient(${preset.colors.gradient_direction}, ${preset.colors.primary_color} 0%, ${preset.colors.secondary_color} 100%)`,
                              }}
                            />
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Display Options Section */}
                  <div className="mt-8 pt-8 border-t border-[#E7E5E4]">
                    <h3 className="text-lg font-bold text-[#1C1917] mb-4">What To Show On Card</h3>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.show_customer_name}
                          onChange={(e) => updateTemplate('show_customer_name', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-[#1C1917] font-semibold">Show Customer Name</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.show_customer_birthday}
                          onChange={(e) => updateTemplate('show_customer_birthday', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-[#1C1917] font-semibold">Show Customer Birthday</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.show_points}
                          onChange={(e) => updateTemplate('show_points', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-[#1C1917] font-semibold">Show Points</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.show_progress_meter}
                          onChange={(e) => updateTemplate('show_progress_meter', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-[#1C1917] font-semibold">Show Progress Meter</span>
                      </label>
                    </div>
                  </div>

                  {/* Global Assets Section */}
                  <div className="mt-8 pt-8 border-t border-[#E7E5E4]">
                    <h3 className="text-lg font-bold text-[#1C1917] mb-4">Global Assets</h3>

                    <label className="block text-sm font-semibold text-[#1C1917] mb-2">Logo URL</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={(e) => handleImageUpload('logo_url', e)}
                        className="hidden"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="px-4 py-2 bg-[#B85C38] text-white rounded-xl cursor-pointer font-semibold hover:shadow-lg transition-shadow text-sm"
                      >
                        Upload Logo
                      </label>
                      <input
                        type="text"
                        value={template.logo_url}
                        onChange={(e) => updateTemplate('logo_url', e.target.value)}
                        className="flex-1 px-4 py-2 border border-[#E7E5E4] rounded-xl text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        placeholder="Or paste URL"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="w-full mt-8 bg-gradient-to-r from-[#B85C38] to-[#E3A869] text-white px-6 py-4 rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-shadow flex items-center justify-center gap-2 text-lg"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Card Template'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h2 className="text-2xl font-bold text-[#1C1917] mb-6">Live Preview</h2>

              {/* Three card phones */}
              <div className="space-y-6">
                {['bronze', 'silver', 'gold'].map((tier) => (
                  <div key={tier}>
                    <p className="text-sm font-bold text-[#1C1917] mb-2 text-center capitalize">{tier}</p>
                    <div className="bg-gradient-to-b from-gray-900 to-black rounded-[3rem] p-3 shadow-2xl border border-gray-800">
                      <div className="bg-black rounded-[2.5rem] overflow-hidden flex flex-col h-96 border-8 border-gray-800">
                        {/* Notch */}
                        <div className="bg-black h-7 flex items-center justify-center">
                          <div className="w-24 h-5 bg-black rounded-b-2xl" />
                        </div>
                        {/* Card content */}
                        <div className="flex-1 overflow-hidden p-2">{renderCardPreview(tier)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info box */}
              <div className="mt-6 p-5 bg-white rounded-xl border border-[#E7E5E4] shadow-sm">
                <p className="text-sm font-bold text-[#1C1917] mb-2">Live Preview</p>
                <p className="text-xs text-[#57534E]">
                  Updates in real-time as you adjust colors, fonts, and settings for each tier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCardDesignerPage;
