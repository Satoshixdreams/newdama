export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { boardStr, playerColorName } = req.body || {};
    if (!boardStr || !playerColorName) {
      res.status(400).json({ error: 'Missing boardStr or playerColorName' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
      return;
    }

    const prompt = `
      You are an expert Checkers (Dama) coach.
      Analyze the following board state.

      Current Player: ${playerColorName}

      Board Representation ([ ] is empty, [B] is Blue, [W] is White, [BK]/[WK] are Kings):
      ${boardStr}

      Board Orientation:
      - Row 0 is top. Row 7 is bottom.
      - White starts at top (Rows 0-2) and moves DOWN (increasing row index).
      - Blue starts at bottom (Rows 5-7) and moves UP (decreasing row index).

      Task:
      Provide a very brief, strategic tip (max 2 sentences) for the ${playerColorName} player.
      Focus on controlling the center, protecting kings, or setting up a double jump if visible.
      Do not describe the board back to me. Just give the advice.
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const errText = await r.text();
      res.status(502).json({ error: 'Upstream error', details: errText });
      return;
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Watch your diagonals and focus on defense!';
    res.status(200).json({ text });
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', details: e?.message || 'unknown' });
  }
}
