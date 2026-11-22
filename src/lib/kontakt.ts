/**
 * Contact details, in one place.
 *
 * They appear on /kontakt, in the pre-order panel on the front page and in the
 * front page's error state, so they live here rather than being retyped in
 * three files. Changing a number is an edit to this file and nothing else.
 */
export const TELEFON = '+45 50 70 80 90';
export const TELEFON_HREF = 'tel:+4550708090';
export const SMS_HREF = 'sms:+4550708090';
export const EMAIL = 'tiedgen@youmail.dk';

/** Indehaver. Shown on /kontakt. */
export const INDEHAVER = 'Tonny Høhrmann';

/**
 * The registered company name, which is not the trading name on the sign.
 * Shown in the footer beside the CVR-nummer, where e-handelsloven wants them.
 */
export const VIRKSOMHED = 'Kvik Kyllinger';

/**
 * The registered address. Kept in two parts so a postal format can be built
 * from it later without re-splitting a string.
 *
 * This is where the business is registered, not somewhere to turn up and buy
 * chicken — that is what the weekly plan on the front page is for. It sits in
 * the footer with the other registration details for exactly that reason.
 */
export const ADRESSE = 'Nordre Ringvej 17, port 4';
export const POSTBY = '7000 Fredericia';

/**
 * CVR-nummer, digits only — the footer formats it.
 *
 * E-handelsloven requires a business site to state the company's name, address,
 * e-mail and CVR-nummer. It belongs in the footer rather than on /kontakt: it
 * is there to satisfy the law on every page, not to help anyone get in touch.
 */
export const CVR = '35982892';

/**
 * The business's page on findsmiley.dk.
 *
 * A food business that markets itself on its own website must publish its
 * kontrolrapporter there, clearly visible. Same rule as above: empty means the
 * link is left out rather than shown broken.
 */
export const SMILEY_URL = 'https://www.findsmiley.dk/1441204';
