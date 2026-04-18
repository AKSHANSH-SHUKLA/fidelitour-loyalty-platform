import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Save,
  AlertCircle,
  Upload,
  Palette,
  Type,
  Eye,
  Check,
  Sparkles,
} from 'lucide-react';
import api from '../lib/api';

const AdminCardDesignerPage = () => {
  // Google Fonts import
  useEffect(() => {
    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;900&family=Cormorant+Garamond:wght@500;600;700&family=Lora:wght@400;500;600&family=Merriweather:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Crimson+Text:wght@400;600&family=EB+Garamond:wght@400;500;600&family=Spectral:wght@400;600;700&family=Prata:wght@400&family=Cinzel:wght@400;600;700&family=Josefin+Sans:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Raleway:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Roboto:wght@400;500;700&family=Lato:wght@400;700&family=Nunito:wght@400;600;700&family=Source+Sans+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;700&family=Manrope:wght@400;600;700&family=Work+Sans:wght@400;600;700&family=Outfit:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // State
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [logoUrl, setLogoUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#B85C38');
  const [secondaryColor, setSecondaryColor] = useState('#E3A869');
  const [textColor, setTextColor] = useState('#FDFBF7');
  const [gradientDirection, setGradientDirection] = useState('135deg');
  const [fontFamily, setFontFamily] = useState('Cormorant Garamond');
  const [showCustomerName, setShowCustomerName] = useState(true);
  const [showCustomerBirthday, setShowCustomerBirthday] = useState(false);
  const [showPointsCounter, setShowPointsCounter] = useState(true);
  const [showVisitsCounter, setShowVisitsCounter] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [backgroundImageOpacity, setBackgroundImageOpacity] = useState(0.3);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Font options
  const fonts = [
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
    { value: 'Lora', label: 'Lora' },
    { value: 'Merriweather', label: 'Merriweather' },
    { value: 'Libre Baskerville', label: 'Libre Baskerville' },
    { value: 'Crimson Text', label: 'Crimson Text' },
    { value: 'EB Garamond', label: 'EB Garamond' },
    { value: 'Spectral', label: 'Spectral' },
    { value: 'Prata', label: 'Prata' },
    { value: 'Cinzel', label: 'Cinzel' },
    { value: 'Josefin Sans', label: 'Josefin Sans' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Raleway', label: 'Raleway' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Nunito', label: 'Nunito' },
    { value: 'Source Sans Pro', label: 'Source Sans Pro' },
    { value: 'DM Sans', label: 'DM Sans' },
    { value: 'Inter', label: 'Inter' },
    { value: 'Manrope', label: 'Manrope' },
    { value: 'Work Sans', label: 'Work Sans' },
    { value: 'Outfit', label: 'Outfit' },
  ];

  // Design presets
  const presets = [
    {
      id: 'royal-gold',
      name: 'Royal Gold',
      primaryColor: '#1C2B4C',
      secondaryColor: '#D4AF37',
      textColor: '#FDFBF7',
      fontFamily: 'Playfair Display',
      gradientDirection: '135deg',
    },
    {
      id: 'terracotta-classic',
      name: 'Terracotta Classic',
      primaryColor: '#FDFBF7',
      secondaryColor: '#C85A3A',
      textColor: '#1C1917',
      fontFamily: 'Cormorant Garamond',
      gradientDirection: '90deg',
    },
    {
      id: 'midnight-luxe',
      name: 'Midnight Luxe',
      primaryColor: '#0F0F0F',
      secondaryColor: '#E8E8E8',
      textColor: '#FFFFFF',
      fontFamily: 'Montserrat',
      gradientDirection: '180deg',
    },
    {
      id: 'garden-fresh',
      name: 'Garden Fresh',
      primaryColor: '#2D5016',
      secondaryColor: '#F5F1E8',
      textColor: '#FFFFFF',
      fontFamily: 'Lora',
      gradientDirection: '45deg',
    },
    {
      id: 'ocean-breeze',
      name: 'Ocean Breeze',
      primaryColor: '#0D7C7C',
      secondaryColor: '#FFFFFF',
      textColor: '#FFFFFF',
      fontFamily: 'Raleway',
      gradientDirection: '135deg',
    },
    {
      id: 'vintage-rose',
      name: 'Vintage Rose',
      primaryColor: '#A68B8B',
      secondaryColor: '#E8D5D5',
      textColor: '#2C1414',
      fontFamily: 'Libre Baskerville',
      gradientDirection: '90deg',
    },
  ];

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

  // Fetch existing template when tenant changes
  useEffect(() => {
    if (!selectedTenantId) return;

    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/card-template/${selectedTenantId}`);
        if (response.data) {
          const template = response.data;
          setLogoUrl(template.logoUrl || '');
          setBusinessName(template.businessName || '');
          setPrimaryColor(template.primaryColor || '#B85C38');
          setSecondaryColor(template.secondaryColor || '#E3A869');
          setTextColor(template.textColor || '#FDFBF7');
          setGradientDirection(template.gradientDirection || '135deg');
          setFontFamily(template.fontFamily || 'Cormorant Garamond');
          setShowCustomerName(template.showCustomerName !== false);
          setShowCustomerBirthday(template.showCustomerBirthday !== false);
          setShowPointsCounter(template.showPointsCounter !== false);
          setShowVisitsCounter(template.showVisitsCounter !== false);
          setBackgroundImage(template.backgroundImage || '');
          setBackgroundImageOpacity(template.backgroundImageOpacity || 0.3);
        }
      } catch (err) {
        console.log('No existing template found');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [selectedTenantId]);

  // Handle logo upload
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle background image upload
  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Apply preset
  const applyPreset = (preset) => {
    setSelectedPreset(preset.id);
    setPrimaryColor(preset.primaryColor);
    setSecondaryColor(preset.secondaryColor);
    setTextColor(preset.textColor);
    setFontFamily(preset.fontFamily);
    setGradientDirection(preset.gradientDirection);
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!selectedTenantId) {
      setError('Please select a tenant');
      return;
    }

    if (!businessName.trim()) {
      setError('Please enter a business name');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const template = {
        logoUrl,
        businessName,
        primaryColor,
        secondaryColor,
        textColor,
        gradientDirection,
        fontFamily,
        showCustomerName,
        showCustomerBirthday,
        showPointsCounter,
        showVisitsCounter,
        backgroundImage,
        backgroundImageOpacity,
      };

      await api.post(`/admin/card-template/${selectedTenantId}`, template);
      setSuccess('Card template saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save template: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Render card preview
  const renderCardPreview = () => (
    <div
      className="relative w-full h-full rounded-3xl overflow-hidden flex flex-col justify-between p-8"
      style={{
        background: backgroundImage
          ? `linear-gradient(rgba(0,0,0,${backgroundImageOpacity}), rgba(0,0,0,${backgroundImageOpacity})), url(${backgroundImage})`
          : `linear-gradient(${gradientDirection}, ${primaryColor} 0%, ${secondaryColor} 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: textColor,
        fontFamily: fontFamily,
        aspectRatio: '16/10',
      }}
    >
      {/* Top section - Logo and Business Name */}
      <div className="flex flex-col items-center">
        {logoUrl && (
          <div className="mb-6">
            <img
              src={logoUrl}
              alt="Business Logo"
              className="w-24 h-24 object-contain"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        <h1
          className="text-4xl font-bold text-center mb-2"
          style={{
            fontFamily: fontFamily,
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {businessName || 'Your Business'}
        </h1>

        {showCustomerName && (
          <p className="text-lg opacity-90 font-semibold mt-2">John Doe</p>
        )}
      </div>

      {/* Middle section - Points/Visits */}
      <div className="flex justify-around items-center gap-4">
        {showPointsCounter && (
          <div className="text-center bg-white/10 backdrop-blur rounded-2xl p-6 flex-1">
            <p className="text-sm opacity-80 mb-2 font-semibold">POINTS</p>
            <p
              className="text-3xl font-bold"
              style={{
                color: secondaryColor,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              2,450
            </p>
          </div>
        )}

        {showVisitsCounter && (
          <div className="text-center bg-white/10 backdrop-blur rounded-2xl p-6 flex-1">
            <p className="text-sm opacity-80 mb-2 font-semibold">VISITS</p>
            <p
              className="text-3xl font-bold"
              style={{
                color: secondaryColor,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              12
            </p>
          </div>
        )}
      </div>

      {/* Bottom section - QR and Footer */}
      <div className="flex flex-col items-center gap-4">
        {showCustomerBirthday && (
          <p className="text-sm opacity-75">Birthday: May 15</p>
        )}

        <div
          className="w-20 h-20 rounded-lg border-2 flex items-center justify-center text-xs"
          style={{
            borderColor: secondaryColor,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <svg viewBox="0 0 100 100" className="w-16 h-16">
            <rect x="10" y="10" width="10" height="10" fill={textColor} />
            <rect x="25" y="10" width="10" height="10" fill={textColor} />
            <rect x="40" y="10" width="10" height="10" fill={textColor} />
            <rect x="55" y="10" width="10" height="10" fill={textColor} />
            <rect x="70" y="10" width="10" height="10" fill={textColor} />
            <rect x="10" y="25" width="10" height="10" fill={textColor} />
            <rect x="25" y="40" width="10" height="10" fill={textColor} />
            <rect x="40" y="55" width="10" height="10" fill={textColor} />
            <rect x="55" y="40" width="10" height="10" fill={textColor} />
            <rect x="70" y="25" width="10" height="10" fill={textColor} />
          </svg>
        </div>

        <p className="text-xs opacity-60 font-semibold">FidéliTour</p>
      </div>
    </div>
  );

  if (loading && tenants.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] to-[#F3EFE7] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-[#B85C38] border-t-transparent rounded-full mb-4" />
          <p className="text-lg text-[#57534E] font-semibold">
            Loading card designer...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] to-[#F3EFE7] p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-8 h-8 text-[#B85C38]" />
            <h1
              className="text-5xl font-bold text-[#1C1917]"
              style={{ fontFamily: 'Cormorant Garamond' }}
            >
              Card Designer
            </h1>
          </div>
          <p className="text-[#57534E] text-lg">
            Create stunning digital loyalty cards that captivate your customers
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 animate-in fade-in">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 font-medium">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tenant Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E5E4] p-8 backdrop-blur-xl bg-white/80">
              <div className="mb-8">
                <label className="block text-sm font-bold text-[#1C1917] mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Select Business
                </label>
                <div className="relative">
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full px-4 py-3 border border-[#E7E5E4] rounded-xl appearance-none bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38] focus:border-transparent font-semibold"
                  >
                    <option value="">-- Select a tenant --</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#57534E] pointer-events-none" />
                </div>
              </div>

              {selectedTenantId && (
                <>
                  {/* Business Name */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-[#1C1917] mb-3">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g., Café Luxe"
                      className="w-full px-4 py-3 border border-[#E7E5E4] rounded-xl text-[#1C1917] placeholder-[#B85C38]/50 focus:outline-none focus:ring-2 focus:ring-[#B85C38] focus:border-transparent font-semibold"
                    />
                  </div>

                  {/* Logo Upload */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-[#1C1917] mb-3 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Business Logo
                    </label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/png,image/jpeg,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="block px-4 py-3 bg-gradient-to-r from-[#B85C38] to-[#E3A869] text-white rounded-xl cursor-pointer font-semibold text-center hover:shadow-lg transition-shadow"
                        >
                          Choose File
                        </label>
                      </div>
                      {logoUrl && (
                        <div className="w-16 h-16 rounded-xl border-2 border-[#B85C38] flex items-center justify-center bg-white overflow-hidden">
                          <img
                            src={logoUrl}
                            alt="Logo Preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Font Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-[#1C1917] mb-3 flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      Typography
                    </label>
                    <div className="relative">
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        style={{ fontFamily: fontFamily }}
                        className="w-full px-4 py-3 border border-[#E7E5E4] rounded-xl appearance-none bg-white text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38] focus:border-transparent font-semibold"
                      >
                        {fonts.map((font) => (
                          <option
                            key={font.value}
                            value={font.value}
                            style={{ fontFamily: font.value }}
                          >
                            {font.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#57534E] pointer-events-none" />
                    </div>
                  </div>

                  {/* Design Presets */}
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-[#1C1917] mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Design Presets
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {presets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          className={`p-4 rounded-xl border-2 transition-all font-semibold text-sm ${
                            selectedPreset === preset.id
                              ? 'border-[#B85C38] bg-[#B85C38]/10'
                              : 'border-[#E7E5E4] hover:border-[#B85C38]/50'
                          }`}
                        >
                          <div
                            className="w-full h-8 rounded-lg mb-2 border border-white/20"
                            style={{
                              background: `linear-gradient(135deg, ${preset.primaryColor} 0%, ${preset.secondaryColor} 100%)`,
                            }}
                          />
                          <p className="text-xs text-[#57534E]">{preset.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Customization */}
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-[#1C1917] mb-4 flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Colors
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] mb-2">
                          Primary Color
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-14 h-14 rounded-xl cursor-pointer border-2 border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-xl text-sm text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] mb-2">
                          Secondary/Accent Color
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            className="w-14 h-14 rounded-xl cursor-pointer border-2 border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-xl text-sm text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] mb-2">
                          Text Color
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-14 h-14 rounded-xl cursor-pointer border-2 border-[#E7E5E4]"
                          />
                          <input
                            type="text"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-xl text-sm text-[#1C1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] mb-2">
                          Gradient Direction
                        </label>
                        <select
                          value={gradientDirection}
                          onChange={(e) => setGradientDirection(e.target.value)}
                          className="w-full px-3 py-2 border border-[#E7E5E4] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                        >
                          <option value="0deg">Top to Bottom</option>
                          <option value="90deg">Left to Right</option>
                          <option value="135deg">Diagonal</option>
                          <option value="180deg">Bottom to Top</option>
                          <option value="45deg">Reverse Diagonal</option>
                          <option value="radial">Radial</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Background Image */}
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-[#1C1917] mb-3 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Custom Background Image
                    </label>
                    <div className="mb-4">
                      <input
                        type="file"
                        id="bg-upload"
                        accept="image/png,image/jpeg"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="bg-upload"
                        className="block px-4 py-3 bg-gradient-to-r from-[#B85C38] to-[#E3A869] text-white rounded-xl cursor-pointer font-semibold text-center hover:shadow-lg transition-shadow"
                      >
                        Choose Background Image
                      </label>
                    </div>
                    {backgroundImage && (
                      <div>
                        <label className="block text-xs font-semibold text-[#57534E] mb-2">
                          Overlay Opacity: {Math.round(backgroundImageOpacity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={backgroundImageOpacity}
                          onChange={(e) =>
                            setBackgroundImageOpacity(parseFloat(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Toggles */}
                  <div className="mb-8 space-y-4 bg-[#F3EFE7] p-6 rounded-xl border border-[#E7E5E4]">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCustomerName}
                        onChange={(e) => setShowCustomerName(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-[#E7E5E4] text-[#B85C38] focus:ring-2 focus:ring-[#B85C38] cursor-pointer"
                      />
                      <span className="text-[#1C1917] font-semibold">
                        Show Customer Name
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCustomerBirthday}
                        onChange={(e) => setShowCustomerBirthday(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-[#E7E5E4] text-[#B85C38] focus:ring-2 focus:ring-[#B85C38] cursor-pointer"
                      />
                      <span className="text-[#1C1917] font-semibold">
                        Show Customer Birthday
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPointsCounter}
                        onChange={(e) => setShowPointsCounter(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-[#E7E5E4] text-[#B85C38] focus:ring-2 focus:ring-[#B85C38] cursor-pointer"
                      />
                      <span className="text-[#1C1917] font-semibold">
                        Show Points Counter
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showVisitsCounter}
                        onChange={(e) => setShowVisitsCounter(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-[#E7E5E4] text-[#B85C38] focus:ring-2 focus:ring-[#B85C38] cursor-pointer"
                      />
                      <span className="text-[#1C1917] font-semibold">
                        Show Visits Counter
                      </span>
                    </label>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-[#B85C38] to-[#E3A869] text-white px-6 py-4 rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-shadow flex items-center justify-center gap-2 text-lg"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Card Template'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h2
                className="text-2xl font-bold text-[#1C1917] mb-6"
                style={{ fontFamily: 'Cormorant Garamond' }}
              >
                Live Preview
              </h2>

              {/* iPhone Frame */}
              <div className="bg-gradient-to-b from-gray-900 to-black rounded-[3rem] p-3 shadow-2xl border border-gray-800">
                <div className="bg-black rounded-[2.5rem] overflow-hidden flex flex-col h-[600px]">
                  {/* Status Bar */}
                  <div className="bg-black text-white px-6 py-2 text-xs flex justify-between items-center border-b border-gray-800">
                    <span className="font-semibold">9:41</span>
                    <div className="flex gap-1">
                      <svg
                        className="w-4 h-3"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <rect x="17" y="2" width="5" height="10" />
                        <rect x="11" y="4" width="5" height="8" />
                        <rect x="5" y="6" width="5" height="6" />
                      </svg>
                    </div>
                  </div>

                  {/* Card Preview */}
                  <div className="flex-1 overflow-hidden bg-gradient-to-br from-gray-900 to-black p-3">
                    {renderCardPreview()}
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-5 bg-white rounded-xl border border-[#E7E5E4] shadow-sm">
                <p className="text-sm font-bold text-[#1C1917] mb-2">
                  Apple Wallet Pass
                </p>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  This preview shows how your card will appear to customers in
                  Apple Wallet. Changes update in real-time.
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
