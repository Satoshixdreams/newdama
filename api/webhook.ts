import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  try {
    const event = req.body || {};
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
}
