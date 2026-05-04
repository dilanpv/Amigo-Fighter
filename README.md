# 🥊 Amigo Fighter

¡Bienvenido a **Amigo Fighter**! Un emocionante juego de lucha multijugador desarrollado con React, Phaser 3 y Node.js. Enfréntate a tus amigos en tiempo real o compite en torneos épicos para convertirte en la leyenda del ring.

![Amigo Fighter](https://img.shields.io/badge/Status-Desarrollo-orange)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Phaser%203%20%7C%20Node.js-blue)

## ✨ Características Principales

*   **Multijugador en Tiempo Real:** Combates fluidos sincronizados mediante WebSockets (Socket.io).
*   **Sistema de Torneos:** Crea o únete a torneos con llaves de eliminación directa (Brackets) automatizadas.
*   **IA de CPU:** Entrena contra el CPU con tres niveles de dificultad (Fácil, Normal, Difícil).
*   **Personalización:** Elige tu personaje, personaliza sus estadísticas (Fuerza, Velocidad, Resistencia) y selecciona tu estilo de pelea (Agresivo, Defensivo, Balanceado).
*   **Interacción Social:** Envía emotes en tiempo real durante el combate.
*   **Diseño Premium:** UI moderna con efectos de cristalmorfismo, animaciones fluidas y soporte para dispositivos móviles.

## 🚀 Instalación y Uso Local

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

### Requisitos Previos
*   [Node.js](https://nodejs.org/) (v16 o superior)
*   npm

### Configuración del Proyecto

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/amigo-fighter.git
    cd amigo-fighter
    ```

2.  **Instala las dependencias (en la raíz):**
    ```bash
    npm run install:all
    ```
    *Este comando instalará automáticamente las dependencias de la carpeta `/client` y `/server`.*

3.  **Ejecuta el proyecto:**
    ```bash
    npm run dev
    ```
    *Esto iniciará el servidor (puerto 3001) y el cliente (puerto 5173) simultáneamente.*

## 📂 Estructura del Proyecto

*   `/client`: Aplicación frontend en React + Vite + Phaser 3.
*   `/server`: Servidor backend en Node.js + Express + Socket.io.
*   `DEPLOYMENT.md`: Guía detallada para desplegar online (Render + Vercel).

## 🎮 Controles

*   **Flechas / D-Pad:** Movimiento y Salto.
*   **Abajo (Down):** Bloqueo.
*   **A:** Jab (Golpe rápido).
*   **S:** Gancho (Golpe fuerte).
*   **D:** Patada.
*   **W:** Ataque Especial.

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** React 19, Phaser 3 (Motor de juego), Tailwind CSS.
*   **Backend:** Node.js, Express, Socket.io (WebSockets).
*   **Despliegue:** Preparado para Render y Vercel.

---

Desarrollado con ❤️ por **Dilan** y el equipo de **Amigo Fighter**.
