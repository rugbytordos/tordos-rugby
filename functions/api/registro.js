// POST /api/registro
// Crea la cuenta de un papá o mamá SOLO si trae el código del equipo correcto.
// La cuenta queda confirmada al instante: no se manda ningún mail de verificación.
import { manejar, json, ErrorApp, supabase } from '../../lib/servidor.js';

const normalizar = (c) => String(c || '').toUpperCase().replace(/\s+/g, '').trim();
const limpiar = (t, max = 60) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);

export const onRequestPost = manejar(async ({ request, env }) => {
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const nombre = limpiar(b.nombre);
  const apellido = limpiar(b.apellido);
  const rol = b.rol === 'mamá' || b.rol === 'papá' ? b.rol : null;

  if (!normalizar(b.codigo)) throw new ErrorApp('Escribí el código del equipo.');
  if (!nombre || !apellido) throw new ErrorApp('Escribí tu nombre y tu apellido.');
  if (!rol) throw new ErrorApp('Elegí si sos la mamá o el papá.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorApp('Revisá el email, parece que tiene un error.');
  if (password.length < 6) throw new ErrorApp('La contraseña tiene que tener al menos 6 letras o números.');

  // 1. Revisar el código del equipo
  const conf = await supabase(env, '/rest/v1/configuracion?select=codigo_equipo&id=eq.1');
  const codigoReal = conf && conf[0] && conf[0].codigo_equipo;
  if (!codigoReal || normalizar(codigoReal) !== normalizar(b.codigo)) {
    await new Promise((r) => setTimeout(r, 800)); // frena a quien intente adivinar
    throw new ErrorApp('El código del equipo no es correcto. Pedilo en el grupo de WhatsApp.', 403);
  }

  // 2. Crear el usuario (ya confirmado, sin mail)
  let usuario;
  try {
    usuario = await supabase(env, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nombre, apellido, rol } }),
    });
  } catch (e) {
    const texto = String(e.message || '').toLowerCase();
    if (e.estado === 422 || texto.includes('already') || texto.includes('exists')) {
      throw new ErrorApp('Ya hay una cuenta con ese email. Tocá "Entrar" y usá tu contraseña.', 409);
    }
    if (texto.includes('password')) throw new ErrorApp('Elegí una contraseña un poco más difícil.');
    throw e;
  }
  const id = usuario.id || (usuario.user && usuario.user.id);

  // 3. Crear el perfil. La primera persona que se registra queda como admin.
  try {
    const admins = await supabase(env, '/rest/v1/perfiles?select=id&es_admin=eq.true&limit=1');
    await supabase(env, '/rest/v1/perfiles', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id, email, nombre, apellido, rol, es_admin: !admins || admins.length === 0 }),
    });
  } catch (e) {
    await supabase(env, '/auth/v1/admin/users/' + id, { method: 'DELETE' }).catch(() => {});
    throw e;
  }

  return json({ ok: true });
});
