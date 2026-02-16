import { createHmac, timingSafeEqual } from 'node:crypto';

interface AdminTokenPayload {
  role: 'admin';
  exp: number;
}

const encodeBase64Url = (value: string): string => Buffer.from(value).toString('base64url');
const decodeBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const sign = (secret: string, payload: string): string => {
  return createHmac('sha256', secret).update(payload).digest('base64url');
};

export const createAdminToken = (secret: string, ttlMs = 24 * 60 * 60 * 1000): string => {
  const payload: AdminTokenPayload = {
    role: 'admin',
    exp: Date.now() + ttlMs
  };

  const payloadString = JSON.stringify(payload);
  const encoded = encodeBase64Url(payloadString);
  const sig = sign(secret, encoded);
  return `${encoded}.${sig}`;
};

export const verifyAdminToken = (token: string, secret: string): boolean => {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSig = sign(secret, encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as AdminTokenPayload;
    if (payload.role !== 'admin') return false;
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
};
