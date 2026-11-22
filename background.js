// Image Downloader - Background Service Worker
// Manages download queues, file saving, and cross-origin fetch for ZIP compression

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Batch download individual files
  if (message.type === "DOWNLOAD_IMAGES") {
    const images = message.images || [];

    (async () => {
      let started = 0;
      let failed = 0;

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        try {
          await new Promise((resolve, reject) => {
            chrome.downloads.download(
              {
                url: item.url,
                filename: item.filename,
                conflictAction: "uniquify",
                saveAs: false
              },
              (downloadId) => {
                if (chrome.runtime.lastError || !downloadId) {
                  reject(chrome.runtime.lastError || new Error("Download failed"));
                } else {
                  resolve(downloadId);
                }
              }
            );
          });
          started++;
        } catch (err) {
          console.warn("Failed to download image:", item.url, err);
          failed++;
        }

        // Small delay between downloads to prevent browser throttling
        if (i < images.length - 1 && i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 60));
        }
      }

      sendResponse({
        success: true,
        started,
        failed,
        total: images.length
      });
    })();

    return true; // Keep message channel open for async response
  }

  // Fetch cross-origin image binary as base64 for ZIP creation in popup
  if (message.type === "FETCH_IMAGE_BINARY") {
    const url = message.url;

    (async () => {
      try {
        if (url.startsWith("data:")) {
          // Already a data URL
          sendResponse({ success: true, dataUrl: url });
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, dataUrl: reader.result, mimeType: blob.type });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: "Failed to read blob" });
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn("Fetch binary error:", url, err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  }

  return true;
});
