"""
Listora — F5Bot → Gmail → Reddit Pipeline
==========================================
Monitors F5Bot email alerts for Etsy-related Reddit posts,
then posts value-first comments that naturally mention Listora.

Setup:
1. Register at f5bot.com with your Gmail
2. Add keywords: etsy seo, etsy listing tips, etsy views,
   etsy sales tips, etsy algorithm, how to rank on etsy,
   etsy listing help, etsy title
3. Set F5Bot to send alerts to your Gmail
4. Add credentials to .env.local
5. Schedule this script to run daily at 9am

ETHICS (NON-NEGOTIABLE):
- Never post if the comment wouldn't genuinely help the person
- Always disclose being the tool maker when mentioning Listora
- Never post more than once per Reddit post
- Value first, Listora second
"""

import os
import json
import time
import random
import imaplib
import email
import re
import logging
from datetime import datetime, timedelta
from email.header import decode_header
from pathlib import Path

# Optional: pip install praw python-dotenv
try:
    import praw
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False
    print("praw not installed. Run: pip install praw")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env.local")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("listora-f5bot")

# ─── CONFIG ────────────────────────────────────────────────────────────────────

GMAIL_USER = os.getenv("GMAIL_USER", "umutalp8898@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")  # Gmail App Password (not regular password)

REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USERNAME = os.getenv("REDDIT_USERNAME", "")
REDDIT_PASSWORD = os.getenv("REDDIT_PASSWORD", "")
REDDIT_USER_AGENT = "Listora:f5bot-pipeline:v1.0 (by /u/{})".format(os.getenv("REDDIT_USERNAME", "listoraetsy"))

SEEN_FILE = Path(__file__).parent.parent / ".listora_f5bot_seen.json"

# Subreddits where we're allowed to comment (value-first, not spam)
ALLOWED_SUBS = [
    'etsysellers', 'etsy', 'handmade', 'handmadeandcraft',
    'ecommerce', 'smallbusiness', 'entrepreneur', 'startups',
    'crafts', 'printfulproducts', 'redbubble', 'shopify',
    'sidehustle', 'workfromhome', 'digitalnomad', 'crafting',
]

# Subreddits where self-promotion is never appropriate
BLOCKED_SUBS = ['etsypromos', 'etsysellersads']

# ─── COMMENT TEMPLATES ─────────────────────────────────────────────────────────

TEMPLATES = {
    "etsy_seo": [
        """The Etsy algorithm (their search ranking system) cares most about 3 things: title relevance, tag completeness, and listing quality score.

What actually moves the needle:

1. **First 40 characters of your title** are what buyers see in search. Lead with the most searchable phrase, not your brand name.
2. **Use all 13 tags** — each one is a separate search path into your listing. Use long-tail phrases (3-4 words), not single keywords like "necklace."
3. **Repeat your top 2-3 keywords** across title, tags, AND the first paragraph of your description. Etsy cross-references these for relevance.
4. **Don't keyword-stuff** — Etsy's algorithm can detect listings that read as spam and penalizes them.

One thing I've noticed: most sellers either use 5-6 tags and leave the rest blank, or they repeat the same word in different tags (like "necklace," "necklaces," "silver necklace" as 3 separate tags). Both hurt your reach significantly.

I actually built a free tool called Listora (listora.xyz) that generates optimized titles + all 13 tags for you — I'm the maker. Worth trying if you want to see what the AI suggests for your specific product.""",

        """Etsy SEO comes down to one thing: matching what buyers actually type into the search bar, not how you'd describe your product.

The most common mistake: sellers name their product what *they* call it, not what *buyers* search for. A "boho macramé wall hanging" might be how you'd describe it, but buyers search "large wall decor for living room" or "bohemian bedroom decoration."

Quick wins that work:
- Type your main keyword into Etsy search and look at the autocomplete suggestions — those are real buyer searches
- Use those autocomplete phrases as your tags (each tag = one autocomplete phrase)
- Front-load your title with the highest-volume phrase, then add secondary descriptors

For deeper keyword research, eRank has a free tier that shows real search volume. I also built Listora (listora.xyz) which generates complete optimized listings — I'm the maker, free to try.""",
    ],

    "etsy_views": [
        """Low views on Etsy almost always come down to one thing: the algorithm can't match your listing to what buyers are actually searching for.

The fix is usually in your title structure:
- **Lead with the search term** buyers use, not what you call the product internally
- Check Etsy search suggestions — type your main keyword and see what autocompletes. Those are real buyer searches.
- Use those exact autocomplete phrases in your title and tags

Quick diagnostic:
- **Zero views**: keyword/title issue. Your listing isn't appearing for relevant searches.
- **Views but no sales**: photo or pricing issue. The algorithm is finding you, but buyers aren't converting.
- **Some views, declining**: you may have ranked briefly but your conversion rate is signaling to Etsy that buyers aren't satisfied

What category/niche is your product? Happy to give more specific advice.""",
    ],

    "etsy_sales": [
        """The gap between views and sales is almost always one of three things: photos, pricing, or trust signals.

**If you're getting views but no sales:**
- Your main thumbnail might not be stopping the scroll. Test a different angle or lifestyle photo as the cover image.
- Price comparison: are you within 20% of what comparable listings charge? Etsy buyers comparison-shop heavily.
- Reviews: if you have fewer than 5 reviews, many buyers won't take the risk. Consider offering a small discount to your first few buyers in exchange for honest feedback.

**If you're getting zero views:**
- That's purely an SEO problem — your listing isn't matching buyer searches
- Rewrite your title: first 40 chars are what shows in search results. Lead with what buyers search, not your product name.

Which situation are you in — zero views, or views but no purchases?""",
    ],

    "etsy_algorithm": [
        """Etsy's search algorithm (often called Cassini internally) ranks listings based on several signals:

**Relevance signals** (what you can control):
- Title: first 40 chars weighted most heavily
- Tags: all 13 should be unique long-tail phrases
- Attributes: fill in every attribute field — material, color, occasion, etc.
- Description: repeat your 2-3 main keywords in the first paragraph

**Quality signals** (built over time):
- Conversion rate: how many people who click actually buy
- Recency: new and recently-renewed listings get a temporary boost
- Shop quality: reviews, completed policies, shipping accuracy

The biggest controllable lever is usually tag completeness + title relevance. Most sellers leave 3-4 tags empty or repeat the same keyword across multiple tags (which wastes those slots).

I built Listora (listora.xyz) — free AI tool that optimizes titles and generates all 13 unique tags. I'm the maker. Might be worth a look if you want to see the AI's take on your specific listing.""",
    ],
}

def get_template(keyword: str) -> str:
    """Select the appropriate comment template based on the F5Bot keyword."""
    kw = keyword.lower()
    if any(x in kw for x in ["seo", "listing tips", "listing help", "rank", "title", "how to rank"]):
        templates = TEMPLATES["etsy_seo"]
    elif "views" in kw:
        templates = TEMPLATES["etsy_views"]
    elif "sales" in kw:
        templates = TEMPLATES["etsy_sales"]
    elif "algorithm" in kw:
        templates = TEMPLATES["etsy_algorithm"]
    else:
        templates = TEMPLATES["etsy_seo"]

    return random.choice(templates)

# ─── SEEN POST TRACKING ────────────────────────────────────────────────────────

def load_seen() -> set:
    if SEEN_FILE.exists():
        try:
            return set(json.loads(SEEN_FILE.read_text()))
        except Exception:
            return set()
    return set()

def save_seen(seen: set):
    SEEN_FILE.write_text(json.dumps(list(seen), indent=2))

# ─── GMAIL PARSING ─────────────────────────────────────────────────────────────

def fetch_f5bot_alerts() -> list[dict]:
    """Connect to Gmail via IMAP, find unread F5Bot emails, parse Reddit URLs."""
    if not GMAIL_APP_PASSWORD:
        log.warning("GMAIL_APP_PASSWORD not set — skipping email fetch")
        return []

    alerts = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        mail.select("inbox")

        # Search for unread F5Bot emails from the last 48 hours
        since = (datetime.now() - timedelta(days=2)).strftime("%d-%b-%Y")
        _, data = mail.search(None, f'(FROM "f5bot" UNSEEN SINCE {since})')

        email_ids = data[0].split()
        log.info(f"Found {len(email_ids)} unread F5Bot emails")

        for eid in email_ids:
            _, msg_data = mail.fetch(eid, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])

            # Get email body
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

            # Extract Reddit post URLs and matched keywords
            reddit_urls = re.findall(r'https://(?:www\.)?reddit\.com/r/\w+/comments/\w+/[^\s\n"<]+', body)
            keywords = re.findall(r'matched keyword[:\s]+([^\n]+)', body, re.IGNORECASE)

            for url in reddit_urls:
                # Clean URL (remove trailing slashes, query params)
                url = url.rstrip('/').split('?')[0]
                keyword = keywords[0].strip() if keywords else "etsy seo"
                alerts.append({"url": url, "keyword": keyword})

            # Mark as read
            mail.store(eid, '+FLAGS', '\\Seen')

        mail.close()
        mail.logout()

    except Exception as e:
        log.error(f"Gmail error: {e}")

    return alerts

# ─── REDDIT COMMENTING ─────────────────────────────────────────────────────────

def should_comment(submission) -> tuple[bool, str]:
    """
    Decide if we should comment on this post.
    Returns (should_comment, reason_if_not).
    """
    sub = submission.subreddit.display_name.lower()

    if sub in BLOCKED_SUBS:
        return False, f"subreddit {sub} is blocked"

    if sub not in ALLOWED_SUBS:
        return False, f"subreddit {sub} not in allowlist"

    # Don't comment if post is archived or locked
    if submission.archived:
        return False, "post is archived"
    if submission.locked:
        return False, "post is locked"

    # Don't comment on posts older than 3 days
    post_age = datetime.utcnow() - datetime.utcfromtimestamp(submission.created_utc)
    if post_age.days > 3:
        return False, f"post is {post_age.days} days old"

    # Don't comment if we've already commented
    submission.comments.replace_more(limit=0)
    for comment in submission.comments.list():
        if hasattr(comment, 'author') and comment.author:
            if comment.author.name.lower() == REDDIT_USERNAME.lower():
                return False, "already commented on this post"

    return True, ""

def post_comment(reddit, alert: dict, seen: set) -> bool:
    """Post a value-first comment on a Reddit post."""
    url = alert["url"]
    keyword = alert["keyword"]

    # Extract post ID from URL
    match = re.search(r'/comments/(\w+)/', url)
    if not match:
        log.warning(f"Could not extract post ID from {url}")
        return False

    post_id = match.group(1)

    if post_id in seen:
        log.info(f"Already processed post {post_id} — skipping")
        return False

    try:
        submission = reddit.submission(id=post_id)
        should, reason = should_comment(submission)

        if not should:
            log.info(f"Skipping {post_id}: {reason}")
            seen.add(post_id)
            return False

        comment_text = get_template(keyword)

        log.info(f"Commenting on: {submission.title[:60]}...")
        submission.reply(comment_text)

        seen.add(post_id)
        log.info(f"✓ Commented on post {post_id} in r/{submission.subreddit.display_name}")

        # Rate limit: wait 10-20 seconds between comments
        time.sleep(random.uniform(10, 20))
        return True

    except Exception as e:
        log.error(f"Error commenting on {post_id}: {e}")
        seen.add(post_id)  # Mark as seen even on error to avoid retrying
        return False

# ─── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=== Listora F5Bot Pipeline starting ===")

    if not PRAW_AVAILABLE:
        log.error("praw not installed. Run: pip install praw python-dotenv")
        return

    if not all([REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD]):
        log.error("Reddit credentials not set in .env.local")
        log.error("Required: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD")
        return

    seen = load_seen()
    log.info(f"Loaded {len(seen)} previously seen posts")

    # Fetch F5Bot email alerts
    alerts = fetch_f5bot_alerts()
    log.info(f"Found {len(alerts)} Reddit posts to process")

    if not alerts:
        log.info("No new alerts — done")
        return

    # Initialize Reddit client
    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        username=REDDIT_USERNAME,
        password=REDDIT_PASSWORD,
        user_agent=REDDIT_USER_AGENT,
    )

    commented = 0
    for alert in alerts:
        if post_comment(reddit, alert, seen):
            commented += 1
        # Max 5 comments per run to avoid appearing spammy
        if commented >= 5:
            log.info("Reached 5-comment limit for this run")
            break

    save_seen(seen)
    log.info(f"=== Done: {commented} comments posted ===")

    # Machine-readable run status so the Nucleus orchestrator can detect
    # silent failures (a run that never writes this file is a failed run).
    try:
        import json as _json
        from pathlib import Path as _Path
        from datetime import datetime as _dt
        _Path(__file__).parent.parent.joinpath("blog-drafts", "f5bot_status.json").write_text(
            _json.dumps({
                "run_at": _dt.now().isoformat(timespec="seconds"),
                "alerts_processed": len(alerts),
                "comments_posted": commented,
            }, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        log.warning(f"Could not write run status: {e}")

if __name__ == "__main__":
    main()
