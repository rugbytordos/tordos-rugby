// GET /api/foto?id=<id de Drive>
// Trae la foto en tamaño completo desde Drive, solo para papás logueados.
import { manejar, ErrorApp, verificarUsuario, descargarArchivo } from '../../lib/servidor.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  await verificarUsuario(request, env);

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[\w-]{10,}$/.test(id)) throw new ErrorApp('Foto no válida.');

  const r = await descargarArchivo(env, id);
  if (r.status === 404) throw new ErrorApp('Esta foto ya no está en Drive.', 404);
  if (!r.ok) throw new ErrorApp('No se pudo traer la foto de Drive.', 502);

  return new Response(r.body, {
    headers: {
      'Content-Type': r.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=604800',
    },
  });
});
