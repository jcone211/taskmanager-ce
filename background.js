// Función robusta para inicializar offscreen
let offscreenDocumentReady = false;

const initializeOffscreen = async () => {
    if (offscreenDocumentReady) return true;
    
    try {
        const hasDocument = await chrome.offscreen.hasDocument();
        if (!hasDocument) {
            await chrome.offscreen.createDocument({
                url: chrome.runtime.getURL('offscreen.html'),
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Reproducir alertas'
            });
        }
        offscreenDocumentReady = true;
        return true;
    } catch (error) {
        console.error("❌ Fallo al inicializar offscreen:", error);
        return false;
    }
};

// Listener de alarmas mejorado
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
      await initializeOffscreen(); // Asegurar que offscreen está listo
      
      const { tasks = [] } = await chrome.storage.local.get('tasks');
      const task = tasks.find(t => t.id === alarm.name);

      if (!task || task.completed) return;

      // Actualizar tarea
      task.completed = true;
      await chrome.storage.local.set({ tasks });

      // Notificación
      chrome.notifications.create(alarm.name, {
          type: 'basic',
          iconUrl: 'icon.png',
          title: '⏰ Tiempo agotado',
          message: `"${task.name}" ha finalizado`,
          priority: 2
      });

      // Enviar mensaje con verificación
      chrome.runtime.sendMessage({ type: 'playSound' }, (response) => {
          if (chrome.runtime.lastError) {
              console.warn("⚠️ Error de conexión:", chrome.runtime.lastError.message);
          }
      });
  } catch (error) {
      console.error("🔥 Error crítico en alarma:", error);
  }
});

// Comunicación desde popup.js
chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
        case 'createAlarm':
            chrome.alarms.create(message.taskId, { 
                delayInMinutes: message.dueTime / 60000 
            });
            break;
        case 'deleteAlarm':
            chrome.alarms.clear(message.taskId);
            break;
    }
});