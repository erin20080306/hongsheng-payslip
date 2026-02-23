// Generate PWA icons with orange theme
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// SVG template for orange-themed icon with white background
const createSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="white"/>
  <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" rx="${size * 0.1}" fill="#f97316"/>
  <text x="${size / 2}" y="${size * 0.45}" font-family="Arial, sans-serif" font-size="${size * 0.25}" font-weight="bold" fill="white" text-anchor="middle">宏盛</text>
  <text x="${size / 2}" y="${size * 0.7}" font-family="Arial, sans-serif" font-size="${size * 0.15}" fill="white" text-anchor="middle">薪資</text>
</svg>`;

const publicDir = path.join(__dirname, '..', 'public');

// Create SVG files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.svg'), createSvg(192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.svg'), createSvg(512));

console.log('SVG icons generated in public/');
console.log('To convert to PNG, use an online converter or:');
console.log('  npx svg2png-cli public/pwa-192x192.svg -o public/pwa-192x192.png');
console.log('  npx svg2png-cli public/pwa-512x512.svg -o public/pwa-512x512.png');
