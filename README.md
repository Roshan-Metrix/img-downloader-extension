# Image Downloader - Chrome Extension (Manifest V3)

A high-performance browser extension that scans, previews, filters, and downloads images from any webpage—individually or bundled in a single ZIP archive.

---

## Key Features

- **Interactive Thumbnail Grid**: Live preview gallery displaying dimensions, formats, and source tags before downloading.
- **Lightbox Preview**: Click the zoom button on any card to inspect full-resolution images and metadata.
- **Real-Time Image Counter**: Shows total discovered images, filtered count, active selections, and hidden duplicates.
- **Batch Selection Controls**: Fast "Select All", "Deselect All", and "Invert" buttons.
- **Minimum Resolution Filtering**: Filter out tiny assets and icons using presets (>150px, >300px, >600px, >1080px HD) or custom width and height inputs.
- **Format Filter Chips**: Instant multi-select filtering for `JPG`, `PNG`, `WEBP`, `GIF`, `SVG`, and other image formats.
- **Smart Duplicate Detection**: Automatically normalizes image URLs, strips tracking query parameters, and hides redundant image copies.
- **Infinite-Scroll Deep Scanner**: Auto-scrolls the active tab in controlled increments to trigger and extract lazy-loaded imagery.
- **Deep Extraction Engine**: Detects images across `<img>` tags, `srcset` descriptors, `<picture>` elements, CSS `background-image` rules, pseudo-elements (`::before`/`::after`), `<video poster>` attributes, and inline `<svg>`.
- **Intelligent File Renaming**: Choose from structured templates (`image_{index}`, `{pageTitle}_{index}`, `{domain}_{index}`, or custom tokens) with automatic MIME/extension correction.
- **Custom Download Folders**: Organize downloads into custom subfolders directly within your browser's download directory.
- **One-Click ZIP Export**: Packages all selected images into a single compressed `.zip` archive using offline client-side compression.

---

## Installation Guide

Because this is an open-source extension, you can install it directly into Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi):

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/imageDownloader.git
   ```
2. **Open Extensions Manager**:
   - In Chrome, navigate to `chrome://extensions`
   - In Edge, navigate to `edge://extensions`
   - In Brave, navigate to `brave://extensions`
3. **Enable Developer Mode**:
   - Toggle the **Developer mode** switch in the top-right corner.
4. **Load the Extension**:
   - Click the **Load unpacked** button in the top-left corner.
   - Select the `imageDownloader` folder containing `manifest.json`.
5. **Pin and Use**:
   - Click the puzzle piece icon in your browser toolbar and pin **Image Downloader**.
   - Navigate to any webpage and click the icon to begin scanning.

---

## Project Structure

```
imageDownloader/
├── manifest.json         # Extension Manifest V3 configuration
├── background.js         # Service worker for downloads and cross-origin fetch
├── content.js            # DOM image extractor and infinite-scroll scanner
├── icons/                # Extension icons (16px, 32px, 48px, 128px, SVG)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon.svg
└── popup/                # Extension popup user interface
    ├── popup.html        # UI structure and layout
    ├── popup.css         # Styling, themes, and responsiveness
    ├── popup.js          # Filtering, preview logic, and zip creation
    └── jszip.min.js      # Bundled library for offline ZIP packaging
```

---

## Permissions Overview

- **`downloads`**: Allows saving selected images and ZIP archives to your local storage.
- **`activeTab` & `scripting`**: Injects the content scanner into the webpage you choose to scan.
- **`storage`**: Remembers user preferences (such as custom folder path, renaming format, and duplicate settings).
- **`<all_urls>` (host_permissions)**: Required to fetch image blobs for ZIP creation across diverse Content Delivery Networks (CDNs).

---

## License

This project is licensed under the permissive MIT Open Source License. You are free to use, modify, distribute, and contribute.
