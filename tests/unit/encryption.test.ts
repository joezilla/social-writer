import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

describe("encryption", () => {
  it("roundtrips plaintext correctly", () => {
    const plaintext = "my-secret-api-key-12345";
    const { ciphertext, iv, tag } = encrypt(plaintext);
    const result = decrypt(ciphertext, iv, tag);
    expect(result).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails with wrong IV", () => {
    const { ciphertext, tag } = encrypt("test");
    const wrongIv = "000000000000000000000000";
    expect(() => decrypt(ciphertext, wrongIv, tag)).toThrow();
  });

  it("fails with wrong tag", () => {
    const { ciphertext, iv } = encrypt("test");
    const wrongTag = "00000000000000000000000000000000";
    expect(() => decrypt(ciphertext, iv, wrongTag)).toThrow();
  });

  it("handles empty string", () => {
    const { ciphertext, iv, tag } = encrypt("");
    expect(decrypt(ciphertext, iv, tag)).toBe("");
  });

  it("handles unicode", () => {
    const plaintext = "Hello 🌍 café résumé";
    const { ciphertext, iv, tag } = encrypt(plaintext);
    expect(decrypt(ciphertext, iv, tag)).toBe(plaintext);
  });

  it("throws when LOCAL_ENCRYPTION_SECRET is missing", () => {
    const original = process.env.LOCAL_ENCRYPTION_SECRET;
    delete process.env.LOCAL_ENCRYPTION_SECRET;
    try {
      expect(() => encrypt("test")).toThrow("LOCAL_ENCRYPTION_SECRET is not set");
    } finally {
      process.env.LOCAL_ENCRYPTION_SECRET = original;
    }
  });
});
