import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'keywords', limit: 15, windowMs: 10 * 60 * 1000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, category } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query is required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    // 1. Fetch Google autocomplete suggestions (etsy-specific)
    let googleSuggestions = [];
    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 4000);
      const googleRes = await fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent('etsy ' + query)}&hl=en`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Listora/1.0)' }, signal: ac.signal }
      );
      clearTimeout(timeout);
      if (googleRes.ok) {
        const data = await googleRes.json();
        const raw = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
        googleSuggestions = raw
          .map(s => s.replace(/^etsy\s+/i, '').trim())
          .filter(s => s.length > 2 && s.length <= 40)
          .slice(0, 12);
      }
    } catch (_) { /* fallback to AI-only */ }

    const categoryCtx = category ? ` for the "${category}" category` : '';
    const googleCtx = googleSuggestions.length > 0
      ? `\nReal search suggestions from Google for Etsy buyers:\n${googleSuggestions.map((s, i) => `${i + 1}. "${s}"`).join('\n')}\n`
      : '';

    const systemPrompt = `You are an expert Etsy SEO analyst. Always respond with valid JSON only. No markdown, no explanation outside JSON.`;

    const userMessage = `Analyze keywords for an Etsy product: "${query}"${categoryCtx}
${googleCtx}
Return JSON:
{
  "primaryKeywords": [
    {
      "keyword": "string max 20 chars",
      "volumeEstimate": "High|Medium|Low",
      "volumeScore": 1-100,
      "competition": "High|Medium|Low",
      "competitionScore": 1-100,
      "trend": "Rising|Stable|Declining",
      "opportunity": "High|Medium|Low",
      "reason": "one sentence why this keyword matters"
    }
  ],
  "longTailKeywords": [
    {
      "keyword": "longer buyer-intent phrase 20-40 chars",
      "volumeEstimate": "High|Medium|Low",
      "volumeScore": 1-100,
      "competition": "High|Medium|Low",
      "competitionScore": 1-100,
      "trend": "Rising|Stable|Declining",
      "opportunity": "High|Medium|Low",
      "reason": "one sentence"
    }
  ],
  "seasonalKeywords": [
    {
      "keyword": "string",
      "season": "Christmas|Valentine|Summer|Halloween|Mother's Day|All year",
      "peakMonths": "e.g. Oct-Dec",
      "volumeScore": 1-100,
      "trend": "Rising|Stable|Declining"
    }
  ],
  "insight": "2-3 sentence strategic insight about this niche",
  "topOpportunity": "The single best keyword opportunity with explanation"
}

Rules:
- primaryKeywords: exactly 10 keywords, all <= 20 chars (Etsy tag limit), ordered by opportunity score
- longTailKeywords: exactly 8 keywords, 20-40 chars, specific buyer-intent phrases
- seasonalKeywords: exactly 5 seasonal keywords
- Be realistic with scores (top searches: 80-100, niche: 20-50)
- High opportunity = decent volume + low-medium competition`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq error ${groqRes.status}`);
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');
    const result = JSON.parse(jsonMatch[0]);

    result.dataSource = googleSuggestions.length > 0 ? 'Google Search Data + AI Analysis' : 'AI Analysis';
    result.queriedAt = new Date().toISOString();
    result.googleSuggestions = googleSuggestions;

    return res.status(200).json(result);
  } catch (err) {
    console.error('Keywords API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze keywords' });
  }
}
