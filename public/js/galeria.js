// "Ver fotos": buscador, filtros, fotos agrupadas por mes y visor a pantalla completa.
import { sb, estado, api, fotoCompleta, imagenMiniatura, urlsMiniaturas, textoDeFoto, cargarDivisiones } from './datos.js';
import { h, icono, aviso, hoja, confirmar, pedirTexto, mensajeError, cargandoEn, MESES, MESES_CORTOS, ACTIVIDADES, nombreCompleto, plural, sinAcentos } from './ui.js';
import { avatarJugador } from './jugadores.js';
import { fotosAlDia, parametrosRuta } from './app.js';

const filtros = { anio: '', division: '', actividad: '', jugador: '', texto: '' };
let repintarGaleria = null;

export async function pantallaFotos() {
  await fotosAlDia();

  // Si se llegó con filtros en el link (por ejemplo desde "Los chicos"), se usan esos
  const p = parametrosRuta();
  if ([...p.keys()].length) {
    Object.assign(filtros, { anio: '', division: '', actividad: '', jugador: '', texto: '' });
    for (const k of Object.keys(filtros)) if (p.get(k)) filtros[k] = p.get(k);
    history.replaceState(null, '', '#/fotos');
  }

  const resultados = h('div');
  const resumen = h('div.resumen-filtros');
  const filaFiltros = h('div.filtros');
  const buscador = h('input.entrada', {
    type: 'search', value: filtros.texto, placeholder: 'Buscar: nombre, partido, torneo…', 'aria-label': 'Buscar fotos', enterkeyhint: 'search',
  });
  let espera = null;
  buscador.oninput = () => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtros.texto = buscador.value; pintar(); }, 220);
  };

  function pintar() {
    filaFiltros.replaceChildren(...armarFiltros(pintar));
    const lista = filtrar();
    const hayFiltros = Object.values(filtros).some(Boolean);
    resumen.replaceChildren(...[
      h('span', plural(lista.length, 'foto', 'fotos')),
      hayFiltros ? h('button.btn.btn-texto.btn-chico', { type: 'button', onclick: () => {
        Object.assign(filtros, { anio: '', division: '', actividad: '', jugador: '', texto: '' });
        buscador.value = '';
        pintar();
      } }, 'Borrar filtros') : null].filter(Boolean));
    mostrarResultados(resultados, lista, hayFiltros);
  }
  repintarGaleria = pintar;
  pintar();

  return [
    h('div.encabezado-pantalla',
      h('div', h('h1', 'Fotos'), h('p.suave', 'Tocá una foto para verla grande y descargarla.')),
      h('a.btn.btn-rojo.btn-chico', { href: '#/subir' }, icono('subir'), 'Subir')),
    h('div.buscador', icono('buscar'), buscador),
    filaFiltros,
    resumen,
    resultados,
  ];
}

function selectFiltro(clave, etiquetaTodos, opciones, pintar) {
  const sel = h('select', { 'aria-label': etiquetaTodos },
    h('option', { value: '' }, etiquetaTodos),
    opciones.map(([valor, texto]) => h('option', { value: valor, selected: String(filtros[clave]) === String(valor) }, texto)));
  sel.onchange = () => { filtros[clave] = sel.value; pintar(); };
  return h('label.filtro', { clase: filtros[clave] ? 'activo' : '' }, sel);
}

function armarFiltros(pintar) {
  const anios = [...new Set(estado.fotos.map((f) => f.anio))].sort((a, b) => b - a);
  const misHijos = new Set(estado.jugadores.filter((j) => j.padres.includes(estado.yo.id)).map((j) => j.id));
  const jugadores = estado.jugadores.slice().sort((a, b) =>
    (misHijos.has(b.id) - misHijos.has(a.id)) || sinAcentos(a.nombre).localeCompare(sinAcentos(b.nombre)));
  return [
    selectFiltro('anio', 'Todos los años', anios.map((a) => [a, String(a)]), pintar),
    selectFiltro('division', 'Todas las divisiones', estado.divisiones.map((d) => [d.id, d.nombre]), pintar),
    selectFiltro('jugador', 'Todos los chicos', jugadores.map((j) => [j.id, `${j.nombre} ${j.apellido}`]), pintar),
    selectFiltro('actividad', 'Toda actividad', ACTIVIDADES.map((a) => [a, a]), pintar),
  ];
}

function filtrar() {
  const palabras = sinAcentos(filtros.texto).split(/\s+/).filter(Boolean);
  return estado.fotos.filter((f) =>
    (!filtros.anio || f.anio === +filtros.anio) &&
    (!filtros.division || f.division_id === +filtros.division) &&
    (!filtros.actividad || f.tipo_actividad === filtros.actividad) &&
    (!filtros.jugador || f.jugadores.includes(+filtros.jugador)) &&
    palabras.every((p) => f.textoBusqueda.includes(p)));
}

// Dibuja las fotos de a tandas, agrupadas por mes y año
function mostrarResultados(cont, lista, hayFiltros) {
  cont.replaceChildren();
  if (!lista.length) {
    cont.append(h('div.vacio', icono('galeria'),
      h('h2', hayFiltros ? 'No hay fotos con esos filtros' : 'Todavía no hay fotos'),
      h('p.suave', hayFiltros ? 'Probá sacando algún filtro o buscando otra palabra.' : 'Subí las primeras fotos del equipo.'),
      hayFiltros ? null : h('a.btn.btn-rojo', { href: '#/subir' }, icono('subir'), 'Subir fotos')));
    return;
  }

  const cantidadPorMes = new Map();
  for (const f of lista) {
    const k = f.anio * 100 + f.mes;
    cantidadPorMes.set(k, (cantidadPorMes.get(k) || 0) + 1);
  }

  let pos = 0;
  let grupoActual = null;
  let grillaActual = null;
  const centinela = h('div', { style: 'height:1px' });

  function tanda() {
    const fin = Math.min(pos + 90, lista.length);
    for (; pos < fin; pos++) {
      const f = lista[pos];
      const k = f.anio * 100 + f.mes;
      if (k !== grupoActual) {
        grupoActual = k;
        grillaActual = h('div.grilla-fotos');
        cont.append(h('section.grupo-mes',
          h('header', h('h2', `${MESES[f.mes - 1]} ${f.anio}`), h('span', plural(cantidadPorMes.get(k), 'foto', 'fotos'))),
          grillaActual));
      }
      const i = pos;
      grillaActual.append(h('button.miniatura', { type: 'button', 'aria-label': descripcionCorta(f), onclick: () => abrirVisor(lista, i) },
        imagenMiniatura(f.miniatura_path, '')));
    }
    if (pos < lista.length) cont.append(centinela);
    else centinela.remove();
  }

  tanda();
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      if (!cont.isConnected) return obs.disconnect();
      tanda();
      if (pos >= lista.length) obs.disconnect();
    }, { rootMargin: '600px 0px' });
    obs.observe(centinela);
  } else {
    while (pos < lista.length) tanda();
  }
}

function descripcionCorta(f) {
  const div = estado.divisionPorId.get(f.division_id);
  return [f.titulo || f.tipo_actividad || 'Foto', div && div.nombre, `${MESES[f.mes - 1]} ${f.anio}`].filter(Boolean).join(', ');
}

// =====================================================================
//  VISOR A PANTALLA COMPLETA
// =====================================================================
export function abrirVisor(lista, indiceInicial) {
  let i = indiceInicial;
  let pedido = 0;
  const anterior = document.activeElement;

  const img = h('img', { alt: '' });
  const cargando = h('div.cargando', icono('cargando', 'girando'));
  const contador = h('span.contador');
  const info = h('div.info');
  const etiquetas = h('div.etiquetas');
  const btnCerrar = h('button.cerrar', { type: 'button', 'aria-label': 'Cerrar' }, icono('x'));
  const btnIzq = h('button.flecha.izq', { type: 'button', 'aria-label': 'Foto anterior' }, icono('izq'));
  const btnDer = h('button.flecha.der', { type: 'button', 'aria-label': 'Foto siguiente' }, icono('der'));
  const btnDescargar = h('button.btn.btn-rojo', { type: 'button' }, icono('descargar'), 'Descargar');
  const btnEditar = h('button.btn.btn-transparente', { type: 'button' }, icono('editar'), 'Editar');
  const btnBorrar = h('button.btn.btn-transparente', { type: 'button' }, icono('borrar'), 'Borrar');
  const escenario = h('div.escenario', img, cargando, btnIzq, btnDer);

  const visor = h('div.visor', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Foto' },
    h('div.arriba', contador, btnCerrar),
    escenario,
    h('div.abajo', info, etiquetas, h('div.acciones', btnDescargar, btnEditar, btnBorrar)));

  document.body.append(visor);
  document.body.style.overflow = 'hidden';
  btnCerrar.focus();

  async function mostrar() {
    const f = lista[i];
    if (!f) return cerrar();
    const miPedido = ++pedido;
    contador.textContent = `${i + 1} de ${lista.length}`;
    btnIzq.hidden = i === 0;
    btnDer.hidden = i === lista.length - 1;
    pintarInfo(f);

    // Primero la miniatura (al instante), después la foto grande
    cargando.hidden = false;
    img.style.opacity = '.6';
    urlsMiniaturas([f.miniatura_path]).then((u) => { if (miPedido === pedido && u[f.miniatura_path] && !img.dataset.grande) img.src = u[f.miniatura_path]; }).catch(() => {});
    delete img.dataset.grande;
    try {
      const blob = await fotoCompleta(f.drive_file_id);
      if (miPedido !== pedido) return;
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      const url = URL.createObjectURL(blob);
      img.dataset.url = url;
      img.dataset.grande = '1';
      img.src = url;
      img.style.opacity = '1';
    } catch (e) {
      if (miPedido === pedido) aviso(mensajeError(e, 'No se pudo abrir la foto grande.'), 'error');
    } finally {
      if (miPedido === pedido) cargando.hidden = true;
    }
    // Deja lista la siguiente
    const sig = lista[i + 1];
    if (sig) fotoCompleta(sig.drive_file_id).catch(() => {});
  }

  function pintarInfo(f) {
    const div = estado.divisionPorId.get(f.division_id);
    const autor = estado.perfilPorId.get(f.subido_por);
    info.replaceChildren(
      h('b', f.titulo || f.tipo_actividad || (div ? div.nombre : 'Foto')),
      h('p', [`${MESES[f.mes - 1]} ${f.anio}`, div && div.nombre, f.titulo && f.tipo_actividad].filter(Boolean).join(', ')
        + (autor ? `. Subida por ${nombreCompleto(autor)}.` : '')));
    etiquetas.replaceChildren(...f.jugadores.map((id) => estado.jugadorPorId.get(id)).filter(Boolean)
      .map((j) => h('span', `${j.nombre} ${j.apellido}`)));
  }

  function ir(paso) {
    const n = i + paso;
    if (n < 0 || n >= lista.length) return;
    i = n;
    mostrar();
  }

  function cerrar() {
    pedido++;
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    visor.remove();
    document.removeEventListener('keydown', teclas);
    if (!document.querySelector('.fondo-hoja')) document.body.style.overflow = '';
    if (anterior && anterior.focus) anterior.focus();
  }

  function teclas(e) {
    if (document.querySelector('.fondo-hoja')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') ir(-1);
    if (e.key === 'ArrowRight') ir(1);
  }

  // Deslizar con el dedo
  let x0 = null, y0 = null;
  escenario.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  escenario.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) ir(dx < 0 ? 1 : -1);
  });

  btnCerrar.onclick = cerrar;
  btnIzq.onclick = () => ir(-1);
  btnDer.onclick = () => ir(1);
  document.addEventListener('keydown', teclas);

  btnDescargar.onclick = async () => {
    const f = lista[i];
    const listo = cargandoEn(btnDescargar, 'Bajando…');
    try {
      await descargar(f);
    } catch (e) {
      if (e && e.name !== 'AbortError') aviso(mensajeError(e, 'No se pudo descargar.'), 'error');
    } finally { listo(); }
  };

  btnEditar.onclick = () => editarFoto(lista[i], () => {
    pintarInfo(lista[i]);
    if (repintarGaleria && document.querySelector('.grilla-fotos')) repintarGaleria();
  });

  btnBorrar.onclick = async () => {
    const f = lista[i];
    const ok = await confirmar('¿Borrar esta foto?',
      'La foto va a la papelera y deja de verse. Si fue un error, un administrador la puede recuperar.',
      { si: 'Sí, borrar', peligro: true });
    if (!ok) return;
    const { error } = await sb.from('fotos')
      .update({ en_papelera_desde: new Date().toISOString(), enviada_por: estado.yo.id }).eq('id', f.id);
    if (error) return aviso(mensajeError(error), 'error');
    estado.fotos = estado.fotos.filter((x) => x.id !== f.id);
    lista.splice(i, 1);
    aviso('La foto se mandó a la papelera.');
    if (repintarGaleria && document.querySelector('.grilla-fotos, .vacio')) repintarGaleria();
    if (!lista.length) return cerrar();
    if (i >= lista.length) i = lista.length - 1;
    mostrar();
  };

  mostrar();
}

// En el celular abre "Compartir / Guardar imagen"; en la compu la baja como archivo.
async function descargar(f) {
  const blob = await fotoCompleta(f.drive_file_id);
  const div = estado.divisionPorId.get(f.division_id);
  const nombre = sinAcentos(['Rugby Tordos', div && div.nombre, MESES[f.mes - 1], f.anio, f.id].filter(Boolean).join(' '))
    .replace(/[^a-z0-9]+/g, '-') + '.jpg';
  const archivo = new File([blob], nombre, { type: blob.type || 'image/jpeg' });

  const esCelular = matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (esCelular && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    await navigator.share({ files: [archivo] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  aviso('La foto se descargó.', 'bien');
}

// =====================================================================
//  EDITAR LOS DATOS DE UNA FOTO
// =====================================================================
function editarFoto(f, alGuardar) {
  const v = { mes: f.mes, anio: f.anio, division: f.division_id, actividad: f.tipo_actividad, titulo: f.titulo || '', jugadores: new Set(f.jugadores) };
  const cuerpo = h('div', { style: 'display:grid;gap:18px' });
  const anioActual = new Date().getFullYear();

  const chip = (texto, activo, alTocar, extra = {}) =>
    h('button.chip', { type: 'button', 'aria-pressed': !!activo, onclick: alTocar, ...extra }, texto);

  function pintar() {
    const anios = [];
    for (let a = anioActual; a >= Math.min(2019, v.anio); a--) anios.push(a);
    const titulo = h('input.entrada', { type: 'text', maxlength: 80, value: v.titulo, oninput: (e) => { v.titulo = e.target.value; } });
    const guardar = h('button.btn.btn-rojo.btn-bloque', { type: 'button' }, 'Guardar cambios');
    guardar.onclick = () => guardarCambios(guardar);

    cuerpo.replaceChildren(
      h('div', h('h3', 'Mes'), h('div.chips.meses', { style: 'margin-top:8px' },
        MESES_CORTOS.map((m, k) => chip(m, v.mes === k + 1, () => { v.mes = k + 1; pintar(); }, { 'aria-label': MESES[k] })))),
      h('div', h('h3', 'Año'), h('div.chips', { style: 'margin-top:8px' },
        anios.map((a) => chip(String(a), v.anio === a, () => { v.anio = a; pintar(); })))),
      h('div', h('h3', 'División'), h('div.chips.rojo', { style: 'margin-top:8px' },
        estado.divisiones.map((d) => chip(d.nombre, v.division === d.id, () => { v.division = d.id; pintar(); })),
        chip([icono('mas'), 'Nueva división'], false, async () => {
          const nombre = await pedirTexto('Nueva división', { etiqueta: 'Nombre de la división', boton: 'Agregar división' });
          if (!nombre) return;
          const { data, error } = await sb.from('divisiones').insert({ nombre, orden: 100 }).select().single();
          if (error) return aviso(mensajeError(error), 'error');
          await cargarDivisiones();
          v.division = data.id;
          pintar();
        }, { clase: 'agregar' }))),
      h('div', h('h3', 'Tipo de actividad'), h('div.chips', { style: 'margin-top:8px' },
        ACTIVIDADES.map((a) => chip(a, v.actividad === a, () => { v.actividad = v.actividad === a ? null : a; pintar(); })))),
      h('div', h('h3', '¿Quiénes están?'), h('div.elegir-jugadores', { style: 'margin-top:8px' },
        estado.jugadores.map((j) => h('button.elegir-jugador', { type: 'button', 'aria-pressed': v.jugadores.has(j.id), onclick: (e) => {
          if (v.jugadores.has(j.id)) v.jugadores.delete(j.id); else v.jugadores.add(j.id);
          e.currentTarget.setAttribute('aria-pressed', v.jugadores.has(j.id));
        } }, avatarJugador(j), `${j.nombre} ${j.apellido}`)))),
      h('label.campo', h('span', 'Título'), titulo),
      guardar);
  }

  async function guardarCambios(boton) {
    const listo = cargandoEn(boton, 'Guardando…');
    try {
      const { error } = await sb.from('fotos').update({
        mes: v.mes, anio: v.anio, division_id: v.division, tipo_actividad: v.actividad, titulo: v.titulo.trim() || null,
      }).eq('id', f.id);
      if (error) throw error;

      const antes = new Set(f.jugadores);
      const quitar = [...antes].filter((id) => !v.jugadores.has(id));
      const sumar = [...v.jugadores].filter((id) => !antes.has(id));
      if (quitar.length) {
        const r = await sb.from('foto_jugadores').delete().eq('foto_id', f.id).in('jugador_id', quitar);
        if (r.error) throw r.error;
      }
      if (sumar.length) {
        const r = await sb.from('foto_jugadores').insert(sumar.map((jugador_id) => ({ foto_id: f.id, jugador_id })));
        if (r.error) throw r.error;
      }

      const cambioFecha = v.mes !== f.mes || v.anio !== f.anio;
      Object.assign(f, {
        mes: v.mes, anio: v.anio, division_id: v.division, tipo_actividad: v.actividad,
        titulo: v.titulo.trim() || null, jugadores: [...v.jugadores],
      });
      f.textoBusqueda = textoDeFoto(f);
      estado.fotos.sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes) || b.creado_en.localeCompare(a.creado_en));

      if (cambioFecha) api('/api/mover', { cuerpo: { driveId: f.drive_file_id, anio: v.anio, mes: v.mes } }).catch(console.error);
      vista.cerrar();
      aviso('Cambios guardados.', 'bien');
      alGuardar();
    } catch (e) {
      listo();
      aviso(mensajeError(e, 'No se pudieron guardar los cambios.'), 'error');
    }
  }

  pintar();
  const vista = hoja('Editar datos de la foto', cuerpo);
}
