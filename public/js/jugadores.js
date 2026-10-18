// "Los chicos": todos los jugadores, sus familias y la bienvenida para elegir a tu hijo.
import { sb, estado, cargarJugadores, imagenMiniatura, misHijos } from './datos.js';
import { leerImagen, achicar } from './imagen.js';
import { h, icono, aviso, hoja, confirmar, mensajeError, cargandoEn, iniciales, plural, sinAcentos } from './ui.js';
import { irA } from './app.js';

export function avatarJugador(j, clase = '') {
  const a = h('span.avatar', { clase });
  if (j.foto_path) a.append(imagenMiniatura(j.foto_path, ''));
  else a.textContent = iniciales(j.nombre, j.apellido);
  return a;
}

function textoPadres(j) {
  return j.padres.map((id) => estado.perfilPorId.get(id)).filter(Boolean)
    .sort((a, b) => (a.rol === 'mamá' ? 0 : 1) - (b.rol === 'mamá' ? 0 : 1))
    .map((p) => `${p.rol === 'mamá' ? 'Mamá' : 'Papá'}: ${p.nombre}`);
}

function fotosDe(j) {
  return estado.fotos.filter((f) => f.jugadores.includes(j.id)).length;
}

// ---------- Pantalla principal ----------
export async function pantallaJugadores() {
  const mias = new Set(misHijos().map((j) => j.id));
  const todas = estado.jugadores.slice().sort((a, b) =>
    sinAcentos(a.nombre + a.apellido).localeCompare(sinAcentos(b.nombre + b.apellido)));
  const resto = todas.filter((j) => !mias.has(j.id));

  const tarjeta = (j) => h('button.tarjeta-jugador', { type: 'button', clase: mias.has(j.id) ? 'mia' : '', onclick: () => detalle(j) },
    avatarJugador(j),
    h('b', `${j.nombre} ${j.apellido}`),
    h('small', textoPadres(j).join(' y ') || 'Sin familia vinculada'),
    h('small', plural(fotosDe(j), 'foto', 'fotos')));

  return [
    h('div.encabezado-pantalla',
      h('div', h('h1', 'Los chicos'), h('p.suave', `${plural(todas.length, 'jugador', 'jugadores')} en el equipo`)),
      h('button.btn.btn-rojo.btn-chico', { type: 'button', onclick: () => editarJugador(null, { esMia: false }) }, icono('mas'), 'Agregar jugador')),
    mias.size ? h('section', h('h2', mias.size === 1 ? 'Mi hijo' : 'Mis hijos'),
      h('div.grilla-jugadores', { style: 'margin-top:12px' }, todas.filter((j) => mias.has(j.id)).map(tarjeta))) : null,
    (resto.length || !todas.length) ? h('section', mias.size ? h('h2', 'Todo el equipo') : null,
      resto.length
        ? h('div.grilla-jugadores', { style: mias.size ? 'margin-top:12px' : '' }, resto.map(tarjeta))
        : (!todas.length ? h('div.vacio', icono('chicos'), h('h2', 'Todavía no hay jugadores'),
          h('p.suave', 'Agregá a tu hijo para que aparezca acá y se lo pueda marcar en las fotos.'),
          h('button.btn.btn-rojo', { type: 'button', onclick: () => editarJugador(null, { esMia: true }) }, icono('mas'), 'Agregar a mi hijo')) : null)) : null,
  ];
}

function refrescarPantalla() {
  if (location.hash.startsWith('#/chicos')) irA('chicos');
}

// ---------- Detalle de un jugador ----------
function detalle(j) {
  const esMia = j.padres.includes(estado.yo.id);
  const cant = fotosDe(j);
  const btnVer = h('a.btn.btn-azul.btn-bloque', { href: '#/fotos?jugador=' + j.id }, icono('galeria'),
    cant ? `Ver sus ${plural(cant, 'foto', 'fotos')}` : 'Ver sus fotos');
  const btnMia = h('button.btn.btn-bloque', { type: 'button', clase: esMia ? 'btn-borde' : 'btn-rosa' },
    icono('corazon'), esMia ? 'Ya no es mi hijo' : 'Es mi hijo');
  const btnEditar = h('button.btn.btn-celeste.btn-bloque', { type: 'button' }, icono('editar'), 'Cambiar nombre o foto');
  const btnBorrar = estado.yo.es_admin ? h('button.btn.btn-peligro.btn-bloque', { type: 'button' }, icono('borrar'), 'Borrar jugador') : null;

  const v = hoja(`${j.nombre} ${j.apellido}`, h('div', { style: 'display:grid;gap:12px;justify-items:center;text-align:center' },
    avatarJugador(j, 'grande'),
    h('p.suave', textoPadres(j).join(' y ') || 'Todavía nadie lo marcó como su hijo'),
    h('div', { style: 'display:grid;gap:10px;width:100%' }, btnVer, btnMia, btnEditar, btnBorrar)));

  btnVer.onclick = () => v.cerrar();
  btnEditar.onclick = () => { v.cerrar(); editarJugador(j); };
  btnMia.onclick = async () => {
    if (esMia) {
      const ok = await confirmar('¿Desvincularte?', `${j.nombre} va a dejar de figurar como tu hijo. Sus fotos no se borran.`, { si: 'Sí, desvincular' });
      if (!ok) return;
      const { error } = await sb.from('familia').delete().eq('perfil_id', estado.yo.id).eq('jugador_id', j.id);
      if (error) return aviso(mensajeError(error), 'error');
    } else {
      const { error } = await sb.from('familia').insert({ perfil_id: estado.yo.id, jugador_id: j.id });
      if (error) return aviso(mensajeError(error), 'error');
      aviso(`¡Listo! ${j.nombre} figura como tu hijo.`, 'bien');
    }
    await cargarJugadores();
    v.cerrar();
    refrescarPantalla();
  };
  if (btnBorrar) btnBorrar.onclick = async () => {
    const ok = await confirmar('¿Borrar jugador?',
      `Se borra a ${j.nombre} ${j.apellido} de la lista y se lo quita de las fotos donde estaba marcado. Las fotos no se borran.`,
      { si: 'Sí, borrar', peligro: true });
    if (!ok) return;
    const { error } = await sb.from('jugadores').delete().eq('id', j.id);
    if (error) return aviso(mensajeError(error), 'error');
    estado.fotos.forEach((f) => { f.jugadores = f.jugadores.filter((id) => id !== j.id); });
    await cargarJugadores();
    v.cerrar();
    aviso('Jugador borrada.');
    refrescarPantalla();
  };
}

// ---------- Agregar o editar un jugador ----------
export function editarJugador(j, { esMia = false, alGuardar } = {}) {
  return new Promise((resolver) => {
    let fotoNueva = null;
    let guardada = null;
    const nombre = h('input.entrada', { type: 'text', autocapitalize: 'words', value: j ? j.nombre : '', required: true });
    const apellido = h('input.entrada', { type: 'text', autocapitalize: 'words', value: j ? j.apellido : '', required: true });
    const vista = h('div', { style: 'display:grid;justify-items:center;gap:10px' });
    const archivo = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const btnFoto = h('button.btn.btn-celeste.btn-chico', { type: 'button', onclick: () => archivo.click() }, icono('camara'), j && j.foto_path ? 'Cambiar foto' : 'Elegir foto');
    const casillaMia = h('input', { type: 'checkbox', checked: esMia, style: 'width:28px;height:28px;accent-color:var(--rojo)' });
    const boton = h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, j ? 'Guardar cambios' : 'Agregar jugador');

    const pintarVista = (src) => {
      const av = src ? h('span.avatar.grande', h('img', { src, alt: '' }))
        : (j ? avatarJugador(j, 'grande') : h('span.avatar.grande', icono('persona')));
      vista.replaceChildren(av, btnFoto);
    };
    pintarVista(null);

    archivo.onchange = async () => {
      const f = archivo.files[0];
      if (!f) return;
      try {
        const { img, url } = await leerImagen(f);
        fotoNueva = await achicar(img, 400, 0.82, { recorteCuadrado: true });
        URL.revokeObjectURL(url);
        pintarVista(URL.createObjectURL(fotoNueva.blob));
      } catch (e) {
        aviso(mensajeError(e), 'error');
      }
    };

    const form = h('form', { style: 'display:grid;gap:16px' },
      vista, archivo,
      h('label.campo', h('span', 'Nombre'), nombre),
      h('label.campo', h('span', 'Apellido'), apellido),
      j ? null : h('label', { style: 'display:flex;gap:12px;align-items:center;font-weight:700;font-size:1.1rem;color:var(--texto)' }, casillaMia, 'Es mi hijo'),
      boton);

    const v = hoja(j ? 'Editar jugador' : 'Agregar jugador', form, { alCerrar: () => resolver(guardada) });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const datos = { nombre: nombre.value.trim(), apellido: apellido.value.trim() };
      if (!datos.nombre || !datos.apellido) return aviso('Completá nombre y apellido.', 'error');

      if (!j) {
        const parecida = estado.jugadores.find((x) => sinAcentos(x.nombre + x.apellido) === sinAcentos(datos.nombre + datos.apellido));
        if (parecida && !(await confirmar('¿Ya está cargado?', `Ya hay un jugador llamado ${parecida.nombre} ${parecida.apellido}. ¿Querés agregarlo igual?`, { si: 'Agregar igual' }))) return;
      }

      const listo = cargandoEn(boton, 'Guardando…');
      try {
        let id = j && j.id;
        if (!j) {
          const { data, error } = await sb.from('jugadores').insert({ ...datos, creado_por: estado.yo.id }).select('id').single();
          if (error) throw error;
          id = data.id;
          if (casillaMia.checked) {
            const r = await sb.from('familia').insert({ perfil_id: estado.yo.id, jugador_id: id });
            if (r.error) throw r.error;
          }
        }
        const cambios = { ...datos };
        if (fotoNueva) {
          const ruta = `jugadores/${id}-${Date.now().toString(36)}.jpg`;
          const sube = await sb.storage.from('miniaturas').upload(ruta, fotoNueva.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
          if (sube.error) throw sube.error;
          cambios.foto_path = ruta;
        }
        const { error } = await sb.from('jugadores').update(cambios).eq('id', id);
        if (error) throw error;

        await cargarJugadores();
        guardada = estado.jugadorPorId.get(id);
        v.cerrar();
        aviso(j ? 'Cambios guardados.' : `¡${datos.nombre} ya está en el equipo!`, 'bien');
        if (alGuardar) alGuardar(guardada);
        else refrescarPantalla();
      } catch (err) {
        listo();
        aviso(mensajeError(err, 'No se pudo guardar.'), 'error');
      }
    };
  });
}

// ---------- Bienvenida: elegir a tu hijo ----------
export async function pantallaBienvenida() {
  const yo = estado.yo;
  const elegidas = new Set(misHijos().map((j) => j.id));
  const lista = h('div');
  const buscador = h('input.entrada', { type: 'search', placeholder: 'Buscar por nombre', 'aria-label': 'Buscar jugador' });

  function terminar() {
    try { localStorage.setItem('rugby-bienvenida-' + yo.id, '1'); } catch { /* */ }
    irA('inicio');
  }

  function pintarLista() {
    const t = sinAcentos(buscador.value);
    const js = estado.jugadores
      .filter((j) => !t || sinAcentos(j.nombre + ' ' + j.apellido).includes(t))
      .sort((a, b) => sinAcentos(a.nombre).localeCompare(sinAcentos(b.nombre)));
    lista.replaceChildren(js.length
      ? h('div.elegir-jugadores', js.map((j) => h('button.elegir-jugador', { type: 'button', 'aria-pressed': elegidas.has(j.id), onclick: (e) => {
        if (elegidas.has(j.id)) elegidas.delete(j.id); else elegidas.add(j.id);
        e.currentTarget.setAttribute('aria-pressed', elegidas.has(j.id));
      } }, avatarJugador(j), `${j.nombre} ${j.apellido}`)))
      : h('p.suave', estado.jugadores.length ? 'No encontramos ese nombre.' : 'Todavía no hay ningún jugador cargado. ¡Agregá a tu hijo!'));
  }
  buscador.oninput = pintarLista;
  pintarLista();

  const guardar = h('button.btn.btn-rojo.btn-bloque', { type: 'button' }, 'Listo, entrar');
  guardar.onclick = async () => {
    const actuales = new Set(misHijos().map((j) => j.id));
    const nuevas = [...elegidas].filter((id) => !actuales.has(id));
    if (nuevas.length) {
      const listo = cargandoEn(guardar, 'Guardando…');
      const { error } = await sb.from('familia').insert(nuevas.map((jugador_id) => ({ perfil_id: yo.id, jugador_id })));
      if (error) { listo(); return aviso(mensajeError(error), 'error'); }
      await cargarJugadores();
    }
    terminar();
  };

  return [
    h('div', h('h1', `¡Bienvenid${yo.rol === 'mamá' ? 'a' : 'o'}, ${yo.nombre}!`),
      h('p.suave', { style: 'margin-top:6px' }, 'Antes de empezar, contanos quién es tu hijo. Si la mamá o el papá ya lo cargó, tocalo en la lista.')),
    h('section.tarjeta',
      h('h2', '¿Ya está en la lista?'),
      estado.jugadores.length > 8 ? buscador : null,
      lista),
    h('button.btn.btn-celeste.btn-bloque', { type: 'button', onclick: async () => {
      const nueva = await editarJugador(null, { esMia: true, alGuardar: () => {} });
      if (nueva) { elegidas.add(nueva.id); pintarLista(); }
    } }, icono('mas'), 'Mi hijo no está: agregarlo'),
    guardar,
    h('button.btn.btn-texto', { type: 'button', onclick: terminar }, 'Lo hago después'),
  ];
}

