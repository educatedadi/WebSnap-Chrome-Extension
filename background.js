let offscreenDocumentOpen = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. Visible Screenshot
    if (message.action === "capture_visible") {
        chrome.tabs.captureVisibleTab({ format: 'png' })
            .then(dataUrl => {
                chrome.downloads.download({
                    url: dataUrl,
                    filename: `visible_${Date.now()}.png`
                });
                sendResponse({ status: 'success' });
            })
            .catch(error => sendResponse({ status: 'error', error: error.message }));
        return true;
    }

    // 2. Full Page Capture
    if (message.action === "capture_full") {
        chrome.tabs.query({ active: true, currentWindow: true })
            .then(([tab]) => {
                if (!tab?.id) throw new Error('No active tab found');
                
                // Store tab reference properly
                const targetTab = tab;
                
                return chrome.scripting.executeScript({
                    target: { tabId: targetTab.id },
                    files: ['content.js']
                }).then(() => {
                    return new Promise((resolve, reject) => {
                        const retry = (attempt = 0) => {
                            chrome.tabs.sendMessage(
                                targetTab.id,
                                { action: "capture_full" },
                                (response) => {
                                    if (chrome.runtime.lastError) {
                                        if (attempt < 3) {
                                            setTimeout(() => retry(attempt + 1), 300);
                                        } else {
                                            reject(new Error(`Content script communication failed: ${chrome.runtime.lastError.message}`));
                                        }
                                    } else {
                                        resolve(response);
                                    }
                                }
                            );
                        };
                        retry();
                    });
                });
            })
            .then(sendResponse)
            .catch(error => sendResponse({ 
                status: 'error', 
                error: error.message 
            }));
        return true;
    }

    // 3. Merge Images
    if (message.action === "merge_images") {
        (async () => {
            try {
                if (!offscreenDocumentOpen) {
                    await chrome.offscreen.createDocument({
                        url: 'offscreen.html',
                        reasons: ['DOM_PARSER'],
                        justification: 'Merging screenshots'
                    });
                    offscreenDocumentOpen = true;
                }

                // Wait for offscreen document to be ready
                await new Promise(resolve => setTimeout(resolve, 200));

                const result = await new Promise((resolve) => {
                    chrome.runtime.sendMessage(
                        { 
                            action: "merge", 
                            images: message.images,
                            heights: message.heights 
                        },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                resolve({ error: chrome.runtime.lastError.message });
                            } else {
                                resolve(response || { error: "No response from offscreen" });
                            }
                        }
                    );
                });

                if (result.error) {
                    throw new Error(result.error);
                }

                if (!result.dataUrl) {
                    throw new Error("Failed to generate merged image");
                }

                await chrome.downloads.download({
                    url: result.dataUrl,
                    filename: `fullpage_${Date.now()}.png`
                });

                sendResponse({ status: 'success' });
            } catch (error) {
                console.error("Merge error:", error);
                sendResponse({ status: 'error', error: error.message });
            } finally {
                // Only close the document if we're done with it
                if (offscreenDocumentOpen) {
                    try {
                        await chrome.offscreen.closeDocument();
                        offscreenDocumentOpen = false;
                    } catch (e) {
                        console.error("Error closing offscreen document:", e);
                    }
                }
            }
        })();
        return true;
    }

    // 4. Visible Tab Capture
    if (message.action === "capture_visible_tab") {
        chrome.tabs.captureVisibleTab({ format: 'png' })
            .then(dataUrl => {
                if (!dataUrl) {
                    sendResponse({ error: "No image data captured" });
                } else {
                    sendResponse({ dataUrl });
                }
            })
            .catch(error => {
                console.error("Visible tab capture error:", error);
                sendResponse({ error: error.message });
            });
        return true;
    }
});