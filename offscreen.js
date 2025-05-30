chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "merge") {
        mergeImages(message.images, message.heights || [])
            .then(dataUrl => {
                sendResponse({ dataUrl });
            })
            .catch(error => {
                console.error('Merge error:', error);
                sendResponse({ error: error.message });
            });
        return true;
    }
});

async function mergeImages(images, heights) {
    if (!images || images.length === 0) {
        throw new Error('No images to merge');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let totalHeight = 0;
    let maxWidth = 0;

    try {
        // Load all images
        const imageElements = await Promise.all(
            images.map((src, index) => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed to load image ${index}`));
                img.src = src;
            }))
        );

        // Calculate dimensions
        imageElements.forEach(img => {
            maxWidth = Math.max(maxWidth, img.width);
        });

        // If custom heights were provided, use them
        if (heights && heights.length === imageElements.length) {
            totalHeight = heights.reduce((sum, height) => sum + height, 0);
        } else {
            // Otherwise use image heights
            totalHeight = imageElements.reduce((sum, img) => sum + img.height, 0);
        }

        // Validate dimensions
        if (maxWidth <= 0 || totalHeight <= 0) {
            throw new Error('Invalid image dimensions');
        }

        // Create final image
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        
        // Clear canvas to ensure transparency
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let yPos = 0;
        
        for (let i = 0; i < imageElements.length; i++) {
            const img = imageElements[i];
            const height = heights && heights[i] ? heights[i] : img.height;
            
            // Draw only the portion we need (avoid duplicating bottom parts)
            ctx.drawImage(
                img,            // Source image
                0, 0,           // Source x, y
                img.width,      // Source width
                height,         // Source height (use our calculated height)
                0, yPos,        // Destination x, y
                img.width,      // Destination width
                height          // Destination height
            );
            
            yPos += height;
        }

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error merging images:', error);
        throw new Error(`Failed to merge images: ${error.message}`);
    }
}