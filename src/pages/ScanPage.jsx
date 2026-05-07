import React, { useState, useRef, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { ScanLine, CheckCircle2, AlertCircle, Euro, Camera, Building2, Gift } from 'lucide-react';
import { C as C_SCAN } from '../components/PageShell';
import { useBranch } from '../contexts/BranchContext';

const BRANCH_STORAGE_KEY = 'fidelitour_scan_branch_id';

const ScanPage = () => {
  const [mode, setMode] = useState('manual'); // 'manual' or 'camera'
  const [barcode, setBarcode] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [points, setPoints] = useState('');
  const [pointsManuallyEdited, setPointsManuallyEdited] = useState(false);
  // Live points rule from this tenant's card template.
  // Two modes: 'per_visit' (flat, default) or 'per_euro' (amount × rate).
  const [pointsMode, setPointsMode] = useState('per_visit');
  const [pointsPerEuro, setPointsPerEuro] = useState(10);
  const [pointsPerVisit, setPointsPerVisit] = useState(10);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState(null); // Enhanced post-scan result
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemDone, setRedeemDone] = useState(false);
  // App-wide branch context (item #18). Picking a branch here also reflects on every other page.
  const { branchId: _branchIdRaw, setBranchId: _setBranchIdGlobal, branches: _branchesCtx, setBranches: _setBranchesCtx } = useBranch();
  const branches = _branchesCtx;
  const branchId = _branchIdRaw || '';
  const setBranchId = (id) => _setBranchIdGlobal(id || null);

  useEffect(() => {
    (async () => {
      try {
        const r = await ownerAPI.getBranches();
        _setBranchesCtx(r.data || []);
      } catch (e) { /* no branches, plan doesn't support — fine */ }
    })();
    // Load the tenant's points rule from the card template.
    (async () => {
      try {
        const t = await ownerAPI.getCardTemplate();
        const m = (t.data?.points_mode || 'per_visit').toLowerCase();
        const rate = Number(t.data?.points_per_euro);
        const visit = Number(t.data?.points_per_visit);
        setPointsMode(m === 'per_euro' ? 'per_euro' : 'per_visit');
        if (rate && rate > 0) setPointsPerEuro(rate);
        if (visit && visit > 0) setPointsPerVisit(visit);
      } catch (_e) { /* keep defaults */ }
    })();
  }, []);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionLoopRef = useRef(null);

  // Initialize BarcodeDetector
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        // qr_code FIRST — that's what the wallet card actually displays.
        // Keep 1D formats so old POS laser scanners and stickers still work.
        detectorRef.current = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upca'],
        });
      } catch (error) {
        console.warn('BarcodeDetector not fully supported:', error);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        setStatus(null);

        if (detectorRef.current) {
          startDetectionLoop();
        } else {
          setStatus({ type: 'info', message: 'Camera opened. Scan barcode or enter manually.' });
        }
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Unable to access camera. Please check permissions.' });
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    setCameraActive(false);
  };

  const startDetectionLoop = () => {
    const detect = async () => {
      if (!videoRef.current || !detectorRef.current || !cameraActive) return;

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);

        if (barcodes.length > 0) {
          const detectedBarcode = barcodes[0].rawValue;
          setBarcode(detectedBarcode);
          setStatus({ type: 'success', message: 'Barcode detected!' });
          stopCamera();
          setMode('manual');
          return;
        }
      } catch (error) {
        console.debug('Detection error:', error);
      }

      detectionLoopRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  // Compute auto-points based on the tenant's chosen mode.
  const computeAutoPoints = (amount) => {
    if (pointsMode === 'per_euro') {
      const a = parseFloat(amount);
      if (!isNaN(a) && a > 0) return Math.floor(a * pointsPerEuro);
      return pointsPerVisit; // no amount → fall back to flat
    }
    return pointsPerVisit; // per_visit mode → always flat
  };

  const handleAmountPaidChange = (e) => {
    const value = e.target.value;
    setAmountPaid(value);

    // Auto-fill the points field per the mode, unless the cashier overrode it.
    if (!pointsManuallyEdited) {
      const calculated = computeAutoPoints(value);
      if (calculated >= 0) setPoints(String(calculated));
    }
  };

  const handlePointsChange = (e) => {
    setPoints(e.target.value);
    setPointsManuallyEdited(true); // Mark as manually edited
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    const parsedAmount = amountPaid.trim() === '' ? 0.0 : parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
        setStatus({ type: 'error', message: 'Please enter a valid amount paid.' });
        return;
    }

    // Calculate final points based on the chosen mode
    const finalPoints = points.trim() !== '' && pointsManuallyEdited
      ? parseInt(points)
      : computeAutoPoints(parsedAmount);

    setLoading(true);
    setStatus(null);
    setScanResult(null);
    try {
      const res = await ownerAPI.scanVisit({
        barcode_id: barcode.trim(),
        points: finalPoints > 0 ? finalPoints : undefined,
        amount_paid: parsedAmount,
        branch_id: branchId || undefined,
      });

      // Backend returns full customer object, transform it for UI
      const customerData = res.data;
      const pointsEarned = finalPoints > 0 ? finalPoints : 10; // default 10 points per visit
      const stampsCurrent = Math.floor(customerData.visits);
      const stampsRequired = 10; // matches default card template
      const canRedeem = stampsCurrent >= stampsRequired;

      setScanResult({
        customer_id: customerData.id,
        barcode_id: customerData.barcode_id,
        customer_name: customerData.name,
        points_earned: pointsEarned,
        stamps_current: stampsCurrent,
        stamps_required: stampsRequired,
        reward_unlocked: canRedeem,
        // Backend now returns these so the cashier sees tier-up celebrations.
        tier: customerData.tier || null,
        previous_tier: customerData.previous_tier || null,
        tier_upgraded: !!customerData.tier_upgraded,
        branch_id: branchId || customerData.branch_id || null,
      });
      setStatus({ type: 'success', message: 'Visit recorded successfully!' });
      setBarcode('');
      setAmountPaid('');
      setPoints('');
      setPointsManuallyEdited(false);
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Customer not found or invalid barcode.';
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero — single focused action surface for staff */}
      <div className="relative text-center pt-4 pb-2">
        <div
          aria-hidden="true"
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${C_SCAN.sky} 0%, transparent 70%)` }}
        />
        <div
          className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
          style={{
            background: `linear-gradient(135deg, ${C_SCAN.sky}1A, ${C_SCAN.lavender}1A)`,
            color: C_SCAN.sky,
            border: `1px solid ${C_SCAN.sky}33`,
          }}
        >
          <ScanLine size={12} /> Staff Workspace
        </div>
        <h1
          className="relative font-['Cormorant_Garamond'] font-bold leading-[1.1]"
          style={{ color: C_SCAN.inkDeep, fontSize: 44 }}
        >
          Record a Visit
        </h1>
        <p className="relative mt-3 text-base max-w-md mx-auto" style={{ color: C_SCAN.inkMute }}>
          Scan the customer's wallet barcode (or type it in) and enter the transaction amount to log loyalty points.
        </p>
      </div>

      {branches.length > 0 && (
        <div
          className="w-full rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'white', border: `1px solid ${C_SCAN.hairline}`, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${C_SCAN.sky}1A`, color: C_SCAN.sky, border: `1px solid ${C_SCAN.sky}33` }}
          >
            <Building2 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C_SCAN.inkMute }}>
              Scanning at branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full mt-1 px-2 py-1 text-sm rounded-lg outline-none"
              style={{ border: `1px solid ${C_SCAN.hairline}`, background: 'white' }}
            >
              <option value="">— Not tagged —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.id}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Mode tabs — pill switcher */}
      <div
        className="w-full p-1.5 rounded-full flex"
        style={{ background: 'white', border: `1px solid ${C_SCAN.hairline}` }}
      >
        {[
          { key: 'manual', label: 'Manual Entry', icon: ScanLine },
          { key: 'camera', label: 'Scan with Camera', icon: Camera },
        ].map((tab) => {
          const isActive = mode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setMode(tab.key);
                if (tab.key === 'manual') stopCamera();
                else if (!cameraActive) startCamera();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                background: isActive ? `linear-gradient(135deg, ${C_SCAN.sky}, ${C_SCAN.lavender})` : 'transparent',
                color: isActive ? 'white' : C_SCAN.inkMute,
                boxShadow: isActive ? '0 4px 14px rgba(74,144,226,0.25)' : 'none',
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="bg-white w-full p-8 md:p-10 rounded-3xl shadow-md border relative overflow-hidden"
        style={{ borderColor: C_SCAN.hairline }}
      >
        {/* Decorative gradient orbs */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: C_SCAN.sky }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: C_SCAN.lavender }}
        />

        {/* Camera Mode */}
        {mode === 'camera' && (
          <div className="relative z-10 space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-xl border-2 border-[#E7E5E4] bg-[#1C1917]"
              style={{ maxHeight: '400px', objectFit: 'cover' }}
            />

            {/* Inline amount field — fill BEFORE scanning so we capture the visit value */}
            <div className="rounded-xl border-2 p-4 space-y-3"
                 style={{ borderColor: '#E3A86955', background: 'linear-gradient(135deg, #FEF9E7 0%, #FFFFFF 100%)' }}>
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: '#E3A869', color: 'white' }}>
                  <Euro size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7B3F00' }}>
                    Montant payé par ce client
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#57534E' }}>
                    Saisissez le montant maintenant — il sera enregistré automatiquement à la détection du code-barres.
                  </p>
                </div>
              </div>
              <div className="relative">
                <Euro className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={handleAmountPaidChange}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-3 rounded-lg border-2 outline-none text-lg font-bold font-['Cormorant_Garamond'] transition-colors"
                  style={{ borderColor: '#E7E5E4', background: 'white' }}
                  onFocus={(e) => (e.target.style.borderColor = '#B85C38')}
                  onBlur={(e) => (e.target.style.borderColor = '#E7E5E4')}
                />
              </div>
              {amountPaid && parseFloat(amountPaid) > 0 && (
                <p className="text-[11px] font-semibold" style={{ color: '#4A5D23' }}>
                  ✓ {computeAutoPoints(amountPaid)} points seront crédités après le scan
                </p>
              )}
            </div>

            {cameraActive && (
              <button
                onClick={stopCamera}
                className="w-full py-3 rounded-xl text-white font-bold bg-[#B85C38] hover:bg-[#9C4E2F] transition-all"
              >
                Arrêter la caméra
              </button>
            )}
          </div>
        )}

        {/* Manual Entry Form */}
        {mode === 'manual' && (
          <form onSubmit={handleScan} className="space-y-6 relative z-10">
            <div>
              <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide">Customer Barcode ID</label>
              <div className="relative">
                <ScanLine className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value.toUpperCase())}
                  placeholder="e.g. FT-A1B2C3D4"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-lg font-mono tracking-widest transition-colors uppercase"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-[#57534E] mt-2">Scannez le QR code de la carte du client (ou tapez l'ID FT-XXXXXXXX manuellement).</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide">Amount Paid (€)</label>
              <div className="relative">
                <Euro className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountPaid}
                  onChange={handleAmountPaidChange}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-lg font-bold font-['Cormorant_Garamond'] transition-colors"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-[#57534E] mt-2">{
                pointsMode === 'per_euro'
                  ? 'Points calculés automatiquement (montant × taux). Vous pouvez les modifier ci-dessous.'
                  : 'Le montant ne change pas les points dans ce mode (forfait par visite). Le commerçant peut le changer dans Réglages.'
              }</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide">Points (Optional)</label>
              <input
                type="number"
                min="0"
                value={points}
                onChange={handlePointsChange}
                placeholder="Auto-calculated from amount paid"
                className="w-full px-4 py-4 rounded-xl border-2 border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-lg font-bold font-['Cormorant_Garamond'] transition-colors"
                disabled={loading}
              />
              <p className="text-xs text-[#57534E] mt-2">{
                pointsMode === 'per_euro'
                  ? (points && amountPaid
                      ? `${computeAutoPoints(amountPaid)} points (${pointsPerEuro} par euro)`
                      : `Laisser vide pour auto-calculer · ${pointsPerEuro} points par euro`)
                  : `Forfait par visite · ${pointsPerVisit} points (paramétré par le commerçant)`
              }</p>
            </div>

            <button
              type="submit"
              disabled={loading || !barcode.trim()}
              className="w-full py-4 rounded-xl text-white font-bold text-lg bg-[#B85C38] hover:bg-[#9C4E2F] disabled:opacity-50 transition-all shadow-md mt-4"
            >
              {loading ? 'Processing Transaction...' : 'Record Visit & Add Points'}
            </button>
          </form>
        )}

        {status && (
          <div className={`mt-8 rounded-2xl border animation-fadeIn ${status.type === 'success' ? 'bg-[#FDFBF7] border-[#E3A869]/50 p-8' : status.type === 'error' ? 'bg-red-50 border-red-200 p-6' : 'bg-[#F3EFE7] border-[#E7E5E4] p-6'}`}>
            {status.type === 'success' && scanResult ? (
              <>
                <div className="flex items-center justify-center gap-3 mb-6">
                  <CheckCircle2 className="w-10 h-10 text-[#E3A869]" />
                  <h3 className="text-2xl font-bold font-['Cormorant_Garamond'] text-[#1C1917]">
                    Visit recorded for {scanResult.customer_name || 'Customer'}
                  </h3>
                </div>

                {/* Points & Stamps Summary */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-center">
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-3xl font-bold text-[#B85C38]">+{scanResult.points_earned || 0}</p>
                    <p className="text-sm text-[#57534E]">points</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-3xl font-bold text-[#4A5D23]">+1</p>
                    <p className="text-sm text-[#57534E]">stamp</p>
                  </div>
                </div>

                {/* Progress Bar */}
                {scanResult.stamps_current !== undefined && scanResult.stamps_required !== undefined && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-semibold text-[#1C1917]">Progress to next reward</p>
                      <p className="text-sm font-bold text-[#B85C38]">{scanResult.stamps_current} / {scanResult.stamps_required}</p>
                    </div>
                    <div className="w-full h-3 bg-[#E7E5E4] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#B85C38] rounded-full transition-all"
                        style={{ width: `${Math.min((scanResult.stamps_current / scanResult.stamps_required) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#8B8680] mt-2">
                      {scanResult.stamps_required - scanResult.stamps_current} stamps until next reward
                    </p>
                  </div>
                )}

                {/* Reward Unlocked Banner — now with a live "Mark as redeemed" action */}
                {scanResult.reward_unlocked && (
                  <div className="bg-[#4A5D23] text-white p-6 rounded-lg mb-6">
                    <div className="text-center mb-4">
                      <p className="text-2xl font-bold mb-1">🎉 Reward unlocked!</p>
                      <p className="text-sm opacity-90">
                        {scanResult.customer_name || 'This customer'} has earned their reward.
                      </p>
                    </div>
                    {redeemDone ? (
                      <div className="bg-white/10 rounded-lg p-3 text-center">
                        <p className="font-bold flex items-center justify-center gap-2">
                          <CheckCircle2 size={18} /> Reward redeemed — logged & their card reset.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setRedeemLoading(true);
                            await ownerAPI.redeemReward({
                              customer_id: scanResult.customer_id,
                              barcode_id: scanResult.barcode_id,
                              reward_name: 'Loyalty reward',
                              branch_id: scanResult.branch_id || undefined,
                            });
                            setRedeemDone(true);
                          } catch (e) {
                            alert('Failed to redeem: ' + (e?.response?.data?.detail || e.message));
                          } finally {
                            setRedeemLoading(false);
                          }
                        }}
                        disabled={redeemLoading}
                        className="w-full py-3 rounded-lg bg-white text-[#4A5D23] font-bold hover:bg-[#F3EFE7] transition flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Gift size={18} />
                        {redeemLoading ? 'Redeeming…' : 'Give reward & mark redeemed'}
                      </button>
                    )}
                    <p className="text-xs text-white/80 text-center mt-3">
                      Logs this redemption to analytics. Their card resets to 0 stamps.
                    </p>
                  </div>
                )}

                {/* Tier Upgrade Celebration — fires when scan_visit returns tier_upgraded:true */}
                {scanResult.tier_upgraded && scanResult.tier && (
                  <div
                    className="relative p-5 rounded-2xl mb-6 text-center overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${C_SCAN.ochre} 0%, ${C_SCAN.amber} 60%, ${C_SCAN.terracotta} 100%)`,
                      color: 'white',
                      boxShadow: '0 8px 24px rgba(212,165,116,0.35)',
                    }}
                  >
                    <div aria-hidden="true" className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-50"
                         style={{ background: 'rgba(255,255,255,0.4)' }} />
                    <p className="relative text-2xl font-['Cormorant_Garamond'] font-bold leading-tight">
                      🎉 Bravo, {scanResult.customer_name?.split(' ')[0]} passe {String(scanResult.tier).toUpperCase()} !
                    </p>
                    <p className="relative text-sm mt-1 text-white/85">
                      They moved up from {String(scanResult.previous_tier || 'their previous tier').toUpperCase()} — a tier-up push notification was already sent.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setScanResult(null);
                    setStatus(null);
                    setRedeemDone(false);
                    setRedeemLoading(false);
                  }}
                  className="w-full py-4 rounded-lg bg-[#B85C38] text-white font-bold hover:bg-[#9C4E2F] transition"
                >
                  Scan next customer
                </button>
              </>
            ) : status.type === 'error' ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-[#57534E] font-medium">{status.message}</p>
              </>
            ) : (
              <p className="text-[#57534E] font-medium">{status.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanPage;
