import { customerAPI } from './api';

export const isPushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// Returns: 'unsupported' | 'denied' | 'subscribed' | 'default'
export async function getPushStatus() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'default';
  } catch {
    return 'default';
  }
}

export async function enablePush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await customerAPI.getVapidKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    });
  }
  await customerAPI.subscribePush(sub.toJSON());
  return { ok: true };
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await customerAPI.unsubscribePush(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    // ignore
  }
  return { ok: true };
}

// Silent re-sync: if permission already granted + subscribed, push the subscription to backend
export async function syncPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await customerAPI.subscribePush(sub.toJSON());
  } catch {
    // ignore
  }
}
