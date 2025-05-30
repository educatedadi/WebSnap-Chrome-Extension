(function() {
    let isCapturing = false;
    let progressBar = null;

    async function captureFullPage() {
        if (isCapturing) return { status: 'error', error: 'Capture already in progress' };
        
        isCapturing = true;
        const originalPosition = window.scrollY;
        const totalHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
        const viewportHeight = window.innerHeight;
        const capturedImages = [];
        const sectionHeights = [];
        
        // Store fixed elements and their original states
        const fixedElements = [];
        // Store original overflow style
        const originalOverflow = document.documentElement.style.overflow;
        
        try {
            // Create progress bar
            progressBar = document.createElement('div');
            progressBar.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                height: 4px;
                background: #0078d4;
                z-index: 2147483647;
                width: 0;
                transition: width 0.3s;
            `;
            document.body.appendChild(progressBar);

            // Find and temporarily handle fixed position elements
            document.querySelectorAll('*').forEach(el => {
                const style = window.getComputedStyle(el);
                if (style.position === 'fixed' || style.position === 'sticky') {
                    fixedElements.push({
                        element: el,
                        originalPosition: el.style.position,
                        originalTop: el.style.top,
                        originalDisplay: el.style.display,
                        originalZIndex: el.style.zIndex
                    });
                }
            });

            // Hide scrollbar during capture
            document.documentElement.style.overflow = 'hidden';
            
            // Calculate specific viewport sections
            let remainingHeight = totalHeight;
            let y = 0;
            
            while (remainingHeight > 0 && isCapturing) {
                const currentHeight = Math.min(viewportHeight, remainingHeight);
                const progress = ((totalHeight - remainingHeight) / totalHeight) * 100;
                
                progressBar.style.width = `${progress}%`;
                
                // Scroll to current position
                window.scrollTo(0, y);
                
                // Wait for scrolling and rendering to complete
                await new Promise(r => setTimeout(r, 400));
                
                // Handle fixed elements
                fixedElements.forEach(item => {
                    if (y === 0) {
                        // Only show fixed elements in the first viewport
                        item.element.style.position = item.originalPosition;
                        item.element.style.display = item.originalDisplay;
                    } else {
                        // Hide fixed elements in other viewports
                        item.element.style.display = 'none';
                    }
                });

                // Hide progress bar before capture
                const progressBarDisplay = progressBar.style.display;
                progressBar.style.display = 'none';
                
                // Additional wait to ensure UI is ready
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                
                try {
                    // Capture screenshot
                    const response = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(
                            { action: "capture_visible_tab" },
                            (result) => {
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                } else if (result.error) {
                                    reject(new Error(result.error));
                                } else {
                                    resolve(result);
                                }
                            }
                        );
                    });
                    
                    if (!response.dataUrl) {
                        throw new Error('Failed to capture section: No image data received');
                    }
                    
                    capturedImages.push(response.dataUrl);
                    sectionHeights.push(currentHeight);
                } catch (captureError) {
                    console.error("Section capture error:", captureError);
                    throw new Error(`Failed to capture section: ${captureError.message}`);
                } finally {
                    // Show progress bar again
                    progressBar.style.display = progressBarDisplay;
                }
                
                // Move to next section
                y += currentHeight;
                remainingHeight -= currentHeight;
            }

            // Initiate merge with section heights
            if (capturedImages.length === 0) {
                throw new Error('No sections captured');
            }
            
            // Send message to merge images
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        action: "merge_images",
                        images: capturedImages,
                        heights: sectionHeights
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (response.status === 'error') {
                            reject(new Error(response.error));
                        } else {
                            resolve(response);
                        }
                    }
                );
            });

            return { status: 'success' };
        } catch (error) {
            console.error("Full page capture error:", error);
            throw new Error(`Capture failed: ${error.message}`);
        } finally {
            // Restore all fixed elements to their original state
            fixedElements.forEach(item => {
                item.element.style.position = item.originalPosition;
                item.element.style.top = item.originalTop;
                item.element.style.display = item.originalDisplay;
                item.element.style.zIndex = item.originalZIndex;
            });
            
            // Restore original overflow (scrollbar)
            document.documentElement.style.overflow = originalOverflow;
            
            // Cleanup
            if (progressBar && document.body.contains(progressBar)) {
                document.body.removeChild(progressBar);
            }
            
            // Scroll back to original position
            window.scrollTo({ top: originalPosition });
            isCapturing = false;
        }
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "capture_full") {
            captureFullPage()
                .then(result => sendResponse(result))
                .catch(error => {
                    console.error("Capture error:", error);
                    sendResponse({ status: 'error', error: error.message });
                });
            return true;
        }
        return false;
    });
})();