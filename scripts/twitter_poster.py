"""
Listora — Twitter/X Daily Poster
=================================
Posts one tweet per day from blog-drafts/tweet-queue.md.
Marks tweets as posted so they're never repeated.

Setup:
1. Create a Twitter Developer account at developer.twitter.com
2. Create an app, get API credentials
3. Add credentials to .env.local
4. Schedule this script to run Mon-Fri at 10am

Requirements:
    pip install tweepy python-dotenv
"""

import os
import re
import random
import logging
from pathlib import Path
from datetime import datetime

try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False
    print("tweepy not installed. Run: pip install tweepy python-dotenv")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env.local")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("listora-twitter")

# ─── CONFIG ────────────────────────────────────────────────────────────────────

TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN", "")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "")

QUEUE_FILE = Path(__file__).parent.parent / "blog-drafts" / "tweet-queue.md"

# ─── QUEUE PARSING ─────────────────────────────────────────────────────────────

def load_queue() -> list[dict]:
    """
    Parse tweet-queue.md.
    Format:
        ## Tweet N
        [POSTED 2025-06-20] (optional, marks as done)
        Tweet text here...

        ---
    """
    if not QUEUE_FILE.exists():
        log.error(f"Queue file not found: {QUEUE_FILE}")
        return []

    content = QUEUE_FILE.read_text(encoding="utf-8")
    tweets = []

    # Split on tweet separators
    blocks = re.split(r'\n---\n', content)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Check if posted
        posted = bool(re.search(r'\[POSTED', block))

        # Extract tweet index
        num_match = re.search(r'##\s*Tweet\s*(\d+)', block)
        num = int(num_match.group(1)) if num_match else 0

        # Extract text (everything after the ## Tweet N line and optional [POSTED] marker)
        text = re.sub(r'##\s*Tweet\s*\d+\s*\n', '', block)
        text = re.sub(r'\[POSTED[^\]]*\]\s*\n?', '', text)
        text = text.strip()

        if text:
            tweets.append({"num": num, "text": text, "posted": posted, "raw_block": block})

    return tweets

def mark_as_posted(tweet: dict):
    """Update tweet-queue.md to mark a tweet as posted."""
    content = QUEUE_FILE.read_text(encoding="utf-8")
    date_str = datetime.now().strftime("%Y-%m-%d")

    # Replace the tweet block's header to add [POSTED date]
    old_header = f"## Tweet {tweet['num']}"
    new_header = f"## Tweet {tweet['num']}\n[POSTED {date_str}]"

    content = content.replace(old_header, new_header, 1)
    QUEUE_FILE.write_text(content, encoding="utf-8")
    log.info(f"Marked Tweet {tweet['num']} as posted")

def get_next_tweet(tweets: list[dict]) -> dict | None:
    """Get the next unposted tweet."""
    pending = [t for t in tweets if not t["posted"] and t["text"]]
    if not pending:
        log.warning("All tweets in queue have been posted!")
        return None
    return pending[0]

# ─── POSTING ───────────────────────────────────────────────────────────────────

def post_tweet(text: str) -> bool:
    """Post a tweet using Twitter API v2."""
    if not TWEEPY_AVAILABLE:
        log.error("tweepy not installed")
        return False

    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET]):
        log.error("Twitter credentials not configured in .env.local")
        log.error("Required: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET")
        return False

    try:
        client = tweepy.Client(
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET,
            access_token=TWITTER_ACCESS_TOKEN,
            access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
        )

        response = client.create_tweet(text=text)
        tweet_id = response.data["id"]
        log.info(f"✓ Posted tweet {tweet_id}")
        log.info(f"  Preview: {text[:100]}...")
        return True

    except tweepy.TweepyException as e:
        log.error(f"Twitter API error: {e}")
        return False

# ─── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=== Listora Twitter Poster starting ===")

    # Skip weekends
    if datetime.now().weekday() >= 5:
        log.info("Weekend — skipping")
        return

    tweets = load_queue()
    if not tweets:
        log.error("No tweets found in queue")
        return

    pending_count = sum(1 for t in tweets if not t["posted"])
    log.info(f"Queue: {len(tweets)} total, {pending_count} pending")

    # Queue-low early warning: leave a machine-readable status file that the
    # Nucleus daily orchestrator checks (threshold: <5 pending -> refill).
    try:
        import json as _json
        status = {
            "checked_at": datetime.now().isoformat(timespec="seconds"),
            "total": len(tweets),
            "pending": pending_count,
            "queue_low": pending_count < 5,
        }
        (QUEUE_FILE.parent / "queue_status.json").write_text(_json.dumps(status, indent=2), encoding="utf-8")
        if pending_count < 5:
            log.warning(f"QUEUE LOW: only {pending_count} tweets left - refill blog-drafts/tweet-queue.md")
    except Exception as e:
        log.warning(f"Could not write queue status: {e}")

    tweet = get_next_tweet(tweets)
    if not tweet:
        log.warning("No pending tweets. Refill tweet-queue.md")
        return

    log.info(f"Posting Tweet {tweet['num']}: {tweet['text'][:80]}...")

    success = post_tweet(tweet["text"])
    if success:
        mark_as_posted(tweet)
        log.info("=== Done ===")
    else:
        log.error("Tweet failed — not marking as posted")

if __name__ == "__main__":
    main()
