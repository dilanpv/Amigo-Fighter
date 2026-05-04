# 🚀 Guía de Despliegue — Amigo Fighter

Este proyecto está preparado para ser desplegado con **Render** (Servidor) y **Vercel/Netlify** (Cliente).

---

## 1. Servidor (Backend) — Despliegue en Render
Render es excelente para servidores de Node.js con WebSockets.

1.  Crea una cuenta en [Render.com](https://render.com/).
2.  Crea un nuevo **Web Service**.
3.  Conecta tu repositorio de GitHub.
4.  Configura los siguientes campos:
    *   **Root Directory:** `server`
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
5.  **Variables de Entorno (Environment Variables):**
    *   `CLIENT_URL`: La URL de tu frontend (ej: `https://amigo-fighter.vercel.app`).
6.  Copia la URL que te asigne Render (ej: `https://amigo-fighter-server.onrender.com`).

---

## 2. Cliente (Frontend) — Despliegue en Vercel
Vercel es ideal para aplicaciones React creadas con Vite.

1.  Crea una cuenta en [Vercel.com](https://vercel.com/).
2.  Importa tu proyecto de GitHub.
3.  Vercel detectará el proyecto. Configura:
    *   **Root Directory:** `client`
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `dist`
4.  **Variables de Entorno (Environment Variables):**
    *   `VITE_SOCKET_URL`: La URL de tu servidor en Render (ej: `https://amigo-fighter-server.onrender.com`).
5.  Haz clic en **Deploy**.

---

## 3. Notas Importantes
*   **WebSockets:** Render "duerme" los servicios gratuitos después de 15 minutos de inactividad. La primera conexión puede tardar hasta 30 segundos.
*   **CORS:** Asegúrate de que `CLIENT_URL` en Render coincida exactamente con la URL que te dé Vercel.
*   **Móvil:** Al estar online, ya no necesitas estar en la misma red Wi-Fi; cualquiera puede jugar desde cualquier lugar.

---

## 🛠️ Resumen de Archivos Modificados para Despliegue
- `client/src/socket.js`: Ahora usa `VITE_SOCKET_URL`.
- `server/index.js`: Ahora usa `CLIENT_URL` para CORS y tiene una ruta `/health`.
- `client/vite.config.js`: Configurado para permitir acceso host en local.
