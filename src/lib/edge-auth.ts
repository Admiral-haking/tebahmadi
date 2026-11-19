import type { AuthTokenPayload } from '@/lib/auth';

function base64UrlToUint8Array(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  if (pad === 3) base64 += '=';
  if (pad === 1) throw new Error('Invalid base64url string');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const secretBytes = encoder.encode(secret);
  const keyBuffer = secretBytes.buffer.slice(
    secretBytes.byteOffset,
    secretBytes.byteOffset + secretBytes.byteLength,
  );
  return crypto.subtle.importKey('raw', keyBuffer as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
}

export async function verifyJwtOnEdge(token: string): Promise<AuthTokenPayload | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const key = await getHmacKey(secret);
  const data = encoder.encode(`${headerPart}.${payloadPart}`);
  const signatureBytes = base64UrlToUint8Array(signaturePart);
  const signatureData = Uint8Array.from(signatureBytes);
  const messageData = Uint8Array.from(data);

  const verified = await crypto.subtle.verify('HMAC', key, signatureData, messageData);
  if (!verified) {
    return null;
  }

  const payloadBytes = base64UrlToUint8Array(payloadPart);
  const payloadJson = decoder.decode(payloadBytes);
  const payload = JSON.parse(payloadJson) as AuthTokenPayload;

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}
