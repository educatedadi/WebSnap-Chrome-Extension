document.getElementById("captureVisible").addEventListener("click", () => {
    const btn = document.getElementById("captureVisible");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = originalHTML.replace(/Capture Screenshot/i, "Capturing...");
    
    chrome.runtime.sendMessage(
        { action: "capture_visible" },
        (response) => {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            
            if (response?.status !== 'success' || chrome.runtime.lastError) {
                const error = chrome.runtime.lastError || response?.error;
                console.error('Visible error:', error);
                alert(`Visible capture failed: ${error?.message || 'Unknown error'}`);
            }
        }
    );
});

document.getElementById("captureFull").addEventListener("click", () => {
    const btn = document.getElementById("captureFull");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = originalHTML.replace(/Capture Full Page/i, "Capturing...");
    
    chrome.runtime.sendMessage(
        { action: "capture_full" },
        (response) => {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            
            if (response?.status !== 'success' || chrome.runtime.lastError) {
                const errorMessage = response?.error || 
                                    chrome.runtime.lastError?.message || 
                                    'Unknown error occurred';
                alert(`Full page capture failed:\n${errorMessage}`);
            }
        }
    );
});