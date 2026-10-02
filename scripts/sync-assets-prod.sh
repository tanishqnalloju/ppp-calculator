#!/usr/bin/env bash
# Promote current v2 sources into public/ for production Worker (ppp.tanishqnalloju.com).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/sync-assets-v2.sh"
rm -rf "$ROOT/public"
cp -a "$ROOT/public-v2" "$ROOT/public"

cat > "$ROOT/public/robots.txt" <<'ROBOTS'
User-agent: *
Allow: /

Sitemap: https://ppp.tanishqnalloju.com/sitemap.xml
ROBOTS

cat > "$ROOT/public/sitemap.xml" <<'SITEMAP'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ppp.tanishqnalloju.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
SITEMAP

python3 - "$ROOT/public/index.html" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
html = p.read_text()
html = html.replace("https://v2.ppp.tanishqnalloju.com", "https://ppp.tanishqnalloju.com")
html = html.replace(
    '<a href="https://ppp.tanishqnalloju.com/">v1</a>',
    '<a href="https://v2.ppp.tanishqnalloju.com/">v2 staging</a>',
)
p.write_text(html)
PY

echo "Promoted v2 → public/ for production ($(find "$ROOT/public" -type f | wc -l) files)"
