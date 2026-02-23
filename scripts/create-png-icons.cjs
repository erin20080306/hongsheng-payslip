// Create simple PNG icons using canvas
// This creates basic orange icons for PWA

const fs = require('fs');
const path = require('path');

// Create a simple 1x1 orange PNG as base64 and tile it
// For production, replace with actual designed icons

// Minimal valid PNG (orange pixel)
const createMinimalPng = (size) => {
  // This creates a very basic PNG structure
  // For proper icons, use a design tool or online generator
  
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const width = size;
  const height = size;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT chunk - simplified solid orange
  // Orange RGB: 249, 115, 22 (#f97316)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Create a simple gradient/pattern
      const centerX = width / 2;
      const centerY = height / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
      
      if (dist < width * 0.4) {
        // Orange center
        rawData.push(249, 115, 22);
      } else if (dist < width * 0.45) {
        // White border
        rawData.push(255, 255, 255);
      } else {
        // White background
        rawData.push(255, 255, 255);
      }
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
};

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const publicDir = path.join(__dirname, '..', 'public');

try {
  const png192 = createMinimalPng(192);
  const png512 = createMinimalPng(512);
  
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
  
  console.log('PNG icons created successfully!');
  console.log('  - public/pwa-192x192.png');
  console.log('  - public/pwa-512x512.png');
} catch (err) {
  console.error('Error creating PNG:', err.message);
}
