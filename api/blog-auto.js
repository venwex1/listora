const KEYWORDS = [
  "etsy listing optimization tips",
  "how to write etsy titles that sell",
  "etsy seo guide for beginners",
  "etsy tags strategy guide",
  "how to rank higher on etsy search",
  "etsy description writing tips",
  "etsy keyword research guide",
  "etsy shop optimization checklist",
  "how to get more etsy sales",
  "etsy competitor analysis tips",
  "etsy product photography tips for more sales",
  "etsy pricing strategy guide",
  "how to use etsy ads effectively",
  "etsy shop branding tips",
  "etsy shipping tips for sellers",
];

async function generateArticle(keyword) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an expert content writer specializing in Etsy SEO. Write helpful, practical blog articles for Etsy sellers. Always respond with valid JSON only, no extra text.",
        },
        {
          role: "user",
          content: `Write a blog article about: "${keyword}"

CRITICAL FORMATTING RULES:
- Every ## heading MUST be on its own separate line
- There MUST be a blank line before and after every ## heading
- Never put a ## heading on the same line as any other text
- Use this exact pattern: [content]\n\n## Heading\n\n[content]

Return ONLY a valid JSON object (no markdown fences, no extra text):
{
  "title": "SEO article title (50-60 chars)",
  "tags": ["etsy", "seo", "ecommerce", "smallbusiness"],
  "body_markdown": "Full article in Markdown, 800-1000 words. Each section starts with a ## heading on its own line with blank lines before and after. End with a natural mention of Listora (listora.xyz)."
}`,
        },
      ],
    }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error("Groq non-JSON: " + text.slice(0, 300)); }
  if (!data.choices?.[0]?.message?.content) throw new Error("Groq empty: " + JSON.stringify(data).slice(0, 300));

  const raw = data.choices[0].message.content.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Groq output: " + raw.slice(0, 300));
  // Sanitize control characters inside JSON strings (literal newlines → \n)
  const sanitized = match[0].replace(
    /"((?:[^"\\]|\\.)*)"/g,
    (_, inner) => '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
  );
  return JSON.parse(sanitized);
}

async function publishToDevTo(article) {
  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.DEVTO_API_KEY,
    },
    body: JSON.stringify({
      article: {
        title: article.title,
        body_markdown: (() => {
          // Split on heading markers, reassemble with guaranteed blank lines
          const md = article.body_markdown;
          const parts = md.split(/(#{1,3} [^\n]+)/g);
          return parts
            .map((part, i) => i % 2 === 1 ? '\n\n' + part + '\n\n' : part)
            .join('')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        })(),
        published: true,
        tags: article.tags,
      },
    }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error("Dev.to non-JSON: " + text.slice(0, 300)); }
  if (data.error) throw new Error("Dev.to error: " + data.error);
  return { url: data.url, title: data.title };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel sends "Authorization: Bearer <CRON_SECRET>" on cron invocations
  // when the CRON_SECRET env var is set. Without this check, anyone who
  // finds the URL can publish articles to Dev.to under our name.
  if (process.env.CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    console.warn("blog-auto: CRON_SECRET not set - endpoint is publicly triggerable. Set CRON_SECRET in Vercel env.");
  }

  if (!process.env.GROQ_API_KEY || !process.env.DEVTO_API_KEY) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  try {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const keyword = KEYWORDS[dayOfYear % KEYWORDS.length];

    const article = await generateArticle(keyword);
    const post = await publishToDevTo(article);

    return res.status(200).json({ success: true, keyword, title: post.title, url: post.url });
  } catch (err) {
    console.error("blog-auto error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}