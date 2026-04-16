/**
 * Audit #7: Image / Media Integrity
 * READ-ONLY — static analysis only, no network fetches
 */

import * as fs from 'fs';

const DUMP_PATH = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/07-images.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/07-images.md';

type Doc = Record<string, any> & { id?: string; _id?: string };

function getId(d: Doc): string {
  return d.id || d._id || d.docId || d.propertyId || '(unknown)';
}

function isActive(d: Doc): boolean {
  return d.isActive !== false;
}

function firstString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function imagesArr(d: Doc): string[] | null {
  if (Array.isArray(d.images)) return d.images.filter((x) => typeof x === 'string');
  return null;
}

function primaryImage(d: Doc): string | null {
  const img = firstString(d.imgSrc, d.cardImage, d.cardImageUrl);
  if (img) return img;
  const arr = imagesArr(d);
  if (arr && arr.length > 0) return arr[0];
  const photos = Array.isArray(d.photos) ? d.photos : null;
  if (photos && photos.length > 0 && typeof photos[0] === 'string') return photos[0];
  const photoUrls = Array.isArray(d.photoUrls) ? d.photoUrls : null;
  if (photoUrls && photoUrls.length > 0 && typeof photoUrls[0] === 'string') return photoUrls[0];
  const imageUrls = Array.isArray(d.imageUrls) ? d.imageUrls : null;
  if (imageUrls && imageUrls.length > 0 && typeof imageUrls[0] === 'string') return imageUrls[0];
  return null;
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return '(invalid-url)';
  }
}

const KNOWN_HOST_RE = /(zillowstatic|zillow\.com|r2\.dev|r2\.cloudflarestorage\.com|cloudflare|googleapis|gstatic|googleusercontent|ownerfi|maps\.googleapis)/i;
const PLACEHOLDER_RE = /(placeholder|default[-_]?image|no[-_]?image|missing|blank\.png|blank\.jpg)/i;

function main() {
  const raw = fs.readFileSync(DUMP_PATH, 'utf8');
  const docs: Doc[] = JSON.parse(raw);
  console.log(`Loaded ${docs.length} docs`);

  const activeDocs = docs.filter(isActive);
  console.log(`Active: ${activeDocs.length}`);

  // Categories
  const c1_noPrimary: string[] = [];
  const c2_imagesNotArray: Array<{ id: string; type: string }> = [];
  const c3_imageCountMismatch: Array<{ id: string; imageCount: number; actual: number }> = [];
  const c4_crossDocDupeImages: Array<{ url: string; docIds: string[] }> = [];
  const c5_malformedUrls: Array<{ id: string; url: string }> = [];
  const c6_placeholderUrls: Array<{ id: string; url: string }> = [];
  const c7_suspiciousHost: Array<{ id: string; host: string; url: string }> = [];
  const c8_cdnInconsistency: {
    staticZillow: string[];
    photosZillow: string[];
  } = { staticZillow: [], photosZillow: [] };
  const c9_hostFreq: Record<string, number> = {};
  const c10_r2ButZillowPrimary: string[] = [];

  // Cross-doc image URL map
  const urlToDocIds: Map<string, string[]> = new Map();

  for (const d of activeDocs) {
    const id = getId(d);

    // C2: images not array when set
    if (d.images !== undefined && d.images !== null && !Array.isArray(d.images)) {
      c2_imagesNotArray.push({ id, type: typeof d.images });
    }

    const arr = imagesArr(d);
    const primary = primaryImage(d);

    // C1: no primary image
    if (!primary) {
      c1_noPrimary.push(id);
    }

    // C3: imageCount mismatch
    const declaredCount =
      typeof d.imageCount === 'number'
        ? d.imageCount
        : typeof d.photoCount === 'number'
        ? d.photoCount
        : null;
    if (declaredCount !== null && arr !== null) {
      if (Math.abs(declaredCount - arr.length) > 0) {
        c3_imageCountMismatch.push({ id, imageCount: declaredCount, actual: arr.length });
      }
    }

    // C4 prep: record every image URL from images[] per doc
    if (arr) {
      const seenInDoc = new Set<string>();
      for (const u of arr) {
        if (typeof u !== 'string' || seenInDoc.has(u)) continue;
        seenInDoc.add(u);
        const bucket = urlToDocIds.get(u);
        if (bucket) bucket.push(id);
        else urlToDocIds.set(u, [id]);
      }
    }

    // C5: malformed urls (check primary + images[])
    const allUrls: string[] = [];
    if (primary) allUrls.push(primary);
    if (arr) allUrls.push(...arr);
    for (const u of allUrls) {
      if (typeof u !== 'string' || !u.trim()) continue;
      if (!/^https?:\/\//i.test(u)) {
        c5_malformedUrls.push({ id, url: u.slice(0, 200) });
        break; // one per doc
      }
    }

    // C6: placeholder
    if (primary && PLACEHOLDER_RE.test(primary)) {
      c6_placeholderUrls.push({ id, url: primary });
    } else if (arr) {
      const hit = arr.find((u) => typeof u === 'string' && PLACEHOLDER_RE.test(u));
      if (hit) c6_placeholderUrls.push({ id, url: hit });
    }

    // C7: suspicious host on primary
    if (primary && /^https?:\/\//i.test(primary)) {
      const host = hostOf(primary);
      c9_hostFreq[host] = (c9_hostFreq[host] || 0) + 1;
      if (!KNOWN_HOST_RE.test(host)) {
        c7_suspiciousHost.push({ id, host, url: primary });
      }
    }

    // C8: static.zillowstatic vs photos.zillowstatic
    const firstImg = primary;
    if (firstImg && /static\.zillowstatic/i.test(firstImg)) c8_cdnInconsistency.staticZillow.push(id);
    if (firstImg && /photos\.zillowstatic/i.test(firstImg)) c8_cdnInconsistency.photosZillow.push(id);

    // C10: r2Images set but primary is zillow
    const hasR2 =
      (Array.isArray(d.r2Images) && d.r2Images.length > 0) ||
      (d.r2Images && typeof d.r2Images === 'object' && Object.keys(d.r2Images || {}).length > 0);
    if (hasR2 && primary && /zillow/i.test(primary)) {
      c10_r2ButZillowPrimary.push(id);
    }
  }

  // C4 finalize — only URLs appearing in >1 distinct doc
  for (const [url, ids] of urlToDocIds.entries()) {
    const distinct = Array.from(new Set(ids));
    if (distinct.length > 1) {
      c4_crossDocDupeImages.push({ url, docIds: distinct });
    }
  }
  c4_crossDocDupeImages.sort((a, b) => b.docIds.length - a.docIds.length);

  // Sort host freq desc
  const hostFreqSorted = Object.entries(c9_hostFreq).sort((a, b) => b[1] - a[1]);

  const result = {
    totalDocs: docs.length,
    activeDocs: activeDocs.length,
    categories: {
      c1_noPrimaryImage: { count: c1_noPrimary.length, ids: c1_noPrimary.slice(0, 20) },
      c2_imagesNotArray: {
        count: c2_imagesNotArray.length,
        samples: c2_imagesNotArray.slice(0, 20),
      },
      c3_imageCountMismatch: {
        count: c3_imageCountMismatch.length,
        samples: c3_imageCountMismatch.slice(0, 20),
      },
      c4_crossDocDupeImages: {
        count: c4_crossDocDupeImages.length,
        samples: c4_crossDocDupeImages.slice(0, 20).map((x) => ({
          url: x.url,
          dupeCount: x.docIds.length,
          firstDocIds: x.docIds.slice(0, 5),
        })),
      },
      c5_malformedUrls: { count: c5_malformedUrls.length, samples: c5_malformedUrls.slice(0, 20) },
      c6_placeholderUrls: {
        count: c6_placeholderUrls.length,
        samples: c6_placeholderUrls.slice(0, 20),
      },
      c7_suspiciousHost: { count: c7_suspiciousHost.length, samples: c7_suspiciousHost.slice(0, 20) },
      c8_cdnInconsistency: {
        staticZillowCount: c8_cdnInconsistency.staticZillow.length,
        photosZillowCount: c8_cdnInconsistency.photosZillow.length,
        staticZillowIds: c8_cdnInconsistency.staticZillow.slice(0, 20),
        photosZillowIds: c8_cdnInconsistency.photosZillow.slice(0, 20),
      },
      c9_hostFrequency: hostFreqSorted,
      c10_r2ButZillowPrimary: {
        count: c10_r2ButZillowPrimary.length,
        ids: c10_r2ButZillowPrimary.slice(0, 20),
      },
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
  console.log(`Wrote ${OUT_JSON}`);

  const md: string[] = [];
  md.push(`# Audit #7: Image / Media Integrity`);
  md.push('');
  md.push(`Total docs scanned: **${docs.length}**  \nActive docs scanned: **${activeDocs.length}**`);
  md.push('');
  md.push(`## Counts`);
  md.push('');
  md.push(`| # | Category | Count |`);
  md.push(`|---|----------|------:|`);
  md.push(`| c1 | No primary image | ${c1_noPrimary.length} |`);
  md.push(`| c2 | \`images\` is non-array when set | ${c2_imagesNotArray.length} |`);
  md.push(`| c3 | \`imageCount\` mismatch vs \`images.length\` | ${c3_imageCountMismatch.length} |`);
  md.push(`| c4 | Cross-doc dupe image URLs | ${c4_crossDocDupeImages.length} |`);
  md.push(`| c5 | Malformed URL (no http/https) | ${c5_malformedUrls.length} |`);
  md.push(`| c6 | Placeholder/default image URL | ${c6_placeholderUrls.length} |`);
  md.push(`| c7 | Suspicious host on primary | ${c7_suspiciousHost.length} |`);
  md.push(`| c8a | static.zillowstatic primaries | ${c8_cdnInconsistency.staticZillow.length} |`);
  md.push(`| c8b | photos.zillowstatic primaries | ${c8_cdnInconsistency.photosZillow.length} |`);
  md.push(`| c10 | r2Images set but primary still Zillow | ${c10_r2ButZillowPrimary.length} |`);
  md.push('');

  md.push(`## c9 — Primary Image Host Frequency`);
  md.push('');
  md.push(`| Host | Count |`);
  md.push(`|------|------:|`);
  for (const [h, n] of hostFreqSorted) md.push(`| \`${h}\` | ${n} |`);
  md.push('');

  const detail = (title: string, ids: string[]) => {
    md.push(`### ${title} — ${ids.length}`);
    md.push('');
    if (ids.length === 0) md.push(`_none_`);
    else {
      md.push(`First 20 IDs:`);
      md.push('');
      ids.slice(0, 20).forEach((x) => md.push(`- \`${x}\``));
    }
    md.push('');
  };

  detail('c1 — No primary image', c1_noPrimary);

  md.push(`### c2 — images non-array — ${c2_imagesNotArray.length}`);
  md.push('');
  c2_imagesNotArray.slice(0, 20).forEach((x) => md.push(`- \`${x.id}\` — type: ${x.type}`));
  md.push('');

  md.push(`### c3 — imageCount mismatch — ${c3_imageCountMismatch.length}`);
  md.push('');
  c3_imageCountMismatch
    .slice(0, 20)
    .forEach((x) => md.push(`- \`${x.id}\` — declared ${x.imageCount}, actual ${x.actual}`));
  md.push('');

  md.push(`### c4 — Cross-doc dupe image URLs — ${c4_crossDocDupeImages.length}`);
  md.push('');
  c4_crossDocDupeImages.slice(0, 20).forEach((x) => {
    md.push(`- ${x.docIds.length} docs share: \`${x.url.slice(0, 120)}\``);
    md.push(`  - first doc IDs: ${x.docIds.slice(0, 5).map((i) => `\`${i}\``).join(', ')}`);
  });
  md.push('');

  md.push(`### c5 — Malformed URLs — ${c5_malformedUrls.length}`);
  md.push('');
  c5_malformedUrls.slice(0, 20).forEach((x) => md.push(`- \`${x.id}\` — \`${x.url}\``));
  md.push('');

  md.push(`### c6 — Placeholder URLs — ${c6_placeholderUrls.length}`);
  md.push('');
  c6_placeholderUrls.slice(0, 20).forEach((x) => md.push(`- \`${x.id}\` — \`${x.url}\``));
  md.push('');

  md.push(`### c7 — Suspicious host — ${c7_suspiciousHost.length}`);
  md.push('');
  c7_suspiciousHost.slice(0, 20).forEach((x) => md.push(`- \`${x.id}\` — host: \`${x.host}\``));
  md.push('');

  md.push(`### c8a — static.zillowstatic primaries — ${c8_cdnInconsistency.staticZillow.length}`);
  md.push('');
  c8_cdnInconsistency.staticZillow.slice(0, 20).forEach((x) => md.push(`- \`${x}\``));
  md.push('');

  md.push(`### c8b — photos.zillowstatic primaries — ${c8_cdnInconsistency.photosZillow.length}`);
  md.push('');
  c8_cdnInconsistency.photosZillow.slice(0, 20).forEach((x) => md.push(`- \`${x}\``));
  md.push('');

  detail('c10 — r2Images set but primary still Zillow', c10_r2ButZillowPrimary);

  fs.writeFileSync(OUT_MD, md.join('\n'));
  console.log(`Wrote ${OUT_MD}`);

  console.log('\n=== SUMMARY ===');
  console.log(`  c1 noPrimary: ${c1_noPrimary.length}`);
  console.log(`  c2 nonArrayImages: ${c2_imagesNotArray.length}`);
  console.log(`  c3 imageCountMismatch: ${c3_imageCountMismatch.length}`);
  console.log(`  c4 crossDocDupeImages: ${c4_crossDocDupeImages.length}`);
  console.log(`  c5 malformedUrls: ${c5_malformedUrls.length}`);
  console.log(`  c6 placeholderUrls: ${c6_placeholderUrls.length}`);
  console.log(`  c7 suspiciousHost: ${c7_suspiciousHost.length}`);
  console.log(`  c8a static.zillowstatic: ${c8_cdnInconsistency.staticZillow.length}`);
  console.log(`  c8b photos.zillowstatic: ${c8_cdnInconsistency.photosZillow.length}`);
  console.log(`  c10 r2ButZillowPrimary: ${c10_r2ButZillowPrimary.length}`);
  console.log(`  Top hosts:`);
  hostFreqSorted.slice(0, 10).forEach(([h, n]) => console.log(`    ${h}: ${n}`));
}

main();
