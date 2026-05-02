/**
 * Web Push subscription helper.
 *
 * Public API (all async, all return either a result object or throw a
 * developer-friendly Error — never raw browser errors):
 *
 *   isSupported()                       → boolean     (sync)
 *   getPermission()                     → 'granted'|'denied'|'default'   (sync)
 *   ensureSubscribed(tenantSlug, barcodeId) → { ok, status, ... }
 *   unsubscribe(tenantSlug, barcodeId)  → { ok }
 *
 * Flow on `ensureSubscribed`:
 *   1. Register the service worker (`/sw.js`)
 *   2. Fetch the backend's VAPID public key once
 *   3. Ask the browser for an active push subscription (or create one)
 *   4. POST that subscription to /api/customer/push/subscribe
 *
 * We intentionally do NOT prompt the user with a flashy modal here — the
 * caller (wallet card toggle) decides the UX. This file is pure plumbing.
 */
import api from './api';

/* ---- Capability checks -------------------------------------------------- */
export function isSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermission() {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

/* ---- Internal: VAPID key + base64url decoding --------------------------- */
let _cachedVapidKey = null;

async function fetchVapidKey() {
  if (_cachedVapidKey) return _cachedVapidKey;
  const res = await api.get('/public/vapid-public-key');
  if (!res.data || !res.data.configured || !res.data.key) {
    throw new Error('vapid_not_configured');
  }
  _cachedVapidKey = res.data.key;
  return _cachedVapidKey;
}

function urlBase64ToUint8Array(base64String) {
  // Web Push expects the VAPID public key as a Uint8Array in raw form.
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

/* ---- Service worker registration ---------------------------------------- */
let _swRegistration = null;

async function registerServiceWorker() {
  if (_swRegistration) return _swRegistration;
  if (!isSupported()) throw new Error('push_not_supported');
  // Service worker MUST be served from origin root (/sw.js) so it can claim
  // every page under the wallet domain.
  _swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  // Wait until the SW is fully active — pushManager.subscribe needs an active worker.
  if (_swRegistration.installing || _swRegistration.waiting) {
    await navigator.serviceWorker.ready;
  }
  return _swRegistration;
}

/* ---- Public: ensure a working subscription is registered with backend --- */
/**
 * Idempotent. Safe to call repeatedly (e.g. on every wallet-card mount).
 *
 * Returns one of:
 *   { ok: true,  status: 'subscribed' }      newly registered
 *   { ok: true,  status: 'already_subscribed' }
 *   { ok: false, status: 'unsupported' }
 *   { ok: false, status: 'permission_denied' }
 *   { ok: false, status: 'vapid_not_configured' }
 *   { ok: false, status: 'error', error: '...' }
 */
export async function ensureSubscribed(tenantSlug, barcodeId) {
  if (!isSupported()) return { ok: false, status: 'unsupported' };

  // 1. Permission (don't prompt unless the user clearly wants notifications —
  //    callers should only invoke this after the user toggles the switch on).
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, status: 'permission_denied' };
  }

  // 2. Service worker
  let reg;
  try {
    reg = await registerServiceWorker();
  } catch (e) {
    return { ok: false, status: 'error', error: 'sw_registration_failed: ' + (e?.message || e) };
  }

  // 3. VAPID key
  let vapidKey;
  try {
    vapidKey = await fetchVapidKey();
  } catch (e) {
    if (e.message === 'vapid_not_configured') {
      return { ok: false, status: 'vapid_not_configured' };
    }
    return { ok: false, status: 'error', error: 'vapid_fetch_failed: ' + e.message };
  }

  // 4. Subscribe (or reuse existing one)
  let subscription = await reg.pushManager.getSubscription();
  let isNew = false;
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      isNew = true;
    } catch (e) {
      return { ok: false, status: 'error', error: 'subscribe_failed: ' + (e?.message || e) };
    }
  }

  // 5. Send to backend (always — the endpoint is upserted by `endpoint`, so
  //    repeated calls are cheap and self-healing if the customer changes device).
  try {
    await api.post('/customer/push/subscribe', {
      tenant_slug: tenantSlug,
      barcode_id: barcodeId,
      subscription: subscription.toJSON(),
    });
  } catch (e) {
    return { ok: false, status: 'error', error: 'backend_register_failed: ' + (e?.message || e) };
  }

  return { ok: true, status: isNew ? 'subscribed' : 'already_subscribed' };
}

/* ---- Public: unsubscribe ----------------------------------------------- */
export async function unsubscribe(tenantSlug, barcodeId) {
  if (!isSupported()) return { ok: true };
  const reg = await registerServiceWorker().catch(() => null);
  if (!reg) return { ok: true };

  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  try {
    await api.post('/customer/push/unsubscribe', {
      tenant_slug: tenantSlug,
      barcode_id: barcodeId,
      subscription: subscription.toJSON(),
    });
  } catch (_e) { /* best-effort */ }

  try { await subscription.unsubscribe(); } catch (_e) { /* ignore */ }
  return { ok: true };
}
