let offscreenInitialized = false;

// Inicializar el documento offscreen si no está creado
const initializeOffscreen = async () => {
    if (offscreenInitialized) return;

    try {
        const hasDoc = await chrome.offscreen.hasDocument();
        if (!hasDoc) {
            console.log("Creando documento offscreen...");
            await chrome.offscreen.createDocument({
                url: chrome.runtime.getURL('offscreen.html'),
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Reproducir alertas'
            });
            console.log("Documento offscreen creado exitosamente.");
        }
        offscreenInitialized = true;
    } catch (error) {
        console.error("Error al inicializar offscreen:", error);
    }
};

// Escuchar todas las alarmas
chrome.alarms.onAlarm.addListener(async (alarm) => {
    await initializeOffscreen();

    // Obtener las tareas almacenadas localmente
    const { tasks = [] } = await chrome.storage.local.get('tasks');
    const task = tasks.find(t => t.id === alarm.name);

    if (!task) {
        console.warn(`No se encontró ninguna tarea con ID ${alarm.name}`);
        return;
    }

    // Crear notificación
    chrome.notifications.create(alarm.name, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: '⏰ Tiempo agotado',
        message: `"${task.name}" ha finalizado`,
        priority: 2
    });

    // Reproducir sonido
    chrome.runtime.sendMessage({ type: 'playSound' });

    // Enviar mensaje para actualizar el popup
    chrome.runtime.sendMessage({
        type: 'alarmTriggered',
        taskName: task.name
    });
});

// Manejar mensajes enviados desde el popup o content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'createAlarm') {
        // Crear alarma para una tarea
        const { taskId, dueTime } = message;
        if (dueTime > 0) {
            chrome.alarms.create(taskId, { delayInMinutes: dueTime / 60000 });
            console.log(`Alarma creada para la tarea con ID ${taskId}`);
        } else {
            console.warn(`El tiempo de vencimiento es inválido para la tarea con ID ${taskId}`);
        }
    } else if (message.type === 'deleteAlarm') {
        // Eliminar alarma para una tarea
        const { taskId } = message;
        chrome.alarms.clear(taskId, () => {
            if (chrome.runtime.lastError) {
                console.error(`Error al eliminar la alarma para la tarea con ID ${taskId}:`, chrome.runtime.lastError);
            } else {
                console.log(`Alarma eliminada para la tarea con ID ${taskId}`);
            }
        });
    } else if (message.type === 'playSound') {
        // Reproducir sonido directamente desde el background script
        const audio = new Audio(chrome.runtime.getURL('alert.mp3'));
        audio.play().catch((error) => {
            console.error("Error al reproducir el sonido:", error);
        });
    } else if (message.type === 'showNotification') {
        // Mostrar notificación personalizada
        const { title, message } = message;
        chrome.notifications.create(null, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: title,
            message: message,
            priority: 2
        });
    }
});