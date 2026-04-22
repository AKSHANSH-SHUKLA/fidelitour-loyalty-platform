import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, BrainCircuit, ScanLine, Smartphone, Settings2, BarChart3 } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-2xl shadow-sm border border-[#E7E5E4] hover:shadow-lg transition-all"
  >
    <div className="bg-[#F3EFE7] w-14 h-14 rounded-full flex items-center justify-center mb-6">
      <Icon className="w-7 h-7 text-[#B85C38]" />
    </div>
    <h3 className="text-2xl font-['Cormorant_Garamond'] font-bold mb-3">{title}</h3>
    <p className="text-[#57534E] leading-relaxed">{description}</p>
  </motion.div>
);

const DemoCard = ({ title, description, children }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-2xl shadow-sm border border-[#E7E5E4] hover:shadow-lg transition-all"
  >
    <h3 className="text-2xl font-['Cormorant_Garamond'] font-bold mb-4">{title}</h3>
    <div className="bg-[#F3EFE7] rounded-xl p-8 mb-6 min-h-64 flex items-center justify-center">
      {children}
    </div>
    <p className="text-[#57534E] leading-relaxed">{description}</p>
  </motion.div>
);

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#FDFBF7] font-['Manrope'] text-[#1C1917]">
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-[#E7E5E4] z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-md bg-[#B85C38] flex items-center justify-center text-white font-bold text-xl">F</div>
            <span className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#B85C38]">FidéliTour</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium">
            <a href="#intro" className="hover:text-[#B85C38] transition-colors">Philosophy</a>
            <a href="#features" className="hover:text-[#B85C38] transition-colors">Capabilities</a>
            <a href="#demo" className="hover:text-[#B85C38] transition-colors">Live Simulation</a>
            <a href="#pricing" className="hover:text-[#B85C38] transition-colors">Plans</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="font-medium hover:text-[#B85C38] transition-colors">Sign in</Link>
            <Link to="/register" className="bg-[#1C1917] text-white px-6 py-2 rounded-full hover:bg-black transition-colors">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section id="intro" className="pt-40 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl space-y-8"
        >
          <h1 className="font-['Cormorant_Garamond'] text-6xl md:text-8xl font-bold leading-[1.1] tracking-tight">
            Stop giving away paper punch cards. <br/><span className="text-[#B85C38]">Start building loyalty.</span>
          </h1>
          <p className="text-xl md:text-2xl text-[#57534E] max-w-2xl mx-auto leading-relaxed">
            A meticulously crafted B2B2C retention platform for local businesses. Digital wallet passes, AI insights, and real-time geolocalisation marketing.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
            <Link to="/register" className="bg-[#B85C38] text-white px-8 py-4 rounded-full text-lg hover:bg-[#9C4E2F] transition-all shadow-md font-semibold">
              Deploy Your System
            </Link>
            <a href="#demo" className="bg-white border border-[#E7E5E4] text-[#1C1917] px-8 py-4 rounded-full text-lg hover:bg-[#F3EFE7] transition-all shadow-sm font-semibold">
              Try the Interactive Demo
            </a>
          </div>
        </motion.div>
      </section>

      {/* COMPREHENSIVE FEATURES GRID */}
      <section id="features" className="py-24 bg-white border-y border-[#E7E5E4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold mb-6">Unrivaled Retention Architecture</h2>
            <p className="text-lg text-[#57534E]">We engineered FidéliTour not just to track points, but to actively pull customers back into your storefront using advanced data telemetry.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Smartphone}
              title="Native Wallet Integration"
              description="Customers save their pass directly to Apple Wallet or Google Pay. Nobody wants another app. We live where their credit cards live."
            />
            <FeatureCard
              icon={Settings2}
              title="Tier-Specific Card Designs"
              description="Bronze, Silver, and Gold each with their own distinct visual look. Upload your logo, select typography, and switch between card styles in seconds."
            />
            <FeatureCard
              icon={MapPin}
              title="Know Your Neighborhoods"
              description="Track where customers come from: Instagram, TikTok, QR in store, and more. Know which neighborhoods need focus with the Tours map."
            />
            <FeatureCard
              icon={ScanLine}
              title="Automatic Points & Stamps"
              description="Automatic points when they pay—just type the amount. Customers collect stamps and earn free rewards. You configure how many visits fill one stamp."
            />
            <FeatureCard
              icon={BrainCircuit}
              title="Neural Marketing Assistant"
              description="Ask our built-in AI complex questions like 'Who are my inactive Bronze tier members?' and let it automatically generate marketing campaigns to win them back."
            />
            <FeatureCard
              icon={BarChart3}
              title="Enterprise Grade Analytics"
              description="Beautiful, interaction-heavy Recharts displaying cohort retention, active vs inactive member flows, and lifetime value segmented by custom time windows."
            />
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO - Card Design Mockups */}
      <section id="demo" className="py-24 bg-[#F3EFE7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold mb-6">How Your Customers Will See Their Loyalty Card</h2>
            <p className="text-lg text-[#57534E]">
              This is how the digital pass appears in customers' Apple Wallet and Google Wallet. A frictionless, native experience that keeps your business just a tap away.
            </p>
          </div>

          {/* iPhone Mockup - Card Design Preview */}
          <div className="max-w-2xl mx-auto mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-black rounded-3xl p-3 shadow-2xl"
            >
              <div className="bg-[#FDFBF7] rounded-2xl p-6 flex flex-col items-center">
                {/* Stamp Card Version */}
                <div className="w-full mb-8">
                  <p className="text-center text-sm text-[#57534E] mb-4 font-medium">Stamp Overlay Style — Hexagon Collection</p>
                  <div className="bg-white rounded-2xl p-6 border-2 border-[#B85C38] shadow-lg">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full bg-[#B85C38] flex items-center justify-center text-white font-bold text-2xl">F</div>
                      <div>
                        <h4 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#1C1917]">Your Business</h4>
                        <p className="text-xs text-[#57534E]">Member Loyalty Card</p>
                      </div>
                    </div>
                    <div className="bg-[#F3EFE7] rounded-xl p-6 mb-4">
                      <p className="text-center text-xs text-[#57534E] mb-4 font-medium">Coffee Stamps Collected</p>
                      <svg viewBox="0 0 240 80" className="w-full h-20">
                        {/* Hexagons */}
                        {[0,1,2,3,4,5,6,7,8,9].map((i) => {
                          const x = 20 + (i % 5) * 44;
                          const y = 20 + Math.floor(i / 5) * 50;
                          const filled = i < 7;
                          return (
                            <g key={i}>
                              <polygon
                                points={`${x},${y-14} ${x+12},${y-7} ${x+12},${y+7} ${x},${y+14} ${x-12},${y+7} ${x-12},${y-7}`}
                                fill={filled ? '#B85C38' : '#E7E5E4'}
                                stroke="#1C1917"
                                strokeWidth="0.5"
                              />
                              {filled && <text x={x} y={y+4} fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">☕</text>}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <p className="text-center text-xs text-[#57534E]">7 of 10 stamps collected—free reward coming soon!</p>
                  </div>
                </div>

                {/* Points Card Version */}
                <div className="w-full">
                  <p className="text-center text-sm text-[#57534E] mb-4 font-medium">Dynamic Points Style</p>
                  <div className="bg-gradient-to-br from-[#B85C38] to-[#9C4E2F] rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="font-['Cormorant_Garamond'] text-xl font-bold">Your Business</h4>
                        <p className="text-xs text-white/80">Rewards Program</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/80">Total Points</p>
                        <p className="text-3xl font-bold">2,450</p>
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-xs text-white/80 mb-1">Tier Level</p>
                          <p className="text-lg font-bold">Gold</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-white/80 mb-1">Next Reward</p>
                          <p className="text-lg font-bold">500 pts</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Demo Dashboard Section */}
          <div className="mb-16">
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold text-center mb-16">See Your Dashboard in Action</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Analytics Dashboard Demo */}
              <DemoCard
                title="Analytics Dashboard"
                description="Real-time insights into customer engagement, lifetime value trends, and retention metrics at a glance."
              >
                <div className="w-full space-y-3">
                  {/* Bar chart mockup */}
                  <div className="flex items-end justify-center gap-2 h-32">
                    <div className="w-6 bg-[#B85C38]/40 rounded-t" style={{ height: '60%' }}></div>
                    <div className="w-6 bg-[#B85C38]/60 rounded-t" style={{ height: '75%' }}></div>
                    <div className="w-6 bg-[#B85C38]/80 rounded-t" style={{ height: '90%' }}></div>
                    <div className="w-6 bg-[#B85C38] rounded-t" style={{ height: '100%' }}></div>
                    <div className="w-6 bg-[#4A5D23]/40 rounded-t" style={{ height: '65%' }}></div>
                  </div>
                  <div className="flex justify-center gap-1 text-xs text-[#57534E]">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                  </div>
                  <div className="pt-3 border-t border-[#E7E5E4]">
                    <p className="text-sm font-bold text-[#1C1917]">€4,250</p>
                    <p className="text-xs text-[#57534E]">↑ 12% revenue</p>
                  </div>
                </div>
              </DemoCard>

              {/* Campaign Manager Demo */}
              <DemoCard
                title="Campaign Manager"
                description="Design and launch targeted push notifications. Watch engagement rates spike when customers see personalized offers."
              >
                <div className="w-full space-y-2">
                  {/* Push notification mockup */}
                  <div className="bg-white border border-[#E7E5E4] rounded-lg p-3 text-left">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#B85C38] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1C1917]">Your Business</p>
                        <p className="text-xs text-[#57534E] truncate">Come back & earn double points!</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#57534E] bg-[#F3EFE7] rounded px-2 py-1">Now</p>
                  </div>

                  <div className="text-center text-sm py-2">
                    <p className="text-[#57534E] text-xs">2 more campaigns</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7E5E4]">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#B85C38]">47%</p>
                      <p className="text-xs text-[#57534E]">Open Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#4A5D23]">23%</p>
                      <p className="text-xs text-[#57534E]">Click Rate</p>
                    </div>
                  </div>
                </div>
              </DemoCard>

              {/* Geolocalisation Demo */}
              <DemoCard
                title="Geolocalisation Notifications"
                description="When customers are within 50m of your shop, they instantly get a personalized offer. Real-time, automatic, powerful."
              >
                <div className="w-full space-y-3">
                  {/* Phone mockup with notification */}
                  <div className="bg-black rounded-2xl p-2 mx-auto w-32">
                    <div className="bg-[#FDFBF7] rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-[#1C1917] mb-2">9:42</p>
                      <div className="bg-[#B85C38] rounded-lg p-2 mb-2">
                        <p className="text-white text-xs font-bold">📍 Nearby</p>
                        <p className="text-white text-xs">Come in now!</p>
                        <p className="text-white/90 text-xs">+5 bonus</p>
                      </div>
                      <p className="text-xs text-[#57534E]">Tap</p>
                    </div>
                  </div>

                  <div className="text-center text-sm">
                    <p className="text-[#57534E] text-xs">50m geofence</p>
                    <p className="text-[#B85C38] text-xs font-bold">312 nearby</p>
                  </div>
                </div>
              </DemoCard>

              {/* Multi-Branch Dashboard Demo */}
              <DemoCard
                title="Multi-Branch Dashboard"
                description="Multi-location owners see everything in one place. Know which neighborhood needs more attention with the Tours map."
              >
                <div className="w-full space-y-3">
                  {/* Branch KPI rows */}
                  <div className="space-y-2">
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-2">
                      <p className="text-xs font-bold text-[#1C1917] mb-1">Downtown</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1"><span className="text-[#B85C38] font-bold">542</span> customers</span>
                        <span className="flex-1"><span className="text-[#4A5D23] font-bold">€1,250</span> rev</span>
                      </div>
                    </div>
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-2">
                      <p className="text-xs font-bold text-[#1C1917] mb-1">Riverside</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1"><span className="text-[#B85C38] font-bold">387</span> customers</span>
                        <span className="flex-1"><span className="text-[#4A5D23] font-bold">€890</span> rev</span>
                      </div>
                    </div>
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-2">
                      <p className="text-xs font-bold text-[#1C1917] mb-1">Westend</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1"><span className="text-[#B85C38] font-bold">264</span> customers</span>
                        <span className="flex-1"><span className="text-[#4A5D23] font-bold">€620</span> rev</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#E7E5E4]">
                    <p className="text-xs font-bold text-[#1C1917] mb-2">Your Tours Map</p>
                    <svg viewBox="0 0 120 80" className="w-full h-16">
                      <rect x="5" y="5" width="110" height="70" fill="#F3EFE7" stroke="#E7E5E4" strokeWidth="1" rx="2" />
                      <circle cx="30" cy="25" r="3" fill="#B85C38" />
                      <circle cx="70" cy="40" r="3" fill="#B85C38" />
                      <circle cx="50" cy="60" r="3" fill="#4A5D23" />
                      <circle cx="85" cy="55" r="3" fill="#B85C38" />
                      <text x="35" y="35" fontSize="8" fill="#57534E" fontWeight="bold">12</text>
                      <text x="55" y="50" fontSize="8" fill="#57534E" fontWeight="bold">8</text>
                      <text x="75" y="70" fontSize="8" fill="#57534E" fontWeight="bold">5</text>
                    </svg>
                  </div>
                </div>
              </DemoCard>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-4">
        <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-bold text-center mb-4">Transparent Software Pricing</h2>
        <p className="text-center text-[#57534E] mb-16 max-w-2xl mx-auto text-lg">No hidden implementation fees. Predictable SaaS scaling designed for independently owned operators up to regional chains.</p>

        <div className="grid lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {/* Basic */}
          <div className="bg-white p-10 rounded-3xl border border-[#E7E5E4] shadow-sm flex flex-col">
            <h3 className="text-2xl font-bold mb-2">Basic Protocol</h3>
            <p className="text-4xl font-bold text-[#B85C38] mb-6">€29<span className="text-lg text-[#57534E] font-medium">/mo</span></p>
            <ul className="mb-8 space-y-4 flex-1 text-[#57534E]">
              <li>• Up to 500 Managed Customers</li>
              <li>• 2 Marketing Campaigns / mo</li>
              <li>• Native Digital Wallet Passes</li>
              <li>• Core Dashboard Analytics</li>
            </ul>
            <Link to="/register" className="block text-center w-full bg-[#F3EFE7] text-[#1C1917] font-semibold px-6 py-4 rounded-xl hover:bg-[#E7E5E4] transition-colors">Get Started</Link>
          </div>

          {/* Gold */}
          <div className="bg-[#1C1917] text-white p-10 rounded-3xl shadow-2xl relative transform lg:-translate-y-4 flex flex-col border border-[#333]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#B85C38] text-white text-sm font-bold px-6 py-2 rounded-full shadow-lg">
              OPTIMAL FOR MOST
            </div>
            <h3 className="text-2xl font-bold mb-2 pt-2">Gold Standard</h3>
            <p className="text-4xl font-bold text-white mb-6">€79<span className="text-lg text-white/70 font-medium">/mo</span></p>
            <ul className="mb-8 space-y-4 flex-1 text-white/80">
              <li>• Up to 2,000 Managed Customers</li>
              <li>• 10 Marketing Campaigns / mo</li>
              <li>• Complete Visual Card Designer</li>
              <li>• AI Assistant (20 queries/day)</li>
              <li>• Advanced Revenue & Lifetime DB</li>
            </ul>
            <Link to="/register" className="block text-center w-full bg-[#B85C38] text-white font-semibold px-6 py-4 rounded-xl hover:bg-[#9C4E2F] transition-colors shadow-lg">Deploy Gold Standard</Link>
          </div>

          {/* VIP */}
          <div className="bg-white p-10 rounded-3xl border border-[#E7E5E4] shadow-sm flex flex-col">
            <h3 className="text-2xl font-bold mb-2">VIP Matrix</h3>
            <p className="text-4xl font-bold text-[#B85C38] mb-6">€199<span className="text-lg text-[#57534E] font-medium">/mo</span></p>
            <ul className="mb-8 space-y-4 flex-1 text-[#57534E]">
              <li>• Up to 10,000 Managed Customers</li>
              <li>• 100 Marketing Campaigns / mo</li>
              <li>• Geofence Radius Push Notifications</li>
              <li>• AI Assistant (35 queries/day)</li>
              <li>• Raw Database CSV Extraction</li>
            </ul>
            <Link to="/register" className="block text-center w-full bg-[#F3EFE7] text-[#1C1917] font-semibold px-6 py-4 rounded-xl hover:bg-[#E7E5E4] transition-colors">Upgrade to VIP</Link>
          </div>

          {/* Chain */}
          <div className="bg-gradient-to-br from-[#2C2420] to-[#1C1917] text-white p-10 rounded-3xl shadow-2xl flex flex-col border-2 border-[#D4A574]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#D4A574] text-[#1C1917] text-sm font-bold px-6 py-2 rounded-full shadow-lg">
              PREMIUM TIER
            </div>
            <h3 className="text-2xl font-bold mb-2 pt-2">Chain</h3>
            <p className="text-xs text-white/70 mb-6">For multi-location businesses</p>
            <p className="text-4xl font-bold text-white mb-6">€349<span className="text-lg text-white/70 font-medium">/mo</span></p>
            <ul className="mb-8 space-y-4 flex-1 text-white/80">
              <li>• Everything in VIP</li>
              <li>• Up to 50,000 Customers</li>
              <li>• 300 Campaigns / mo</li>
              <li>• 50 AI Queries / day</li>
              <li>• Multi-branch Support</li>
              <li>• Aggregated Analytics</li>
              <li>• Dedicated Support</li>
            </ul>
            <Link to="/register" className="block text-center w-full bg-[#D4A574] text-[#1C1917] font-semibold px-6 py-4 rounded-xl hover:bg-[#E4B584] transition-colors shadow-lg">Contact Sales</Link>
          </div>
        </div>
      </section>

      {/* MULTI-STORE CTA */}
      <section id="multi-store" className="max-w-5xl mx-auto px-4 pb-20">
        <div
          className="rounded-3xl overflow-hidden shadow-xl border border-[#E7E5E4]"
          style={{ background: 'linear-gradient(135deg, #1C1917 0%, #3B2418 100%)' }}
        >
          <div className="p-10 md:p-14 text-center">
            <div className="inline-block mb-4 px-4 py-1 rounded-full bg-[#D4A574]/20 text-[#D4A574] text-xs uppercase tracking-widest font-semibold">
              For Multi-Location Businesses
            </div>
            <h2 className="font-['Cormorant_Garamond'] text-3xl md:text-5xl text-white font-bold mb-4">
              Got multiple stores? Let's talk.
            </h2>
            <p className="text-[#D4A574] text-base md:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              If you run several locations and want one loyalty platform for all of them — unified
              customers, shared tiers, consolidated analytics, and per-branch reports — we'll set
              everything up for you, migrate your existing data, and train your staff.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto text-left">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white font-semibold text-sm mb-1">Unified customer base</p>
                <p className="text-[#C4B5A0] text-xs">One customer card works at every store.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white font-semibold text-sm mb-1">Per-branch analytics</p>
                <p className="text-[#C4B5A0] text-xs">Compare performance across locations.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white font-semibold text-sm mb-1">Dedicated onboarding</p>
                <p className="text-[#C4B5A0] text-xs">We handle setup & staff training.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href="mailto:contact@fidelitour.fr?subject=Multi-store%20enquiry"
                className="inline-block bg-[#D4A574] text-[#1C1917] font-semibold px-8 py-3.5 rounded-xl hover:bg-[#E4B584] transition-colors shadow-lg"
              >
                Contact Us
              </a>
              <span className="text-[#8A8575] text-sm">or call <span className="text-white font-semibold">+33 2 47 00 00 00</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-[#E7E5E4] py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-[#57534E]">
          <p className="font-['Cormorant_Garamond'] text-2xl font-bold mb-4 text-[#B85C38]">FidéliTour</p>
          <p className="text-sm">© {new Date().getFullYear()} FidéliTour Platforms Inc. Architected for local excellence.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
