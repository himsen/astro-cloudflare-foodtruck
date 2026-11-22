/** The site's main links, shared by the top bar and the footer. Jump links to
 *  sections of "/" start with '/#' and are never marked as the current page. */
export const NAV_LINKS = [
  { href: '/', label: 'Hvor er vi?' },
  { href: '/#menu', label: 'Menu' },
  { href: '/#forudbestilling', label: 'Forudbestilling' },
  { href: '/ydelser', label: 'Ydelser' },
  { href: '/om-os', label: 'Om os' },
  { href: '/kontakt', label: 'Kontakt' },
] as const;
