import { describe, it, expect } from 'vitest';
import { smsIsOpen, SMS_DEADLINE } from '../../src/lib/preorder';
import { timeInCopenhagen } from '../../src/lib/datetime';

describe('smsIsOpen', () => {
  it('is open in the morning', () => {
    expect(smsIsOpen('00:00')).toBe(true);
    expect(smsIsOpen('09:30')).toBe(true);
  });

  it('is open right up to the deadline', () => {
    expect(smsIsOpen('15:59')).toBe(true);
  });

  it('closes on the deadline itself, not a minute later', () => {
    expect(smsIsOpen(SMS_DEADLINE)).toBe(false);
    expect(smsIsOpen('16:00')).toBe(false);
  });

  it('stays closed for the rest of the day', () => {
    expect(smsIsOpen('16:01')).toBe(false);
    expect(smsIsOpen('23:59')).toBe(false);
  });
});

describe('timeInCopenhagen', () => {
  it('converts from UTC in summer time', () => {
    // Copenhagen is UTC+2 in August.
    expect(timeInCopenhagen(new Date('2026-08-22T13:30:00Z'))).toBe('15:30');
  });

  it('converts from UTC in winter time', () => {
    // and UTC+1 in January.
    expect(timeInCopenhagen(new Date('2026-01-15T13:30:00Z'))).toBe('14:30');
  });

  it('formats midnight as 00:00 rather than 24:00', () => {
    expect(timeInCopenhagen(new Date('2026-08-21T22:00:00Z'))).toBe('00:00');
  });

  it('crosses the deadline at the right moment in local time', () => {
    // 13:59 UTC is 15:59 in Copenhagen — still open.
    expect(smsIsOpen(timeInCopenhagen(new Date('2026-08-22T13:59:00Z')))).toBe(true);
    expect(smsIsOpen(timeInCopenhagen(new Date('2026-08-22T14:00:00Z')))).toBe(false);
  });
});
