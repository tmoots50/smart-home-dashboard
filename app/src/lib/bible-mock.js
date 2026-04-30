// Mock bible verses. Rotates by day-of-year so the wall changes daily but
// returns to the same verse on the same date next year. Real source could
// be a public verse-of-the-day API later.

const VERSES = [
  { ref: 'Psalm 46:10',     text: 'Be still, and know that I am God.' },
  { ref: 'Proverbs 3:5–6',  text: 'Trust in the Lord with all your heart, and lean not on your own understanding.' },
  { ref: 'Lamentations 3:22–23', text: 'His mercies are new every morning; great is your faithfulness.' },
  { ref: 'Isaiah 40:31',    text: 'Those who hope in the Lord will renew their strength; they will soar on wings like eagles.' },
  { ref: 'Philippians 4:6–7', text: 'Do not be anxious about anything; in every situation present your requests to God.' },
  { ref: 'Matthew 11:28',   text: 'Come to me, all you who are weary and burdened, and I will give you rest.' },
  { ref: 'Romans 8:28',     text: 'In all things God works for the good of those who love him.' },
  { ref: 'Psalm 23:1',      text: 'The Lord is my shepherd; I shall not want.' },
  { ref: 'Joshua 1:9',      text: 'Be strong and courageous. Do not be afraid; the Lord your God will be with you wherever you go.' },
  { ref: 'Ecclesiastes 3:1', text: 'For everything there is a season, and a time for every matter under heaven.' },
  { ref: 'Psalm 127:3',     text: 'Behold, children are a heritage from the Lord, the fruit of the womb a reward.' },
  { ref: 'Zephaniah 3:17',  text: 'The Lord your God is with you, the Mighty Warrior who saves.' },
];

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86_400_000);
}

export function getMockBibleVerse(now = new Date()) {
  return VERSES[dayOfYear(now) % VERSES.length];
}
