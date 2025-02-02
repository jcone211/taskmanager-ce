// offscreen.js (Versión corregida)
let isDocumentClosed = false;

const closeOffscreenDocument = () => {
    if (!isDocumentClosed && chrome.offscreen) {
        isDocumentClosed = true;
        chrome.offscreen.closeDocument().catch((error) => {
            console.log("🔒 Documento ya cerrado:", error.message);
        });
    }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'playSound') {
        const audio = new Audio(chrome.runtime.getURL('alert.mp3'));
        
        audio.addEventListener('ended', () => {
            closeOffscreenDocument();
            sendResponse(true);
        });

        audio.addEventListener('error', (e) => {
            console.error("🔊 Error de audio:", e.target.error);
            closeOffscreenDocument();
            sendResponse(false);
        });

        audio.play()
            .then(() => {
                setTimeout(closeOffscreenDocument, 3000);
                sendResponse(true);
            })
            .catch(error => {
                console.error("❌ Error al reproducir:", error);
                sendResponse(false);
            });

        return true; // Mantener el canal abierto
    }
});