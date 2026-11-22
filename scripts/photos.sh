#!/bin/sh
# Regenerates public/photos/*.webp from raw_pictures/. Requires cwebp.
# Fonts (downloaded once with curl -fL -o, not by this script):
#  https://cdn.jsdelivr.net/npm/@fontsource/alfa-slab-one@5.3.0/files/alfa-slab-one-latin-400-normal.woff2
#    -> public/fonts/alfa-slab-one-latin-400.woff2
#  https://cdn.jsdelivr.net/npm/@fontsource-variable/source-sans-3@5.3.1/files/source-sans-3-latin-wght-normal.woff2
#    -> public/fonts/source-sans-3-latin-wght.woff2
# Logo (owner's own, from the old site; source is 1080x279 RGBA). Download with
# curl -fL -o logo.png https://chicks-on-wheels.vercel.app/logo.png, then
# (the crop drops a dark speck in the bottom-right corner):
#  cwebp -q 85 -alpha_q 100 -crop 0 0 1080 257 -resize 220 0 logo.png -o public/logo.webp
#  cwebp -q 85 -alpha_q 100 -crop 0 0 1080 257 -resize 440 0 logo.png -o public/logo@2x.webp
set -eu
cd "$(dirname "$0")/.."
o=public/photos
cwebp -quiet -q 78 -resize 640 0 raw_pictures/fb3.jpg -o $o/hero-640.webp
cwebp -quiet -q 78 -resize 960 0 raw_pictures/fb3.jpg -o $o/hero-960.webp
cwebp -quiet -q 78 -resize 800 0 raw_pictures/fb4.jpg -o $o/truck-800.webp
cwebp -quiet -q 78 -resize 1200 0 raw_pictures/fb4.jpg -o $o/truck-1200.webp
cwebp -quiet -q 78 -resize 800 0 raw_pictures/fb8.jpg -o $o/ydelser-800.webp
cwebp -quiet -q 78 -resize 1200 0 raw_pictures/fb8.jpg -o $o/ydelser-1200.webp
cwebp -quiet -q 78 -resize 800 0 raw_pictures/fb9_lej_en_poelsevogn.jpg -o $o/polsevogn-800.webp
cwebp -quiet -q 78 -resize 600 0 raw_pictures/owner.jpg -o $o/ejer-600.webp
cwebp -quiet -q 78 -resize 600 0 raw_pictures/fb4.jpg -o $o/truck-600.webp
cwebp -quiet -q 78 -resize 600 0 raw_pictures/fb6.jpg -o $o/gris-600.webp
cwebp -quiet -q 78 -resize 800 0 raw_pictures/fb5.jpg -o $o/tonnys-800.webp

# Menu card pictures (public/photos/menu/*.webp) are the reference site's
# illustrations (https://chicks-on-wheels.vercel.app/menu), used with the
# owner's consent: 500px webp -> dwebp -> centre square crop -> 200x200, q80.

# Om os page
cwebp -quiet -q 82 -crop 352 110 403 537 raw_pictures/owner.jpg -o $o/tonny-portraet.webp   # Tonny only (right of the two)
cwebp -quiet -q 82 raw_pictures/fb2.jpg -o $o/tonny-luge-335.webp                       # Tonny in the hatch, source is 335px
cwebp -quiet -q 78 -resize 1200 0 raw_pictures/fb1.jpg -o $o/truck-side-1200.webp
