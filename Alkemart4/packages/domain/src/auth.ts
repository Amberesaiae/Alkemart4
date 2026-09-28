// Workers production currently caps a single PBKDF2 derivation at 100k.
// 600k is an explicit rollout setting, not a blind default (see SECURITY-HARDENING.md).
const PBKDF2_ITERATIONS = 100_000
export type PasswordHashIterations = 100_000 | 600_000
const SALT_BYTES = 16
const KEY_BITS = 256
const HASH_PREFIX = "pbkdf2-sha256"

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

async function deriveKey(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations,
    },
    material,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(plain: string, iterations: PasswordHashIterations = PBKDF2_ITERATIONS): Promise<string> {
  if (iterations !== 100_000 && iterations !== 600_000) throw new Error("unsupported password work factor")
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const key = await deriveKey(plain, salt, iterations)
  return `${HASH_PREFIX}$${iterations}$${bytesToHex(salt)}$${bytesToHex(key)}`
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const parts = hash.split("$")
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) {
    return false
  }
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 600_000) {
    return false
  }
  const salt = hexToBytes(parts[2] ?? "")
  const expected = hexToBytes(parts[3] ?? "")
  if (!salt || salt.length !== SALT_BYTES || !expected || expected.length !== KEY_BITS / 8) {
    return false
  }
  const actual = await deriveKey(plain, salt, iterations)
  return timingSafeEqual(actual, expected)
}

export function passwordHashNeedsUpgrade(hash: string, target: PasswordHashIterations): boolean {
  const parts = hash.split("$")
  return parts[0] === HASH_PREFIX && Number(parts[1]) < target
}
