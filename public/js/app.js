// Arranque de la app: sesión, estructura de pantallas y navegación.
import { sb, estado, cargarYo, cargarTodo, cargarFotos, misHijos, imagenMiniatura } from './datos.js';
import { h, icono, aviso, hoja, mensajeError, nombreCompleto, iniciales, MESES, plural } from './ui.js';
import { pantallaAcceso } from './acceso.js';
import { pantallaSubir } from './subir.js';
import { pantallaFotos, abrirVisor } from './galeria.js';
import { pantallaJugadores, pantallaBienvenida } from './jugadores.js';
import { pantallaPerfil } from './perfil.js';
import { pantallaAdmin } from './admin.js';

const app = document.getElementById('app');
let principal = null;
let cabecera = null;
let nav = null;
let arrancado = false;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// Botón "Instalar app" en Android/compu
export let pedidoInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalar = e; });

// ---------- Sesión ----------
sb.auth.onAuthStateChange((evento, sesion) => {
  if (evento === 'PASSWORD_RECOVERY') {
    setTimeout(() => nuevaClaveDesdeMail(), 300);
  }
  if (evento === 'SIGNED_OUT') {
    estado.sesion = null;
    estado.yo = null;
    arrancado = false;
    setTimeout(mostrarAcceso, 0);
  }
  if (evento === 'SIGNED_IN' && sesion && !arrancado) {
    estado.sesion = sesion;
    setTimeout(() => entrar(), 0); // fuera del aviso de Supabase, para no trabarlo
  }
});

async function iniciar() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    estado.sesion = data.session;
    await entrar();
  } else {
    mostrarAcceso();
  }
}

function mostrarAcceso() {
  principal = null;
  app.replaceChildren(pantallaAcceso());
}

export async function entrar() {
  if (arrancado) return;
  arrancado = true;
  app.replaceChildren(h('div.cargando-inicial',
    h('img', { src: '/icons/escudo.svg', alt: '', width: 84, height: 84 }),
    h('p', 'Buscando las fotos…')));
  try {
    const { data } = await sb.auth.getSession();
    estado.sesion = data.session;
    const yo = await cargarYo();
    if (!yo) return cuentaBloqueada();
    await cargarTodo();
  } catch (e) {
    console.error(e);
    arrancado = false;
    app.replaceChildren(h('div.cargando-inicial',
      h('img', { src: '/icons/escudo.svg', alt: '', width: 84, height: 84 }),
      h('p', mensajeError(e, 'No se pudo cargar la app.')),
      h('button.btn.btn-rojo', { onclick: () => location.reload() }, 'Probar de nuevo'),
      h('button.btn.btn-texto', { onclick: () => sb.auth.signOut() }, 'Salir')));
    return;
  }
  armarEstructura();
  let vistaBienvenida = false;
  try { vistaBienvenida = localStorage.getItem('rugby-bienvenida-' + estado.yo.id); } catch { /* */ }
  if (!misHijos().length && !vistaBienvenida) location.hash = '#/bienvenida';
  mostrarRuta();
}

function cuentaBloqueada() {
  app.replaceChildren(h('div.acceso',
    h('div.portada', h('img', { src: '/icons/escudo.svg', alt: '' }), h('h1', 'Cuenta pausada')),
    h('div.cuerpo', h('div.tarjeta',
      h('p', 'Tu cuenta está pausada por un administrador. Si creés que es un error, hablá con quien administra la app en el grupo del equipo.'),
      h('button.btn.btn-azul.btn-bloque', { onclick: () => sb.auth.signOut() }, icono('salir'), 'Salir')))));
}

// ---------- Estructura: cabecera, contenido y barra de abajo ----------
function armarEstructura() {
  cabecera = h('header.cabecera');
  principal = h('main.pantalla', { id: 'contenido', tabindex: '-1' });
  nav = h('nav.barra-nav', { 'aria-label': 'Secciones' },
    enlaceNav('inicio', 'Inicio', 'inicio'),
    enlaceNav('subir', 'Subir', 'subir'),
    enlaceNav('fotos', 'Fotos', 'fotos'),
    enlaceNav('chicos', 'Los chicos', 'chicos'));
  app.replaceChildren(cabecera, principal, nav);
  pintarCabecera();
}

export function pintarCabecera() {
  if (!cabecera) return;
  const yo = estado.yo;
  cabecera.replaceChildren(
    h('a.marca', { href: '#/inicio' },
      h('img', { src: '/icons/escudo.svg', alt: '' }),
      h('span', h('b', 'Los Tordos'), h('small', 'Fotos Rugby'))),
    h('a.boton-perfil', { href: '#/perfil', 'aria-label': 'Mi perfil' },
      h('span.avatar.chico', iniciales(yo.nombre, yo.apellido)),
      yo.nombre));
}

function enlaceNav(ruta, texto, ic) {
  return h('a', { href: '#/' + ruta, 'data-ruta': ruta }, icono(ic), texto);
}

// ---------- Navegación ----------
export function irA(ruta) {
  if (location.hash === '#/' + ruta) mostrarRuta();
  else location.hash = '#/' + ruta;
}

export function parametrosRuta() {
  const [, consulta = ''] = location.hash.split('?');
  return new URLSearchParams(consulta);
}

window.addEventListener('hashchange', () => { if (principal) mostrarRuta(); });

async function mostrarRuta() {
  const ruta = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'inicio');
  document.querySelectorAll('.fondo-hoja:not([data-fija]), .visor').forEach((n) => n.remove());
  document.body.style.overflow = '';

  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.ruta === ruta) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const pantallas = {
    inicio: pantallaInicio,
    subir: pantallaSubir,
    fotos: pantallaFotos,
    chicos: pantallaJugadores,
    perfil: pantallaPerfil,
    admin: pantallaAdmin,
    bienvenida: pantallaBienvenida,
  };
  const armar = pantallas[ruta] || pantallaInicio;
  principal.replaceChildren();
  window.scrollTo(0, 0);
  try {
    const contenido = await armar();
    if (contenido) principal.replaceChildren(...[].concat(contenido).filter(Boolean));
  } catch (e) {
    console.error(e);
    principal.replaceChildren(h('div.vacio', icono('alerta'), h('p', mensajeError(e)),
      h('button.btn.btn-rojo', { onclick: () => mostrarRuta() }, 'Probar de nuevo')));
  }
}

// Recarga las fotos si pasó más de un minuto
export async function fotosAlDia() {
  if (Date.now() - estado.fotosCargadas > 60000) await cargarFotos();
}

// ---------- Inicio ----------
async function pantallaInicio() {
  await fotosAlDia().catch(() => {});
  const yo = estado.yo;
  const hora = new Date().getHours();
  const saludo = hora < 13 ? '¡Buen día' : hora < 20 ? '¡Buenas tardes' : '¡Buenas noches';
  const hijos = misHijos();
  const ultimas = estado.fotos.slice().sort((a, b) => b.creado_en.localeCompare(a.creado_en)).slice(0, 12);

  return [
    h('div.saludo',
      h('h1', `${saludo}, ${yo.nombre}!`),
      h('p.suave', hijos.length
        ? `${yo.rol === 'mamá' ? 'Mamá' : 'Papá'} de ${hijos.map((j) => j.nombre).join(' y ')}`
        : `${yo.rol === 'mamá' ? 'Bienvenida' : 'Bienvenido'} a las fotos del equipo`)),

    h('div.grandes',
      h('a.gran-boton.subir', { href: '#/subir' },
        h('span.icono-grande', icono('camara')), h('b', 'Subir fotos'), h('span', 'Del celular o la compu')),
      h('a.gran-boton.ver', { href: '#/fotos' },
        h('span.icono-grande', icono('galeria')), h('b', 'Ver fotos'), h('span', plural(estado.fotos.length, 'foto', 'fotos')))),

    h('div.medianos',
      h('a.mediano.rosa', { href: '#/chicos' }, icono('chicos'), 'Los chicos'),
      h('a.mediano.celeste', { href: '#/perfil' }, icono('persona'), 'Mi perfil'),
      yo.es_admin ? h('a.mediano.azul', { href: '#/admin' }, icono('escudo'), 'Administración') : null),

    ultimas.length ? h('section',
      h('div.seccion-titulo', h('h2', 'Lo último que se subió'), h('a', { href: '#/fotos' }, 'Ver todas')),
      h('div.tira-fotos', { style: 'margin-top:12px' }, ultimas.map((f, i) =>
        h('button.miniatura', { type: 'button', 'aria-label': 'Abrir foto', onclick: () => abrirVisor(ultimas, i) },
          imagenMiniatura(f.miniatura_path, f.titulo || ''))))) : null,
  ];
}

// ---------- Contraseña nueva (cuando vienen del mail de "me olvidé") ----------
function nuevaClaveDesdeMail() {
  const entrada = h('input.entrada', { type: 'password', autocomplete: 'new-password', minlength: 6 });
  const form = h('form', { style: 'display:grid;gap:14px' },
    h('p', 'Escribí tu contraseña nueva. La vas a usar para entrar de ahora en más.'),
    h('label.campo', h('span', 'Contraseña nueva'), entrada),
    h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, 'Guardar contraseña'));
  const v = hoja('Elegí tu contraseña', form);
  v.caja.parentElement.dataset.fija = '1';
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (entrada.value.length < 6) return aviso('Tiene que tener al menos 6 letras o números.', 'error');
    const { error } = await sb.auth.updateUser({ password: entrada.value });
    if (error) return aviso(mensajeError(error), 'error');
    v.cerrar();
    history.replaceState(null, '', location.pathname + '#/inicio');
    aviso('¡Listo! Tu contraseña quedó cambiada.', 'bien');
  };
}

// Para usar desde otras pantallas
export { MESES, nombreCompleto };

iniciar();
