import React, { useState, useRef, useEffect } from 'react';
import { ownerAPI } from '../lib/api';
import { ScanLine, CheckCircle2, AlertCircle, Euro, Camera } from 'lucide-react';

const ScanPage = () => {
  const [mode, setMode] = useState('manual'); // 'manual' or 'camera'
  const [barcode, setBarcode] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

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

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    const parsedAmount = amountPaid.trim() === '' ? 0.0 : parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
        setStatus({ type: 'error', message: 'Please enter a valid amount paid.' });
        return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const res = await ownerAPI.scanVisit({ barcode_id: barcode.trim(), points: 1, amount_paid: parsedAmount });
      setStatus({ type: 'success', message: 'Visit recorded successfully!' });
      setBarcode('');
      setAmountPaid('');
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
              <label className="block text-sm font-bold text-[#1C1917] mb-2 uppercase tracking-wide">Amount Paid (LTV Update)</label>
              <div className="relative">
                <Euro className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-lg font-bold font-['Cormorant_Garamond'] transition-colors"
                  disabled={loading}
                />
              </div>
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
          <div className={`mt-8 p-6 rounded-2xl border flex flex-col items-center text-center animation-fadeIn ${status.type === 'success' ? 'bg-[#FDFBF7] border-[#E3A869]/50' : status.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-[#F3EFE7] border-[#E7E5E4]'}`}>
            {status.type === 'success' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-[#E3A869] mb-4" />
                <h3 className="text-2xl font-bold font-['Cormorant_Garamond'] text-[#1C1917] mb-1">Visit Recorded!</h3>
              </>
            ) : status.type === 'error' ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              </>
            ) : null}
            <p className="text-[#57534E] font-medium">{status.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanPage;
