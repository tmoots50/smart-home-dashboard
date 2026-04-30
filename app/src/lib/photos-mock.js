// Mock photos. SVG gradients as data URIs so we have a working slideshow
// without binary fixtures in the repo. Real source (rclone'd Drive folder)
// will be normalized to the same {src, caption} shape.

const GRADIENTS = [
  { from: '#3b3a39', to: '#9b8b6e', caption: 'Mabel · week four' },
  { from: '#1b2a3a', to: '#4a6b8a', caption: 'Brooklyn rooftop · April' },
  { from: '#2a1f1a', to: '#7a5a3a', caption: 'Coffee at Joyce' },
  { from: '#1a2a1a', to: '#5a7a4a', caption: 'Prospect Park · golden hour' },
];

function gradientDataUri({ from, to, caption }) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}"/>
          <stop offset="100%" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g)"/>
      <text x="40" y="560" fill="#f3f1ec" opacity="0.25"
            font-family="Georgia,serif" font-size="36" font-style="italic">${caption}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getMockPhotos() {
  return GRADIENTS.map(g => ({
    src: gradientDataUri(g),
    caption: g.caption,
  }));
}
