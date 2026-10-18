// Conexión con Supabase y con las funciones de Cloudflare (que hablan con Drive).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { MESES, nombreCompleto, sinAcentos } from './ui.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'rugby-sesion' },
});

// Todo lo que la app tiene en memoria
export const estado = {
  sesion: null,
  yo: null,
  perfiles: [], perfilPorId: new Map(),
  divisiones: [], divisionPorId: new Map(),
  jugadores: [], jugadorPorId: new Map(),
  familia: [],
  fotos: [],
  fotosCargadas: 0, // momento de la última carga
};

function revisar({ data, error }) {
  if (error) throw error;
  return data;
}

// Supabase entrega de a 1000 filas: esto trae todas
async function traerTodo(armarConsulta) {
  const todo = [];
  for (let desde = 0; ; desde += 1000) {
    const parte = revisar(await armarConsulta().range(desde, desde + 999));
    todo.push(...parte);
    if (parte.length < 1000) break;
  }
  return todo;
}

// ---------- Cargas ----------
export async function cargarYo() {
  const uid = estado.sesion.user.id;
  const { data, error } = await sb.from('perfiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  estado.yo = data; // null si está bloqueado (las reglas no lo dejan ver nada)
  return data;
}

export async function cargarPerfiles() {
  estado.perfiles = revisar(await sb.from('perfiles').select('id,email,nombre,apellido,rol,es_admin,bloqueado,creado_en').order('nombre'));
  estado.perfilPorId = new Map(estado.perfiles.map((p) => [p.id, p]));
}

export async function cargarDivisiones() {
  estado.divisiones = revisar(await sb.from('divisiones').select('*').order('orden').order('nombre'));
  estado.divisionPorId = new Map(estado.divisiones.map((d) => [d.id, d]));
}

export async function cargarJugadores() {
  const [jug, fam] = await Promise.all([
    traerTodo(() => sb.from('jugadores').select('*').order('nombre').order('apellido')),
    traerTodo(() => sb.from('familia').select('*')),
  ]);
  estado.familia = fam;
  estado.jugadores = jug.map((j) => ({
    ...j,
    padres: fam.filter((f) => f.jugador_id === j.id).map((f) => f.perfil_id),
  }));
  estado.jugadorPorId = new Map(estado.jugadores.map((j) => [j.id, j]));
}

const CAMPOS_FOTO = 'id,drive_file_id,miniatura_path,nombre_archivo,ancho,alto,mes,anio,division_id,tipo_actividad,titulo,subido_por,creado_en,en_papelera_desde,enviada_por,foto_jugadores(jugador_id)';

export function prepararFoto(f) {
  const jugadores = (f.foto_jugadores || []).map((x) => x.jugador_id);
  const foto = { ...f, jugadores };
  delete foto.foto_jugadores;
  foto.textoBusqueda = textoDeFoto(foto);
  return foto;
}

export function textoDeFoto(f) {
  const div = estado.divisionPorId.get(f.division_id);
  const autor = estado.perfilPorId.get(f.subido_por);
  return sinAcentos([
    f.titulo, f.tipo_actividad, div && div.nombre, MESES[f.mes - 1], f.anio,
    autor && nombreCompleto(autor),
    ...f.jugadores.map((id) => { const j = estado.jugadorPorId.get(id); return j ? j.nombre + ' ' + j.apellido : ''; }),
  ].filter(Boolean).join(' '));
}

export async function cargarFotos() {
  const filas = await traerTodo(() => sb.from('fotos').select(CAMPOS_FOTO)
    .is('en_papelera_desde', null)
    .order('anio', { ascending: false }).order('mes', { ascending: false }).order('creado_en', { ascending: false }));
  estado.fotos = filas.map(prepararFoto);
  estado.fotosCargadas = Date.now();
}

export async function cargarPapelera() {
  const filas = await traerTodo(() => sb.from('fotos').select(CAMPOS_FOTO)
    .not('en_papelera_desde', 'is', null).order('en_papelera_desde', { ascending: false }));
  return filas.map(prepararFoto);
}

export async function cargarTodo() {
  await Promise.all([cargarPerfiles(), cargarDivisiones()]);
  await cargarJugadores();
  await cargarFotos();
}

export function misHijos() {
  const uid = estado.yo && estado.yo.id;
  return estado.jugadores.filter((j) => j.padres.includes(uid));
}

// ---------- Funciones de Cloudflare ----------
async function token(renovar = false) {
  if (renovar) {
    const { data } = await sb.auth.refreshSession();
    if (data && data.session) return data.session.access_token;
  }
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('Tu sesión venció. Volvé a entrar.');
  return data.session.access_token;
}

export async function api(ruta, opciones = {}, reintento = false) {
  const { metodo = 'POST', cuerpo, tipo, sinSesion = false, limite = 60000 } = opciones;
  const cabeceras = {};
  if (!sinSesion) cabeceras.Authorization = 'Bearer ' + (await token(reintento));
  let body = cuerpo;
  if (cuerpo && !(cuerpo instanceof Blob)) {
    cabeceras['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  } else if (tipo) cabeceras['Content-Type'] = tipo;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), limite);
  let r;
  try {
    r = await fetch(ruta, { method: metodo, headers: cabeceras, body, signal: control.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('La conexión tardó demasiado.');
    throw e;
  } finally {
    clearTimeout(reloj);
  }
  if (r.status === 401 && !sinSesion && !reintento) return api(ruta, opciones, true);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || 'El servidor respondió con un error (' + r.status + ').');
  return datos;
}

// ---------- Fotos en tamaño completo (desde Drive) ----------
const completas = new Map(); // driveId → blob
export async function fotoCompleta(driveId) {
  if (completas.has(driveId)) return completas.get(driveId);
  let r = await fetch('/api/foto?id=' + encodeURIComponent(driveId), {
    headers: { Authorization: 'Bearer ' + (await token()) },
  });
  if (r.status === 401) {
    r = await fetch('/api/foto?id=' + encodeURIComponent(driveId), {
      headers: { Authorization: 'Bearer ' + (await token(true)) },
    });
  }
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || 'No se pudo abrir la foto.');
  }
  const blob = await r.blob();
  completas.set(driveId, blob);
  if (completas.size > 25) completas.delete(completas.keys().next().value);
  return blob;
}

// ---------- Miniaturas (Supabase Storage, privadas) ----------
// Se guardan los links firmados una semana: así el celular reutiliza lo que ya bajó.
const CLAVE_FIRMAS = 'rugby-firmas';
const SEMANA = 7 * 24 * 3600;
let firmas = {};
try { firmas = JSON.parse(localStorage.getItem(CLAVE_FIRMAS) || '{}'); } catch { firmas = {}; }
let guardarPendiente = null;
function guardarFirmas() {
  clearTimeout(guardarPendiente);
  guardarPendiente = setTimeout(() => {
    const ahora = Date.now();
    for (const k of Object.keys(firmas)) if (firmas[k].v < ahora) delete firmas[k];
    try { localStorage.setItem(CLAVE_FIRMAS, JSON.stringify(firmas)); } catch { /* sin espacio: no pasa nada */ }
  }, 400);
}

export async function urlsMiniaturas(rutas) {
  const ahora = Date.now();
  const resultado = {};
  const faltan = [];
  for (const r of rutas) {
    const f = firmas[r];
    if (f && f.v > ahora + 86400000) resultado[r] = f.u;
    else faltan.push(r);
  }
  for (let i = 0; i < faltan.length; i += 100) {
    const lote = faltan.slice(i, i + 100);
    const { data, error } = await sb.storage.from('miniaturas').createSignedUrls(lote, SEMANA);
    if (error) throw error;
    for (const d of data || []) {
      if (!d.signedUrl || d.error) continue;
      resultado[d.path] = d.signedUrl;
      firmas[d.path] = { u: d.signedUrl, v: ahora + SEMANA * 1000 };
    }
  }
  if (faltan.length) guardarFirmas();
  return resultado;
}

export function olvidarFirma(ruta) {
  delete firmas[ruta];
  guardarFirmas();
}

// Carga perezosa: pide la miniatura recién cuando la foto aparece en pantalla
const pendientes = new Map();
let temporizador = null;
const observador = 'IntersectionObserver' in window
  ? new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      observador.unobserve(e.target);
      const ruta = e.target.dataset.ruta;
      if (!pendientes.has(ruta)) pendientes.set(ruta, []);
      pendientes.get(ruta).push(e.target);
    }
    clearTimeout(temporizador);
    temporizador = setTimeout(procesarPendientes, 60);
  }, { rootMargin: '400px 0px' })
  : null;

async function procesarPendientes() {
  const lote = new Map(pendientes);
  pendientes.clear();
  if (!lote.size) return;
  try {
    const urls = await urlsMiniaturas([...lote.keys()]);
    for (const [ruta, imgs] of lote) {
      for (const img of imgs) if (urls[ruta]) img.src = urls[ruta];
    }
  } catch (e) {
    console.error(e);
  }
}

// Crea un <img> que carga solo su miniatura cuando hace falta
export function imagenMiniatura(ruta, alt = '') {
  const img = document.createElement('img');
  img.alt = alt;
  img.decoding = 'async';
  img.dataset.ruta = ruta;
  img.addEventListener('load', () => img.classList.add('lista'));
  img.addEventListener('error', () => {
    // el link venció o cambió: se pide uno nuevo una vez
    if (img.dataset.reintento) return;
    img.dataset.reintento = '1';
    olvidarFirma(ruta);
    urlsMiniaturas([ruta]).then((u) => { if (u[ruta]) img.src = u[ruta]; }).catch(() => {});
  });
  if (observador) observador.observe(img);
  else urlsMiniaturas([ruta]).then((u) => { if (u[ruta]) img.src = u[ruta]; });
  return img;
}
