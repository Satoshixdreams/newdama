export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const hostedUrl = process.env.FARC_HOSTED_MANIFEST_URL;

  if (hostedUrl && /^https?:\/\//.test(hostedUrl)) {
    res.status(307);
    res.setHeader('Location', hostedUrl);
    res.end();
    return;
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const manifestPath = path.join(process.cwd(), 'public', '.well-known', 'farcaster.json');
    const body = fs.readFileSync(manifestPath);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(body);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Manifest not found and hosted URL not set' });
  }
}

