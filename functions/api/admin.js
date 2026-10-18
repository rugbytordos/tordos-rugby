// POST /api/admin   (solo administradores)
//   { accion: 'borrar', fotoIds: [1,2,3] }      → borra definitivamente fotos de la papelera
//   { accion: 'clave',  perfilId, clave }        → le pone una contraseña nueva a un papá/mamá
import { manejar, json, ErrorApp, verificarUsuario, supabase, papeleraDrive } from '../../lib/servidor.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  await verificarUsuario(request, env, { admin: true });
  const b = await request.json().catch(() => ({}));

  if (b.accion === 'borrar') {
    const ids = (Array.isArray(b.fotoIds) ? b.fotoIds : []).map(Number).filter((n) => n > 0).slice(0, 200);
    if (!ids.length) throw new ErrorApp('No hay fotos para borrar.');

    // Solo se pueden borrar definitivamente las que ya están en la papelera
    const fotos = await supabase(env,
      `/rest/v1/fotos?select=id,drive_file_id,miniatura_path&id=in.(${ids.join(',')})&en_papelera_desde=not.is.null`);
    if (!fotos.length) return json({ borradas: 0 });

    for (const f of fotos) await papeleraDrive(env, f.drive_file_id);

    await supabase(env, '/storage/v1/object/miniaturas', {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: fotos.map((f) => f.miniatura_path) }),
    }).catch((e) => console.error('miniaturas', e.message));

    await supabase(env, `/rest/v1/fotos?id=in.(${fotos.map((f) => f.id).join(',')})`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    return json({ borradas: fotos.length });
  }

  if (b.accion === 'clave') {
    const clave = String(b.clave || '');
    if (!/^[0-9a-f-]{36}$/i.test(String(b.perfilId || ''))) throw new ErrorApp('Usuario no válido.');
    if (clave.length < 6) throw new ErrorApp('La contraseña tiene que tener al menos 6 letras o números.');
    await supabase(env, '/auth/v1/admin/users/' + b.perfilId, {
      method: 'PUT',
      body: JSON.stringify({ password: clave }),
    });
    return json({ ok: true });
  }

  throw new ErrorApp('Acción desconocida.');
});
