// Herramientas de interfaz: crear elementos, íconos, avisos y ventanas.

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const ACTIVIDADES = ['Entrenamiento', 'Partido', 'Encuentro', 'Torneo', 'Tercer Tiempo', 'Salida', 'Otros'];

// h('div.clase', {atributos}, hijos...)
export function h(etiqueta, attrs, ...hijos) {
  const [tag, ...clases] = etiqueta.split('.');
  const el = document.createElement(tag || 'div');
  if (clases.length) el.className = clases.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    hijos.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'clase') el.className += ' ' + v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  agregar(el, hijos);
  return el;
}

function agregar(el, hijos) {
  for (const c of hijos.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ---------- Íconos (trazos simples, redondeados) ----------
const TRAZOS = {
  camara: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.4-2h5.8l1.4 2h1.2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.6"/>',
  galeria: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.8"/><path d="m4 17 5-5 4 4 2.5-2.5L20 18"/>',
  subir: '<path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5"/><path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  fotos: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  inicio: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
  chicos: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.7-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.3c2.4-.3 4.2 1.3 4.7 4.2"/>',
  persona: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.9-3.9 3.8-6 7.5-6s6.6 2.1 7.5 6"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  descargar: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  editar: '<path d="M4.5 19.5h4L19 9a2.8 2.8 0 0 0-4-4L4.5 15.5z"/><path d="m13.5 6.5 4 4"/>',
  borrar: '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2m-8 0 .8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  izq: '<path d="m15 5-7 7 7 7"/>',
  der: '<path d="m9 5 7 7-7 7"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  cargando: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />',
  alerta: '<path d="M12 8v5m0 3.5v.01"/><circle cx="12" cy="12" r="8.5"/>',
  escudo: '<path d="M12 3.5c1.6 1.4 4.3 2 7.5 1.8v6.2c0 4.6-3.2 7.6-7.5 9-4.3-1.4-7.5-4.4-7.5-9V5.3c3.2.2 5.9-.4 7.5-1.8z"/>',
  salir: '<path d="M14 4.5h3.5A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  corazon: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.2c0 5.6-7.5 10-7.5 10z"/>',
  recuperar: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V9h4.5"/>',
  llave: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8m-3 3 2 2m-4 0 1.5 1.5"/>',
  instalar: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7v7m0 0-3-3m3 3 3-3"/>',
};

export function icono(nombre, clase = '') {
  const span = document.createElement('span');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${clase}">${TRAZOS[nombre] || ''}</svg>`;
  return span.firstChild;
}

// ---------- Avisos ----------
export function aviso(texto, tipo = '') {
  const cont = document.getElementById('avisos');
  const a = h('div.aviso', { clase: tipo, role: tipo === 'error' ? 'alert' : 'status' }, texto);
  cont.append(a);
  setTimeout(() => a.remove(), tipo === 'error' ? 6000 : 3500);
}

// ---------- Hojas (ventanas que suben desde abajo) ----------
export function hoja(titulo, contenido, { alCerrar } = {}) {
  const anterior = document.activeElement;
  const cerrarBtn = h('button.cerrar', { type: 'button', 'aria-label': 'Cerrar' }, icono('x'));
  const caja = h('div.hoja', { role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    h('div.encabezado-hoja', h('h2', titulo), cerrarBtn),
    contenido);
  const fondo = h('div.fondo-hoja', caja);

  function cerrar() {
    if (!fondo.isConnected) return;
    fondo.remove();
    document.removeEventListener('keydown', teclas);
    if (!document.querySelector('.fondo-hoja, .visor')) document.body.style.overflow = '';
    if (anterior && anterior.focus) anterior.focus();
    if (alCerrar) alCerrar();
  }
  function teclas(e) { if (e.key === 'Escape') cerrar(); }

  cerrarBtn.addEventListener('click', cerrar);
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener('keydown', teclas);
  document.body.append(fondo);
  document.body.style.overflow = 'hidden';
  setTimeout(() => (caja.querySelector('input:not([type=file]), select') || cerrarBtn).focus({ preventScroll: true }), 50);
  return { cerrar, caja };
}

// Pregunta Sí / No con botones grandes
export function confirmar(titulo, texto, { si = 'Sí', no = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolver) => {
    let respuesta = false;
    const btnSi = h('button.btn.btn-bloque', { type: 'button', clase: peligro ? 'btn-rojo' : 'btn-azul' }, si);
    const btnNo = h('button.btn.btn-borde.btn-bloque', { type: 'button' }, no);
    const v = hoja(titulo, h('div', { style: 'display:grid;gap:12px' }, h('p', texto), btnSi, btnNo),
      { alCerrar: () => resolver(respuesta) });
    btnSi.onclick = () => { respuesta = true; v.cerrar(); };
    btnNo.onclick = () => v.cerrar();
  });
}

// Pide un texto (por ejemplo, el nombre de una división nueva)
export function pedirTexto(titulo, { etiqueta, valor = '', boton = 'Guardar', tipo = 'text', ayuda } = {}) {
  return new Promise((resolver) => {
    let resultado = null;
    const entrada = h('input.entrada', { type: tipo, value: valor, autocomplete: 'off' });
    const form = h('form', { style: 'display:grid;gap:14px' },
      h('label.campo', h('span', etiqueta || titulo), entrada),
      ayuda ? h('p.suave.chico', ayuda) : null,
      h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, boton));
    const v = hoja(titulo, form, { alCerrar: () => resolver(resultado) });
    form.onsubmit = (e) => {
      e.preventDefault();
      const t = entrada.value.trim();
      if (!t) return entrada.focus();
      resultado = t;
      v.cerrar();
    };
  });
}

// ---------- Texto ----------
export function sinAcentos(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function iniciales(nombre, apellido) {
  return (((nombre || '?')[0] || '') + ((apellido || '')[0] || '')).toUpperCase();
}

export function nombreCompleto(p) {
  return p ? [p.nombre, p.apellido].filter(Boolean).join(' ') : '';
}

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// Mensaje entendible a partir de un error técnico
export function mensajeError(e, porDefecto = 'Algo salió mal. Probá de nuevo.') {
  const m = (e && (e.message || e.error_description || e.error)) || '';
  if (/failed to fetch|network|load failed|tardó demasiado/i.test(m)) return 'No hay conexión a internet. Revisá la señal y probá de nuevo.';
  if (/invalid login credentials/i.test(m)) return 'El email o la contraseña no son correctos.';
  if (/duplicate key|already exists|unique/i.test(m)) return 'Eso ya existe.';
  if (/foreign key/i.test(m)) return 'No se puede borrar porque tiene fotos asociadas.';
  if (/jwt|token|session/i.test(m)) return 'Tu sesión venció. Volvé a entrar.';
  if (m && m.length < 140 && !/[{}]/.test(m)) return m;
  return porDefecto;
}

export function cargandoEn(boton, texto = 'Un momento…') {
  const original = [...boton.childNodes];
  boton.disabled = true;
  boton.replaceChildren(icono('cargando', 'girando'), texto);
  return () => { boton.disabled = false; boton.replaceChildren(...original); };
}
