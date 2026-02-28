import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.LOCAL_ENCRYPTION_SECRET;
  if (!secret) throw new Error("LOCAL_ENCRYPTION_SECRET is not set");
  // Pad or hash to 32 bytes
  const key = Buffer.alloc(32);
  Buffer.from(secret, "utf8").copy(key);
  return key;
}

export function encrypt(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decrypt(ciphertext: string, iv: string, tag: string): string {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
