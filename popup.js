document.addEventListener('DOMContentLoaded', () => {
  let tasks = [];
  let editingTask = null;
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  const countdownIntervals = new Map();

  const elements = {
    addTaskForm: document.getElementById('add-task-form'),
    formIcon: document.getElementById('form-icon'),
    closeForm: document.getElementById('close-form'),
    submitForm: document.getElementById('submit-form'),
    searchInput: document.getElementById('search-input'),
    taskList: document.getElementById('task-list'),
    urgentCount: document.getElementById('urgent-count'),
    highCount: document.getElementById('high-count'),
    lowCount: document.getElementById('low-count'),
    filterCategory: document.getElementById('filter-category'),
    filterStatus: document.getElementById('filter-status'),
    filterDate: document.getElementById('filter-date'),
    calendarIcon: document.getElementById('calendar-icon'),
    calendarModal: document.getElementById('calendar-modal'),
    calendar: document.getElementById('calendar'),
    currentMonth: document.getElementById('current-month'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    taskDetails: document.getElementById('task-details'),
    filterWrapper: document.querySelector('.filter-wrapper'),
    filterDropdown: document.querySelector('.filter-dropdown')
  };


  const playAlertSound = () => {
    chrome.runtime.sendMessage({ type: 'playSound' });
  };
  
  const showNotification = (taskName) => {
    chrome.runtime.sendMessage({
      type: 'showNotification',
      title: '¡Tiempo agotado!',
      message: `La tarea "${taskName}" ha expirado`
    });
  };

  const getCategoryClass = (category) => {
    return {
      'urgente': 'danger',
      'alta': 'warning',
      'baja': 'success'
    }[category?.toLowerCase()] || '';
  };


  const toggleForm = (isEditing = false) => {
    elements.addTaskForm.classList.toggle('show');
    elements.submitForm.textContent = isEditing ? 'Guardar cambios' : 'Añadir tarea';
    document.querySelector('#add-task-form h2').textContent = isEditing ? 'Editar Tarea' : 'Añadir Tarea';
    if (!isEditing) {
      elements.addTaskForm.reset();
      editingTask = null;
    }
  };

  const populateForm = (task) => {
    const form = elements.addTaskForm.elements;
    form['task-name'].value = task.name;
    form['task-category'].value = task.category.toLowerCase();
    form['task-due-date'].value = task.dueDate || '';
    form['task-description'].value = task.description || '';
    form['task-timer'].value = task.timer || 'none';
  };

  const calculateDueDateTime = (timer) => {
    if (!timer || timer === 'none') return null;
    const timeUnits = { min: 60000, h: 3600000 };
    const match = timer.match(/(\d+)(min|h)/);
    return match ? Date.now() + (parseInt(match[1]) * timeUnits[match[2]]) : null;
};

  const createTaskElement = (task) => {
    const taskElement = document.createElement('li');
    taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
    taskElement.id = `task-${task.id}`;
    
    taskElement.innerHTML = `
  <div class="task-content">
    <div class="task-header-container">
      <h3 class="task-name">${task.name}</h3>
      <span class="label ${getCategoryClass(task.category)}">${task.category}</span>
    </div>
    ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
    <div class="task-footer-container">
      <div class="task-meta">
        <span class="task-date"><i class="fas fa-calendar"></i> ${new Date(task.creationDate).toLocaleDateString('es-ES')}</span>
        ${task.dueDate ? `<span class="task-due-date"><i class="fas fa-clock"></i> ${new Date(task.dueDate).toLocaleDateString('es-ES')}</span>` : ''}
        ${task.lastModified ? `<span class="task-modified"><i class="fas fa-edit"></i> ${new Date(task.lastModified).toLocaleDateString('es-ES')}</span>` : ''}
        ${task.timer !== 'none' ? `<div class="task-timer"><i class="fas fa-hourglass"></i> <span class="countdown" id="countdown-${task.id}"></span></div>` : ''}
      </div>
      <div class="task-actions">
        <button class="complete-btn" title="${task.completed ? 'Reabrir' : 'Completar'}">
          <i class="fas fa-${task.completed ? 'undo' : 'check'}"></i>
        </button>
        <button class="edit-btn" title="Editar"><i class="fas fa-pencil-alt"></i></button>
        <button class="delete-btn" title="Eliminar"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  </div>
`;

    taskElement.querySelector('.complete-btn').addEventListener('click', () => toggleComplete(task));
    taskElement.querySelector('.edit-btn').addEventListener('click', () => editTask(task));
    taskElement.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task));

    return taskElement;
  };

  const renderTasks = (tasksToRender = tasks) => {
    elements.taskList.innerHTML = '';
    tasksToRender.forEach(task => {
      elements.taskList.appendChild(createTaskElement(task));
      if (!task.completed && task.dueDateTime > Date.now()) startCountdown(task);
    });
  };

  const saveTasks = () => chrome.storage.local.set({ tasks });

  const toggleComplete = (task) => {
    task.completed = !task.completed;
    task.lastModified = Date.now();
    
    if (!task.completed && task.timer !== 'none') {
      // Restaurar el tiempo original del temporizador
      const [value, unit] = task.timer.match(/(\d+)(min|h)/i)?.slice(1) || [];
      const timeUnits = { min: 60000, h: 3600000 };
      task.dueDateTime = Date.now() + (value * timeUnits[unit]);
      
      chrome.runtime.sendMessage({
        type: 'createAlarm',
        taskId: task.id,
        dueTime: value * timeUnits[unit]
      });
      startCountdown(task);
    } else {
      chrome.runtime.sendMessage({ type: 'deleteAlarm', taskId: task.id });
    }
    
    saveTasks();
    renderTasks();
    updateStatistics();
  };

  const editTask = (task) => {
    editingTask = task;
    populateForm(task);
    toggleForm(true);
  };

  const deleteTask = (task) => {
    tasks = tasks.filter(t => t.id !== task.id);
    if (countdownIntervals.has(task.id)) {
      clearInterval(countdownIntervals.get(task.id));
      countdownIntervals.delete(task.id);
    }
    saveTasks();
    renderTasks();
    updateStatistics();
  };

  const updateStatistics = () => {
    const counts = tasks.reduce((acc, task) => {
      if (!task.completed) acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {});
    elements.urgentCount.textContent = counts.urgente || 0;
    elements.highCount.textContent = counts.alta || 0;
    elements.lowCount.textContent = counts.baja || 0;
  };

  const startCountdown = (task) => {
    if (!task.dueDateTime || task.completed) return;

    // Eliminar intervalos previos
    if (countdownIntervals.has(task.id)) {
        clearInterval(countdownIntervals.get(task.id));
    }

    const update = () => {
        const now = Date.now();
        const timeLeft = task.dueDateTime - now;
        const countdownElement = document.getElementById(`countdown-${task.id}`);

        if (timeLeft <= 0) {
            task.completed = true;
            saveTasks();
            renderTasks();

            // 🔥 Crear alarma manualmente (FALTA ESTE PASO)
            chrome.runtime.sendMessage({ 
                type: 'createAlarm', 
                taskId: task.id,
                dueTime: 0 // Disparar inmediatamente
            });

            // Notificación y sonido
            showNotification(task.name);
            playAlertSound();

            clearInterval(countdownIntervals.get(task.id));
        } else {
            const hours = Math.floor(timeLeft / 3600000).toString().padStart(2, '0');
            const minutes = Math.floor((timeLeft % 3600000) / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0');
            
            if (countdownElement) {
                countdownElement.textContent = `${hours}:${minutes}:${seconds}`;
                countdownElement.classList.toggle('red', timeLeft < 300000);
            }
        }
    };

    update();
    countdownIntervals.set(task.id, setInterval(update, 1000));
};

  const generateCalendar = (month, year) => {
    elements.calendar.innerHTML = '';
    const date = new Date(year, month);
    elements.currentMonth.textContent = date.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric'
    }).toUpperCase();
  
    // Cabecera días de la semana
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      elements.calendar.appendChild(dayHeader);
    });
  
    // Días vacíos iniciales
    const firstDay = new Date(year, month, 1).getDay() || 7; // Lunes=1, Domingo=7
    for (let i = 1; i < firstDay; i++) {
      elements.calendar.appendChild(document.createElement('div'));
    }
  
    // Días del mes
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const dayElement = document.createElement('div'); // Definición corregida
      dayElement.className = 'calendar-day';
      dayElement.textContent = day;
  
      const currentDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = tasks.filter(task => task.dueDate === currentDate);
  
      // Resaltar días con tareas
      if (dayTasks.length > 0) {
        dayElement.classList.add('has-tasks');
        dayElement.dataset.taskCount = dayTasks.length;
        
        // Clase de categoría predominante
        const categories = dayTasks.reduce((acc, task) => {
          acc[task.category] = (acc[task.category] || 0) + 1;
          return acc;
        }, {});
        const mainCategory = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
        dayElement.classList.add(getCategoryClass(mainCategory));
      }
  
      // Evento clic para detalles
      dayElement.addEventListener('click', () => {
        const currentDetails = elements.taskDetails.dataset.currentDate;
        elements.taskDetails.innerHTML = '';
        elements.taskDetails.removeAttribute('data-current-date');
        
        if (currentDetails !== currentDate) {
          elements.taskDetails.setAttribute('data-current-date', currentDate);
          showTaskDetails(dayTasks);
        }
      });
  
      elements.calendar.appendChild(dayElement);
    }
  };

  const showTaskDetails = (tasks) => {
    elements.taskDetails.innerHTML = tasks.map(task => `
      <div class="task-detail1 ${task.completed ? 'completed' : ''}">
        <div class="task-header1">
          <h4>${task.name}</h4>
          <span class="label ${getCategoryClass(task.category)}">${task.category}</span>
        </div>
        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
        <div class="task-meta">
          <span><i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString('es-ES')}</span>
          ${task.timer !== 'none' ? `<span><i class="fas fa-hourglass"></i> ${task.timer}</span>` : ''}
        </div>
      </div>
    `).join('');
    
    // Añadir separación entre elementos
    document.querySelectorAll('.task-detail').forEach((el, index) => {
      if (index > 0) el.style.marginTop = '15px';
    });
  };

  elements.formIcon.addEventListener('click', () => toggleForm());
  elements.closeForm.addEventListener('click', () => toggleForm(false));
  
  elements.addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(elements.addTaskForm);
    
    if (!formData.get('task-name')?.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    const taskData = {
      id: editingTask?.id || Date.now().toString(),
      name: formData.get('task-name').trim(),
      category: formData.get('task-category'),
      dueDate: formData.get('task-due-date'),
      description: formData.get('task-description'),
      timer: formData.get('task-timer'),
      dueDateTime: calculateDueDateTime(formData.get('task-timer')),
      completed: editingTask?.completed || false,
      creationDate: editingTask?.creationDate || Date.now(),
      lastModified: Date.now()
    };

    if (editingTask) {
      const index = tasks.findIndex(t => t.id === editingTask.id);
      if (index !== -1) tasks[index] = taskData;
    } else {
      tasks.push(taskData);
    }

    if (taskData.timer !== 'none') {
      // Crear alarma solo si hay temporizador
      chrome.runtime.sendMessage({
          type: 'createAlarm',
          taskId: taskData.id,
          dueTime: taskData.dueDateTime - Date.now() // Tiempo restante
      });
  }

    saveTasks();
    renderTasks();
    updateStatistics();
    toggleForm(false);
  });

  elements.filterWrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.filterDropdown.classList.toggle('show');
  });

  elements.filterDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', () => {
    elements.filterDropdown.classList.remove('show');
  });

  elements.searchInput.addEventListener('input', () => renderTasks(applyFilters()));
  elements.filterCategory.addEventListener('change', () => renderTasks(applyFilters()));
  elements.filterStatus.addEventListener('change', () => renderTasks(applyFilters()));
  elements.filterDate.addEventListener('change', () => renderTasks(applyFilters()));

  elements.calendarIcon.addEventListener('click', () => {
    elements.calendarModal.style.display = 'block';
    generateCalendar(currentMonth, currentYear);
  });

  elements.prevMonth.addEventListener('click', () => {
    currentMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    currentYear = currentMonth === 11 ? currentYear - 1 : currentYear;
    generateCalendar(currentMonth, currentYear);
  });

  elements.nextMonth.addEventListener('click', () => {
    currentMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    currentYear = currentMonth === 0 ? currentYear + 1 : currentYear;
    generateCalendar(currentMonth, currentYear);
  });

  document.querySelector('.close-modal').addEventListener('click', () => {
    elements.calendarModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === elements.calendarModal) elements.calendarModal.style.display = 'none';
  });

  const applyFilters = () => tasks.filter(task => {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const categoryFilter = elements.filterCategory.value;
    const statusFilter = elements.filterStatus.value;
    const dateFilter = elements.filterDate.value;
    
    return (
      (task.name.toLowerCase().includes(searchTerm) || 
      (task.description && task.description.toLowerCase().includes(searchTerm))) &&
      (!categoryFilter || task.category.toLowerCase() === categoryFilter) &&
      (!statusFilter || 
       (statusFilter === 'completed' && task.completed) || 
       (statusFilter === 'pending' && !task.completed)) &&
      (!dateFilter || task.dueDate === dateFilter)
    );
  });

  chrome.storage.local.get(['tasks'], (result) => {
    tasks = result.tasks || [];
    renderTasks();
    updateStatistics();
    tasks.forEach(task => {
      if (!task.completed && task.dueDateTime > Date.now()) startCountdown(task);
    });
  });


  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'alarmTriggered') {
      renderTasks();
      updateStatistics();
      showNotification(message.taskName);
      playAlertSound();
    }
  });

});