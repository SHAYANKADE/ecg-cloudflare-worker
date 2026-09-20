import { EcgRoom } from './ecgRoom.js';

// Durable Object باید از همین فایل اصلی هم export بشه تا wrangler بشناسدش
export { EcgRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // فقط یک اتاق (instance) داریم چون یک دستگاه/استریم داریم
    const id = env.ECG_ROOM.idFromName('main');
    const room = env.ECG_ROOM.get(id);

    // درخواست WebSocket از مرورگر → مستقیم به Durable Object
    if (url.pathname === '/ws') {
      return room.fetch(request);
    }

    // دیتای POST شده از ESP8266 → فوروارد به Durable Object برای broadcast
    if (url.pathname === '/ecg' && request.method === 'POST') {
      return room.fetch(new Request('https://internal/ecg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: request.body
      }));
    }

    // وضعیت سلامت
    if (url.pathname === '/health') {
      return room.fetch(new Request('https://internal/health'));
    }

    // بقیه‌ی مسیرها: فایل‌های استاتیک (index.html, style.css, app.js)
    return env.ASSETS.fetch(request);
  }
};
