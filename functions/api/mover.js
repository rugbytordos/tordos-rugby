// POST /api/mover  { driveId, anio, mes }
// Si alguien corrige el mes o el año de una foto, la mueve a la carpeta correcta en Drive.
import { manejar, json, ErrorApp, verificarUsuario, carpetaDe, moverArchivo } from '../../lib/servidor.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  await verificarUsuario(request, env);
  const b = await request.json().catch(() => ({}));
  const anio = parseInt(b.anio, 10);
  const mes = parseInt(b.mes, 10);
  if (!/^[\w-]{10,}$/.test(String(b.driveId || ''))) throw new ErrorApp('Foto no válida.');
  if (!(anio >= 2015 && anio <= 2100) || !(mes >= 1 && mes <= 12)) throw new ErrorApp('Falta el mes o el año.');

  const carpetaId = await carpetaDe(env, anio, mes);
  await moverArchivo(env, b.driveId, carpetaId);
  return json({ ok: true });
});
