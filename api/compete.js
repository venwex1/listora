import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'compete', limit: 10, windowMs: 10 * 60 * 1000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { productName, category, features, targetAudience, competitorTitle, competitorTags } = req.body || {};
  if (!productName || !competitorTitle) return res.status(400).json({ error: 'productName and competitorTitle are required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are an expert Etsy competitive intelligence analyst and SEO strategist. You analyze competitor listings and create superior alternatives designed to outrank and steal traffic. Always respond with valid JSON only — no markdown, no text outside JSON.`;

  const userMessage = `Perform competitive analysis and create a superior listing:

MY PRODUCT:
Name: ${productName}
${category ? `Category: ${category}` : ''}
${features ? `Features/USP: ${features}` : ''}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}

COMPETITOR'S LISTING:
Title: ${competitorTitle}
${competitorTags ? `Tags: ${competitorTags}` : ''}

Analyze the competitor's strengths and weaknesses, identify keyword gaps, and create a superior listing. Return JSON:
{
  "dominanceScore": 1-100,
  "gapAnalysis": "3-4 sentence analysis of competitor weaknesses, keyword gaps, and specific opportunities to outrank them",
  "missingKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "title": "superior title 130-140 chars that beats the competitor",
  "description": "superior 300-350 word description that addresses competitor weaknesses and targets their keyword gaps",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"]
}

Rules:
- dominanceScore: how much our product CAN dominate if using the generated listing (1=very hard, 100=easy win)
- Score based on: competitor's keyword gaps, their title weaknesses, our product's strengths
- missingKeywords: 5-8 high-value keywords the competitor uses OR misses that we should target
- title: must be 130-140 chars, incorporate competitor's best keywords PLUS their missing ones
- description: 300-350 words, naturally beat competitor by addressing what they miss
- tags: exactly 13 tags, each max 20 chars, include competitor's best-performing keywords plus gaps
- The generated listing must be objectively better than the competitor's`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.55,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq API error: ${groqRes.status}`);
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response format from AI');

    const result = JSON.parse(jsonMatch[0]);

    if (result.tags && Array.isArray(result.tags)) {
      result.tags = result.tags
        .map(t => String(t).trim().toLowerCase().slice(0, 20))
        .filter(t => t.length > 0)
        .slice(0, 13);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Compete API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze competitor' });
  }
}
