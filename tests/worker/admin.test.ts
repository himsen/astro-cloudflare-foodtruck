import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

describe('/admin access control', () => {
  it('refuses a request with no Access token', async () => {
    const response = await exports.default.fetch('https://example.dk/admin');
    expect(response.status).toBe(403);
  });

  it('refuses a forged Access header', async () => {
    const response = await exports.default.fetch('https://example.dk/admin', {
      headers: { 'cf-access-jwt-assertion': 'obviously.not.valid' },
    });
    expect(response.status).toBe(403);
  });

  it('refuses a POST with no Access token', async () => {
    const body = new FormData();
    body.set('_form', 'banner');
    body.set('text', 'Hacked');
    body.set('until', '2099-01-01');

    const response = await exports.default.fetch('https://example.dk/admin', {
      method: 'POST',
      body,
    });
    expect(response.status).toBe(403);
  });

  it('leaves public pages alone', async () => {
    // Asserting "not 403" rather than "200" keeps this test about the access
    // guard's scope, not about how the test pool serves static assets.
    const response = await exports.default.fetch('https://example.dk/');
    expect(response.status).not.toBe(403);
  });
});
