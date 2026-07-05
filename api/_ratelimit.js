// Shared per-IP rate limiter for Listora's serverless endpoints.
// Underscore prefix keeps Vercel from exposing this file as a route.
// In-memory per warm instance: caps burst abuse of the Groq/Resend budget
// without adding infrastructure. Upgrade path: @upstash/ratelimit (see ApiRift).

const buckets = new Map();
const MAX_BUCKETS = 10000;

export function rateLimit(req, res, { key, limit, windowMs }) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    return false;
  }
  return true;
}
