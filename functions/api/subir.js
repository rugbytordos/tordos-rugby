// POST /api/subir?anio=2026&mes=10&nombre=xxx.jpg
// Recibe una foto (ya achicada en el celular) y la guarda en Google Drive,
// dentro de "Fotos Rugby Tordos (app)/2026/10 - Octubre".
import { manejar, json, ErrorApp, verificarUsuario, carpetaDe, subirArchivo } from '../../lib/servidor.js';

const MAX_BYTES = 25 * 1024 * 1024;

export const onRequestPost = manejar(async ({ request, env }) => {
  await verificarUsuario(request, env);

  const url = new URL(request.url);
  const anio = parseInt(url.searchParams.get('anio'), 10);
  const mes = parseInt(url.searchParams.get('mes'), 10);
  if (!(anio >= 2015 && anio <= 2100) || !(mes >= 1 && mes <= 12)) throw new ErrorApp('Falta el mes o el año.');

  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!tipo.startsWith('image/')) throw new ErrorApp('Solo se pueden subir fotos.');

  const datos = await request.arrayBuffer();
  if (!datos.byteLength) throw new ErrorApp('La foto llegó vacía. Probá de nuevo.');
  if (datos.byteLength > MAX_BYTES) throw new ErrorApp('La foto es demasiado grande.');

  const nombre = (url.searchParams.get('nombre') || `foto-${Date.now()}.jpg`)
    .replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '').slice(0, 120) || `foto-${Date.now()}.jpg`;

  const carpetaId = await carpetaDe(env, anio, mes);
  const archivo = await subirArchivo(env, { nombre, tipo, datos, carpetaId });
  return json({ driveId: archivo.id });
});
