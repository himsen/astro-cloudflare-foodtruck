import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

export const ACCESS_HEADER = 'cf-access-jwt-assertion';

export interface AccessVerifierOptions {
  teamDomain: string; // e.g. 'chicks.cloudflareaccess.com'
  aud: string; // the Access application's AUD tag
  /** Injected in tests. Production fetches the team's published keys. */
  keySet?: JWTVerifyGetKey;
}

/** Remote key sets cache their fetches, so build each one only once. */
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function keySetFor(issuer: string): JWTVerifyGetKey {
  let keySet = remoteKeySets.get(issuer);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    remoteKeySets.set(issuer, keySet);
  }
  return keySet;
}

/**
 * Build a verifier for the Cf-Access-Jwt-Assertion header.
 *
 * The header is never trusted on its own: anything that can reach the Worker
 * directly can set it. Only a signature from the team's published keys, with
 * a matching issuer and audience, counts as proof of identity.
 *
 * Returns the verified email, or null if the request should be refused.
 */
export function createAccessVerifier(
  options: AccessVerifierOptions,
): (request: Request) => Promise<string | null> {
  const issuer = `https://${options.teamDomain}`;
  const keySet = options.keySet ?? keySetFor(issuer);

  return async function verify(request: Request): Promise<string | null> {
    const token = request.headers.get(ACCESS_HEADER);
    if (!token) return null;

    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer,
        audience: options.aud,
      });
      const email = payload.email;
      return typeof email === 'string' && email.length > 0 ? email : null;
    } catch {
      // Expired, forged, malformed, wrong audience — all the same answer.
      return null;
    }
  };
}
