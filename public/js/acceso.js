// Pantalla de entrada: "Entrar" y "Crear cuenta" (con el código del equipo).
import { sb, api } from './datos.js';
import { h, aviso, mensajeError, cargandoEn, pedirTexto, hoja } from './ui.js';

export function pantallaAcceso() {
  const cuerpo = h('div.tarjeta');
  const tabEntrar = h('button', { type: 'button', role: 'tab' }, 'Entrar');
  const tabCrear = h('button', { type: 'button', role: 'tab' }, 'Crear cuenta');

  function mostrar(cual) {
    tabEntrar.setAttribute('aria-selected', cual === 'entrar');
    tabCrear.setAttribute('aria-selected', cual === 'crear');
    cuerpo.replaceChildren(h('div.pestanias', { role: 'tablist' }, tabEntrar, tabCrear),
      cual === 'entrar' ? formEntrar() : formCrear());
  }
  tabEntrar.onclick = () => mostrar('entrar');
  tabCrear.onclick = () => mostrar('crear');

  let yaEntro = false;
  try { yaEntro = localStorage.getItem('rugby-ya-entro'); } catch { /* */ }
  mostrar(yaEntro ? 'entrar' : 'crear');

  return h('div.acceso',
    h('div.portada',
      h('img', { src: '/icons/escudo.svg', alt: 'Escudo de Los Tordos' }),
      h('h1', 'Las fotos del equipo'),
      h('p', 'Los Tordos · Rugby infantil')),
    h('div.cuerpo', cuerpo));
}

function campoClave(autocomplete) {
  const entrada = h('input.entrada', { type: 'password', autocomplete, required: true, minlength: 6 });
  const ver = h('button', { type: 'button' }, 'Ver');
  ver.onclick = () => {
    const oculta = entrada.type === 'password';
    entrada.type = oculta ? 'text' : 'password';
    ver.textContent = oculta ? 'Ocultar' : 'Ver';
  };
  return { entrada, nodo: h('div.con-boton', entrada, ver) };
}

function formEntrar() {
  const email = h('input.entrada', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true });
  const clave = campoClave('current-password');
  const error = h('p.error-form', { hidden: true });
  const boton = h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, 'Entrar');

  const form = h('form', { style: 'display:grid;gap:16px;margin-top:20px' },
    h('label.campo', h('span', 'Tu email'), email),
    h('label.campo', h('span', 'Tu contraseña'), clave.nodo),
    error, boton,
    h('button.btn.btn-texto', { type: 'button', onclick: () => olvideClave(email.value) }, '¿Te olvidaste la contraseña?'));

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.hidden = true;
    const listo = cargandoEn(boton, 'Entrando…');
    const { error: err } = await sb.auth.signInWithPassword({ email: email.value.trim().toLowerCase(), password: clave.entrada.value });
    if (err) {
      listo();
      error.textContent = mensajeError(err);
      error.hidden = false;
      return;
    }
    try { localStorage.setItem('rugby-ya-entro', '1'); } catch { /* */ }
  };
  return form;
}

function formCrear() {
  const cont = h('div', { style: 'margin-top:20px' });
  const datos = { codigo: '', nombre: '', apellido: '', rol: '', email: '', password: '' };

  // Paso 1: el código del equipo
  function paso1(mensaje) {
    const codigo = h('input.entrada.codigo', { type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: datos.codigo, required: true });
    const error = h('p.error-form', { hidden: !mensaje }, mensaje || '');
    const form = h('form', { style: 'display:grid;gap:16px' },
      h('p', 'Para crear tu cuenta necesitás el código del equipo. Está en el grupo de WhatsApp de las familias.'),
      h('label.campo', h('span', 'Código del equipo'), codigo),
      error,
      h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, 'Seguir'));
    form.onsubmit = (e) => {
      e.preventDefault();
      datos.codigo = codigo.value.trim();
      if (datos.codigo) paso2();
    };
    cont.replaceChildren(form);
    setTimeout(() => codigo.focus(), 50);
  }

  // Paso 2: quién sos
  function paso2() {
    const nombre = h('input.entrada', { type: 'text', autocomplete: 'given-name', autocapitalize: 'words', value: datos.nombre, required: true });
    const apellido = h('input.entrada', { type: 'text', autocomplete: 'family-name', autocapitalize: 'words', value: datos.apellido, required: true });
    const botonesRol = ['mamá', 'papá'].map((r) => {
      const b = h('button', { type: 'button', 'aria-pressed': datos.rol === r }, r === 'mamá' ? 'Soy la mamá' : 'Soy el papá');
      b.onclick = () => {
        datos.rol = r;
        botonesRol.forEach((x) => x.setAttribute('aria-pressed', x === b));
      };
      return b;
    });
    const email = h('input.entrada', { type: 'email', autocomplete: 'email', inputmode: 'email', value: datos.email, required: true });
    const clave = campoClave('new-password');
    const error = h('p.error-form', { hidden: true });
    const boton = h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, 'Crear mi cuenta');

    const form = h('form', { style: 'display:grid;gap:16px' },
      h('label.campo', h('span', 'Tu nombre'), nombre),
      h('label.campo', h('span', 'Tu apellido'), apellido),
      h('div.campo', h('span', '¿Sos la mamá o el papá?'), h('div.eleccion-rol', botonesRol)),
      h('label.campo', h('span', 'Tu email'), email),
      h('label.campo', h('span', 'Elegí una contraseña ', h('em', '(mínimo 6 letras o números)')), clave.nodo),
      error, boton,
      h('button.btn.btn-texto', { type: 'button', onclick: () => paso1() }, 'Volver'));

    form.onsubmit = async (e) => {
      e.preventDefault();
      Object.assign(datos, {
        nombre: nombre.value.trim(), apellido: apellido.value.trim(),
        email: email.value.trim().toLowerCase(), password: clave.entrada.value,
      });
      const falta = !datos.rol ? 'Tocá "Soy la mamá" o "Soy el papá".'
        : datos.password.length < 6 ? 'La contraseña tiene que tener al menos 6 letras o números.' : '';
      if (falta) { error.textContent = falta; error.hidden = false; return; }

      error.hidden = true;
      const listo = cargandoEn(boton, 'Creando tu cuenta…');
      try {
        await api('/api/registro', { cuerpo: datos, sinSesion: true });
      } catch (err) {
        listo();
        if (/código/i.test(err.message)) return paso1(err.message);
        error.textContent = mensajeError(err);
        error.hidden = false;
        return;
      }
      try { localStorage.setItem('rugby-ya-entro', '1'); } catch { /* */ }
      const { error: errEntrar } = await sb.auth.signInWithPassword({ email: datos.email, password: datos.password });
      if (errEntrar) {
        listo();
        aviso('Tu cuenta quedó creada. Ahora tocá "Entrar".', 'bien');
      }
    };
    cont.replaceChildren(form);
    setTimeout(() => nombre.focus(), 50);
  }

  paso1();
  return cont;
}

async function olvideClave(emailEscrito) {
  const email = await pedirTexto('Recuperar contraseña', {
    etiqueta: 'Tu email', valor: emailEscrito || '', tipo: 'email', boton: 'Mandarme el mail',
    ayuda: 'Te mandamos un mail con un botón para elegir una contraseña nueva.',
  });
  if (!email) return;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + '/' });
  if (error) return aviso(mensajeError(error), 'error');
  hoja('Revisá tu mail', h('div', { style: 'display:grid;gap:12px' },
    h('p', `Si ${email} tiene una cuenta, en unos minutos te llega un mail. Tocá el botón del mail y vas a poder elegir tu contraseña nueva.`),
    h('p.suave', 'Si no te llega (mirá también en "Spam"), pedile a un administrador del equipo que te ponga una contraseña nueva desde la app.')));
}
