chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'playSound') {
        const audio = new Audio(chrome.runtime.getURL('alert.mp3'));
        audio.play().catch(error => {
            console.error('Error al reproducir:', error);
        });
    }
});