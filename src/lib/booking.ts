export const BOOKING_PUNKTER: readonly string[] = [
  'Dato',
  'Sted / adresse',
  'Antal gæster (ca.)',
  'Type arrangement',
  'Foodtruck, pølsevogn eller begge',
  'Dit navn og telefonnummer',
];

const enc = encodeURIComponent;

export function bookingMailto(email: string): string {
  return `mailto:${email}?subject=${enc('Booking af foodtruck')}&body=${enc(BOOKING_PUNKTER.map((p) => `${p}: `).join('\r\n'))}`;
}
