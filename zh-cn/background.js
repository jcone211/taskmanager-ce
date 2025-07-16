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
    const taskIndex = tasks.findIndex(t => t.id === alarm.name);

    if (taskIndex === -1) {
        console.warn(`No se encontró ninguna tarea con ID ${alarm.name}`);
        return;
    }

    const task = tasks[taskIndex];
    if (!task || !task.name) {
        console.error('La tarea o su nombre no están definidos:', task);
        return;
    }

    // Marcar la tarea como completada
    tasks[taskIndex].completed = true;
    await chrome.storage.local.set({ tasks });

    chrome.runtime.sendMessage({
        type: 'playSound'
    });

    // 创建通知
    chrome.notifications.create(alarm.name, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: '⏰ 任务清单',
        message: `"${task.name}" 计时结束`,
        priority: 2
    });
});

// Manejar mensajes enviados desde el popup o content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'createAlarm') {
        const { taskId, dueTime } = message;
        if (dueTime > 0) {
            chrome.alarms.create(taskId, { delayInMinutes: dueTime / 60000 });
            console.log(`Alarma creada para la tarea con ID ${taskId}`);
        }
    } else if (message.type === 'deleteAlarm') {
        chrome.alarms.clear(message.taskId);
    }
});