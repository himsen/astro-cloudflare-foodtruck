# Illustrationer

What is drawn, what it came from, and what is still worth commissioning.

Four of the drawings are no longer invented: they were traced off the
photographs in `raw_pictures/`, so the truck on the site is the actual truck and
the mascot is the character already painted on it. Each entry names its source
photo. Everything ships as finished artwork today — replacing a drawing is a
one-file change, and the slot, its ratio and its size do not move.

## House style

Whatever replaces these has to sit next to the rest of the site without a seam.

| | |
| --- | --- |
| Line | One heavy black keyline, even weight, round joins and caps. No hairlines, no tapering. |
| Colour | Flat spot colour only. No gradients, no shading, no drop shadows, no texture. |
| Palette | Interface colours: black `#111111`, mustard `#FFC526`, tomato `#E8341F`, white `#FFFFFF`, bone `#F4F1EA`. Plus four that exist only in the drawings, because the real objects are these colours: brown `#7C4A37` (the truck), powder blue `#93C4DD` (the mascot), skin `#F2D3B6`, signboard blue `#5F8FA8`. Nothing else. |
| Detail | Enough to read at 40 px. A drawing that needs 400 px to make sense is the wrong drawing. |
| Mood | Hand-painted sign on the side of a van. Warm, direct, a bit loud. Not corporate, not cute-twee, not "flat illustration" stock. |

Deliver as SVG with the paths already outlined, on the viewBox given below, or
as a layered vector file. Not PNG — these render from 26 px (the truck's roof
sign) to 576 px (the front page).

## Drawings

### 1. Maskotten — the carhop *(drawn, not in use)*

| | |
| --- | --- |
| Ratio | 5:8 (viewBox `0 0 200 320`) |
| Source | `raw_pictures/fb10.jpg` (the back door, clearest), `fb1.jpg` (the side) |
| Status | **Not used on the site.** Kept as a faithful record of the character. |
| File | `src/components/art/Maskot.astro` |

The character painted on the real vehicle: a 1950s carhop on roller skates,
blonde flip, powder-blue cap and dress, a Dannebrog hanging from her belt, a
roast chicken on a tray. She is the closest thing the business has to a logo.

The drawing is a reduction rather than a copy — cartoon proportions so she still
reads at 40 px, and this site's flat keyline style so she sits beside the truck
without looking imported. She keeps her own colours because those are the ones
on the van, which is why `brun`, `himmel` and `hud` exist as illustration-only
tokens in `global.css`.

She was tried as the site's mark, cropped to a badge in the header, and it
looked bad at that size — the hen does that job instead. The full figure is kept
here at full size so the drawing does not have to be made twice, and so a
commissioned version has something to work from.

If she is ever redrawn properly, the three things that must survive are the
skates, the tray, and the flag on her hip. The flag is what stops her reading as
a generic American diner sticker.

### 2. Hønen — the hen

| | |
| --- | --- |
| Ratio | 1:1 (viewBox `0 0 120 120`) |
| Renders at | 24–44 px in the header and footer, 26 px on the truck's roof sign, 32 px as the favicon |
| File | `src/components/art/HoeneFigur.astro` (the `<g>`), wrapped by `Hoene.astro` |
| Placeholder | Yes — hen in profile, tail up, comb and wattle |

The mark, and the reason her body, comb and keyline are separate CSS variables:
she has to work in more than one colourway. In the header and the footer she is
white with a red comb inside a mustard badge — the same lockup as the favicon.
Black on mustard was tried first and killed the drawing; at 32 px a solid black
bird is a blob. Whoever draws her
should check all three before calling it done.

She should look like she is about to walk off the edge of the sign — alert,
side-on, not a logo-mark abstracted into a circle.

### 3. Foodtrucken — the chicken truck

| | |
| --- | --- |
| Ratio | roughly 3:2 (viewBox `0 0 300 190`) |
| Source | `raw_pictures/fb7.jpg` (side on, hatch open), `fb1.jpg`, `fb10.jpg` |
| Renders at | up to 448 px on the front page; ~150 px on narrow screens |
| File | `src/components/art/Foodtruck.astro` |

The hero of the whole site, and now the actual vehicle: brown box van, cab at
the front left, one long serving hatch, and the side panel lifted to become the
awning with the signboard painted on it — so the sign only reads when the truck
is open, exactly as in life.

An earlier version of this drawing was a generic red van with a hen on the roof.
That was invented and it is gone.

Still missing, and worth adding if anyone redraws it: the mascot decal on the
box side, and the menu chalked on the hatch.

### 4. Pølsevognen — "Tonny's"

| | |
| --- | --- |
| Ratio | roughly 3:2 (viewBox `0 0 300 190`) |
| Source | `raw_pictures/fb5.jpg`, and the flyer in `fb9_lej_en_poelsevogn.jpg` |
| Renders at | 256 px in the `/ydelser` header, ~200 px on the front page |
| File | `src/components/art/Polsevogn.astro` |

The real cart: bright red, single axle, two serving hatches with the awnings
propped open, hot dogs painted either side of the same blue signboard the truck
carries, tow bar at the back.

Deliberately secondary to the truck everywhere it appears — never drawn larger,
never alone on the front page.

### 5. Kyllingespiddet — chickens on the spit

| | |
| --- | --- |
| Ratio | roughly 2:1 (viewBox `0 0 290 150`) |
| Source | `raw_pictures/fb3.jpg` |
| Renders at | up to 384 px at the top of the Menu panel |
| File | `src/components/art/Kyllingespid.astro` |

Three birds on the rod, grill marks, legs tied. The most appetising thing in the
photo set and the thing the business is named after, so it opens the menu.

### 6. Indehaveren — the owner

| | |
| --- | --- |
| Ratio | 4:5 (viewBox `0 0 200 250`) |
| Source | `raw_pictures/owner.jpg` — the shorter of the two men, on the right |
| Renders at | 224–288 px on `/kontakt` |
| File | `src/components/art/Indehaver.astro` (not rendered anywhere) |

**Not in use.** It was on `/kontakt` and the likeness was not good enough, so
the page now carries no portrait rather than a poor one. The drawing stays in
the repository as a starting point, nothing more.

A face is the one subject in this set where a flat, heavy-keyline cartoon does
not do the work — the vehicles only need to be the right shape, but a person
has to be recognisably themselves. **This slot wants a photograph**, not a
redraw: see `foto-ejer` below.

**`Ejer.astro` is the version this replaced** — a guess made before there was a
photograph, of a woman in a cap and apron with the hen on her shoulder. It is
unused. Delete it, or say what it is for.

## Photographs

Photos have not been taken yet. Each slot below already renders a drawing, so
the page is finished without them; a photo either replaces the drawing or joins
it in the same band.

Shoot in daylight, outdoors, no flash. Tight and high-contrast beats wide and
tidy — these sit next to solid black and mustard, so a washed-out grey photo
will look broken.

| Slot | Ratio | Where | What it needs to show |
| --- | --- | --- | --- |
| `foto-truck-paa-plads` | 3:2 | Front page art band, replacing or beside the truck drawing | The real truck at a real stop, hatch open, in the town. The proof that the drawing above is a real vehicle. |
| `foto-mad` | 1:1 | `/ydelser`, beside the Foodtruck section | The food, close, in the hand or in the box. No table settings, no props. |
| `foto-polsevogn` | 3:2 | `/ydelser` header, replacing the drawing | The wagon set up at an event, ideally with people around it. |
| `foto-ejer` | 4:5 | `/kontakt`, replacing the drawing | Her, at the hatch. Head and shoulders, looking at the camera. `fb2.jpg` and `fb7.jpg` already show someone serving, but neither is a portrait. |
| `foto-pattegris` | 3:2 | `/ydelser`, beside the party sections | `fb6.jpg` — a whole pig on the grill. It is the most striking photo in the set and it advertises a service the site does not currently mention. |

### Technical

Local images belong in `src/assets/`, not `public/`, so they are hashed and
optimised at build time:

```astro
---
import { Image } from 'astro:assets';
import truck from '../assets/foto-truck-paa-plads.jpg';
---
<Image src={truck} alt="Foodtrucken på Torvet" widths={[400, 800, 1200]} />
```

The Cloudflare `IMAGES` binding is already configured, so `<Image />` needs no
further setup. The free tier covers 5,000 unique transformations a month, which
is far more than four photos on four pages will ever use.

Alt text is Danish, describes what is in the frame, and is never left empty on a
photograph. The drawings are the opposite: they are decorative wherever they
repeat something the text already says, and they are marked `aria-hidden` there.
