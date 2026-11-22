// Image Downloader - Popup Script
// Full implementation of preview grid, filters, duplicate detection, smart rename, zip download, and auto-scroll

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const pageDomainEl = document.getElementById("pageDomain");
  const deepScanBtn = document.getElementById("deepScanBtn");
  const deepScanText = document.getElementById("deepScanText");
  const scanIcon = document.getElementById("scanIcon");

  const countIndicator = document.getElementById("countIndicator");
  const selectedCountEl = document.getElementById("selectedCount");
  const displayedCountEl = document.getElementById("displayedCount");
  const totalStatsEl = document.getElementById("totalStats");

  const selectAllBtn = document.getElementById("selectAllBtn");
  const deselectAllBtn = document.getElementById("deselectAllBtn");
  const invertSelectionBtn = document.getElementById("invertSelectionBtn");

  const formatChips = document.getElementById("formatChips");
  const resPresetSelect = document.getElementById("resPresetSelect");
  const customResInputs = document.getElementById("customResInputs");
  const minWidthInput = document.getElementById("minWidthInput");
  const minHeightInput = document.getElementById("minHeightInput");

  const hideDuplicatesCheckbox = document.getElementById("hideDuplicatesCheckbox");
  const dupCountBadge = document.getElementById("dupCountBadge");

  const folderInput = document.getElementById("folderInput");
  const renameSelect = document.getElementById("renameSelect");
  const customPatternWrapper = document.getElementById("customPatternWrapper");
  const customPatternInput = document.getElementById("customPatternInput");

  const imageGrid = document.getElementById("imageGrid");
  const gridState = document.getElementById("gridState");
  const gridStateText = document.getElementById("gridStateText");
  const gridSpinner = document.getElementById("gridSpinner");

  const progressBanner = document.getElementById("progressBanner");
  const progressText = document.getElementById("progressText");
  const progressPercent = document.getElementById("progressPercent");
  const progressBar = document.getElementById("progressBar");

  const footerStatus = document.getElementById("footerStatus");
  const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
  const downloadZipBtn = document.getElementById("downloadZipBtn");
  const downloadBtnText = document.getElementById("downloadBtnText");

  // Lightbox elements
  const lightboxModal = document.getElementById("lightboxModal");
  const lightboxBackdrop = document.getElementById("lightboxBackdrop");
  const lightboxCloseBtn = document.getElementById("lightboxCloseBtn");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxResolution = document.getElementById("lightboxResolution");
  const lightboxFormat = document.getElementById("lightboxFormat");
  const lightboxType = document.getElementById("lightboxType");
  const lightboxFilename = document.getElementById("lightboxFilename");
  const lightboxOpenUrl = document.getElementById("lightboxOpenUrl");
  const lightboxDownloadBtn = document.getElementById("lightboxDownloadBtn");

  // State
  let allImages = []; // Array of image objects
  let pageInfo = { title: "Images", url: "", domain: "download" };
  let activeTabId = null;
  let isDeepScanning = false;
  let currentActiveLightboxItem = null;

  // Filter state
  const selectedFormats = new Set(["all"]);
  let minResolution = { width: 0, height: 0 };
  let hideDuplicates = true;

  // Initialize
  init();

  async function init() {
    loadSettings();
    setupEventListeners();
    await connectAndScan();
  }

  // Load saved settings from chrome.storage.local
  function loadSettings() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["downloadFolder", "renameOption", "customPattern", "hideDups"], (result) => {
        if (result.downloadFolder !== undefined) {
          folderInput.value = result.downloadFolder;
        }
        if (result.renameOption !== undefined) {
          renameSelect.value = result.renameOption;
          if (renameSelect.value === "custom") {
            customPatternWrapper.classList.remove("hidden");
          }
        }
        if (result.customPattern !== undefined) {
          customPatternInput.value = result.customPattern;
        }
        if (result.hideDups !== undefined) {
          hideDuplicatesCheckbox.checked = result.hideDups;
          hideDuplicates = result.hideDups;
        }
      });
    }
  }

  // Save settings helper
  function saveSettings() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        downloadFolder: folderInput.value.trim(),
        renameOption: renameSelect.value,
        customPattern: customPatternInput.value.trim(),
        hideDups: hideDuplicatesCheckbox.checked
      });
    }
  }

  // Set up all UI event listeners
  function setupEventListeners() {
    // Selection buttons
    selectAllBtn.addEventListener("click", () => setDisplayedSelection(true));
    deselectAllBtn.addEventListener("click", () => setDisplayedSelection(false));
    invertSelectionBtn.addEventListener("click", () => invertDisplayedSelection());

    // Format Chips
    formatChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const fmt = chip.dataset.format;

      if (fmt === "all") {
        selectedFormats.clear();
        selectedFormats.add("all");
        formatChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      } else {
        selectedFormats.delete("all");
        formatChips.querySelector('[data-format="all"]')?.classList.remove("active");

        if (selectedFormats.has(fmt)) {
          selectedFormats.delete(fmt);
          chip.classList.remove("active");
          if (selectedFormats.size === 0) {
            selectedFormats.add("all");
            formatChips.querySelector('[data-format="all"]')?.classList.add("active");
          }
        } else {
          selectedFormats.add(fmt);
          chip.classList.add("active");
        }
      }
      applyFilters();
    });

    // Resolution filter presets
    resPresetSelect.addEventListener("change", () => {
      const val = resPresetSelect.value;
      if (val === "custom") {
        customResInputs.classList.remove("hidden");
        minResolution.width = parseInt(minWidthInput.value, 10) || 0;
        minResolution.height = parseInt(minHeightInput.value, 10) || 0;
      } else {
        customResInputs.classList.add("hidden");
        const size = parseInt(val, 10) || 0;
        minResolution.width = size;
        minResolution.height = size;
      }
      applyFilters();
    });

    minWidthInput.addEventListener("input", () => {
      minResolution.width = parseInt(minWidthInput.value, 10) || 0;
      applyFilters();
    });

    minHeightInput.addEventListener("input", () => {
      minResolution.height = parseInt(minHeightInput.value, 10) || 0;
      applyFilters();
    });

    // Hide duplicates toggle
    hideDuplicatesCheckbox.addEventListener("change", () => {
      hideDuplicates = hideDuplicatesCheckbox.checked;
      saveSettings();
      applyFilters();
    });

    // Folder and rename settings
    folderInput.addEventListener("change", saveSettings);
    renameSelect.addEventListener("change", () => {
      if (renameSelect.value === "custom") {
        customPatternWrapper.classList.remove("hidden");
      } else {
        customPatternWrapper.classList.add("hidden");
      }
      saveSettings();
    });
    customPatternInput.addEventListener("change", saveSettings);

    // Deep scan button
    deepScanBtn.addEventListener("click", toggleDeepScan);

    // Download buttons
    downloadSelectedBtn.addEventListener("click", handleDownloadSelected);
    downloadZipBtn.addEventListener("click", handleDownloadZip);

    // Lightbox modal events
    lightboxCloseBtn.addEventListener("click", closeLightbox);
    lightboxBackdrop.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightboxModal.classList.contains("hidden")) {
        closeLightbox();
      }
    });

    lightboxDownloadBtn.addEventListener("click", () => {
      if (currentActiveLightboxItem) {
        downloadSingleImage(currentActiveLightboxItem);
      }
    });

    // Runtime messages from content script (e.g. auto-scroll progress)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "AUTO_SCROLL_PROGRESS") {
        footerStatus.textContent = `Scrolled ${message.scrollsDone}/${message.maxScrolls} times (${message.foundCount} images found)...`;
      }
      if (message.type === "AUTO_SCROLL_COMPLETE") {
        isDeepScanning = false;
        deepScanText.textContent = "Deep Scan";
        scanIcon.classList.remove("spin");
        footerStatus.textContent = `Deep scan completed. Total ${message.images.length} images found.`;
        mergeExtractedImages(message.images);
      }
    });
  }

  // Connect to active tab and extract images
  async function connectAndScan() {
    try {
      showGridLoading("Scanning current page...");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showGridEmpty("No active browser tab found.");
        return;
      }
      activeTabId = tab.id;

      // Check if page is a chrome:// or edge:// system page
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("edge://")) {
        showGridEmpty("Cannot extract images from browser system pages.");
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          files: ["content.js"]
        });
      } catch (err) {
        console.warn("Script injection note:", err);
      }

      // Send extraction command
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTabId, { type: "EXTRACT_IMAGES" }, (res) => {
          if (chrome.runtime.lastError || !res) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });

      if (!response || !response.success || !response.images) {
        showGridEmpty("No images detected on this page.");
        return;
      }

      pageInfo = response.pageInfo || {
        title: tab.title || "Images",
        url: tab.url,
        domain: new URL(tab.url).hostname
      };

      pageDomainEl.textContent = pageInfo.domain || "Webpage";
      pageDomainEl.title = `${pageInfo.title} (${pageInfo.url})`;

      processAndLoadImages(response.images);
    } catch (err) {
      console.error("Scan error:", err);
      showGridEmpty("Failed to scan page: " + (err.message || "Unknown error"));
    }
  }

  // Normalize image URL for duplicate detection
  function normalizeUrl(url) {
    if (!url) return "";
    if (url.startsWith("data:")) {
      return url.substring(0, 160) + "_" + url.length;
    }
    try {
      const u = new URL(url);
      // Remove query parameters that are typically tracking or dynamic tokens
      const searchParams = new URLSearchParams(u.search);
      const trackingParams = [
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "_ga", "ref", "timestamp", "t", "_"
      ];
      trackingParams.forEach((param) => searchParams.delete(param));

      const cleanSearch = searchParams.toString();
      return `${u.protocol}//${u.host}${u.pathname}${cleanSearch ? "?" + cleanSearch : ""}`;
    } catch {
      return url.split("#")[0];
    }
  }

  // Detect image format from URL or MIME or data URL
  function detectImageFormat(url) {
    if (!url) return "other";
    const lower = url.toLowerCase();

    if (lower.startsWith("data:image/svg") || lower.includes(".svg")) return "svg";
    if (lower.startsWith("data:image/png") || lower.includes(".png")) return "png";
    if (lower.startsWith("data:image/webp") || lower.includes(".webp") || lower.includes("format=webp") || lower.includes("fm=webp")) return "webp";
    if (lower.startsWith("data:image/gif") || lower.includes(".gif")) return "gif";
    if (lower.startsWith("data:image/jpeg") || lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes("format=jpg") || lower.includes("fm=jpg")) return "jpg";
    if (lower.startsWith("data:image/avif") || lower.includes(".avif")) return "other";
    if (lower.startsWith("data:image/bmp") || lower.includes(".bmp")) return "other";

    return "other";
  }

  // Clean filename base from URL or alt
  function getCleanBasename(url, alt) {
    if (alt && alt.trim().length > 1 && alt.trim().length < 60) {
      return alt.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    }
    try {
      if (url.startsWith("data:")) return "image";
      const u = new URL(url);
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        const nameWithoutExt = last.replace(/\.[a-zA-Z0-9]{2,5}$/, "");
        const cleaned = nameWithoutExt.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
        if (cleaned.length > 0) return cleaned;
      }
    } catch {
      // Fallback
    }
    return "image";
  }

  // Process raw extracted images and mark duplicates
  function processAndLoadImages(rawImages) {
    const seenUrls = new Set();
    const seenNormalized = new Set();
    allImages = [];

    rawImages.forEach((raw, idx) => {
      const url = raw.url;
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);

      const norm = normalizeUrl(url);
      const isDuplicate = seenNormalized.has(norm);
      if (!isDuplicate) {
        seenNormalized.add(norm);
      }

      const format = detectImageFormat(url);
      const item = {
        id: `img_${idx}_${Date.now()}`,
        url,
        cleanUrl: norm,
        alt: raw.alt || "",
        title: raw.title || "",
        width: raw.width || 0,
        height: raw.height || 0,
        sourceType: raw.sourceType || "img",
        format,
        isDuplicate,
        selected: !isDuplicate // Select non-duplicates by default
      };

      allImages.push(item);

      // Asynchronously probe dimensions if not already known
      if (item.width === 0 || item.height === 0) {
        measureImageDimensions(item);
      }
    });

    renderGrid();
  }

  // Merge new images from deep scan without losing existing selections
  function mergeExtractedImages(newRawImages) {
    const existingUrlMap = new Map();
    allImages.forEach((img) => existingUrlMap.set(img.url, img));

    const seenNormalized = new Set();
    allImages.filter((img) => !img.isDuplicate).forEach((img) => seenNormalized.add(img.cleanUrl));

    let addedCount = 0;

    newRawImages.forEach((raw, idx) => {
      if (existingUrlMap.has(raw.url)) {
        // Upgrade dimensions if previously 0
        const existing = existingUrlMap.get(raw.url);
        if ((!existing.width || existing.width === 0) && raw.width) {
          existing.width = raw.width;
          existing.height = raw.height;
          updateCardResolution(existing);
        }
        return;
      }

      const norm = normalizeUrl(raw.url);
      const isDuplicate = seenNormalized.has(norm);
      if (!isDuplicate) seenNormalized.add(norm);

      const format = detectImageFormat(raw.url);
      const item = {
        id: `img_deep_${idx}_${Date.now()}`,
        url: raw.url,
        cleanUrl: norm,
        alt: raw.alt || "",
        title: raw.title || "",
        width: raw.width || 0,
        height: raw.height || 0,
        sourceType: raw.sourceType || "img",
        format,
        isDuplicate,
        selected: !isDuplicate
      };

      allImages.push(item);
      addedCount++;

      if (item.width === 0 || item.height === 0) {
        measureImageDimensions(item);
      }
    });

    if (addedCount > 0) {
      applyFilters();
    }
  }

  // Load Image in background to determine naturalWidth/naturalHeight
  function measureImageDimensions(item) {
    const img = new Image();
    img.onload = () => {
      item.width = img.naturalWidth || 0;
      item.height = img.naturalHeight || 0;
      updateCardResolution(item);
      // Re-check min resolution if active
      if (minResolution.width > 0 || minResolution.height > 0) {
        applyFilters();
      }
    };
    img.onerror = () => {
      // Keep width/height as 0
    };
    img.src = item.url;
  }

  // Update card resolution in DOM
  function updateCardResolution(item) {
    const card = document.getElementById(item.id);
    if (card) {
      const resSpan = card.querySelector(".card-res");
      if (resSpan) {
        resSpan.textContent = item.width && item.height ? `${item.width} × ${item.height}` : "Unknown";
      }
    }
  }

  // Filter check for a single item
  function matchesFilter(item) {
    // 1. Duplicate filter
    if (hideDuplicates && item.isDuplicate) {
      return false;
    }

    // 2. Format filter
    if (!selectedFormats.has("all")) {
      let matchesFmt = false;
      for (const fmt of selectedFormats) {
        if (fmt === "jpg" && (item.format === "jpg" || item.format === "jpeg")) matchesFmt = true;
        else if (item.format === fmt) matchesFmt = true;
      }
      if (!matchesFmt) return false;
    }

    // 3. Minimum resolution filter
    if (minResolution.width > 0 && item.width > 0 && item.width < minResolution.width) {
      return false;
    }
    if (minResolution.height > 0 && item.height > 0 && item.height < minResolution.height) {
      return false;
    }

    return true;
  }

  // Apply filters and re-render grid
  function applyFilters() {
    renderGrid();
  }

  // Render the image preview grid
  function renderGrid() {
    imageGrid.innerHTML = "";

    const visibleItems = allImages.filter(matchesFilter);
    const duplicatesCount = allImages.filter((img) => img.isDuplicate).length;

    // Update duplicate badge
    if (duplicatesCount > 0) {
      dupCountBadge.textContent = `${duplicatesCount}`;
      dupCountBadge.classList.remove("hidden");
    } else {
      dupCountBadge.classList.add("hidden");
    }

    if (visibleItems.length === 0) {
      if (allImages.length === 0) {
        showGridEmpty("No images found on this page.");
      } else {
        showGridEmpty("No images match your filter criteria.");
      }
      updateCounters(0, 0, allImages.length, duplicatesCount);
      return;
    }

    hideGridState();

    const fragment = document.createDocumentFragment();

    visibleItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = `image-card ${item.selected ? "selected" : ""}`;
      card.id = item.id;
      card.dataset.id = item.id;

      // Format class for badge color
      const fmtClass = ["jpg", "png", "webp", "gif", "svg"].includes(item.format) ? item.format : "other";

      card.innerHTML = `
        <div class="card-top-bar">
          <input type="checkbox" class="card-checkbox" ${item.selected ? "checked" : ""} title="Select image" />
          <span class="card-format-badge ${fmtClass}">${item.format.toUpperCase()}</span>
        </div>
        <div class="thumb-wrapper">
          <img class="thumb-img" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt || "image")}" loading="lazy" />
          <div class="card-overlay-actions">
            <button class="card-zoom-btn" title="View full image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-info-bar">
          <span class="card-res">${item.width && item.height ? `${item.width} × ${item.height}` : "Measuring..."}</span>
          <span class="card-type-tag">${item.sourceType}</span>
        </div>
      `;

      // Handle broken thumbnail images gracefully
      const imgEl = card.querySelector(".thumb-img");
      imgEl.addEventListener("error", () => {
        imgEl.style.display = "none";
        const wrapper = card.querySelector(".thumb-wrapper");
        wrapper.innerHTML = `<span style="font-size:10px; color:#94a3b8; text-align:center; padding:10px;">Preview unavailable</span>`;
      });

      // Click card to toggle selection
      card.addEventListener("click", (e) => {
        // If clicked zoom button, open lightbox
        if (e.target.closest(".card-zoom-btn")) {
          e.stopPropagation();
          openLightbox(item);
          return;
        }

        // Toggle selection
        const checkbox = card.querySelector(".card-checkbox");
        if (e.target !== checkbox) {
          item.selected = !item.selected;
          checkbox.checked = item.selected;
        } else {
          item.selected = checkbox.checked;
        }

        if (item.selected) {
          card.classList.add("selected");
        } else {
          card.classList.remove("selected");
        }

        updateCounters();
      });

      fragment.appendChild(card);
    });

    imageGrid.appendChild(fragment);
    updateCounters(visibleItems.filter((i) => i.selected).length, visibleItems.length, allImages.length, duplicatesCount);
  }

  // Update counters and button states
  function updateCounters(sel, disp, tot, dups) {
    const visible = allImages.filter(matchesFilter);
    const selected = visible.filter((i) => i.selected);

    const sCount = sel !== undefined ? sel : selected.length;
    const dCount = disp !== undefined ? disp : visible.length;
    const tCount = tot !== undefined ? tot : allImages.length;
    const dupCount = dups !== undefined ? dups : allImages.filter((img) => img.isDuplicate).length;

    selectedCountEl.textContent = sCount;
    displayedCountEl.textContent = dCount;

    let statsText = `Total: ${tCount} found`;
    if (dupCount > 0 && hideDuplicates) {
      statsText += ` (${dupCount} duplicates hidden)`;
    }
    totalStatsEl.textContent = statsText;

    // Enable/disable download buttons
    const hasSelection = sCount > 0;
    downloadSelectedBtn.disabled = !hasSelection;
    downloadZipBtn.disabled = !hasSelection;
    downloadBtnText.textContent = hasSelection ? `Download Selected (${sCount})` : "Download Selected";

    footerStatus.textContent = hasSelection ? `${sCount} image${sCount > 1 ? "s" : ""} selected for download.` : "Select images to download.";
  }

  // Selection helpers
  function setDisplayedSelection(isSelected) {
    const visible = allImages.filter(matchesFilter);
    visible.forEach((item) => {
      item.selected = isSelected;
      const card = document.getElementById(item.id);
      if (card) {
        const checkbox = card.querySelector(".card-checkbox");
        if (checkbox) checkbox.checked = isSelected;
        if (isSelected) card.classList.add("selected");
        else card.classList.remove("selected");
      }
    });
    updateCounters();
  }

  function invertDisplayedSelection() {
    const visible = allImages.filter(matchesFilter);
    visible.forEach((item) => {
      item.selected = !item.selected;
      const card = document.getElementById(item.id);
      if (card) {
        const checkbox = card.querySelector(".card-checkbox");
        if (checkbox) checkbox.checked = item.selected;
        if (item.selected) card.classList.add("selected");
        else card.classList.remove("selected");
      }
    });
    updateCounters();
  }

  // Infinite Scroll / Deep Scan Toggle
  async function toggleDeepScan() {
    if (!activeTabId) return;

    if (!isDeepScanning) {
      isDeepScanning = true;
      deepScanText.textContent = "Stop Scan";
      scanIcon.classList.add("spin");
      footerStatus.textContent = "Deep scanning page (auto-scrolling)...";

      chrome.tabs.sendMessage(activeTabId, {
        type: "START_AUTO_SCROLL",
        maxScrolls: 30,
        delayMs: 350
      }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("Deep scan trigger error:", chrome.runtime.lastError);
          isDeepScanning = false;
          deepScanText.textContent = "Deep Scan";
          scanIcon.classList.remove("spin");
        }
      });
    } else {
      isDeepScanning = false;
      deepScanText.textContent = "Deep Scan";
      scanIcon.classList.remove("spin");
      footerStatus.textContent = "Stopping auto-scroll scan...";

      chrome.tabs.sendMessage(activeTabId, { type: "STOP_AUTO_SCROLL" });
    }
  }

  // Intelligent Filename Generator
  function generateIntelligentFilename(item, index, totalCount) {
    // Determine extension
    let ext = item.format;
    if (ext === "other" || !ext) {
      try {
        const u = new URL(item.url);
        const match = u.pathname.match(/\.([a-zA-Z0-9]{3,4})($|\?)/);
        if (match) ext = match[1].toLowerCase();
        else ext = "jpg";
      } catch {
        ext = "jpg";
      }
    }
    if (ext === "jpeg") ext = "jpg";

    // Padded index: 001, 002 if total >= 100; 01, 02 if total >= 10
    const padLength = totalCount >= 100 ? 3 : totalCount >= 10 ? 2 : 1;
    const paddedIndex = String(index + 1).padStart(padLength, "0");

    const cleanBaseName = getCleanBasename(item.url, item.alt);
    const cleanPageTitle = (pageInfo.title || "image")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 40) || "page";
    const cleanDomain = (pageInfo.domain || "web")
      .replace(/[^\w-]/g, "_")
      .substring(0, 30);

    const renameMode = renameSelect.value;
    let filename = "";

    if (renameMode === "original") {
      filename = `${cleanBaseName}.${ext}`;
    } else if (renameMode === "image_index") {
      filename = `image_${paddedIndex}.${ext}`;
    } else if (renameMode === "page_index") {
      filename = `${cleanPageTitle}_${paddedIndex}.${ext}`;
    } else if (renameMode === "domain_index") {
      filename = `${cleanDomain}_${paddedIndex}.${ext}`;
    } else if (renameMode === "custom") {
      const pattern = customPatternInput.value.trim() || "{name}_{index}";
      filename = pattern
        .replace(/{name}/g, cleanBaseName)
        .replace(/{index}/g, paddedIndex)
        .replace(/{pageTitle}/g, cleanPageTitle)
        .replace(/{domain}/g, cleanDomain)
        .replace(/{width}/g, item.width || 0)
        .replace(/{height}/g, item.height || 0)
        .replace(/{ext}/g, ext);

      if (!filename.toLowerCase().endsWith("." + ext)) {
        filename += `.${ext}`;
      }
    } else {
      filename = `image_${paddedIndex}.${ext}`;
    }

    // Sanitize filename for operating systems
    filename = filename.replace(/[\\/:*?"<>|]/g, "_").trim();

    // Attach custom folder if provided
    let folder = folderInput.value.trim().replace(/[\\:*?"<>|]/g, "/");
    folder = folder.replace(/^\/+|\/+$/g, ""); // strip leading/trailing slashes

    if (folder) {
      return `${folder}/${filename}`;
    }
    return filename;
  }

  // Download selected images individually
  async function handleDownloadSelected() {
    const selected = allImages.filter(matchesFilter).filter((img) => img.selected);
    if (selected.length === 0) return;

    downloadSelectedBtn.disabled = true;
    footerStatus.textContent = `Preparing download for ${selected.length} images...`;

    const downloadItems = selected.map((item, idx) => ({
      url: item.url,
      filename: generateIntelligentFilename(item, idx, selected.length)
    }));

    try {
      chrome.runtime.sendMessage({
        type: "DOWNLOAD_IMAGES",
        images: downloadItems
      }, (response) => {
        if (chrome.runtime.lastError || !response) {
          footerStatus.textContent = "Download failed: " + (chrome.runtime.lastError?.message || "Error");
        } else {
          footerStatus.textContent = `Started downloading ${response.started}/${response.total} files!`;
        }
        downloadSelectedBtn.disabled = false;
      });
    } catch (err) {
      footerStatus.textContent = "Error: " + err.message;
      downloadSelectedBtn.disabled = false;
    }
  }

  // Download single image directly
  function downloadSingleImage(item) {
    const filename = generateIntelligentFilename(item, 0, 1);
    chrome.downloads.download({
      url: item.url,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    }, () => {
      if (chrome.runtime.lastError) {
        alert("Failed to download image: " + chrome.runtime.lastError.message);
      } else {
        footerStatus.textContent = `Downloading ${filename}...`;
      }
    });
  }

  // Convert Base64 data URL to ArrayBuffer for JSZip
  function dataUrlToArrayBuffer(dataUrl) {
    const parts = dataUrl.split(",");
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    return uint8Array;
  }

  // Fetch binary for an image (direct fetch or background service worker fallback)
  async function fetchImageBinary(url) {
    if (url.startsWith("data:")) {
      return dataUrlToArrayBuffer(url);
    }

    // Try direct fetch first
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        return buffer;
      }
    } catch {
      // Fallback to background service worker
    }

    // Use background service worker with extension host permissions
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "FETCH_IMAGE_BINARY", url }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          reject(new Error(res?.error || chrome.runtime.lastError?.message || "Fetch failed"));
        } else {
          try {
            const buffer = dataUrlToArrayBuffer(res.dataUrl);
            resolve(buffer);
          } catch (e) {
            reject(e);
          }
        }
      });
    });
  }

  // Download selected images as a ZIP archive
  async function handleDownloadZip() {
    if (typeof JSZip === "undefined") {
      alert("ZIP library is not loaded. Please restart extension.");
      return;
    }

    const selected = allImages.filter(matchesFilter).filter((img) => img.selected);
    if (selected.length === 0) return;

    downloadZipBtn.disabled = true;
    downloadSelectedBtn.disabled = true;
    showProgress(0, `Preparing ZIP archive (0/${selected.length})...`);

    const zip = new JSZip();
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      const filename = generateIntelligentFilename(item, i, selected.length);
      // Remove folder prefix inside zip file so it has a clean root or simple subfolder
      const cleanZipFilename = filename.replace(/^Downloads\//i, "");

      showProgress(
        Math.round((i / selected.length) * 60),
        `Fetching image ${i + 1}/${selected.length}...`
      );

      try {
        const buffer = await fetchImageBinary(item.url);
        zip.file(cleanZipFilename, buffer);
        completed++;
      } catch (err) {
        console.warn("ZIP fetch error for:", item.url, err);
        failed++;
      }
    }

    if (completed === 0) {
      hideProgress();
      downloadZipBtn.disabled = false;
      downloadSelectedBtn.disabled = false;
      footerStatus.textContent = "Failed to fetch images for ZIP.";
      return;
    }

    showProgress(70, `Compressing ${completed} images into ZIP...`);

    try {
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      }, (metadata) => {
        const p = 70 + Math.round(metadata.percent * 0.28);
        showProgress(p, `Compressing ZIP: ${Math.round(metadata.percent)}%`);
      });

      showProgress(100, "Starting ZIP download...");

      const blobUrl = URL.createObjectURL(zipBlob);
      const cleanTitle = (pageInfo.title || "images")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .substring(0, 35) || "images";
      const zipFilename = `${cleanTitle}_images.zip`;

      chrome.downloads.download({
        url: blobUrl,
        filename: zipFilename,
        conflictAction: "uniquify",
        saveAs: true
      }, () => {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        hideProgress();
        downloadZipBtn.disabled = false;
        downloadSelectedBtn.disabled = false;
        footerStatus.textContent = `ZIP created successfully (${(zipBlob.size / 1024 / 1024).toFixed(1)} MB)!`;
      });
    } catch (err) {
      console.error("ZIP generate error:", err);
      hideProgress();
      downloadZipBtn.disabled = false;
      downloadSelectedBtn.disabled = false;
      footerStatus.textContent = "Failed to create ZIP: " + err.message;
    }
  }

  // Progress Bar Helpers
  function showProgress(percent, text) {
    progressBanner.classList.remove("hidden");
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressText.textContent = text;
  }

  function hideProgress() {
    progressBanner.classList.add("hidden");
  }

  // Lightbox Modal Controls
  function openLightbox(item) {
    currentActiveLightboxItem = item;
    lightboxImg.src = item.url;
    lightboxResolution.textContent = item.width && item.height ? `${item.width} × ${item.height} px` : "Unknown size";
    lightboxFormat.textContent = item.format.toUpperCase();
    lightboxType.textContent = item.sourceType;
    const filename = generateIntelligentFilename(item, 0, 1);
    lightboxFilename.textContent = filename.split("/").pop();
    lightboxOpenUrl.href = item.url;
    lightboxModal.classList.remove("hidden");
  }

  function closeLightbox() {
    lightboxModal.classList.add("hidden");
    lightboxImg.src = "";
    currentActiveLightboxItem = null;
  }

  // Grid State Helpers
  function showGridLoading(msg) {
    gridSpinner.classList.remove("hidden");
    gridStateText.textContent = msg;
    gridState.classList.remove("hidden");
    imageGrid.innerHTML = "";
  }

  function showGridEmpty(msg) {
    gridSpinner.classList.add("hidden");
    gridStateText.textContent = msg;
    gridState.classList.remove("hidden");
    imageGrid.innerHTML = "";
  }

  function hideGridState() {
    gridState.classList.add("hidden");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
