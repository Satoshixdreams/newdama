export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { url, token, title, body, targetUrl } = req.body || {};
    if (!url || !token || !title || !body || !targetUrl) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    const notificationId = `${Date.now()}`;
    const payload = {
      notificationId,
      title,
      body,
      targetUrl,
      tokens: [token]
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    res.status(200).json({ ok: r.ok });
  } catch (e: any) {
    res.status(500).json({ error: 'Server error' });
  }
}
