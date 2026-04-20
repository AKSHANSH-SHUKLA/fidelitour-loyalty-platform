import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Smartphone, Check, Image as ImageIcon, Type, Sparkles } from 'lucide-react';

const CardDesignerPage = () => {
  const { user } = useAuth();
  const [template, setTemplate] = useState({
    primary_color: '#1C1917',
    secondary_color: '#E3A869',
    text_content: 'LOYALTY REWARDS',
    logo_url: '',
    design_mode: 'stamps', // 'stamps' or 'classic'
    font_family: 'Cormorant Garamond',
    show_points: true
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ownerAPI.getCardTemplate().then(res => {
      if (res.data) setTemplate(res.data);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ownerAPI.saveCardTemplate(template);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // The 10 hexagon stamp visual component
  const HexagonStamps = () => (
      <div className="grid grid-cols-5 gap-3 px-4 py-6 w-full justify-items-center">
          {[...Array(10)].map((_, i) => (
             <div key={i} className="relative w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm opacity-80" style={{fill: i < 3 ? template.secondary_color : '#ffffff', stroke: template.secondary_color, strokeWidth: 4}}>
                   <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" />
                </svg>
                {i < 3 && <Sparkles className="absolute text-white w-4 h-4" />}
             </div>
          ))}
      </div>
  );

  return (
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen">
      <div>
        <h1 className="text-4xl font-['Cormorant_Garamond'] font-bold text-[#1C1917] mb-2">Digital Pass Designer</h1>
        <p className="text-[#57534E]">Customize the visual layout of your Apple Wallet & Google Pay passes.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* DESIGN CONTROLS */}
        <div className="flex-1 space-y-8">
            {/* Global Options */}
            <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm space-y-6">
                <div>
                   <label className="block text-sm font-bold text-[#1C1917] mb-3 uppercase tracking-wide">Design Architecture</label>
                   <div className="flex gap-4">
                       <button onClick={() => setTemplate({...template, design_mode: 'stamps'})} className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all ${template.design_mode === 'stamps' ? 'border-[#B85C38] bg-[#F3EFE7]' : 'border-[#E7E5E4] hover:bg-gray-50'}`}>
                           Physical Stamp Replica
                       </button>
                       <button onClick={() => setTemplate({...template, design_mode: 'classic'})} className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all ${template.design_mode === 'classic' ? 'border-[#B85C38] bg-[#F3EFE7]' : 'border-[#E7E5E4] hover:bg-gray-50'}`}>
                           Digital Point Tracker
                       </button>
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-[#1C1917] mb-3 uppercase tracking-wide">Typography (Font Family)</label>
                   <div className="flex items-center gap-3 relative">
                       <Type className="w-5 h-5 absolute left-3 text-[#A8A29E]" />
                       <select 
                           value={template.font_family}
                           onChange={e => setTemplate({...template, font_family: e.target.value})}
                           className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E7E5E4] outline-none font-bold"
                       >
                           <option value="Cormorant Garamond">Cormorant Garamond (Elegant Serif)</option>
                           <option value="Manrope">Manrope (Clean Sans)</option>
                           <option value="Times New Roman">Times New Roman (Classic Serif)</option>
                           <option value="Inter">Inter (System Tech)</option>
                       </select>
                   </div>
                </div>
            </div>

            {/* Aesthetics */}
            <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] shadow-sm space-y-6">
                 <div>
                    <label className="block text-sm font-bold text-[#1C1917] mb-3 uppercase tracking-wide">Brand Colors</label>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-[#57534E] mb-1 block">Background Color</label>
                            <input type="color" value={template.primary_color} onChange={e => setTemplate({...template, primary_color: e.target.value})} className="w-full h-12 rounded cursor-pointer border border-[#E7E5E4]" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-[#57534E] mb-1 block">Accent / Stamp Color</label>
                            <input type="color" value={template.secondary_color} onChange={e => setTemplate({...template, secondary_color: e.target.value})} className="w-full h-12 rounded cursor-pointer border border-[#E7E5E4]" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide">Brand Identity</label>
                    <div className="relative mb-4">
                        <ImageIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                        <input 
                            type="text" 
                            placeholder="Paste external Logo Image URL"
                            value={template.logo_url}
                            onChange={(e) => setTemplate({...template, logo_url: e.target.value})}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E7E5E4] outline-none text-sm"
                        />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Hero Title (e.g. CAFE LUMIERE)"
                        value={template.text_content}
                        onChange={(e) => setTemplate({...template, text_content: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-[#E7E5E4] outline-none font-bold uppercase tracking-wider"
                    />
                </div>
            </div>

            <button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[#B85C38] hover:bg-[#9C4E2F] text-white rounded-xl font-bold transition-all shadow-md"
            >
                {saving ? 'Synchronizing...' : saved ? <><Check className="w-5 h-5"/> Synced Globally</> : 'Publish to All Passes'}
            </button>
        </div>

        {/* LIVE SIMULATION */}
        <div className="w-[350px] shrink-0 mx-auto lg:mx-0">
          <div className="bg-[#1C1917] p-4 rounded-[40px] shadow-2xl relative border-[8px] border-gray-900 h-[700px] flex flex-col justify-start overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl"></div> {/* iPhone Notch */}
            
            <div className="flex items-center gap-2 text-white/50 justify-center mt-6 mb-4 text-xs font-semibold">
                <Smartphone className="w-4 h-4"/> Apple Wallet Simulation
            </div>

            {/* THE PASS */}
            <div 
                className="w-full rounded-2xl overflow-hidden shadow-xl mt-2 transition-all relative"
                style={{ backgroundColor: template.primary_color, minHeight: '500px', fontFamily: template.font_family }}
            >
                {/* Header */}
                <div className="px-5 py-6 flex items-center justify-between border-b border-white/10">
                   <div className="flex items-center gap-3">
                       {template.logo_url ? (
                           <img src={template.logo_url} alt="logo" className="w-12 h-12 rounded-full object-cover border-2 border-white/20"/>
                       ) : (
                           <div className="w-12 h-12 rounded-full flex items-center justify-center text-white/90 font-bold text-xl border-2 border-white/20" style={{backgroundColor: template.secondary_color}}>
                               B
                           </div>
                       )}
                       <div className="font-bold text-white text-xl tracking-wide">{template.text_content || 'BRAND'}</div>
                   </div>
                </div>

                {/* Body Mode Selector */}
                {template.design_mode === 'stamps' ? (
                     <div className="flex flex-col items-center justify-center pt-8 pb-4">
                         <div className="text-white/80 uppercase text-xs font-bold tracking-widest mb-4">La Carte de Fidélité</div>
                         <HexagonStamps />
                         <div className="text-center text-white/60 text-xs mt-6 px-6 leading-relaxed">
                            Every 10th visit unlocks a free reward of your choice.
                         </div>
                     </div>
                ) : (
                    <div className="p-6">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 shadow-inner">
                            <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Customer Name</div>
                            <div className="text-white text-2xl font-bold mb-6">John Doe</div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Current Balance</div>
                                    <div className="text-white text-3xl font-bold" style={{color: template.secondary_color}}>1,450 <span className="text-sm">Pts</span></div>
                                </div>
                                <div>
                                    <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Status Tier</div>
                                    <div className="text-white text-xl font-bold">Gold Elite</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Pass Information */}
                <div className="absolute bottom-0 left-0 w-full p-6 text-center space-y-4">
                    <div className="w-full h-16 bg-white/20 rounded-md flex items-center justify-center opacity-80 backdrop-blur-sm">
                       <div className="font-mono text-white tracking-widest text-lg font-bold">FT-A1B2C3D4</div>
                    </div>
                    <div className="text-xs text-white/30 uppercase tracking-widest font-sans">Powered by FidéliTour</div>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
export default CardDesignerPage;
