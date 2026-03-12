import { prisma } from "./db";
import { encrypt, decrypt } from "./encryption";

// --- Setting definitions ---

interface SettingDef {
  sensitive: boolean;
  group: string;
  description: string;
}

export const SETTING_DEFINITIONS: Record<string, SettingDef> = {
  ANTHROPIC_API_KEY: {
    sensitive: true,
    group: "api_keys",
    description: "Anthropic API key for Claude",
  },
  OPENAI_API_KEY: {
    sensitive: true,
    group: "api_keys",
    description: "OpenAI API key for embeddings",
  },
  EXA_API_KEY: {
    sensitive: true,
    group: "api_keys",
    description: "Exa API key for web search",
  },
  LINKEDIN_CLIENT_ID: {
    sensitive: false,
    group: "linkedin",
    description: "LinkedIn OAuth application client ID",
  },
  LINKEDIN_CLIENT_SECRET: {
    sensitive: true,
    group: "linkedin",
    description: "LinkedIn OAuth application client secret",
  },
  LINKEDIN_REDIRECT_URI: {
    sensitive: false,
    group: "linkedin",
    description: "LinkedIn OAuth redirect URI",
  },
  LINKEDIN_PROFILE_HANDLE: {
    sensitive: false,
    group: "linkedin",
    description: "LinkedIn profile handle for scraping",
  },
  SCRAPER_CRON: {
    sensitive: false,
    group: "scraper",
    description: "Cron schedule for LinkedIn scraper",
  },
};

// --- Cache ---

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

const globalForSettings = globalThis as unknown as {
  settingsCache: Map<string, CacheEntry> | undefined;
};

function getCache(): Map<string, CacheEntry> {
  if (!globalForSettings.settingsCache) {
    globalForSettings.settingsCache = new Map();
  }
  return globalForSettings.settingsCache;
}

// --- Core functions ---

export async function getSetting(key: string): Promise<string | undefined> {
  const cache = getCache();
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // Try DB
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) {
    let value: string;
    if (row.encrypted && row.iv && row.tag) {
      value = decrypt(row.value, row.iv, row.tag);
    } else {
      value = row.value;
    }
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  // Fallback to env
  const envVal = process.env[key];
  if (envVal !== undefined) {
    cache.set(key, { value: envVal, expiresAt: Date.now() + CACHE_TTL_MS });
    return envVal;
  }

  return undefined;
}

export async function requireSetting(key: string): Promise<string> {
  const value = await getSetting(key);
  if (value === undefined) {
    throw new Error(`Required setting ${key} is not configured`);
  }
  return value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const def = SETTING_DEFINITIONS[key];
  const sensitive = def?.sensitive ?? false;
  const group = def?.group ?? "general";

  let storeValue = value;
  let iv: string | null = null;
  let tag: string | null = null;

  if (sensitive) {
    const encrypted = encrypt(value);
    storeValue = encrypted.ciphertext;
    iv = encrypted.iv;
    tag = encrypted.tag;
  }

  await prisma.appSetting.upsert({
    where: { key },
    update: { value: storeValue, iv, tag, encrypted: sensitive, group },
    create: { key, value: storeValue, iv, tag, encrypted: sensitive, group },
  });

  // Update cache with plaintext
  const cache = getCache();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export interface SettingInfo {
  key: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  group: string;
  description: string;
  sensitive: boolean;
  value?: string;
}

export async function getAllSettings(): Promise<SettingInfo[]> {
  const dbRows = await prisma.appSetting.findMany();
  const dbMap = new Map(dbRows.map((r) => [r.key, r]));

  return Object.entries(SETTING_DEFINITIONS).map(([key, def]) => {
    const dbRow = dbMap.get(key);

    if (dbRow) {
      let value: string | undefined;
      if (!def.sensitive) {
        value = dbRow.encrypted && dbRow.iv && dbRow.tag
          ? decrypt(dbRow.value, dbRow.iv, dbRow.tag)
          : dbRow.value;
      }
      return {
        key,
        hasValue: true,
        source: "db" as const,
        group: def.group,
        description: def.description,
        sensitive: def.sensitive,
        value,
      };
    }

    const envVal = process.env[key];
    if (envVal !== undefined) {
      return {
        key,
        hasValue: true,
        source: "env" as const,
        group: def.group,
        description: def.description,
        sensitive: def.sensitive,
        value: def.sensitive ? undefined : envVal,
      };
    }

    return {
      key,
      hasValue: false,
      source: "none" as const,
      group: def.group,
      description: def.description,
      sensitive: def.sensitive,
    };
  });
}

export async function deleteSetting(key: string): Promise<void> {
  await prisma.appSetting.delete({ where: { key } }).catch(() => {
    // Ignore if not found
  });
  const cache = getCache();
  cache.delete(key);
}
