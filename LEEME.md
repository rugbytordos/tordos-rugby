# Fotos Rugby Tordos

App privada para que las familias del rugby infantil de Los Tordos suban y vean las fotos de los chicos.

- **Supabase**: login, datos, etiquetas y miniaturas.
- **Google Drive** (rugbytordos@gmail.com): fotos en tamaño completo, en la carpeta
  `Fotos Rugby Tordos (app) / AÑO / MES`.
- **Cloudflare (Worker `tordos-rugby`)**: aloja la app, hace de puente seguro con Drive
  y cada 2 días "despierta" a Supabase para que no se pause.
- **GitHub**: guarda el código. Cada cambio que se sube se publica solo en Cloudflare.

## Qué hay en cada carpeta

| Carpeta | Para qué |
|---|---|
| `public/` | La app que ven los papás (pantallas, estilos, íconos) |
| `public/js/config.js` | URL y llave pública (anon) de Supabase |
| `src/worker.js` | Punto de entrada del Worker (rutas /api y despertador) |
| `functions/api/` | Funciones del servidor: registro con código, subir a Drive, ver/descargar fotos, admin, salud |
| `lib/servidor.js` | Conexión con Drive y Supabase usando las llaves secretas |
| `supabase/base-de-datos.sql` | Script único de la base de datos (se corre una sola vez) |
| `wrangler.jsonc` | Configuración del Worker (nombre, archivos, despertador) |

## Configuración de Cloudflare (Worker)

El proyecto se publica como **Worker** con archivos estáticos (`wrangler.jsonc`), no como Pages:
- Build command: *(vacío)*
- Deploy command: `npx wrangler deploy`

Variables en *Settings → Variables and Secrets* (las de la app, no las de Build), todas como **Secret**:

| Nombre | De dónde sale |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → pestaña "Legacy API keys" → anon |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API Keys → pestaña "Legacy API keys" → service_role |
| `GOOGLE_CLIENT_ID` | Google Cloud → Clientes OAuth |
| `GOOGLE_CLIENT_SECRET` | Google Cloud → Clientes OAuth |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground |

Para comprobar que todo está bien conectado: abrir `https://tordos-rugby.TU-CUENTA.workers.dev/api/salud`.
Tiene que decir `ok` en las **cuatro** líneas (variables, supabase, supabase_publica, drive).

## Supabase

- Usar las llaves de la pestaña **"Legacy API keys"** (empiezan con `eyJ`).
- Authentication → Sign In / Providers: desactivar **"Allow new users to sign up"** y **"Confirm email"**.
  (Las cuentas las crea el servidor después de revisar el código del equipo.)

## Detalles útiles

- Código inicial del equipo: `PANTERAS2026` (se cambia desde Administración).
- Divisiones iniciales: M6 y M7, M8, M9, M10 (se pueden sumar más al subir fotos).
- Actividades: Entrenamiento, Partido, Encuentro, Torneo, Tercer Tiempo, Salida, Otros.
- La primera persona que se registra queda como **administrador**.
- Las cuentas se crean ya confirmadas: no se manda mail de verificación.
- Las fotos se achican a 2048 px de lado (unos 0,5 a 1 MB) antes de subirlas.
- Borrar una foto la manda a la papelera; solo un admin la borra para siempre.
