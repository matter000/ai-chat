// API Key 加密服务
// - PBKDF2(SHA-256, 100k 迭代) 派生 AES-GCM 密钥
// - 每用户独立盐 + verifier 存 localStorage
// - 派生密钥仅缓存在内存中

const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN_BITS = 256;
const SALT_LEN = 16;
const IV_LEN = 12;
const STORAGE = {
  SALT: 'ai-chat-crypto-salt',
  VERIFIER: 'ai-chat-crypto-verifier',
  VERIFIER_IV: 'ai-chat-crypto-verifier-iv',
  ENABLED: 'ai-chat-crypto-enabled',
};

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 将 Uint8Array 复制到一个独立 ArrayBuffer，避免 SharedArrayBuffer 类型歧义 */
function asBuf(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

// ----- 盐 / 验证 -----

export function isEncryptionEnabled(): boolean {
  return localStorage.getItem(STORAGE.ENABLED) === '1';
}

export function hasMasterPassword(): boolean {
  return isEncryptionEnabled() && !!localStorage.getItem(STORAGE.SALT);
}

function getOrCreateSalt(): Uint8Array {
  const existing = localStorage.getItem(STORAGE.SALT);
  if (existing) return fromBase64(existing);
  const s = randomBytes(SALT_LEN);
  localStorage.setItem(STORAGE.SALT, toBase64(s));
  return s;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passBuf = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    asBuf(passBuf),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBuf(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ----- 主密码设置 / 验证 -----

let cachedKey: CryptoKey | null = null;

export async function setMasterPassword(password: string): Promise<void> {
  if (!password || password.length < 6) {
    throw new Error('主密码至少 6 位');
  }
  const salt = getOrCreateSalt();
  const key = await deriveKey(password, salt);
  const iv = randomBytes(IV_LEN);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBuf(iv) },
    key,
    new TextEncoder().encode('ai-chat-verifier'),
  );
  localStorage.setItem(STORAGE.VERIFIER_IV, toBase64(iv));
  localStorage.setItem(STORAGE.VERIFIER, toBase64(ct));
  localStorage.setItem(STORAGE.ENABLED, '1');
  cachedKey = key;
}

export async function unlockWithPassword(password: string): Promise<boolean> {
  if (!isEncryptionEnabled()) {
    cachedKey = null;
    return true;
  }
  const saltStr = localStorage.getItem(STORAGE.SALT);
  const verifierStr = localStorage.getItem(STORAGE.VERIFIER);
  const verifierIvStr = localStorage.getItem(STORAGE.VERIFIER_IV);
  if (!saltStr || !verifierStr || !verifierIvStr) return false;

  const salt = fromBase64(saltStr);
  const key = await deriveKey(password, salt);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBuf(fromBase64(verifierIvStr)) },
      key,
      asBuf(fromBase64(verifierStr)),
    );
    if (new TextDecoder().decode(plain) !== 'ai-chat-verifier') return false;
    cachedKey = key;
    return true;
  } catch {
    return false;
  }
}

export function isUnlocked(): boolean {
  if (!isEncryptionEnabled()) return true;
  return cachedKey !== null;
}

export function lock(): void {
  cachedKey = null;
}

export function clearMasterPassword(): void {
  localStorage.removeItem(STORAGE.SALT);
  localStorage.removeItem(STORAGE.VERIFIER);
  localStorage.removeItem(STORAGE.VERIFIER_IV);
  localStorage.removeItem(STORAGE.ENABLED);
  cachedKey = null;
}

// ----- 加密 / 解密 API Key -----

export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!isEncryptionEnabled()) return plaintext;
  if (!cachedKey) throw new Error('未解锁，无法加密');
  const iv = randomBytes(IV_LEN);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBuf(iv) },
    cachedKey,
    new TextEncoder().encode(plaintext),
  );
  return 'enc:' + toBase64(iv) + ':' + toBase64(ct);
}

export async function decryptApiKey(stored: string): Promise<string> {
  if (!stored.startsWith('enc:')) return stored;
  if (!isEncryptionEnabled()) return '';
  if (!cachedKey) throw new Error('未解锁，无法解密');
  const [, ivB64, ctB64] = stored.split(':');
  const iv = fromBase64(ivB64);
  const ct = fromBase64(ctB64);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBuf(iv) },
    cachedKey,
    asBuf(ct),
  );
  return new TextDecoder().decode(plain);
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith('enc:');
}

// ===== 用户登录密码哈希（与 API Key 加密无关，但原理相同） =====

const USER_PW_ITERATIONS = 120_000;
const USER_PW_SALT_LEN = 16;
const USER_PW_HASH_LEN = 32; // SHA-256 输出 256 位

/** 将明文密码哈希为存储格式："pbkdf2:salt_b64:hash_b64" */
export async function hashUserPassword(password: string): Promise<string> {
  const salt = randomBytes(USER_PW_SALT_LEN);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    asBuf(enc.encode(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: asBuf(salt),
      iterations: USER_PW_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    USER_PW_HASH_LEN * 8,
  );
  return 'pbkdf2:' + toBase64(salt) + ':' + toBase64(bits);
}

/** 验证明文密码是否与存储的哈希匹配 */
export async function verifyUserPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('pbkdf2:')) return false;
  const [, saltB64, hashB64] = stored.split(':');
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    asBuf(enc.encode(plain)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: asBuf(salt),
      iterations: USER_PW_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    USER_PW_HASH_LEN * 8,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}