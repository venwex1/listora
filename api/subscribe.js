import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'subscribe', limit: 3, windowMs: 10 * 60 * 1000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  const OWNER_EMAIL = 'umutalp8898@gmail.com';
  const FROM = 'Listora <hello@listora.xyz>';

  try {
    // 1. Welcome email to subscriber
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: 'Welcome to Listora ✦ — Your free optimizations are ready',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e2dfff;overflow:hidden;box-shadow:0 4px 24px rgba(108,92,231,.10)">
    <div style="background:linear-gradient(135deg,#6c5ce7 0%,#a29bfe 50%,#fd79a8 100%);padding:36px 32px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px">✦ Listora</div>
      <div style="color:rgba(255,255,255,.85);font-size:14px;margin-top:6px">AI Etsy Listing Optimizer</div>
    </div>
    <div style="padding:36px 32px">
      <h1 style="font-size:22px;font-weight:800;color:#1a1535;margin:0 0 12px;letter-spacing:-.5px">Welcome! Your free uses are ready ✦</h1>
      <p style="font-size:15px;color:#4b4575;line-height:1.65;margin:0 0 20px">You have <strong>7 free optimizations</strong> to try every feature — Generate, Audit, Compete, Research, and Bulk. No credit card needed.</p>
      <div style="background:#f5f4fe;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:13px;font-weight:700;color:#8b85b0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">What you can do:</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="font-size:14px;color:#4b4575">✦ <strong>Generate</strong> — 3 AI title variants + full description + 13 tags</div>
          <div style="font-size:14px;color:#4b4575">🔍 <strong>Research</strong> — Real keyword data with volume &amp; competition scores</div>
          <div style="font-size:14px;color:#4b4575">📊 <strong>Audit</strong> — SEO score + issue report + improved version</div>
          <div style="font-size:14px;color:#4b4575">⚔️ <strong>Compete</strong> — Analyze competitors and outrank them</div>
          <div style="font-size:14px;color:#4b4575">⚡ <strong>Bulk</strong> — Optimize up to 20 listings at once</div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <a href="https://listora.xyz" style="display:inline-block;background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 16px rgba(108,92,231,.3)">Start Optimizing →</a>
      </div>
      <p style="font-size:13px;color:#8b85b0;line-height:1.6;margin:0">Questions? Reply to this email — we read every one.<br>You're receiving this because you signed up at listora.xyz.</p>
    </div>
    <div style="background:#f5f4fe;padding:16px 32px;text-align:center;border-top:1px solid #e2dfff">
      <div style="font-size:12px;color:#8b85b0">© 2026 Listora · <a href="mailto:hello@listora.xyz" style="color:#6c5ce7">hello@listora.xyz</a></div>
    </div>
  </div>
</body>
</html>`
      })
    });

    // 2. Notification email to owner
    const safeEmail = email.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [OWNER_EMAIL],
        subject: `🎉 New Listora subscriber: ${email}`,
        html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
          <h2 style="color:#6c5ce7">✦ New subscriber!</h2>
          <p style="font-size:16px">Email: <strong>${safeEmail}</strong></p>
          <p style="font-size:14px;color:#666">Signed up at: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
        </div>`
      })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
