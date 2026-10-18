// "Administración": código del equipo, familias, papelera y divisiones. Solo para admins.
import { sb, estado, api, cargarPerfiles, cargarDivisiones, cargarPapelera, cargarFotos, imagenMiniatura } from './datos.js';
import { h, icono, aviso, hoja, confirmar, pedirTexto, mensajeError, cargandoEn, iniciales, nombreCompleto, plural, MESES } from './ui.js';
import { irA } from './app.js';

export async function pantallaAdmin() {
  if (!estado.yo.es_admin) {
    return h('div.vacio', icono('escudo'), h('h2', 'Solo para administradores'),
      h('a.btn.btn-azul', { href: '#/inicio' }, 'Volver al inicio'));
  }
  await cargarPerfiles();
  const [{ data: conf }, papelera] = await Promise.all([
    sb.from('configuracion').select('codigo_equipo').eq('id', 1).maybeSingle(),
    cargarPapelera(),
  ]);

  return [
    h('div', h('h1', 'Administración'), h('p.suave', 'Estas opciones solo las ven los administradores.')),
    seccionCodigo(conf ? conf.codigo_equipo : '—'),
    seccionFamilias(),
    seccionPapelera(papelera),
    seccionDivisiones(),
  ];
}

const recargar = () => irA('admin');

// ---------- Código del equipo ----------
function seccionCodigo(codigo) {
  const mensaje = `Hola familias 👋 Ya está la app con las fotos de los chicos 🏉\n\n1. Entrá a ${location.origin}\n2. Tocá "Crear cuenta"\n3. Código del equipo: ${codigo}\n\nDespués podés instalarla en el celular desde "Mi perfil".`;
  return h('section.tarjeta',
    h('h2', 'Código del equipo'),
    h('p.suave', 'Es lo que piden para crear una cuenta. Si se lo pasaron a alguien que no corresponde, cambialo: los que ya entraron no se ven afectados.'),
    h('p', { style: 'font-family:var(--letra-titulo);font-size:1.8rem;font-weight:700;letter-spacing:.12em;color:var(--rojo);text-align:center' }, codigo),
    h('div.fila-botones',
      h('button.btn.btn-celeste', { type: 'button', onclick: async () => {
        try {
          await navigator.clipboard.writeText(mensaje);
          aviso('Mensaje copiado. Pegalo en el grupo de WhatsApp.', 'bien');
        } catch {
          hoja('Mensaje para WhatsApp', h('textarea.entrada', { rows: 8, readonly: true }, mensaje));
        }
      } }, 'Copiar mensaje para WhatsApp'),
      h('button.btn.btn-borde', { type: 'button', onclick: async () => {
        const nuevo = await pedirTexto('Cambiar código', { etiqueta: 'Código nuevo', valor: '', boton: 'Guardar código', ayuda: 'Usá algo difícil de adivinar, por ejemplo PANTERAS-M8-58. Mínimo 4 letras o números.' });
        if (!nuevo) return;
        const { error } = await sb.rpc('admin_cambiar_codigo', { nuevo });
        if (error) return aviso(mensajeError(error), 'error');
        aviso('Código cambiado.', 'bien');
        recargar();
      } }, 'Cambiar código')));
}

// ---------- Familias ----------
function seccionFamilias() {
  const hijosDe = (id) => estado.jugadores.filter((j) => j.padres.includes(id)).map((j) => j.nombre);
  const perfiles = estado.perfiles.slice().sort((a, b) => (b.es_admin - a.es_admin) || nombreCompleto(a).localeCompare(nombreCompleto(b)));
  return h('section.tarjeta',
    h('h2', `Mamás y papás (${perfiles.length})`),
    h('div.lista', perfiles.map((p) => {
      const hijos = hijosDe(p.id);
      return h('button.fila', { type: 'button', style: 'text-align:left', onclick: () => accionesPerfil(p) },
        h('span.avatar', iniciales(p.nombre, p.apellido)),
        h('span.datos',
          h('b', nombreCompleto(p),
            p.es_admin ? h('span.etiqueta.admin', 'Admin') : null,
            p.bloqueado ? h('span.etiqueta.bloq', 'Pausado') : null),
          h('small', `${p.rol === 'mamá' ? 'Mamá' : 'Papá'}${hijos.length ? ' de ' + hijos.join(' y ') : ''}`),
          h('small', p.email)),
        icono('der'));
    })));
}

function accionesPerfil(p) {
  const soyYo = p.id === estado.yo.id;
  const botones = [];

  botones.push(h('button.btn.btn-celeste.btn-bloque', { type: 'button', onclick: async () => {
    const clave = await pedirTexto('Contraseña nueva', {
      etiqueta: `Contraseña nueva para ${p.nombre}`, boton: 'Poner contraseña',
      ayuda: 'Mínimo 6 letras o números. Después pasásela por WhatsApp para que pueda entrar.',
    });
    if (!clave) return;
    try {
      await api('/api/admin', { cuerpo: { accion: 'clave', perfilId: p.id, clave } });
      aviso(`Listo. ${p.nombre} ya puede entrar con la contraseña nueva.`, 'bien');
    } catch (e) { aviso(mensajeError(e), 'error'); }
  } }, icono('llave'), 'Ponerle una contraseña nueva'));

  if (!soyYo) {
    botones.push(h('button.btn.btn-bloque', { type: 'button', clase: p.es_admin ? 'btn-borde' : 'btn-azul', onclick: async () => {
      const ok = await confirmar(p.es_admin ? '¿Quitar administrador?' : '¿Hacer administrador?',
        p.es_admin ? `${p.nombre} va a dejar de ver la sección Administración.`
          : `${p.nombre} va a poder cambiar el código, pausar cuentas, vaciar la papelera y ordenar las divisiones.`);
      if (!ok) return;
      const { error } = await sb.rpc('admin_hacer_admin', { perfil: p.id, admin: !p.es_admin });
      if (error) return aviso(mensajeError(error), 'error');
      v.cerrar();
      recargar();
    } }, icono('escudo'), p.es_admin ? 'Quitarle administrador' : 'Hacerlo administrador'));

    botones.push(h('button.btn.btn-peligro.btn-bloque', { type: 'button', onclick: async () => {
      const ok = await confirmar(p.bloqueado ? '¿Reactivar cuenta?' : '¿Pausar cuenta?',
        p.bloqueado ? `${p.nombre} va a poder volver a entrar y ver las fotos.`
          : `${p.nombre} no va a poder ver ni subir fotos hasta que la reactives.`,
        { si: p.bloqueado ? 'Sí, reactivar' : 'Sí, pausar', peligro: !p.bloqueado });
      if (!ok) return;
      const { error } = await sb.rpc('admin_bloquear', { perfil: p.id, bloquear: !p.bloqueado });
      if (error) return aviso(mensajeError(error), 'error');
      v.cerrar();
      recargar();
    } }, p.bloqueado ? 'Reactivar cuenta' : 'Pausar cuenta'));
  }

  const v = hoja(nombreCompleto(p), h('div', { style: 'display:grid;gap:10px' },
    h('p.suave', p.email), ...botones));
}

// ---------- Papelera ----------
function seccionPapelera(fotos) {
  if (!fotos.length) {
    return h('section.tarjeta', h('h2', 'Papelera'), h('p.suave', 'No hay fotos borradas.'));
  }
  const vaciar = h('button.btn.btn-peligro.btn-bloque', { type: 'button' }, icono('borrar'), 'Vaciar papelera');
  vaciar.onclick = async () => {
    const ok = await confirmar('¿Vaciar la papelera?',
      `Se borran para siempre ${plural(fotos.length, 'foto', 'fotos')}. Esto no se puede deshacer.`,
      { si: 'Sí, borrar para siempre', peligro: true });
    if (!ok) return;
    const listo = cargandoEn(vaciar, 'Borrando…');
    try {
      for (let i = 0; i < fotos.length; i += 50) {
        await api('/api/admin', { cuerpo: { accion: 'borrar', fotoIds: fotos.slice(i, i + 50).map((f) => f.id) } });
      }
      aviso('Papelera vacía.', 'bien');
      recargar();
    } catch (e) {
      listo();
      aviso(mensajeError(e), 'error');
    }
  };

  return h('section.tarjeta',
    h('h2', `Papelera (${fotos.length})`),
    h('p.suave', 'Fotos que alguien borró. Tocá una para recuperarla.'),
    h('div.grilla-fotos', fotos.map((f) => h('button.miniatura', { type: 'button', onclick: () => accionesPapelera(f) },
      imagenMiniatura(f.miniatura_path, '')))),
    vaciar);
}

function accionesPapelera(f) {
  const quien = estado.perfilPorId.get(f.enviada_por);
  const div = estado.divisionPorId.get(f.division_id);
  const recuperar = h('button.btn.btn-azul.btn-bloque', { type: 'button' }, icono('recuperar'), 'Recuperar foto');
  const borrar = h('button.btn.btn-peligro.btn-bloque', { type: 'button' }, icono('borrar'), 'Borrar para siempre');

  const v = hoja('Foto en la papelera', h('div', { style: 'display:grid;gap:12px' },
    h('div.miniatura', { style: 'max-width:220px;margin:0 auto;width:100%' }, imagenMiniatura(f.miniatura_path, '')),
    h('p.suave', [`${MESES[f.mes - 1]} ${f.anio}`, div && div.nombre, f.titulo].filter(Boolean).join(', ')
      + (quien ? `. La borró ${nombreCompleto(quien)}.` : '.')),
    recuperar, borrar));

  recuperar.onclick = async () => {
    const { error } = await sb.from('fotos').update({ en_papelera_desde: null, enviada_por: null }).eq('id', f.id);
    if (error) return aviso(mensajeError(error), 'error');
    await cargarFotos();
    v.cerrar();
    aviso('La foto volvió a la galería.', 'bien');
    recargar();
  };
  borrar.onclick = async () => {
    const ok = await confirmar('¿Borrar para siempre?', 'Esta foto se borra definitivamente. No se puede deshacer.', { si: 'Sí, borrar', peligro: true });
    if (!ok) return;
    try {
      await api('/api/admin', { cuerpo: { accion: 'borrar', fotoIds: [f.id] } });
      v.cerrar();
      aviso('Foto borrada para siempre.');
      recargar();
    } catch (e) { aviso(mensajeError(e), 'error'); }
  };
}

// ---------- Divisiones ----------
function seccionDivisiones() {
  return h('section.tarjeta',
    h('h2', 'Divisiones'),
    h('p.suave', 'Cualquiera puede sumar divisiones al subir fotos. Acá podés corregir nombres o borrar las que no tengan fotos.'),
    h('div.lista', estado.divisiones.map((d) => {
      const cant = estado.fotos.filter((f) => f.division_id === d.id).length;
      return h('div.fila',
        h('span.datos', h('b', d.nombre), h('small', plural(cant, 'foto', 'fotos'))),
        h('button.btn.btn-celeste.btn-chico', { type: 'button', 'aria-label': 'Cambiar nombre de ' + d.nombre, onclick: async () => {
          const nombre = await pedirTexto('Cambiar nombre', { etiqueta: 'Nombre de la división', valor: d.nombre });
          if (!nombre || nombre === d.nombre) return;
          const { error } = await sb.from('divisiones').update({ nombre }).eq('id', d.id);
          if (error) return aviso(mensajeError(error), 'error');
          await cargarDivisiones();
          await cargarFotos();
          recargar();
        } }, icono('editar')),
        cant ? null : h('button.btn.btn-peligro.btn-chico', { type: 'button', 'aria-label': 'Borrar ' + d.nombre, onclick: async () => {
          if (!(await confirmar('¿Borrar división?', `Se borra "${d.nombre}".`, { si: 'Sí, borrar', peligro: true }))) return;
          const { error } = await sb.from('divisiones').delete().eq('id', d.id);
          if (error) return aviso(mensajeError(error), 'error');
          await cargarDivisiones();
          recargar();
        } }, icono('borrar')));
    })));
}
