// این کلاس یک "اتاق" واحده که همه‌ی اتصالات WebSocket مرورگرها رو نگه می‌داره
// و دیتای دریافتی از ESP8266 رو به همه‌ی اونا پخش می‌کنه.
export class EcgRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Set();
    this.lastSeen = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // ---------- درخواست ارتقا به WebSocket (از مرورگر) ----------
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      this.sessions.add(server);

      server.addEventListener('close', () => this.sessions.delete(server));
      server.addEventListener('error', () => this.sessions.delete(server));

      return new Response(null, { status: 101, webSocket: client });
    }

    // ---------- دریافت دیتای ECG (از ESP8266، فوروارد شده توسط worker.js) ----------
    if (url.pathname === '/ecg' && request.method === 'POST') {
      let data;
      try {
        data = await request.json();
      } catch (err) {
        return new Response(JSON.stringify({ error: 'JSON نامعتبر است' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!Array.isArray(data.samples)) {
        return new Response(JSON.stringify({ error: 'فرمت داده نامعتبر است' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      this.lastSeen = Date.now();

      const payload = JSON.stringify({
        type: 'ecg_batch',
        device_id: data.device_id,
        sample_rate: data.sample_rate,
        lead_off: data.lead_off,
        device_millis: data.millis,
        samples: data.samples,
        server_time: this.lastSeen
      });

      // پخش به همه‌ی مرورگرهای متصل
      for (const ws of this.sessions) {
        try {
          ws.send(payload);
        } catch (err) {
          this.sessions.delete(ws);
        }
      }

      return new Response(JSON.stringify({ status: 'ok', received: data.samples.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---------- وضعیت سلامت سرور ----------
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        lastSeen: this.lastSeen,
        secondsSinceLastData: this.lastSeen ? Math.round((Date.now() - this.lastSeen) / 1000) : null,
        connectedClients: this.sessions.size
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
}
