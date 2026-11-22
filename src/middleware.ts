import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { createAccessVerifier } from './lib/access';

const DENIED = `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><title>Ingen adgang</title></head>
<body style="font-family: system-ui; padding: 2rem; max-width: 32rem;">
<h1>Ingen adgang</h1>
<p>Du har ikke adgang til denne side. Kontakt den, der passer hjemmesiden.</p>
</body></html>`;

function denied(): Response {
  return new Response(DENIED, {
    status: 403,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith('/admin')) {
    return next();
  }

  // Local development only. `import.meta.env.DEV` is false in every build that
  // is deployed, so this cannot weaken production.
  if (import.meta.env.DEV) {
    context.locals.accessEmail = 'dev@localhost';
    return next();
  }

  // Fail closed. While the domain transfer is pending there is no Access
  // application yet, so these are unset — deny rather than allow.
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return denied();
  }

  const verify = createAccessVerifier({
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    aud: env.ACCESS_AUD,
  });

  const email = await verify(context.request);
  if (!email) {
    return denied();
  }

  context.locals.accessEmail = email;
  return next();
});
