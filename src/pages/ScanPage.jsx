import React, { useState, useRef, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { ScanLine, CheckCircle2, AlertCircle, Euro, Camera, Building2, Gift } from 'lucide-react';

const BRANCH_STORAGE_KEY = 'fidelitour_scan_branch_id';

const ScanPage = () => {
  const [mode, setMode] = useState('manual'); // 'manual' or 'camera'
  const [barcode, setBarcode] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [points, setPoints] = useState('');
  const [pointsManuallyEdited, setPointsManuallyEdited] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState(null); // Enhanced post-scan result
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemDone, setRedeemDone] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(() => {
    try { return localStorage.getItem(BRANCH_STORAGE_KEY) || ''; } catch (e) { return ''; }
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await ownerAPI.getBranches();
        setBranches(r.data || []);
      } catch (e) { /* no branches, plan doesn't support — fine */ }
    })();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(BRANCH_STORAGE_KEY, branchId || ''); } catch (e) {}
  }, [branchId]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionLoopRef = useRef(null);

  // Initialize BarcodeDetector
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['code_128', 'ean_13', 'ean_8', 'code_39', 'upca'],
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

  const handleAmountPaidChange = (e) => {
    const value = e.target.value;
    setAmountPaid(value);

    // Auto-calculate points if amount is valid and user hasn't manually edited points
    if (!pointsManuallyEdited && value.trim() !== '') {
      const amount = parseFloat(value);
      if (!isNaN(amount) && amount >= 0) {
        const calculatedPoints = Math.floor(amount * 10); // 10 points per euro
        setPoints(calculatedPoints.toString());
      }
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

    // Calculate final points
    const finalPoints = points.trim() !== '' && pointsManuallyEdited ? parseInt(points) : Math.floor(parsedAmount * 10);

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
        tier_upgraded: false, // Would need previous tier to compare
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
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen flex flex-col items-center">
      <div className="w-full max-w-2xl text-center mb-8">
        <h1 className="text-4xl font-['Cormorant_Garamond'] font-bold text-[#1C1917] mb-2">Record Visit</h1>
        <p className="text-[#57534E]">Enter the customer's wallet barcode and the transaction value to log loyalty tracking.</p>
      </div>

      {branches.length > 0 && (
        <div className="w-full max-w-2xl bg-white border border-[#E7E5E4] rounded-xl p-4 flex items-center gap-3">
          <Building2 size={18} className="text-[#B85C38]" />
          <div className="flex-1">
            <label className="block text-xs font-bold text-[#57534E] uppercase tracking-wider">Scanning at branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full mt-1 px-2 py-1 text-sm border border-[#E7E5E4] rounded"
            >
              <option value="">— Not tagged (counts toward "all branches" only) —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.id}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="w-full max-w-2xl flex gap-4 border-b border-[#E7E5E4]">
        <button
          onClick={() => {
            setMode('manual');
            stopCamera();
          }}
          className={`flex-1 py-3 px-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-colors ${
            mode === 'manual'
              ? 'border-[#B85C38] text-[#B85C38]'
              : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => {
            setMode('camera');
            if (!cameraActive) startCamera();
          }}
          className={`flex-1 py-3 px-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-colors flex items-center justify-center gap-2 ${
            mode === 'camera'
              ? 'border-[#B85C38] text-[#B85C38]'
              : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <Camera className="w-4 h-4" />
          Scan with Camera
        </button>
      </div>

      <div className="bg-white w-full max-w-2xl p-10 rounded-3xl shadow-lg border border-[#E7E5E4] relative overflow-hidden">

        {/* Decorative background circle */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#F3EFE7] rounded-full opacity-50 pointer-events-none"></div>

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
            {cameraActive && (
              <button
                onClick={stopCamera}
                className="w-full py-3 rounded-xl text-white font-bold bg-[#B85C38] hover:bg-[#9C4E2F] transition-all"
              >
                Stop Camera
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
              <p className="text-xs text-[#57534E] mt-2">Scan with a 2D barcode scanner or manually type the ID printed on the pass.</p>
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
              <p className="text-xs text-[#57534E] mt-2">Points update automatically based on the amount paid — you can override if needed.</p>
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
              <p className="text-xs text-[#57534E] mt-2">{points && amountPaid ? `${Math.floor(parseFloat(amountPaid) * 10)} points at 10 per euro` : 'Leave blank to auto-calculate'}</p>
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

                {/* Tier Upgrade Notification */}
                {scanResult.tier_upgraded && (
                  <div className="bg-[#E3A869] text-[#1C1917] p-4 rounded-lg mb-6 text-center">
                    <p className="font-bold">⭐ {scanResult.customer_name} just became {scanResult.new_tier}!</p>
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
