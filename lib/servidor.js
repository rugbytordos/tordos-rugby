// =====================================================================
//  Funciones compartidas por la parte "servidor" (Worker de Cloudflare).
//  Acá viven las llaves secretas: nunca llegan al celular de los papás.
//
//  Variables que hay que cargar en Cloudflare (Settings → Variables and Secrets, como Secret):
//    SUPABASE_URL            https://xxxx.supabase.co
//    SUPABASE_ANON_KEY       la llave pública (anon)
//    SUPABASE_SERVICE_KEY    la llave secreta (service_role)   ← SECRETA
//    GOOGLE_CLIENT_ID        de Google Cloud
//    GOOGLE_CLIENT_SECRET    de Google Cloud                   ← SECRETA
//    GOOGLE_REFRESH_TOKEN    del OAuth Playground              ← SECRETA
// =====================================================================

export const CARPETA_RAIZ = 'Fotos Rugby Tordos (app)';
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ---------- Respuestas ----------
export function json(datos, estado = 200) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export class ErrorApp extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

// Envuelve cada función para devolver errores amigables
// Quita espacios, saltos de línea y comillas que se cuelan al pegar las llaves
export function limpiarEnv(env) {
  const limpio = { ...env };
  for (const v of VARIABLES) {
    if (typeof limpio[v] === 'string') limpio[v] = limpio[v].trim().replace(/^["']|["']$/g, '').trim();
  }
  return limpio;
}

export function manejar(fn) {
  return async (contexto) => {
    try {
      contexto = { ...contexto, env: limpiarEnv(contexto.env) };
      faltantes(contexto.env);
      return await fn(contexto);
    } catch (e) {
      if (e instanceof ErrorApp) return json({ error: e.message }, e.estado);
      console.error(e);
      return json({ error: 'Ocurrió un error inesperado. Probá de nuevo en un rato.' }, 500);
    }
  };
}

const VARIABLES = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];

export function faltantes(env, lanzar = true) {
  const falta = VARIABLES.filter((v) => !env[v]);
  if (falta.length && lanzar) {
    throw new ErrorApp('Falta configurar en Cloudflare: ' + falta.join(', '), 500);
  }
  return falta;
}

// ---------- Supabase ----------
function baseSupabase(env) {
  return env.SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
}

export function cabecerasServicio(env, extra = {}) {
  const k = env.SUPABASE_SERVICE_KEY;
  const h = { apikey: k, 'Content-Type': 'application/json', ...extra };
  if (k.startsWith('eyJ')) h.Authorization = 'Bearer ' + k; // llave "legacy"
  return h;
}

// Llamada a Supabase con la llave secreta (salta las reglas de seguridad)
export async function supabase(env, ruta, opciones = {}) {
  const r = await fetch(baseSupabase(env) + ruta, {
    ...opciones,
    headers: cabecerasServicio(env, opciones.headers || {}),
  });
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  if (!r.ok) {
    const msg = (datos && (datos.msg || datos.message || datos.error_description || datos.error)) || texto;
    const err = new Error('Supabase ' + r.status + ': ' + msg);
    err.estado = r.status;
    err.datos = datos;
    throw err;
  }
  return datos;
}

// Verifica que quien llama esté logueado y no bloqueado (o que sea admin)
export async function verificarUsuario(request, env, { admin = false } = {}) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ErrorApp('Tenés que iniciar sesión.', 401);

  const funcion = admin ? 'es_admin' : 'es_activo';
  // Se usa la llave del servidor como "apikey" y el token del papá para saber quién es
  const llave = env.SUPABASE_SERVICE_KEY;
  const r = await fetch(baseSupabase(env) + '/rest/v1/rpc/' + funcion, {
    method: 'POST',
    headers: { apikey: llave, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (r.status === 401 || r.status === 403) {
    const texto = await r.text();
    console.error('verificarUsuario', r.status, texto);
    if (/api key/i.test(texto)) throw new ErrorApp('La llave de Supabase cargada en Cloudflare no es válida.', 500);
    throw new ErrorApp('Tu sesión venció. Volvé a entrar.', 401);
  }
  if (!r.ok) {
    console.error('verificarUsuario', r.status, await r.text());
    throw new ErrorApp('No se pudo verificar tu sesión.', 500);
  }
  const ok = await r.json();
  if (ok !== true) {
    throw new ErrorApp(admin ? 'Solo los administradores pueden hacer esto.' : 'Tu cuenta no está habilitada.', 403);
  }
  return token;
}

// ---------- Google Drive ----------
// Se guardan en memoria mientras la función siga "despierta"
let tokenCache = { valor: null, vence: 0 };
const carpetasCache = new Map();

export async function tokenGoogle(env) {
  if (tokenCache.valor && Date.now() < tokenCache.vence) return tokenCache.valor;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) {
    console.error('Google token', r.status, d);
    throw new ErrorApp('No se pudo conectar con Google Drive (' + (d.error || r.status) + ').', 500);
  }
  tokenCache = { valor: d.access_token, vence: Date.now() + (d.expires_in - 120) * 1000 };
  return d.access_token;
}

async function drive(env, url, opciones = {}) {
  const token = await tokenGoogle(env);
  const r = await fetch(url, {
    ...opciones,
    headers: { Authorization: 'Bearer ' + token, ...(opciones.headers || {}) },
  });
  return r;
}

async function driveJson(env, url, opciones) {
  const r = await drive(env, url, opciones);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Drive', r.status, JSON.stringify(d));
    const motivo = d.error && (d.error.errors?.[0]?.reason || d.error.status || '');
    const detalle = d.error && d.error.message ? ': ' + String(d.error.message).slice(0, 160) : '';
    throw new ErrorApp('Google Drive respondió con un error (' + r.status + (motivo ? ' ' + motivo : '') + ')' + detalle, 502);
  }
  return d;
}

const TIPO_CARPETA = 'application/vnd.google-apps.folder';

// Busca una carpeta por nombre dentro de otra; si no existe, la crea
export async function carpeta(env, padreId, nombre) {
  const clave = padreId + '/' + nombre;
  if (carpetasCache.has(clave)) return carpetasCache.get(clave);

  const nombreQ = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name='${nombreQ}' and mimeType='${TIPO_CARPETA}' and trashed=false and '${padreId}' in parents`;
  const lista = await driveJson(env,
    'https://www.googleapis.com/drive/v3/files?fields=files(id)&pageSize=1&q=' + encodeURIComponent(q));

  let id = lista.files && lista.files[0] && lista.files[0].id;
  if (!id) {
    const nueva = await driveJson(env, 'https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: TIPO_CARPETA, parents: [padreId] }),
    });
    id = nueva.id;
  }
  carpetasCache.set(clave, id);
  return id;
}

export function nombreCarpetaMes(mes) {
  return String(mes).padStart(2, '0') + ' - ' + MESES[mes - 1];
}

// Carpeta final: Fotos Rugby Tordos (app) / 2026 / 10 - Octubre
export async function carpetaDe(env, anio, mes) {
  const raiz = await carpeta(env, 'root', CARPETA_RAIZ);
  const carpetaAnio = await carpeta(env, raiz, String(anio));
  return carpeta(env, carpetaAnio, nombreCarpetaMes(mes));
}

export async function subirArchivo(env, { nombre, tipo, datos, carpetaId }) {
  const limite = 'rugby' + crypto.randomUUID().replace(/-/g, '');
  const meta = JSON.stringify({ name: nombre, parents: [carpetaId] });
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${limite}\r\nContent-Type: ${tipo}\r\n\r\n`,
    datos,
    `\r\n--${limite}--`,
  ]);
  return driveJson(env, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
}

export async function descargarArchivo(env, id) {
  return drive(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
}

export async function moverArchivo(env, id, nuevaCarpetaId) {
  const info = await driveJson(env,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=parents`);
  const quitar = (info.parents || []).filter((p) => p !== nuevaCarpetaId).join(',');
  if (!quitar && (info.parents || []).includes(nuevaCarpetaId)) return;
  const params = new URLSearchParams({ addParents: nuevaCarpetaId, fields: 'id' });
  if (quitar) params.set('removeParents', quitar);
  await driveJson(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?` + params, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

// Manda el archivo a la papelera de Drive (Google la vacía sola a los 30 días)
export async function papeleraDrive(env, id) {
  const r = await drive(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!r.ok && r.status !== 404) throw new ErrorApp('No se pudo borrar la foto de Drive.', 502);
}
