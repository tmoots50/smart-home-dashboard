import { describe, it, expect } from 'vitest';
import { decodeEntities, parseFeed, selectHeadlines, selectPool } from './rss.js';

describe('decodeEntities', () => {
  it('strips CDATA wrappers', () => {
    expect(decodeEntities('<![CDATA[hello]]>')).toBe('hello');
  });
  it('decodes numeric entities (curly quotes)', () => {
    expect(decodeEntities('&#8220;hi&#8221;')).toBe('“hi”');
  });
  it('decodes hex entities', () => {
    expect(decodeEntities('&#x2014;')).toBe('—');
  });
  it('decodes common named entities', () => {
    expect(decodeEntities('A &amp; B')).toBe('A & B');
  });
});

describe('parseFeed', () => {
  it('parses Atom <entry> blocks (Eater shape)', () => {
    const xml = `<feed>
      <entry>
        <title type="html"><![CDATA[The 38 Best Restaurants]]></title>
        <link rel="alternate" type="text/html" href="https://atlanta.eater.com/x"/>
        <id>https://atlanta.eater.com/x</id>
        <updated>2026-04-30T14:08:29+00:00</updated>
        <published>2026-04-30T14:06:37+00:00</published>
      </entry>
    </feed>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('The 38 Best Restaurants');
    expect(items[0].url).toBe('https://atlanta.eater.com/x');
    expect(items[0].publishedAt).toBe('2026-04-30T14:06:37.000Z');
  });

  it('parses RSS 2.0 <item> blocks (ATL Mag shape)', () => {
    const xml = `<rss><channel>
      <item>
        <title>College goals: 10 &#8220;rules&#8221; for Georgia Tech</title>
        <link>https://www.atlantamagazine.com/y</link>
        <pubDate>Thu, 07 May 2026 04:39:57 +0000</pubDate>
      </item>
    </channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('College goals: 10 “rules” for Georgia Tech');
    expect(items[0].url).toBe('https://www.atlantamagazine.com/y');
    expect(new Date(items[0].publishedAt).toUTCString()).toBe('Thu, 07 May 2026 04:39:57 GMT');
  });

  it('falls back to <updated> when <published> is absent', () => {
    const xml = `<feed><entry>
      <title>x</title>
      <link rel="alternate" href="https://e.com/x"/>
      <updated>2026-04-30T14:08:29+00:00</updated>
    </entry></feed>`;
    expect(parseFeed(xml)[0].publishedAt).toBe('2026-04-30T14:08:29.000Z');
  });

  it('drops items missing a title or date', () => {
    const xml = `<rss><channel>
      <item><title>no date</title><link>x</link></item>
      <item><pubDate>Thu, 07 May 2026 04:00:00 +0000</pubDate><link>x</link></item>
    </channel></rss>`;
    expect(parseFeed(xml)).toHaveLength(0);
  });
});

describe('selectHeadlines', () => {
  const item = (source, title, daysAgo) => ({
    source, title,
    publishedAt: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
  });

  it('guarantees at least one from each non-empty source', () => {
    const groups = [
      { source: 'Eater', items: [item('Eater', 'old-eater', 5)] },
      { source: 'ATL Mag', items: [
        item('ATL Mag', 'mag-1', 0),
        item('ATL Mag', 'mag-2', 1),
        item('ATL Mag', 'mag-3', 2),
      ]},
    ];
    const result = selectHeadlines(groups, 3);
    const sources = new Set(result.map(i => i.source));
    expect(sources).toEqual(new Set(['Eater', 'ATL Mag']));
  });

  it('outputs newest-first', () => {
    const groups = [
      { source: 'Eater', items: [item('Eater', 'eater-old', 5)] },
      { source: 'ATL Mag', items: [item('ATL Mag', 'mag-new', 0)] },
    ];
    const result = selectHeadlines(groups, 2);
    expect(result.map(i => i.title)).toEqual(['mag-new', 'eater-old']);
  });

  it('handles an empty source without breaking guarantee', () => {
    const groups = [
      { source: 'Eater', items: [] },
      { source: 'ATL Mag', items: [item('ATL Mag', 'm1', 0), item('ATL Mag', 'm2', 1)] },
    ];
    const result = selectHeadlines(groups, 3);
    expect(result.map(i => i.source)).toEqual(['ATL Mag', 'ATL Mag']);
  });

  it('does not exceed max', () => {
    const groups = [
      { source: 'Eater', items: [item('Eater', 'e1', 0), item('Eater', 'e2', 1)] },
      { source: 'ATL Mag', items: [item('ATL Mag', 'm1', 0), item('ATL Mag', 'm2', 1), item('ATL Mag', 'm3', 2)] },
    ];
    expect(selectHeadlines(groups, 3)).toHaveLength(3);
  });

  it('returns [] when every source is empty', () => {
    expect(selectHeadlines([{ source: 'A', items: [] }], 3)).toEqual([]);
  });
});

describe('selectPool', () => {
  const item = (source, title, daysAgo, url) => ({
    source, title, url: url ?? `https://x/${title}`,
    publishedAt: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
  });

  it('round-robins so a prolific feed cannot crowd others out', () => {
    const groups = [
      { source: 'Cheap', items: Array.from({ length: 10 }, (_, i) => item('Cheap', `c${i}`, i)) },
      { source: 'Mag', items: [item('Mag', 'm0', 0), item('Mag', 'm1', 1)] },
    ];
    const pool = selectPool(groups, 6);
    // both sources represented near the top despite Cheap having 5x the items
    expect(pool.slice(0, 2).map(i => i.source)).toEqual(['Cheap', 'Mag']);
    expect(pool.filter(i => i.source === 'Mag')).toHaveLength(2);
  });

  it('takes the freshest first within each source', () => {
    const groups = [
      { source: 'A', items: [item('A', 'old', 5), item('A', 'new', 0)] },
    ];
    expect(selectPool(groups, 2).map(i => i.title)).toEqual(['new', 'old']);
  });

  it('dedupes by url', () => {
    const groups = [
      { source: 'A', items: [item('A', 't1', 0, 'https://dup')] },
      { source: 'B', items: [item('B', 't2', 0, 'https://dup')] },
    ];
    expect(selectPool(groups, 5)).toHaveLength(1);
  });

  it('caps at max and drains without infinite-looping on all-dup input', () => {
    const groups = [
      { source: 'A', items: [item('A', 't', 0, 'https://same'), item('A', 't', 1, 'https://same')] },
    ];
    expect(selectPool(groups, 10)).toHaveLength(1);
  });

  it('returns [] when every source is empty', () => {
    expect(selectPool([{ source: 'A', items: [] }], 5)).toEqual([]);
  });
});
