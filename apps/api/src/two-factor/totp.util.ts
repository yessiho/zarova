import { createHmac, randomBytes } from 'crypto';

/*
 * RFC 4648 Base32 alphabet.
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/*
 * Encode a Buffer as a Base32 string.
 */
function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return result;
}

/*
 * Decode a Base32 string to a Buffer.
 */
function base32Decode(str: string): Buffer {
  const normalized = str.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of normalized) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/*
 * Compute a 6-digit TOTP for a given secret and time step.
 * timeStep defaults to the current 30-second window (RFC 6238).
 */
function computeTOTP(secret: string, timeStep?: number): string {
  const step = timeStep ?? Math.floor(Date.now() / 1000 / 30);

  const stepBuffer = Buffer.alloc(8);
  stepBuffer.writeBigInt64BE(BigInt(step));

  const keyBuffer = base32Decode(secret);
  const hmac = createHmac('sha1', keyBuffer).update(stepBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;

  return code.toString().padStart(6, '0');
}

/*
 * Generate a cryptographically secure Base32 TOTP secret (20 bytes = 160 bits).
 */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/*
 * Verify a TOTP token against a secret.
 * Accepts tokens from ±1 time steps to account for clock drift.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    if (computeTOTP(secret, step + i) === token) return true;
  }
  return false;
}

/*
 * Build the otpauth:// URI used to provision authenticator apps.
 */
export function buildKeyURI(
  email: string,
  issuer: string,
  secret: string,
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return (
    `otpauth://totp/${label}` +
    `?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}
