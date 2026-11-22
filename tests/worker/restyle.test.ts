import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

const html = async (path: string) =>
  (await exports.default.fetch(`https://example.dk${path}`)).text();

describe('phone call bar', () => {
  it('is on the front page and links to the phone', async () => {
    const page = await html('/');
    expect(page).toMatch(/<a[^>]*data-ringebar[^>]*href="tel:/);
  });
});

describe('front page', () => {
  it('shows menu and pre-order inline, with no overlay dialog', async () => {
    const page = await html('/');
    expect(page).toContain('id="menu"');
    expect(page).toContain('id="forudbestilling"');
    expect(page).not.toContain('role="dialog"');
  });

  it('loads the hero photo eagerly and first', async () => {
    const page = await html('/');
    expect(page).toMatch(/<img[^>]*hero-komp-1200\.webp[^>]*fetchpriority="high"/);
    expect(page).not.toMatch(/<img[^>]*hero-[^>]*loading="lazy"/);
  });

  it('shows the SMS link at most once', async () => {
    const page = await html('/');
    expect((page.match(/href="sms:/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it('still renders a closed today (fresh DB is all closed)', async () => {
    const page = await html('/');
    // The DayCard's heading, not a WeekRow, must carry the closed sign.
    expect(page).toMatch(/<h3[^>]*>\s*<span class="sr-only">I dag:<\/span>\s*<span[^>]*bg-fare[^>]*>Lukket<\/span>/);
  });
});

describe('top bar', () => {
  it('links to the booking page and the menu section, with a no-JS menu toggle', async () => {
    const page = await html('/');
    expect(page).toMatch(/<a[^>]*href="\/book"/);
    expect(page).toMatch(/<a[^>]*href="\/#menu"/);
    expect(page).toMatch(/<details[^>]*data-navmenu/);
    expect(page).toContain('src="/logo.webp"');
  });

  it('jumps to Forudbestilling from the bar, the footer and the buttons under the bar', async () => {
    const page = await html('/');
    const header = page.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
    const footer = page.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? '';
    expect(header).toContain('href="/#forudbestilling"');
    expect(footer).toContain('href="/#forudbestilling"');
    expect(footer).toContain('href="/#menu"');
    expect(footer).toContain('href="/book"');
    expect(header).toContain('href="/om-os"');
    expect(footer).toContain('href="/om-os"');
    // The food-inspection smiley is linked from every page.
    expect(footer).toContain('findsmiley.dk');
    // Om os has its own page now, so the front page no longer carries it.
    expect(page).not.toContain('id="om-os"');
    expect(page).toContain('href="#menu"');
    expect(page).toContain('href="#forudbestilling"');
  });

  it('opens with the hero headline, its two jump buttons and the offer strip', async () => {
    const page = await html('/');
    expect((page.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(page).toMatch(/<h1[^>]*>[\s\S]*Kylling fra[\s\S]*spyddet[\s\S]*<\/h1>/);
    expect(page).toMatch(/<img[^>]*hero-komp-1200\.webp[^>]*fetchpriority="high"/);
    expect(page).toContain('Foodtruck &amp; pølsevogn');
  });

  it('shows each menu as its own card with a picture', async () => {
    const page = await html('/');
    expect((page.match(/src="\/photos\/menu\/[a-z]+\.webp"/g) ?? []).length).toBe(4);
    // Arrows ship hidden and are revealed by script, so no-JS visitors just swipe.
    expect(page).toMatch(/<button[^>]*data-forrige[^>]*hidden/);
    expect(page).toMatch(/<button[^>]*data-naeste[^>]*hidden/);
  });

  it('has no phone number in the top bar', async () => {
    const header = (await html('/')).match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(header).toContain('data-navmenu');
    expect(header).not.toContain('href="tel:');
  });
});
