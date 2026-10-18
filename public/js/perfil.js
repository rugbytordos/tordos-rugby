// "Mi perfil": mis datos, mis hijos, contraseña, instalar la app y salir.
import { sb, estado, cargarYo, cargarPerfiles, misHijos } from './datos.js';
import { h, icono, aviso, hoja, pedirTexto, confirmar, mensajeError, cargandoEn } from './ui.js';
import { avatarJugador } from './jugadores.js';
import { pintarCabecera, pedidoInstalar } from './app.js';

export async function pantallaPerfil() {
  const yo = estado.yo;
  let rol = yo.rol;

  const nombre = h('input.entrada', { type: 'text', value: yo.nombre, autocomplete: 'given-name' });
  const apellido = h('input.entrada', { type: 'text', value: yo.apellido || '', autocomplete: 'family-name' });
  const botonesRol = ['mamá', 'papá'].map((r) => {
    const b = h('button', { type: 'button', 'aria-pressed': rol === r }, r === 'mamá' ? 'Soy la mamá' : 'Soy el papá');
    b.onclick = () => { rol = r; botonesRol.forEach((x) => x.setAttribute('aria-pressed', x === b)); };
    return b;
  });
  const guardar = h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, 'Guardar mis datos');

  const form = h('form.tarjeta',
    h('h2', 'Mis datos'),
    h('label.campo', h('span', 'Nombre'), nombre),
    h('label.campo', h('span', 'Apellido'), apellido),
    h('div.campo', h('span', '¿Sos la mamá o el papá?'), h('div.eleccion-rol', botonesRol)),
    h('div.campo', h('span', 'Email para entrar'), h('p.suave', yo.email)),
    guardar);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const datos = { nombre: nombre.value.trim(), apellido: apellido.value.trim(), rol };
    if (!datos.nombre || !datos.apellido) return aviso('Completá tu nombre y apellido.', 'error');
    const listo = cargandoEn(guardar, 'Guardando…');
    const { error } = await sb.from('perfiles').update(datos).eq('id', yo.id);
    listo();
    if (error) return aviso(mensajeError(error), 'error');
    await Promise.all([cargarYo(), cargarPerfiles()]);
    pintarCabecera();
    aviso('Tus datos quedaron guardados.', 'bien');
  };

  const hijos = misHijos();

  return [
    h('h1', 'Mi perfil'),
    form,

    h('section.tarjeta',
      h('h2', hijos.length > 1 ? 'Mis hijos' : 'Mi hijo'),
      hijos.length
        ? h('div.lista', hijos.map((j) => h('div.fila', avatarJugador(j), h('div.datos', h('b', `${j.nombre} ${j.apellido}`)))))
        : h('p.suave', 'Todavía no elegiste a tu hijo.'),
      h('a.btn.btn-rosa.btn-bloque', { href: '#/bienvenida' }, icono('chicos'), hijos.length ? 'Elegir o agregar otro hijo' : 'Elegir a mi hijo')),

    h('section.tarjeta',
      h('h2', 'Más opciones'),
      h('div.menu-acciones',
        h('button.btn.btn-celeste.btn-bloque', { type: 'button', onclick: instalar }, icono('instalar'), 'Instalar la app en el celular'),
        h('button.btn.btn-celeste.btn-bloque', { type: 'button', onclick: cambiarClave }, icono('llave'), 'Cambiar mi contraseña'),
        yo.es_admin ? h('a.btn.btn-azul.btn-bloque', { href: '#/admin' }, icono('escudo'), 'Administración') : null,
        h('button.btn.btn-borde.btn-bloque', { type: 'button', onclick: salir }, icono('salir'), 'Salir de la app'))),
  ];
}

async function cambiarClave() {
  const clave = await pedirTexto('Cambiar contraseña', { etiqueta: 'Contraseña nueva', tipo: 'password', boton: 'Guardar contraseña', ayuda: 'Mínimo 6 letras o números.' });
  if (!clave) return;
  if (clave.length < 6) return aviso('Tiene que tener al menos 6 letras o números.', 'error');
  const { error } = await sb.auth.updateUser({ password: clave });
  if (error) return aviso(mensajeError(error), 'error');
  aviso('Tu contraseña quedó cambiada.', 'bien');
}

async function salir() {
  if (await confirmar('¿Salir de la app?', 'Para volver a entrar vas a necesitar tu email y tu contraseña.', { si: 'Sí, salir' })) {
    await sb.auth.signOut();
  }
}

function instalar() {
  const yaInstalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (yaInstalada) return aviso('¡Ya la estás usando como app!', 'bien');

  if (pedidoInstalar) {
    pedidoInstalar.prompt();
    return;
  }
  const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const pasos = esIphone
    ? ['Abrí esta página en Safari (el navegador de la brújula).',
      'Tocá el botón Compartir: el cuadradito con una flecha para arriba, abajo en la pantalla.',
      'Bajá y tocá "Agregar a inicio".',
      'Tocá "Agregar". Listo: vas a ver el escudo de Los Tordos entre tus apps.']
    : ['Abrí esta página en Chrome.',
      'Tocá los tres puntitos de arriba a la derecha.',
      'Tocá "Agregar a la pantalla principal" o "Instalar app".',
      'Confirmá. Listo: vas a ver el escudo de Los Tordos entre tus apps.'];
  hoja('Instalar la app', h('ol', { style: 'display:grid;gap:12px;padding-left:22px;margin:0' }, pasos.map((p) => h('li', p))));
}
