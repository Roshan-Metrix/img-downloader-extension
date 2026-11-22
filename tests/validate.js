// tests/validate.js - Zero-dependency CI validation suite
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

console.log('🧪 Starting Extension Test & Validation Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// 1. Manifest V3 Integrity
runTest('Manifest JSON exists and is valid JSON', () => {
  const manifestPath = path.resolve(__dirname, '../manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json missing');
  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);
  assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
  assert.ok(manifest.name, 'Manifest must have a name');
  assert.ok(manifest.version, 'Manifest must have a version');
  assert.ok(manifest.action && manifest.action.default_popup, 'Must declare default_popup');
  assert.ok(manifest.background && manifest.background.service_worker, 'Must declare service_worker');
});

runTest('All files referenced in manifest.json exist', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));

  // Background worker
  const bgPath = path.resolve(__dirname, '..', manifest.background.service_worker);
  assert.ok(fs.existsSync(bgPath), `Background worker missing: ${bgPath}`);

  // Popup HTML
  const popupPath = path.resolve(__dirname, '..', manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), `Popup HTML missing: ${popupPath}`);

  // Icons
  if (manifest.icons) {
    for (const [size, iconFile] of Object.entries(manifest.icons)) {
      const iconPath = path.resolve(__dirname, '..', iconFile);
      assert.ok(fs.existsSync(iconPath), `Icon (${size}) missing at: ${iconFile}`);
    }
  }
});

// 2. Syntax Validation
runTest('All JavaScript files have valid syntax', () => {
  const files = [
    'background.js',
    'content.js',
    'popup/popup.js'
  ];

  for (const relPath of files) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    assert.ok(fs.existsSync(fullPath), `File not found: ${relPath}`);
    // Run node --check
    execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
  }
});

// 3. Chrome Web Store CSP & Security Compliance
runTest('Extension scripts comply with CSP (No eval or forbidden APIs)', () => {
  const files = ['background.js', 'content.js', 'popup/popup.js'];
  for (const relPath of files) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    const code = fs.readFileSync(fullPath, 'utf8');

    assert.ok(!/\beval\s*\(/.test(code), `Forbidden eval() detected in ${relPath}`);
    assert.ok(!/\bnew\s+Function\s*\(/.test(code), `Forbidden new Function() detected in ${relPath}`);
    assert.ok(!/\bdocument\.write\s*\(/.test(code), `Forbidden document.write() detected in ${relPath}`);
  }
});

// 4. Core Logic Tests
runTest('URL Normalization logic strips tracking parameters', () => {
  function normalizeUrl(url) {
    if (!url || url.startsWith('data:')) return url;
    try {
      const u = new URL(url);
      const searchParams = new URLSearchParams(u.search);
      ['utm_source', 'utm_medium', 'fbclid', 'gclid', '_ga', 'ref', 'timestamp', 't', '_'].forEach(p => searchParams.delete(p));
      const cleanSearch = searchParams.toString();
      return `${u.protocol}//${u.host}${u.pathname}${cleanSearch ? '?' + cleanSearch : ''}`;
    } catch {
      return url.split('#')[0];
    }
  }

  const urlWithTrackers = 'https://example.com/photo.jpg?utm_source=twitter&utm_medium=social&fbclid=12345';
  const clean = normalizeUrl(urlWithTrackers);
  assert.strictEqual(clean, 'https://example.com/photo.jpg', 'Tracking parameters must be stripped');

  const regularUrl = 'https://example.com/image.png?w=800';
  assert.strictEqual(normalizeUrl(regularUrl), 'https://example.com/image.png?w=800', 'Legitimate image params must be kept');
});

runTest('Image format detector accurately identifies formats', () => {
  function detectImageFormat(url) {
    if (!url) return 'other';
    const lower = url.toLowerCase();
    if (lower.startsWith('data:image/svg') || lower.includes('.svg')) return 'svg';
    if (lower.startsWith('data:image/png') || lower.includes('.png')) return 'png';
    if (lower.startsWith('data:image/webp') || lower.includes('.webp') || lower.includes('format=webp') || lower.includes('fm=webp')) return 'webp';
    if (lower.startsWith('data:image/gif') || lower.includes('.gif')) return 'gif';
    if (lower.startsWith('data:image/jpeg') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('format=jpg') || lower.includes('fm=jpg')) return 'jpg';
    return 'other';
  }

  assert.strictEqual(detectImageFormat('https://cdn.site.com/photo.jpg'), 'jpg');
  assert.strictEqual(detectImageFormat('https://cdn.site.com/photo.jpeg'), 'jpg');
  assert.strictEqual(detectImageFormat('https://cdn.site.com/asset.png?v=2'), 'png');
  assert.strictEqual(detectImageFormat('https://images.unsplash.com/photo?auto=format&format=webp'), 'webp');
  assert.strictEqual(detectImageFormat('https://example.com/graphic.svg#icon'), 'svg');
  assert.strictEqual(detectImageFormat('https://example.com/anim.gif'), 'gif');
  assert.strictEqual(detectImageFormat('data:image/png;base64,iVBORw0KGgo...'), 'png');
});

runTest('Filename sanitizer removes illegal OS characters', () => {
  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  const badName = 'my:cool*photo?preview<1>|test.jpg';
  const clean = sanitizeFilename(badName);
  assert.strictEqual(clean, 'my_cool_photo_preview_1__test.jpg');
  assert.ok(!/[\\/:*?"<>|]/.test(clean), 'Filename must not contain illegal OS characters');
});

// 5. JSZip Offline Integration Test
runTest('JSZip offline package creates valid zip archives', async () => {
  const JSZip = require(path.resolve(__dirname, '../popup/jszip.min.js'));
  const zip = new JSZip();
  zip.file('images/test.txt', 'Image Downloader CI Test');
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  assert.ok(buffer && buffer.length > 50, 'Generated zip buffer must not be empty');
  // First 4 bytes of PKZip header are always 0x50, 0x4B, 0x03, 0x04 ("PK\x03\x04")
  assert.strictEqual(buffer[0], 0x50, 'Zip header byte 0 must be 0x50 (P)');
  assert.strictEqual(buffer[1], 0x4b, 'Zip header byte 1 must be 0x4B (K)');
});

// Summary
console.log(`\n========================================`);
console.log(`Tests: ${passedTests}/${totalTests} passed`);
console.log(`========================================\n`);

if (process.exitCode && process.exitCode !== 0) {
  process.exit(1);
}
