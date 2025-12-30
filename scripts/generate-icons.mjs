/**
 * Generate PWA icons for AmiDash
 * Run with: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// AmiDash brand color (sky-500)
const brandColor = '#0ea5e9';
const textColor = '#ffffff';

/**
 * Create an SVG icon with the AmiDash logo
 */
function createIconSVG(size) {
  const fontSize = Math.round(size * 0.35);
  const smallFontSize = Math.round(size * 0.12);

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0284c7;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.02}" flood-opacity="0.3"/>
        </filter>
      </defs>

      <!-- Background with rounded corners -->
      <rect
        x="0" y="0"
        width="${size}" height="${size}"
        rx="${size * 0.2}" ry="${size * 0.2}"
        fill="url(#bg)"
      />

      <!-- Inner highlight -->
      <rect
        x="${size * 0.05}" y="${size * 0.05}"
        width="${size * 0.9}" height="${size * 0.45}"
        rx="${size * 0.15}" ry="${size * 0.15}"
        fill="rgba(255,255,255,0.1)"
      />

      <!-- Main text "A" -->
      <text
        x="${size * 0.5}"
        y="${size * 0.62}"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="${textColor}"
        text-anchor="middle"
        filter="url(#shadow)"
      >A</text>

      <!-- Subtitle "DASH" -->
      <text
        x="${size * 0.5}"
        y="${size * 0.82}"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${smallFontSize}"
        font-weight="600"
        fill="rgba(255,255,255,0.9)"
        text-anchor="middle"
        letter-spacing="${size * 0.02}"
      >DASH</text>
    </svg>
  `;
}

/**
 * Create a simple fallback icon (just letter A with gradient)
 */
function createSimpleIconSVG(size) {
  const fontSize = Math.round(size * 0.5);

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0284c7;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect
        x="0" y="0"
        width="${size}" height="${size}"
        rx="${size * 0.2}" ry="${size * 0.2}"
        fill="url(#bg)"
      />

      <!-- Letter A -->
      <text
        x="${size * 0.5}"
        y="${size * 0.68}"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="${textColor}"
        text-anchor="middle"
      >A</text>
    </svg>
  `;
}

async function generateIcons() {
  console.log('Generating PWA icons...\n');

  const sizes = [
    { size: 192, name: 'icon-192x192.png' },
    { size: 512, name: 'icon-512x512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 16, name: 'favicon-16x16.png' },
  ];

  for (const { size, name } of sizes) {
    const svg = size >= 128 ? createIconSVG(size) : createSimpleIconSVG(size);
    const outputPath = join(publicDir, name);

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);

      console.log(`✓ Created ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`✗ Failed to create ${name}:`, error.message);
    }
  }

  // Also create favicon.ico (using the 32x32 version)
  console.log('\nNote: For favicon.ico, you can use the favicon-32x32.png or convert it using an online tool.');

  console.log('\n✓ PWA icons generated successfully!');
  console.log('\nFiles created in /public/:');
  sizes.forEach(({ name }) => console.log(`  - ${name}`));
}

generateIcons().catch(console.error);
