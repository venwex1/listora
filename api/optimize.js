import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'optimize', limit: 10, windowMs: 10 * 60 * 1000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { productName, category, features, targetAudience, occasion } = req.body || {};
  if (!productName || !features) return res.status(400).json({ error: 'productName and features are required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are an expert Etsy SEO copywriter who creates listings that rank #1 on Etsy search. You deeply understand Etsy's search algorithm, buyer psychology, and conversion optimization. You always respond with valid JSON only — no markdown, no text outside JSON.`;

  const userMessage = `Create an optimized Etsy listing for:
Product: ${productName}
${category ? `Category: ${category}` : ''}
Features/Materials: ${features}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}
${occasion ? `Occasion/Use: ${occasion}` : ''}

Return JSON:
{
  "titles": [
    {
      "text": "title string 130-140 chars",
      "angle": "e.g. Gift-Focused|Keyword-Heavy|Lifestyle",
      "strength": "e.g. High search volume|Emotional appeal|Long-tail niche"
    },
    {
      "text": "second title variant 130-140 chars",
      "angle": "different angle",
      "strength": "different strength"
    },
    {
      "text": "third title variant 130-140 chars",
      "angle": "different angle",
      "strength": "different strength"
    }
  ],
  "description": "Full 300-360 word Etsy description. Start with a compelling hook. Include key features, materials, dimensions if relevant, care instructions, customization options. End with a clear call to action. Naturally incorporate SEO keywords throughout. Use short paragraphs for readability.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"]
}

Rules:
- titles: exactly 3 variants, each 130-140 characters, each with a different SEO angle
- Each title must be packed with searchable keywords buyers actually use
- description: 300-360 words, no bullet points, natural flowing text with keywords
- tags: exactly 13 tags, each tag maximum 20 characters, mix of broad and specific terms
- All tags must be real buyer search phrases, no single generic words
- Prioritize high-volume Etsy search terms`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1800,
        temperature: 0.65,
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

    // Validate and fix tags
    if (result.tags && Array.isArray(result.tags)) {
      result.tags = result.tags
        .map(t => String(t).trim().toLowerCase().slice(0, 20))
        .filter(t => t.length > 0)
        .slice(0, 13);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Optimize API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate listing' });
  }
}
