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
    taskTimer: document.getElementById('task-timer'),
    customTimerDiv: document.getElementById('customTimerDiv'),
    customTimer: document.getElementById('task-custom-timer'),
    dailyTaskDiv: document.getElementById('dailyTaskDiv'),
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

  const getCategoryClass = (category) => {
    return {
      'urgente': 'danger',
      'alta': 'warning',
      'baja': 'success'
    }[category?.toLowerCase()] || '';
  };

  const categoryEnum = {
    'urgente': '紧急',
    'alta': '高优先',
    'baja': '低优先'
  };

  const toggleForm = (isEditing = false) => {
    elements.addTaskForm.classList.toggle('show');
    elements.submitForm.textContent = isEditing ? '保存更改' : '添加任务';
    document.querySelector('#add-task-form h2').textContent = isEditing ? '编辑任务' : '添加任务';
    if (!isEditing) {
      elements.addTaskForm.reset();
      showCustomTimerDiv(false);
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
    form['task-custom-timer'].value = task.customTimer || '';
    [...form['daily-task']].forEach(input => input.checked = input.value === String(task.dailyTask));
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
      <h3 class="task-name">${task.dailyTask ? "[每日] " + task.name : task.name}</h3>
      <span class="label ${getCategoryClass(task.category)}">${categoryEnum[task.category]}</span>
    </div>
    ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
    <div class="task-footer-container">
      <div class="task-meta">
        <span class="task-date"><i class="fas fa-calendar"></i> ${new Date(task.creationDate).toLocaleDateString('es-ES')}</span>
        ${task.dueDate ? `<span class="task-due-date"><i class="fas fa-clock"></i> ${new Date(task.dueDate).toLocaleDateString('es-ES')}</span>` : ''}
        ${false ? `
          <span class="task-modified">
            <i class="fas fa-edit"></i> 
            ${new Date(task.lastModified).toLocaleDateString('zh-CN')}
          </span>` : ''}
        ${(task.timer !== 'none' && task.timer !== 'custom') ? `<div class="task-timer"><i class="fas fa-hourglass"></i> <span class="countdown" id="countdown-${task.id}"></span></div>` : ''}
        ${(task.timer === 'custom' && !task.completed) ? `<div class="task-timer"><i class="fas fa-hourglass"></i> <span class="countdown" id="countdown-${task.id}"></span></div>` : ''}
      </div>
      <div class="task-actions">
        <button class="complete-btn" title="${task.completed ? '重新打开' : '完成'}">
          <i class="fas fa-${task.completed ? 'undo' : 'check'}"></i>
        </button>
        <button class="edit-btn" title="编辑"><i class="fas fa-pencil-alt"></i></button>
        <button class="delete-btn" title="删除"><i class="fas fa-trash"></i></button>
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

    if (task.completed) {
      task.lastCompleted = Date.now();
      chrome.runtime.sendMessage({ type: 'deleteAlarm', taskId: task.id });
      if (countdownIntervals.has(task.id)) {
        clearInterval(countdownIntervals.get(task.id));
        countdownIntervals.delete(task.id);
      }
    } else {
      if (task.timer && task.timer !== 'none') {
        let dueTimestamp = null;
        if (task.timer === 'custom') {
          const [hours, minutes, seconds] = task.customTimer.split(':').map(Number);
          const totalMilliseconds = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
          const now = new Date();
          const beyond = totalMilliseconds >= now.getTime();
          if (!beyond) {
            task.dueDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + totalMilliseconds;
            dueTimestamp = task.dueDateTime - now;
          }
        } else {
          dueTimestamp = calculateDueDateTime(task.timer);
          task.dueDateTime = dueTimestamp;
        }
        if (dueTimestamp) {
          chrome.runtime.sendMessage({
            type: 'createAlarm',
            taskId: task.id,
            dueTime: dueTimestamp
          });
          startCountdown(task);
        }
      }
    }

    saveTasks();
    renderTasks();
    updateStatistics();
  };

  const editTask = (task) => {
    editingTask = task;
    showCustomTimerDiv(task.timer);
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

    // Limpiar intervalos anteriores
    if (countdownIntervals.has(task.id)) {
      clearInterval(countdownIntervals.get(task.id));
      countdownIntervals.delete(task.id);
    }

    const update = () => {
      const now = Date.now();
      const timeLeft = task.dueDateTime - now;
      const countdownElement = document.getElementById(`countdown-${task.id}`);

      if (timeLeft <= 0) {
        task.completed = true;
        saveTasks();
        renderTasks();

        // 🔥 Crear alarma para disparar notificación
        chrome.runtime.sendMessage({
          type: 'deleteAlarm',
          taskId: task.id
        });

        clearInterval(countdownIntervals.get(task.id));
        countdownIntervals.delete(task.id);
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
    elements.currentMonth.textContent = date.toLocaleDateString('zh-CN', {
      month: 'long',
      year: 'numeric'
    }).toUpperCase();

    // Cabecera días de la semana
    ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach(day => {
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
          <span class="label ${getCategoryClass(task.category)}">${categoryEnum[task.category]}</span>
        </div>
        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
        <div class="task-meta">
          <span><i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString('zh-CN')}</span>
          ${task.timer !== 'none' ? `<span><i class="fas fa-hourglass"></i> ${task.timer}</span>` : ''}
        </div>
      </div>
    `).join('');

    // Añadir separación entre elementos
    document.querySelectorAll('.task-detail').forEach((el, index) => {
      if (index > 0) el.style.marginTop = '15px';
    });
  };

  const showCustomTimerDiv = (timer) => {
    if (!timer || timer === 'none') {
      elements.customTimer.removeAttribute('required');
      elements.customTimerDiv.classList.add('hide');
      elements.dailyTaskDiv.classList.remove('hide');
    } else if (timer === 'custom') {
      elements.customTimer.setAttribute('required', '');
      elements.customTimerDiv.classList.remove('hide');
      elements.dailyTaskDiv.classList.add('hide');
      document.querySelector('input[name="daily-task"][value="false"]').checked = true;
    } else {
      elements.customTimer.removeAttribute('required');
      elements.customTimerDiv.classList.add('hide');
      elements.dailyTaskDiv.classList.add('hide');
      document.querySelector('input[name="daily-task"][value="false"]').checked = true;
    }
  }

  elements.formIcon.addEventListener('click', () => toggleForm());
  elements.closeForm.addEventListener('click', () => toggleForm(false));

  elements.addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(elements.addTaskForm);
    if (!formData.get('task-name')?.trim()) {
      alert('任务名称是必填项');
      return;
    }
    const taskData = {
      id: editingTask?.id || Date.now().toString(),
      name: formData.get('task-name').trim(),
      category: formData.get('task-category'),
      dueDate: formData.get('task-due-date'),
      description: formData.get('task-description'),
      timer: formData.get('task-timer'),
      customTimer: formData.get('task-custom-timer'),
      dueDateTime: calculateDueDateTime(formData.get('task-timer')),
      completed: editingTask?.completed || false,
      creationDate: editingTask?.creationDate || Date.now(),
      lastModified: null,
      lastCompleted: editingTask?.lastCompleted || false,  //用于每日执行任务判断当日是否执行
      dailyTask: document.querySelector('input[name="daily-task"]:checked')?.value === 'true',
      // lastModified: editingTask ? Date.now() : null
    };

    let dueTimestamp = null;
    if (taskData.timer && taskData.timer === 'custom' && taskData.customTimer) {
      const [hours, minutes, seconds] = taskData.customTimer.split(':').map(Number);
      const totalMilliseconds = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
      const now = new Date();
      const beyond = totalMilliseconds >= now.getTime();
      if (!beyond) {
        taskData.dueDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + totalMilliseconds;
        dueTimestamp = taskData.dueDateTime - now;
      }
    }

    if (editingTask) {
      const index = tasks.findIndex(t => t.id === editingTask.id);
      if (index !== -1) tasks[index] = taskData;
      editingTask = null;
      chrome.runtime.sendMessage({ type: 'deleteAlarm' });
    } else {
      tasks.push(taskData);
    }

    if (taskData.timer && taskData.timer !== 'none') {
      if (taskData.timer !== 'custom') {
        dueTimestamp = calculateDueDateTime(taskData.timer);
      }
      if (dueTimestamp) {
        chrome.runtime.sendMessage({
          type: 'createAlarm',
          taskId: taskData.id,
          dueTime: dueTimestamp
        });
      }
    }

    saveTasks();
    renderTasks();
    updateStatistics();
    toggleForm(false);
  });

  //监听定时器值改变事件，弹出自定义时间选择
  elements.taskTimer.addEventListener('change', (e) => {
    showCustomTimerDiv(e.target.value);
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

  const refreshTasksStorage = () => {
    const now = new Date();
    chrome.storage.local.get(['tasks'], (result) => {
      tasks = result.tasks || [];
      let refreshFlag = false;
      tasks.forEach(task => {
        if (!task.completed && task.dueDateTime > Date.now()) {
          startCountdown(task);
        }
        if (!task.completed && task.dueDateTime < Date.now()) {
          task.completed = true;
          refreshFlag = true;
        }
        if (task.dailyTask && task.completed) {
          //判断今日是否完成
          const todayCompleted = task.lastCompleted > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (!todayCompleted) {
            //判断是否已截止
            if (task.dueDate) {
              const beyond = (new Date(task.dueDate) + 86400000) < Date.now();
              if (!beyond) {
                task.completed = false;
                refreshFlag = true;
              }
            } else {
              task.completed = false;
              refreshFlag = true;
            }
          }
        }
      });
      // 创建每日任务提醒
      const dailyTaskNotCompleted = tasks.filter(task => task.dailyTask && !task.completed).length;
      if (dailyTaskNotCompleted > 0) {
        chrome.runtime.sendMessage({
          type: 'createAlarm',
          taskId: `daily-${new Date().toISOString().split('T')[0]}`,
          dueTime: 72000000 - (Date.now() - new Date().setHours(0, 0, 0, 0)),
        });
      }
      if (refreshFlag) {
        saveTasks();
      }
      renderTasks();
      updateStatistics();
    });
  };
  refreshTasksStorage();

});
