/**
 * LinkedIn Scraper Script
 *
 * Usage:
 *   npx tsx scripts/scrape-linkedin.ts              # One-shot scrape
 *   npx tsx scripts/scrape-linkedin.ts --cron       # Run on schedule (default 8am daily)
 *   npx tsx scripts/scrape-linkedin.ts --login      # Force visible browser for login
 *
 * First run opens a visible browser for manual LinkedIn login.
 * Subsequent runs use saved cookies headlessly.
 */

import { chromium, type BrowserContext } from "playwright";
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

const DATA_DIR = join(process.cwd(), "data");
const SESSION_FILE = join(DATA_DIR, "linkedin-session.json");
const LOG_FILE = join(DATA_DIR, "scraper.log");

function log(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // ignore
  }
}

async function notify(title: string, message: string) {
  try {
    const notifier = await import("node-notifier");
    notifier.default.notify({ title, message });
  } catch {
    log(`Notification: ${title} - ${message}`);
  }
}

function hasSavedSession(): boolean {
  return existsSync(SESSION_FILE);
}

function loadCookies(): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
}> {
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveCookies(
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }>
) {
  writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  log(`Saved ${cookies.length} cookies to ${SESSION_FILE}`);
}

async function createAuthenticatedContext(forceLogin: boolean) {
  if (!forceLogin && hasSavedSession()) {
    // Headless with saved cookies
    log("Using saved session (headless)");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const cookies = loadCookies();
    await context.addCookies(cookies);
    return { browser, context };
  }

  // Visible browser for manual login
  log("Opening visible browser for LinkedIn login...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  if (hasSavedSession()) {
    const cookies = loadCookies();
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  await page.goto("https://www.linkedin.com/login");

  log("Please log in to LinkedIn in the browser window.");
  log("The script will continue automatically once logged in.");

  // Wait for navigation to the feed (indicates successful login)
  try {
    await page.waitForURL("**/feed/**", { timeout: 120000 });
    log("Login detected. Saving session...");
  } catch {
    log("Login timeout. Trying to continue anyway...");
  }

  const cookies = await context.cookies();
  saveCookies(cookies);
  await page.close();

  return { browser, context };
}

async function scrapeFollowerCount(context: BrowserContext): Promise<number | null> {
  const handle = process.env.LINKEDIN_PROFILE_HANDLE;
  if (!handle) {
    log("LINKEDIN_PROFILE_HANDLE not set, skipping follower scrape");
    return null;
  }

  const page = await context.newPage();
  try {
    const url = `https://www.linkedin.com/in/${handle}/`;
    log(`Navigating to profile: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Try multiple selectors for follower count
    const selectors = [
      ".pv-top-card--list .text-body-small",
      "[class*='follower']",
      "span:has-text('followers')",
    ];

    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        const text = await el.textContent({ timeout: 5000 });
        if (text) {
          const match = text.match(/([\d,]+)\s*followers?/i);
          if (match) {
            const count = parseInt(match[1].replace(/,/g, ""), 10);
            log(`Follower count: ${count}`);
            return count;
          }
        }
      } catch {
        continue;
      }
    }

    // Fallback: search all text on page
    const bodyText = await page.textContent("body");
    if (bodyText) {
      const match = bodyText.match(/([\d,]+)\s*followers/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ""), 10);
        log(`Follower count (fallback): ${count}`);
        return count;
      }
    }

    log("Could not find follower count on profile page");
    return null;
  } catch (err) {
    log(`Follower scrape error: ${err}`);
    return null;
  } finally {
    await page.close();
  }
}

async function scrapePostEngagement(
  context: BrowserContext,
  linkedinPostId: string
): Promise<{ reactions?: number; comments?: number; shares?: number } | null> {
  const page = await context.newPage();
  try {
    const url = `https://www.linkedin.com/feed/update/${linkedinPostId}/`;
    log(`Scraping post: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const result: { reactions?: number; comments?: number; shares?: number } = {};

    // Try to extract engagement metrics from the page
    const bodyText = (await page.textContent("body")) || "";

    // Reactions (likes)
    const reactionsMatch = bodyText.match(/([\d,]+)\s*(?:reactions?|likes?)/i);
    if (reactionsMatch) {
      result.reactions = parseInt(reactionsMatch[1].replace(/,/g, ""), 10);
    }

    // Comments
    const commentsMatch = bodyText.match(/([\d,]+)\s*comments?/i);
    if (commentsMatch) {
      result.comments = parseInt(commentsMatch[1].replace(/,/g, ""), 10);
    }

    // Reposts/shares
    const sharesMatch = bodyText.match(/([\d,]+)\s*(?:reposts?|shares?)/i);
    if (sharesMatch) {
      result.shares = parseInt(sharesMatch[1].replace(/,/g, ""), 10);
    }

    log(`Post engagement: ${JSON.stringify(result)}`);
    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    log(`Post scrape error for ${linkedinPostId}: ${err}`);
    return null;
  } finally {
    await page.close();
  }
}

async function runScrape(forceLogin: boolean, userId: string) {
  log("Starting LinkedIn scrape...");

  let browser;
  try {
    const { browser: b, context } = await createAuthenticatedContext(forceLogin);
    browser = b;

    // Check if session is still valid
    const testPage = await context.newPage();
    await testPage.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    const currentUrl = testPage.url();
    await testPage.close();

    if (currentUrl.includes("/login") || currentUrl.includes("/authwall")) {
      log("Session expired! Need to re-authenticate.");
      await notify(
        "LinkedIn Scraper",
        "Session expired. Run with --login to re-authenticate."
      );
      await browser.close();
      return;
    }

    // 1. Scrape follower count
    const followerCount = await scrapeFollowerCount(context);
    if (followerCount !== null) {
      await prisma.followerSnapshot.create({
        data: {
          followerCount,
          source: "playwright",
          userId,
        },
      });
      log(`Saved FollowerSnapshot: ${followerCount}`);
    }

    // 2. Scrape engagement for published posts (< 45 days old)
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const publishedPosts = await prisma.post.findMany({
      where: {
        userId,
        status: "PUBLISHED",
        linkedinPostId: { not: null },
        publishedAt: { gte: cutoff },
      },
    });

    log(`Found ${publishedPosts.length} published posts to scrape`);

    for (const post of publishedPosts) {
      if (!post.linkedinPostId) continue;
      const engagement = await scrapePostEngagement(context, post.linkedinPostId);
      if (engagement) {
        await prisma.postAnalytics.create({
          data: {
            postId: post.id,
            followerCount: followerCount || 0,
            reactions: engagement.reactions,
            comments: engagement.comments,
            shares: engagement.shares,
          },
        });
        log(`Saved PostAnalytics for "${post.title}"`);
      }
    }

    // Save updated cookies
    const cookies = await context.cookies();
    saveCookies(cookies);

    log("Scrape complete.");
    await browser.close();
  } catch (err) {
    log(`Scrape error: ${err}`);
    await notify("LinkedIn Scraper", `Error: ${err}`);
    if (browser) await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const forceLogin = args.includes("--login");
  const cronMode = args.includes("--cron");

  // Resolve user
  const userIdx = args.indexOf("--user");
  const userEmail = userIdx >= 0 ? args[userIdx + 1] : process.env.SCRAPER_USER_EMAIL;
  if (!userEmail) {
    console.error("--user <email> or SCRAPER_USER_EMAIL env var is required");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    console.error(`User not found: ${userEmail}`);
    process.exit(1);
  }
  log(`Scraping for user: ${user.email} (${user.id})`);

  if (cronMode) {
    const cron = await import("node-cron");
    const schedule = process.env.SCRAPER_CRON || "0 8 * * *"; // Default: 8am daily
    log(`Starting scraper in cron mode: ${schedule}`);
    cron.default.schedule(schedule, () => {
      runScrape(false, user.id);
    });
    // Keep the process alive
    log("Scraper cron scheduled. Press Ctrl+C to stop.");
  } else {
    await runScrape(forceLogin, user.id);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
