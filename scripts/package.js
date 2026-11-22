// scripts/package.js - Package extension into production distribution zip
const fs = require('fs');
const path = require('path');
const JSZip = require('../popup/jszip.min.js');

async function packageExtension() {
  const rootDir = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const version = manifest.version || '1.0.0';
  const outDir = path.join(rootDir, 'dist');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outZipName = `image-downloader-v${version}.zip`;
  const outZipPath = path.join(outDir, outZipName);

  console.log(`📦 Packaging Image Downloader v${version}...`);

  const zip = new JSZip();

  // Files and directories to include in distribution zip
  const filesToInclude = [
    'manifest.json',
    'background.js',
    'content.js',
    'icon-48.png',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png',
    'icons/icon.svg',
    'popup/popup.html',
    'popup/popup.css',
    'popup/popup.js',
    'popup/jszip.min.js'
  ];

  for (const relPath of filesToInclude) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const data = fs.readFileSync(fullPath);
      // Ensure forward slashes in zip
      const zipPath = relPath.replace(/\\/g, '/');
      zip.file(zipPath, data);
      console.log(`   + ${zipPath}`);
    } else {
      console.warn(`   ! Missing file: ${relPath}`);
    }
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  fs.writeFileSync(outZipPath, buffer);
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`\n🎉 Distribution package created: dist/${outZipName} (${sizeMb} MB, ${buffer.length} bytes)`);
}

packageExtension().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
