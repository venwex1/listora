import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'audit', limit: 10, windowMs: 10 * 60 * 1000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, description, tags, productName, category } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are an expert Etsy SEO auditor with deep knowledge of Etsy's search algorithm. You analyze listings and provide precise, actionable scores and improvements. Always respond with valid JSON only — no markdown, no text outside JSON.`;

  const userMessage = `Audit this Etsy listing for SEO quality:

Title: ${title}
Description: ${description}
Tags: ${tags || 'none provided'}
${productName ? `Product: ${productName}` : ''}
${category ? `Category: ${category}` : ''}

Analyze thoroughly and return JSON:
{
  "score": overall score 0-100,
  "grade": "A+|A|B|C|D|F",
  "titleScore": 0-100,
  "descScore": 0-100,
  "tagsScore": 0-100,
  "wordCount": actual word count of description,
  "issues": [
    "specific issue 1 with actionable fix",
    "specific issue 2 with actionable fix"
  ],
  "missedKeywords": ["keyword1", "keyword2", "keyword3"],
  "improvedTitle": "improved title 130-140 chars with better keywords",
  "improvedDescription": "improved 300-350 word description with better SEO",
  "improvedTags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"]
}

Scoring rules:
- titleScore: 100 if 130-140 chars with strong keywords; deduct for short title, weak keywords, no buyer intent
- descScore: 100 if 300+ words with keywords naturally placed; deduct for short, keyword-stuffed, no hook
- tagsScore: 100 if 13 tags all <= 20 chars with real search phrases; deduct for missing tags, too generic, over 20 chars
- overall score: weighted average (title 35%, desc 35%, tags 30%)
- grade: A+ (95-100), A (85-94), B (70-84), C (55-69), D (40-54), F (below 40)
- issues: list 3-6 specific problems found, each with a concrete fix suggestion
- missedKeywords: 4-8 high-value keywords missing from the listing
- improvedTitle: must be 130-140 chars
- improvedTags: exactly 13 tags, each max 20 chars`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2200,
        temperature: 0.3,
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

    if (result.improvedTags && Array.isArray(result.improvedTags)) {
      result.improvedTags = result.improvedTags
        .map(t => String(t).trim().toLowerCase().slice(0, 20))
        .filter(t => t.length > 0)
        .slice(0, 13);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Audit API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to audit listing' });
  }
}
