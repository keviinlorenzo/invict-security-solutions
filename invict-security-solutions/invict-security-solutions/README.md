# INVICT Security Solutions — Sistema de Gestión Gerencial y Matriz Operativa

Plataforma interna de INVICT Security Solutions S.A.: matriz de tareas por puesto, informes ejecutivos, gastos de oficina, calendario, feed interno y el asistente BONO.

## Stack

- React 19 + Vite + Tailwind 4 (frontend en `src/`)
- Endpoints de IA con Gemini en `lib/aiHandlers.ts`:
  - `POST /api/bono/chat` — asistente BONO
  - `POST /api/expenses/analyze-receipt` — lectura de comprobantes (si no hay clave, usa un analizador heurístico)
- En Vercel esos endpoints corren como funciones (`api/`); en local los sirve `server.ts` (Express + Vite).

## Correr en local

```bash
npm install
npm run dev
```

Abre en http://localhost:3000 (o el puerto de `PORT`).

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Clave de Gemini para BONO y la lectura de comprobantes. Sin ella la app funciona con respuestas de respaldo. |

En Vercel se cargan en *Settings → Environment Variables*.

## Despliegue

Cada push a `main` publica en Vercel. Configuración en `vercel.json`.

## A tener en cuenta

- Los datos (tareas, gastos, contraseñas cambiadas) se guardan en el `localStorage` de cada navegador: no se comparten entre computadoras.
- El inicio de sesión con Google usa el proyecto de Firebase de `firebase-applet-config.json`; para que funcione en un dominio nuevo hay que agregarlo en *Firebase → Authentication → Authorized domains*.
