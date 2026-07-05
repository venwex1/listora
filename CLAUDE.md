# Listora — Project Context for Claude

## What This Is
Listora is an AI-powered Etsy listing optimizer at listora.xyz.
Generates SEO titles, tags, and descriptions that rank.
Tech: vanilla HTML/CSS/JS + Vercel serverless functions (`/api/` routes).
NOT a Next.js project — pure HTML + Tailwind CDN.

Owner: Umut (umutalp8898@gmail.com)
GitHub: https://github.com/venwex1/listora
Local source: `C:\Users\Asus\Desktop\listora_v4\`

## Ethics (NON-NEGOTIABLE)
- No fake testimonials, no fake stats, no astroturfing
- Reddit comments: value-first only, always disclose being the tool maker in CTA
- Never post fake success stories or fabricated win rates
- Only comment where the comment genuinely helps the person
- All marketing must be honest and transparent

## Project Structure
```
listora_v4/
├── index.html              ← main app + landing (single file)
├── landing.html            ← standalone landing page
├── api/                    ← Vercel serverless functions
│   ├── optimize.js         ← AI listing generation
│   ├── audit.js            ← listing SEO audit
│   ├── compete.js          ← competitor analysis
│   ├── keywords.js         ← keyword research
│   ├── trending.js         ← trending keywords
│   ├── bulk.js             ← bulk optimizer
│   ├── subscribe.js        ← email capture → Resend
│   └── blog-auto.js        ← weekly Dev.to blog publisher
├── vercel.json             ← cron: blog-auto every Monday 9am
├── scripts/
│   ├── f5bot_pipeline.py   ← F5Bot → Reddit pipeline (daily 9am)
│   └── twitter_poster.py   ← Twitter/X daily poster (Mon-Fri 10am)
├── blog-drafts/
│   └── tweet-queue.md      ← 20 pre-written tweets queue
├── CLAUDE.md               ← this file
├── MARKETING.md            ← marketing strategy
├── LAUNCH_ASSETS.md        ← PH + HN launch copy
└── .env.local              ← API keys (never commit)
```

## Environment Variables (Vercel)
- `GROQ_API_KEY` — Groq API for AI generation
- `RESEND_API_KEY` — Resend for transactional email (hello@listora.xyz)
- `DEVTO_API_KEY` — Dev.to blog auto-publishing

## Design Skill Auto-Triggers
On every new HTML page or significant UI change:
1. accessibility-review (`design:accessibility-review`)
2. design-critique (`design:design-critique`)

On any new button/CTA/error/microcopy:
3. ux-copy (`design:ux-copy`)

Design tokens: `--accent:#6c5ce7`, `--grad:linear-gradient(135deg,#6c5ce7,#a29bfe,#fd79a8)`
Dark mode: `[data-theme="dark"]` on `<html>`

## Automation Systems

### F5Bot → Reddit Pipeline
Script: `scripts/f5bot_pipeline.py`
Scheduled: daily 9am via Claude scheduled task (listora-f5bot-pipeline)
F5Bot keywords monitored:
- etsy seo, etsy listing tips, etsy views, etsy sales tips
- etsy algorithm, how to rank on etsy, etsy listing help, etsy title
Allowed subreddits: etsysellers, etsy, handmade, handmadeandcraft,
  ecommerce, smallbusiness, entrepreneur, startups, crafts,
  printfulproducts, redbubble, shopify, sidehustle, workfromhome,
  digitalnomad, crafting
Deduplication file: `.listora_f5bot_seen.json`
Ethics: value-first comments only, always disclose tool maker

### Twitter/X Daily Poster
Script: `scripts/twitter_poster.py`
Queue file: `blog-drafts/tweet-queue.md`
Scheduled: Mon-Fri 10am via Claude scheduled task (listora-twitter-daily)
Posts one tweet per day from queue, marks as posted

### Dev.to Blog (Vercel Cron)
Route: `/api/blog-auto`
Schedule: every Monday 9am (`0 9 * * 1` in vercel.json)
Generates AI article with Groq → publishes to Dev.to
15 rotating Etsy SEO keywords

### Email Capture
Route: `/api/subscribe`
Sends welcome email via Resend from hello@listora.xyz
Sends notification to umutalp8898@gmail.com

## Directory Listings
- listora.xyz (live)
- peerlist.io/umutalp8898 (WORK project added)
- Uneed.best (queue #39582, free tier)
- Indie Hackers, Fazier, BetaList (wizard complete, needs $39 payment)
- Product Hunt (launched)
- Dev.to (@umutalp1) — blog auto-publishing active

## Known Issues / Deferred
- Paywall modal shows wrong message when user clicks Upgrade before hitting 7-use limit (deferred)
- ~~Footer year~~ RESOLVED 2026-07-05 by NUCLEUS: now dynamic via new Date().getFullYear()
- ~~UI accessibility (contrast/font size)~~ RESOLVED 2026-07-05 by NUCLEUS: `--muted` raised to WCAG AA (light 3.45→5.1:1, dark card 4.13→5.7:1); font floor raised to 12px (no 10/11px) in index.html + landing.html. Uppercase eyebrow labels kept (intentional). Full visual polish still recommended in a dedicated design session.

---

## NUCLEUS — Üst El (şirket koordinasyonu)

Bu projede çalışan bir Claude oturumusun — tek başına asistan değil, bir şirketin
çalışanısın. Üst hafıza ve ortak vizyon: `C:\Users\Asus\Desktop\Nucleus\`

**BAŞLARKEN (zorunlu):**
1. `..\Nucleus\VISION.md` oku — şirketin kuzey yıldızı, içselleştir.
2. `..\Nucleus\protocols\session-start.md` uygula (OPERATING_SYSTEM, registry'de bu proje,
   decisions-log'daki son değişiklikler, conventions).

**ÇALIŞIRKEN:** En zor ama en doğru yolu seç; "kolay olduğu için" asla. Bitmiş = doğrulanmış.
Otonomi: fark et → karar ver → uygula → günlüğe yaz. Riskli/geri dönüşsüz kararda kurucuya danış.

**BİTİRİRKEN (zorunlu):**
3. `..\Nucleus\protocols\session-end.md` uygula — değişikliğini
   `..\Nucleus\memory\decisions-log.md`'ye yaz ki diğer menüler/projeler öğrensin.

Bu proje: **Listora (Etsy optimizer)**. Rol/model: işe göre Fable5/Sonnet5.
