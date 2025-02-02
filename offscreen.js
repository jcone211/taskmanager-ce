chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'playSound') {
        const audio = new Audio(chrome.runtime.getURL('alert.mp3'));
        audio.play()
            .then(() => {
                setTimeout(() => {
                    chrome.offscreen.closeDocument();
                }, 3000);
            })
            .catch(error => {
                console.error('Error al reproducir:', error);
                chrome.offscreen.closeDocument();
            });
    }
});