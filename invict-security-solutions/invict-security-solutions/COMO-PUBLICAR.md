# Cómo publicar INVICT en tu propia cuenta

Este zip tiene el proyecto completo, corregido y probado. Se publica en dos pasos: primero GitHub (donde vive el código) y después Vercel (que lo pone en la web).

Necesitás una cuenta de GitHub y una de Vercel (podés crear la de Vercel entrando con GitHub).

---

## 1. Subir el código a GitHub

### Opción A — Desde la web (sin instalar nada)

1. Descomprimí el zip en una carpeta.
2. Entrá a https://github.com/new
   - **Repository name:** `invict-security-solutions`
   - Marcá **Private**.
   - No tildes "Add a README" ni ningún otro archivo.
   - Tocá **Create repository**.
3. En la página que aparece, tocá el link **uploading an existing file**.
4. Arrastrá **todo el contenido** de la carpeta descomprimida (las carpetas `src`, `api`, `lib`, `public` y los archivos sueltos), no la carpeta contenedora.
5. Abajo, tocá **Commit changes**.

> La carpeta `.aistudio` y los archivos que empiezan con punto (`.gitignore`, `.env.example`) pueden no verse en el explorador de Windows. No pasa nada si no se suben: la app funciona igual.

### Opción B — Con Git instalado

```bash
cd invict-security-solutions
git init -b main
git add -A
git commit -m "Versión inicial"
git remote add origin https://github.com/TU-USUARIO/invict-security-solutions.git
git push -u origin main
```

---

## 2. Publicar en Vercel

1. Entrá a https://vercel.com/new
2. Si te lo pide, conectá tu cuenta de GitHub y dale acceso al repo `invict-security-solutions`.
3. Elegí el repo y tocá **Import**.
4. Vercel detecta todo solo (Framework: **Vite**). No cambies nada de la configuración de build.
5. (Opcional, ver punto 3) Abrí **Environment Variables** y cargá `GEMINI_API_KEY`.
6. Tocá **Deploy**. En un minuto te da la dirección, del estilo `invict-security-solutions.vercel.app`.

Desde ahí, cada cambio que se suba al repo se publica solo.

---

## 3. Activar la inteligencia artificial (BONO y lectura de comprobantes)

Sin esta clave la app funciona, pero BONO contesta con respuestas predefinidas y los comprobantes se leen de forma aproximada.

1. Sacá una clave en https://aistudio.google.com/apikey
2. En Vercel: proyecto → **Settings → Environment Variables**
   - **Key:** `GEMINI_API_KEY`
   - **Value:** la clave
3. Volvé a publicar: **Deployments** → los tres puntos del último → **Redeploy**.

---

## 4. Ingreso con Google (calendario)

El botón de Google usa el proyecto de Firebase del autor original (`firebase-applet-config.json`). Para que funcione en el dominio nuevo, el dueño de ese proyecto de Firebase tiene que agregar la dirección de Vercel en **Firebase → Authentication → Settings → Authorized domains**, o reemplazar ese archivo por la configuración de un proyecto de Firebase propio.

---

## Antes de usarlo con datos reales

- **Los datos quedan en cada computadora.** Tareas, gastos y contraseñas se guardan en el navegador de cada equipo; lo que carga una persona no lo ve otra en otra PC.
- **Las contraseñas iniciales están en el código** (`src/utils/cloudSyncService.ts` y `src/utils/authService.ts`) y la contraseña inicial de cada puesto sigue sirviendo aunque se cambie. Sirve para una demostración, no para información confidencial.
