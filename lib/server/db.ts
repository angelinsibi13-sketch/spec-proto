import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { blankVault } from "@/lib/machine";
import type { Vault } from "@/lib/types";

const directory = path.join(process.cwd(), "data");
const vaultPath = path.join(directory, "vault.bin");
const keyPath = path.join(directory, "key.bin");

function key(): Buffer {
  mkdirSync(directory, { recursive: true });
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32));
  return readFileSync(keyPath);
}

export function readVault(): Vault {
  if (!existsSync(vaultPath)) return blankVault();
  try {
    const raw = readFileSync(vaultPath);
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const cipher = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(json) as Vault;
    if (!Array.isArray(parsed.audit)) parsed.audit = [];
    if (!parsed.reminders || typeof parsed.reminders !== "object") parsed.reminders = {};
    return parsed;
  } catch {
    return blankVault();
  }
}

export function writeVault(vault: Vault) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(vault), "utf8"), cipher.final()]);
  mkdirSync(directory, { recursive: true });
  writeFileSync(vaultPath, Buffer.concat([iv, cipher.getAuthTag(), body]));
}

export function vaultFile() {
  return {
    alg: "AES-256-GCM",
    path: "data/vault.bin",
    bytes: existsSync(vaultPath) ? statSync(vaultPath).size : 0,
  };
}
