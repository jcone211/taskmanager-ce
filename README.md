# Task Manager Chrome Extension

**English | [简体中文](README_zh-CN.md)**

![icon](https://github.com/user-attachments/assets/3c86f31d-1183-470e-b280-409472668bb4)

## 📌 Descripción

Task Manager es una extensión de Google Chrome diseñada para ayudarte a organizar tus tareas de manera sencilla y eficiente directamente desde tu navegador.

## 🚀 Características

- ✅ Añadir, editar y eliminar tareas fácilmente.
- 🔔 Notificaciones de recordatorio y alertas por audio.
- 🎨 Interfaz simple y amigable.
- 🌙 Calendario de tareas.

## ✨ Modified items from the original project

(The original version has not been modified.Please use zh-CN version)

1. Sinicization of Chinese.
2. Add a custom task time selection.
3. Added daily fixed mission feature.
4. Modify some CSS styles.
5. ...

### Interfaz principal:

![image](https://github.com/user-attachments/assets/0458ad4c-b659-4305-a5eb-50aa7f8f72ad)

### Vista de las tareas en el calendario:

![image](https://github.com/user-attachments/assets/324d35a4-2629-4402-bf79-2069bca3f46b)

## 🛠 Instalación

1. Descarga el repositorio:
   ```sh
   git clone https://github.com/OriolLlovera/taskmanager-ce.git
   ```
2. Abre Google Chrome y ve a `chrome://extensions/`.
3. Activa el "Modo Desarrollador" en la esquina superior derecha.
4. Haz clic en "Cargar descomprimida" y selecciona la carpeta del proyecto.

## 📦 Estructura del Proyecto

```
📂 task-manager-extension
├── 📁 assets       # Imágenes y recursos
├── 📁 src          # Código fuente
│   ├── icon.png  # Icono extensión
│   ├── popup.html  # Interfaz de la extensión
│   ├── popup.js    # Lógica de la aplicación
│   ├── manifest.json  # Configuración de la extensión
│   ├── background.js  # Archivo JS para audio y alertas
│   ├── offscreen.js  # Archivo JS para audio y alertas con la app minimizada
│   ├── offscreen.html  # Archivo HTML para audio y alertas con la app minimizada
│   ├── styles.css  # Estilos CSS
└── README.md       # Documentación
```

## 📝 Uso

1. Haz clic en el icono de la extensión en la barra de herramientas.
2. Añade una nueva tarea y guárdala.
3. Marca tareas como completadas cuando termines o de forma automática con el temporizador.
4. Revisa en el calendario las tareas por fecha.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si tienes ideas o mejoras, abre un issue o haz un pull request.

## 📜 Licencia

Este proyecto está bajo la licencia MIT. Puedes usarlo y modificarlo libremente.

---

🚀 **Desarrollado por Oriol Llovera (https://github.com/OriolLlovera/)**
