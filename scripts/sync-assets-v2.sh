#!/usr/bin/env bash
# Sync v2 sources + shared data into public-v2/ for Worker deploy.
# Bundles modular JS into one app.js and inlines tokens into styles.css
# so Cloudflare Assets reliably serves every path (nested /js/* was SPA-falling-through).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public-v2"

rm -rf "$OUT"
mkdir -p "$OUT/data"

{
  cat "$ROOT/v2/js/compute.js"
  echo
  cat "$ROOT/v2/js/tax.js"
  echo
  cat "$ROOT/v2/js/theme.js"
  echo
  cat "$ROOT/v2/js/url.js"
  echo
  cat "$ROOT/v2/js/pickers.js"
  echo
  cat "$ROOT/v2/js/render.js"
  echo
  cat "$ROOT/v2/app.js"
} > "$OUT/app.js"

{
  cat "$ROOT/v2/tokens.css"
  echo
  cat "$ROOT/v2/styles.css"
} > "$OUT/styles.css"

cp "$ROOT/v2/tokens.css" "$OUT/tokens.css"
cp "$ROOT/v2/favicon.svg" "$OUT/favicon.svg"
cp "$ROOT/data/countries.json" "$OUT/data/countries.json"
cp "$ROOT/data/commodities.json" "$OUT/data/commodities.json"
cp "$ROOT/data/taxes.json" "$OUT/data/taxes.json"

python3 - "$ROOT" "$OUT" <<'PY'
import re, sys
from pathlib import Path
root, out = Path(sys.argv[1]), Path(sys.argv[2])
html = (root / "v2/index.html").read_text()
html = html.replace(
    '<link rel="stylesheet" href="tokens.css" />\n<link rel="stylesheet" href="styles.css" />',
    '<link rel="stylesheet" href="styles.css" />',
)
html = re.sub(r'<script src="js/[^"]+" defer></script>\n?', '', html)
if 'src="app.js"' not in html:
    html = html.replace('</body>', '<script src="app.js" defer></script>\n</body>')
(out / "index.html").write_text(html)
print("Wrote", out / "index.html")
PY

cat > "$OUT/robots.txt" <<'ROBOTS'
User-agent: *
Allow: /

Sitemap: https://v2.ppp.tanishqnalloju.com/sitemap.xml
ROBOTS

cat > "$OUT/sitemap.xml" <<'SITEMAP'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://v2.ppp.tanishqnalloju.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
SITEMAP

echo "Synced v2 → public-v2/ ($(find "$OUT" -type f | wc -l) files)"
