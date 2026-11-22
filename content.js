// Image Downloader - Content Script
// Handles comprehensive image extraction and infinite-scroll page scanning

(() => {
  // Prevent duplicate execution if re-injected
  if (window.__imgDownloaderInitialized) {
    return;
  }
  window.__imgDownloaderInitialized = true;

  let isAutoScrolling = false;
  let autoScrollStopRequested = false;

  // Helper to make absolute URL
  function toAbsoluteUrl(urlStr) {
    if (!urlStr || typeof urlStr !== "string") return null;
    const trimmed = urlStr.trim();
    if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("about:") || trimmed.startsWith("blob:")) {
      return null;
    }
    if (trimmed.startsWith("data:image/")) {
      return trimmed;
    }
    try {
      const base = document.baseURI || window.location.href;
      return new URL(trimmed, base).href;
    } catch {
      return null;
    }
  }

  // Parse srcset attribute candidates: "url 1x, url 2x" or "url 480w, url 800w"
  function parseSrcsetUrls(srcsetStr) {
    if (!srcsetStr || typeof srcsetStr !== "string") return [];
    const urls = [];
    // Match URLs optionally followed by width or density descriptor
    const regex = /\s*([^\s,]+)(?:\s+[\d.]+[wx])?\s*(?:,|$)/g;
    let match;
    while ((match = regex.exec(srcsetStr)) !== null) {
      const parsed = toAbsoluteUrl(match[1]);
      if (parsed) urls.push(parsed);
    }
    return urls;
  }

  // Parse CSS url(...) values from background or backgroundImage
  function parseCssBackgroundUrls(cssText) {
    if (!cssText || typeof cssText !== "string" || cssText === "none") return [];
    const urls = [];
    const regex = /url\(["']?(.*?)["']?\)/gi;
    let match;
    while ((match = regex.exec(cssText)) !== null) {
      const parsed = toAbsoluteUrl(match[1]);
      if (parsed) urls.push(parsed);
    }
    return urls;
  }

  // Extract clean text from element or alt/title
  function getElementText(el) {
    if (!el) return "";
    return (
      el.getAttribute("alt") ||
      el.getAttribute("title") ||
      el.getAttribute("aria-label") ||
      el.dataset.title ||
      ""
    ).trim();
  }

  // Core extraction function
  function extractAllImages() {
    const results = new Map(); // key: url, value: metadata

    function addImage(url, info = {}) {
      const absoluteUrl = toAbsoluteUrl(url);
      if (!absoluteUrl) return;

      if (!results.has(absoluteUrl)) {
        results.set(absoluteUrl, {
          url: absoluteUrl,
          alt: info.alt || "",
          title: info.title || "",
          width: info.width || 0,
          height: info.height || 0,
          sourceType: info.sourceType || "img"
        });
      } else {
        // Upgrade dimensions if current has 0 and info has dimensions
        const existing = results.get(absoluteUrl);
        if ((!existing.width || existing.width === 0) && info.width) {
          existing.width = info.width;
          existing.height = info.height;
        }
        if (!existing.alt && info.alt) {
          existing.alt = info.alt;
        }
      }
    }

    // 1. Scan <img> elements
    document.querySelectorAll("img").forEach((img) => {
      const alt = getElementText(img);
      const width = img.naturalWidth || img.clientWidth || 0;
      const height = img.naturalHeight || img.clientHeight || 0;

      // Direct source
      if (img.currentSrc) addImage(img.currentSrc, { alt, width, height, sourceType: "img" });
      if (img.src) addImage(img.src, { alt, width, height, sourceType: "img" });

      // Common lazy loading attributes
      const lazyAttributes = [
        "data-src",
        "data-lazy-src",
        "data-lazy",
        "data-original",
        "data-url",
        "data-full-url",
        "data-high-res-src",
        "data-hi-res-src",
        "data-large-img",
        "data-zoom-image",
        "data-fallback",
        "data-orig-file"
      ];
      lazyAttributes.forEach((attr) => {
        const val = img.getAttribute(attr);
        if (val) addImage(val, { alt, width, height, sourceType: "lazy" });
      });

      // srcset
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
      if (srcset) {
        parseSrcsetUrls(srcset).forEach((u) => {
          addImage(u, { alt, width, height, sourceType: "srcset" });
        });
      }
    });

    // 2. Scan <picture> and <source> elements
    document.querySelectorAll("picture source, source").forEach((source) => {
      const srcset = source.getAttribute("srcset") || source.getAttribute("data-srcset");
      if (srcset) {
        parseSrcsetUrls(srcset).forEach((u) => {
          addImage(u, { sourceType: "picture" });
        });
      }
      const src = source.getAttribute("src") || source.getAttribute("data-src");
      if (src) {
        addImage(src, { sourceType: "picture" });
      }
    });

    // 3. Scan CSS Background images on all elements + pseudo elements
    const allElements = document.querySelectorAll("*");
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];

      // Check inline style first (fast)
      if (el.style && el.style.backgroundImage) {
        parseCssBackgroundUrls(el.style.backgroundImage).forEach((u) => {
          addImage(u, { sourceType: "css" });
        });
      }

      // Check computed style
      try {
        const computed = window.getComputedStyle(el);
        if (computed && computed.backgroundImage && computed.backgroundImage !== "none") {
          parseCssBackgroundUrls(computed.backgroundImage).forEach((u) => {
            addImage(u, { sourceType: "css" });
          });
        }

        // Check ::before and ::after pseudo elements on relevant elements
        const tagName = el.tagName.toLowerCase();
        if (tagName === "div" || tagName === "span" || tagName === "a" || tagName === "section" || tagName === "header" || tagName === "button") {
          const beforeStyle = window.getComputedStyle(el, "::before");
          if (beforeStyle && beforeStyle.backgroundImage && beforeStyle.backgroundImage !== "none") {
            parseCssBackgroundUrls(beforeStyle.backgroundImage).forEach((u) => {
              addImage(u, { sourceType: "css-pseudo" });
            });
          }
          const afterStyle = window.getComputedStyle(el, "::after");
          if (afterStyle && afterStyle.backgroundImage && afterStyle.backgroundImage !== "none") {
            parseCssBackgroundUrls(afterStyle.backgroundImage).forEach((u) => {
              addImage(u, { sourceType: "css-pseudo" });
            });
          }
        }
      } catch {
        // Ignore cross-origin stylesheet or security restriction
      }

      // Check data-bg and data-background attributes
      const dataBg = el.getAttribute("data-bg") || el.getAttribute("data-background");
      if (dataBg) {
        addImage(dataBg, { sourceType: "lazy-bg" });
      }
    }

    // 4. Scan <a> links pointing directly to images
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && /\.(jpe?g|png|webp|gif|svg|avif|bmp)(\?.*)?$/i.test(href)) {
        addImage(href, {
          alt: a.textContent?.trim() || getElementText(a),
          sourceType: "link"
        });
      }
    });

    // 5. Scan <video poster="...">
    document.querySelectorAll("video[poster]").forEach((video) => {
      const poster = video.getAttribute("poster");
      if (poster) {
        addImage(poster, { alt: "Video poster", sourceType: "video-poster" });
      }
    });

    // 6. Scan OpenGraph / Twitter meta tags
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((meta) => {
      const content = meta.getAttribute("content");
      if (content) {
        addImage(content, { alt: "Page preview image", sourceType: "meta" });
      }
    });

    // 7. Extract inline <svg> as data URI
    document.querySelectorAll("svg").forEach((svg, index) => {
      try {
        const rect = svg.getBoundingClientRect();
        // Ignore tiny hidden SVGs
        if (rect.width > 24 && rect.height > 24) {
          const serializer = new XMLSerializer();
          let svgString = serializer.serializeToString(svg);
          if (!svgString.includes("xmlns=")) {
            svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
          }
          const encoded = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
          addImage(encoded, {
            alt: `SVG ${index + 1}`,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            sourceType: "svg"
          });
        }
      } catch {
        // Ignore SVG serialization errors
      }
    });

    return Array.from(results.values());
  }

  // Infinite Scroll Page Scanner
  async function performAutoScroll(maxScrolls = 25, delayMs = 400) {
    if (isAutoScrolling) return;
    isAutoScrolling = true;
    autoScrollStopRequested = false;

    let previousHeight = 0;
    let scrollsDone = 0;

    try {
      while (scrollsDone < maxScrolls && !autoScrollStopRequested) {
        const currentScroll = window.scrollY;
        const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const windowHeight = window.innerHeight;

        // Scroll down
        window.scrollBy({
          top: windowHeight * 0.85,
          behavior: "smooth"
        });

        scrollsDone++;

        // Send intermediate progress
        chrome.runtime.sendMessage({
          type: "AUTO_SCROLL_PROGRESS",
          scrollsDone,
          maxScrolls,
          foundCount: extractAllImages().length
        }).catch(() => {});

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Reached bottom
        if (window.scrollY + windowHeight >= scrollHeight - 30 && scrollHeight === previousHeight) {
          break;
        }
        previousHeight = scrollHeight;
      }
    } finally {
      isAutoScrolling = false;
      // Scroll back up gently or stay
      chrome.runtime.sendMessage({
        type: "AUTO_SCROLL_COMPLETE",
        images: extractAllImages()
      }).catch(() => {});
    }
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT_IMAGES") {
      const images = extractAllImages();
      sendResponse({
        success: true,
        images,
        pageInfo: {
          title: document.title || "Page",
          url: window.location.href,
          domain: window.location.hostname || "download"
        }
      });
      return true;
    }

    if (message.type === "START_AUTO_SCROLL") {
      performAutoScroll(message.maxScrolls || 25, message.delayMs || 400);
      sendResponse({ success: true, started: true });
      return true;
    }

    if (message.type === "STOP_AUTO_SCROLL") {
      autoScrollStopRequested = true;
      isAutoScrolling = false;
      sendResponse({ success: true, stopped: true });
      return true;
    }

    return true;
  });
})();
