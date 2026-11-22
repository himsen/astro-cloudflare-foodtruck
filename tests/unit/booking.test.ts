import { describe, it, expect } from 'vitest';
import { bookingMailto, BOOKING_PUNKTER } from '../../src/lib/booking';

describe('bookingMailto', () => {
  const href = bookingMailto('a@b.dk');
  it('targets the address with an encoded subject', () => {
    expect(href.startsWith('mailto:a@b.dk?subject=Booking%20af%20foodtruck&body=')).toBe(true);
  });
  it('has no raw spaces or newlines', () => {
    expect(href).not.toMatch(/[ \r\n]/);
  });
  it('round-trips every checklist line, including æ and ø', () => {
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body.split('\r\n')).toEqual(BOOKING_PUNKTER.map((p) => `${p}: `));
  });
});
