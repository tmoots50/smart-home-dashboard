// Minimal RSS 2.0 + Atom parser + headline selector. Pure functions — runs in
// CF Workers (no DOM, no deps). Extracts only what the headlines widget needs:
// title, link, publishedAt.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseFeed(xml) {
  const atomBlocks = matchBlocks(xml, /<entry\b[\s\S]*?<\/entry>/g);
  const isAtom = atomBlocks.length > 0;
  const blocks = isAtom ? atomBlocks : matchBlocks(xml, /<item\b[\s\S]*?<\/item>/g);
  return blocks
    .map(b => parseBlock(b, isAtom))
    .filter(i => i.title && i.publishedAt);
}

function matchBlocks(s, re) {
  return Array.from(s.matchAll(re), m => m[0]);
}

function parseBlock(block, isAtom) {
  const titleRaw = pick(block, /<title[^>]*>([\s\S]*?)<\/title>/);
  const dateRaw = isAtom
    ? (pick(block, /<published>([^<]+)<\/published>/)
       || pick(block, /<updated>([^<]+)<\/updated>/))
    : pick(block, /<pubDate>([^<]+)<\/pubDate>/);
  const url = extractLink(block, isAtom);
  const date = dateRaw ? new Date(dateRaw) : null;
  return {
    title: titleRaw ? decodeEntities(titleRaw) : null,
    publishedAt: date && !isNaN(date) ? date.toISOString() : null,
    url,
  };
}

function extractLink(block, isAtom) {
  if (isAtom) {
    const m = block.match(/<link\s[^>]*rel=["']?alternate["']?[^>]*href=["']([^"']+)["']/i)
           || block.match(/<link\s[^>]*href=["']([^"']+)["'][^>]*rel=["']?alternate["']?/i)
           || block.match(/<link\s[^>]*href=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }
  const m = block.match(/<link>([^<]+)<\/link>/);
  return m ? m[1].trim() : null;
}

function pick(s, re) {
  const m = s.match(re);
  return m ? m[1] : null;
}

// Pick `max` items from `groups`, guaranteeing at least one from each non-empty
// source (the freshest from that source). Remaining slots filled by global
// recency. Output is sorted newest-first for display.
export function selectHeadlines(groups, max) {
  const sorted = groups
    .map(g => ({
      source: g.source,
      items: [...(g.items || [])]
        .filter(i => i.publishedAt)
        .sort(byDateDesc),
    }))
    .filter(g => g.items.length);
  if (!sorted.length) return [];

  const picked = [];
  const seen = new Set();
  for (const g of sorted) {
    picked.push(g.items[0]);
    seen.add(g.items[0]);
    if (picked.length >= max) break;
  }
  if (picked.length < max) {
    const rest = sorted.flatMap(g => g.items)
      .filter(i => !seen.has(i))
      .sort(byDateDesc);
    for (const item of rest) {
      picked.push(item);
      if (picked.length >= max) break;
    }
  }
  return picked.sort(byDateDesc);
}

function byDateDesc(a, b) {
  return +new Date(b.publishedAt) - +new Date(a.publishedAt);
}
