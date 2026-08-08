import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Share, Plus, X, Bell } from 'lucide-react';

/**
 * InstallPwaPrompt — surfaces "add this card to your home screen" at the right
 * moment, in the way the user's browser actually supports.
 *
 * Why this matters: on iOS, web push notifications only work once the wallet
 * card is installed as a standalone PWA. Without that step, the customer can
 * tap "enable notifications" all day and nothing fires. So the install step
 * is part of the push opt-in flow on Apple devices.
 *
 * Behaviour:
 *   1. Android Chrome / Edge / Samsung Internet → captures the
 *      `beforeinstallprompt` event and shows a single-tap "Add to home screen"
 *      button. After the user accepts, the browser handles the rest.
 *   2. iOS Safari → no programmatic install API exists. We detect iOS and
 *      show a step-by-step modal: Share → Add to Home Screen.
 *   3. Already installed (matchMedia('(display-mode: standalone)')) → render
 *      nothing. The card is already at home.
 *   4. Previously dismissed → respect localStorage flag and stay quiet for
 *      14 days, unless the parent passes `force` (e.g. owner clicked "show
 *      me how").
 *
 * Props:
 *   - onInstalled?: () => void   fires after the user accepts the Android
 *                                prompt (best-effort; iOS gives us no signal).
 *   - context?: 'card' | 'cta'   visual variant — 'card' renders inline,
 *                                'cta' renders as a slim button.
 *   - force?: boolean            ignore the "dismissed recently" memory.
 */
export default function InstallPwaPrompt({ onInstalled, context = 'card', force = false }) {
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [hidden, setHidden] = useState(false);
  const deferredPromptRef = useRef(null);

  // Detect platform once on mount.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS-specific:
      window.navigator.standalone === true);

  const isIos =
    typeof window !== 'undefined' &&
    /iPhone|iPad|iPod/.test(window.navigator.userAgent) &&
    !window.MSStream;

  // Hide if already installed, or recently dismissed (unless forced).
  useEffect(() => {
    if (isStandalone) { setHidden(true); return; }
    if (force) return;
    try {
      const dismissedAt = parseInt(localStorage.getItem('ft.installPrompt.dismissed') || '0', 10);
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      if (dismissedAt && Date.now() - dismissedAt < fourteenDays) {
        setHidden(true);
      }
    } catch (_e) { /* localStorage unavailable — show by default */ }
  }, [isStandalone, force]);

  // Capture Android's install prompt event.
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  // Track post-install for analytics + UX.
  useEffect(() => {
    const onInstalledEvt = () => {
      setInstallable(false);
      setHidden(true);
      onInstalled?.();
    };
    window.addEventListener('appinstalled', onInstalledEvt);
    return () => window.removeEventListener('appinstalled', onInstalledEvt);
  }, [onInstalled]);

  const dismiss = () => {
    try { localStorage.setItem('ft.installPrompt.dismissed', String(Date.now())); } catch (_e) {}
    setHidden(true);
  };

  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      // Android path — native prompt.
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === 'accepted') onInstalled?.();
      deferredPromptRef.current = null;
      setInstallable(false);
    } else if (isIos) {
      // iOS path — open instructions modal.
      setIosModalOpen(true);
    }
  };

  if (hidden) return null;
  // Don't render the prompt at all if we have neither an Android event nor iOS.
  // (Desktop browsers and old Android < 76 fall here — push still works on
  // desktop without install, so no need to nag.)
  if (!installable && !isIos) return null;

  if (context === 'cta') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#B85C38] text-white hover:bg-[#9C4427] transition-colors"
        >
          <Smartphone size={14} />
          Installer la carte
        </button>
        {iosModalOpen && <IosInstallModal onClose={() => setIosModalOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-[#DD9F8B] bg-gradient-to-br from-[#FCE3DC] to-[#F8E8E2] p-4 my-3 relative">
        <button
          type="button"
          aria-label="Fermer"
          onClick={dismiss}
          className="absolute top-2 right-2 text-[#9C4427] hover:text-[#171412] p-1"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#B85C38] text-white p-2 flex-shrink-0">
            <Bell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#171412] mb-1">
              Recevez vos offres au bon moment
            </p>
            <p className="text-xs text-[#57504A] mb-3 leading-relaxed">
              {isIos
                ? "Ajoutez cette carte à votre écran d'accueil pour activer les notifications. C'est gratuit et prend 5 secondes."
                : "Installez la carte sur votre téléphone pour recevoir les anniversaires, offres, et nouveautés."}
            </p>
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-[#B85C38] text-white hover:bg-[#9C4427] transition-colors"
            >
              <Smartphone size={16} />
              {isIos ? "Voir comment l'ajouter" : "Ajouter à l'écran d'accueil"}
            </button>
          </div>
        </div>
      </div>
      {iosModalOpen && <IosInstallModal onClose={() => setIosModalOpen(false)} />}
    </>
  );
}

/**
 * IosInstallModal — visual walkthrough of the Share → Add to Home Screen flow.
 * Apple gives no programmatic API, so this is the best we can do.
 */
function IosInstallModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#171412]">Installer la carte</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 -mr-1">
            <X size={20} className="text-[#57504A]" />
          </button>
        </div>
        <ol className="space-y-4 text-sm text-[#171412]">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#B85C38] text-white text-sm font-bold flex items-center justify-center">1</span>
            <div className="flex-1">
              <p className="font-medium">Touchez l'icône <Share size={16} className="inline mx-1 text-[#4A90E2]" /> partager</p>
              <p className="text-xs text-[#57504A]">en bas de votre écran Safari.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#B85C38] text-white text-sm font-bold flex items-center justify-center">2</span>
            <div className="flex-1">
              <p className="font-medium">Choisissez <span className="inline-flex items-center gap-1"><Plus size={14} className="text-[#4A90E2]" /> Sur l'écran d'accueil</span></p>
              <p className="text-xs text-[#57504A]">défilez si besoin pour le voir.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#B85C38] text-white text-sm font-bold flex items-center justify-center">3</span>
            <div className="flex-1">
              <p className="font-medium">Touchez « Ajouter »</p>
              <p className="text-xs text-[#57504A]">en haut à droite.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#7FA269] text-white text-sm font-bold flex items-center justify-center">✓</span>
            <div className="flex-1">
              <p className="font-medium">Ouvrez la carte depuis votre écran d'accueil.</p>
              <p className="text-xs text-[#57504A]">Vous recevrez désormais les offres et anniversaires en push.</p>
            </div>
          </li>
        </ol>
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl bg-[#171412] text-white font-medium hover:bg-[#3D3431] transition-colors"
        >
          C'est compris
        </button>
      </div>
    </div>
  );
}
