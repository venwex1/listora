import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'trending', limit: 15, windowMs: 10 * 60 * 1000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { category } = req.body || {};
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const now = new Date();
  const month = now.getMonth() + 1;
  const seasonCtx = month >= 11 || month <= 1 ? 'Holiday/Christmas season (peak Etsy season)'
    : month >= 2 && month <= 3 ? "Valentine's Day and Spring approaching"
    : month >= 4 && month <= 5 ? 'Spring, Easter, Mother\'s Day season'
    : month >= 6 && month <= 8 ? 'Summer and back-to-school season'
    : 'Fall season, Halloween, and early holiday prep';

  try {
    const systemPrompt = `You are an Etsy trend analyst. Respond with valid JSON only. No markdown.`;

    const catCtx = category ? `Category focus: ${category}` : 'All Etsy categories';
    const userMessage = `Current season: ${seasonCtx} (Month ${month})
${catCtx}

Generate Etsy trending keyword intelligence. Return JSON:
{
  "trendingNow": [
    {
      "keyword": "string max 20 chars",
      "category": "Etsy category",
      "trendScore": 1-100,
      "momentumLabel": "🔥 Exploding|📈 Rising|⚡ Seasonal Peak|✅ Evergreen",
      "reason": "why trending right now in one sentence"
    }
  ],
  "upcomingSeasonal": [
    {
      "keyword": "string",
      "event": "holiday or occasion name",
      "daysUntil": estimated number,
      "urgency": "Act now|2-3 weeks|Next month",
      "tip": "actionable seller tip in one sentence"
    }
  ],
  "hotCategories": [
    {
      "category": "Etsy category name",
      "trend": "Up|Stable|Down",
      "topKeyword": "best keyword in this category right now"
    }
  ],
  "proTip": "one strategic tip for sellers based on current season"
}

Rules:
- trendingNow: exactly 12 trending keywords right now given the season
- upcomingSeasonal: exactly 5 upcoming opportunities in next 60-90 days
- hotCategories: exactly 6 hot categories
- Be specific to the actual current season/month`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1800,
        temperature: 0.5,
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
    if (!jsonMatch) throw new Error('Invalid AI response');
    const result = JSON.parse(jsonMatch[0]);
    result.season = seasonCtx;
    result.generatedAt = now.toISOString();
    return res.status(200).json(result);
  } catch (err) {
    console.error('Trending API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch trending data' });
  }
}
