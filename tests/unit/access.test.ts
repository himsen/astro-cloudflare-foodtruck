import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { createAccessVerifier, ACCESS_HEADER } from '../../src/lib/access';

const TEAM_DOMAIN = 'chicks.cloudflareaccess.com';
const ISSUER = `https://${TEAM_DOMAIN}`;
const AUD = 'aud-tag-for-the-admin-app';

let privateKey: CryptoKey;
let keySet: JWTVerifyGetKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  keySet = createLocalJWKSet({ keys: [jwk] });

  // A second key, never published in the key set — used to forge a signature.
  const otherPair = await generateKeyPair('RS256', { extractable: true });
  otherPrivateKey = otherPair.privateKey;
});

async function sign(
  claims: Record<string, unknown>,
  options: { issuer?: string; audience?: string; expiresIn?: string; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt()
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUD)
    .setExpirationTime(options.expiresIn ?? '1h')
    .sign(options.key ?? privateKey);
}

function verifier() {
  return createAccessVerifier({ teamDomain: TEAM_DOMAIN, aud: AUD, keySet });
}

describe('createAccessVerifier', () => {
  it('returns the email from a valid token', async () => {
    const token = await sign({ email: 'ejer@example.com' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBe('ejer@example.com');
  });

  it('rejects a missing header', async () => {
    const request = new Request('https://example.dk/admin');
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { issuer: 'https://evil.example' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a token for a different application', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { audience: 'some-other-app' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { expiresIn: '-1h' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a token signed by an unknown key', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { key: otherPrivateKey });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a valid token carrying no email', async () => {
    const token = await sign({});
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a header that is not a token at all', async () => {
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: 'not-a-jwt' },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });
});
