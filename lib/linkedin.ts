import { prisma } from "./db";
import { encrypt, decrypt } from "./encryption";
import { requireSetting } from "./settings";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";

const SCOPES = ["openid", "profile", "w_member_social"];

export async function getAuthorizationUrl(state: string): Promise<string> {
  const clientId = await requireSetting("LINKEDIN_CLIENT_ID");
  const redirectUri = await requireSetting("LINKEDIN_REDIRECT_URI");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES.join(" "),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const redirectUri = await requireSetting("LINKEDIN_REDIRECT_URI");
  const clientId = await requireSetting("LINKEDIN_CLIENT_ID");
  const clientSecret = await requireSetting("LINKEDIN_CLIENT_SECRET");

  // Exchange authorization code for access token
  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;
  const expiresIn: number = tokenData.expires_in; // seconds

  // Fetch user info for person URN and display name
  const userRes = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    const err = await userRes.text();
    throw new Error(`Userinfo fetch failed: ${err}`);
  }

  const userInfo = await userRes.json();
  const personUrn = `urn:li:person:${userInfo.sub}`;
  const displayName = userInfo.name || "LinkedIn User";

  // Encrypt and store
  const { ciphertext, iv, tag } = encrypt(accessToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Upsert: delete any existing token, store new one
  await prisma.linkedInToken.deleteMany();
  await prisma.linkedInToken.create({
    data: {
      accessToken: ciphertext,
      tokenIv: iv,
      tokenTag: tag,
      personUrn,
      displayName,
      expiresAt,
    },
  });

  return { personUrn, displayName, expiresAt };
}

export async function getStoredToken(): Promise<{
  accessToken: string;
  personUrn: string;
  displayName: string;
  expiresAt: Date;
} | null> {
  const token = await prisma.linkedInToken.findFirst();
  if (!token) return null;

  const accessToken = decrypt(token.accessToken, token.tokenIv, token.tokenTag);
  return {
    accessToken,
    personUrn: token.personUrn,
    displayName: token.displayName,
    expiresAt: token.expiresAt,
  };
}

export async function disconnectLinkedIn() {
  await prisma.linkedInToken.deleteMany();
}

export async function publishPost(
  accessToken: string,
  personUrn: string,
  text: string
): Promise<string> {
  const res = await fetch(LINKEDIN_POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202402",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: personUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn publish failed: ${err}`);
  }

  // LinkedIn returns the post ID in the x-restli-id header
  const postId = res.headers.get("x-restli-id") || "";
  return postId;
}
