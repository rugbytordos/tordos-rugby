// =====================================================================
//  Punto de entrada del Worker de Cloudflare.
//  - /api/...  → funciones del servidor (registro, Drive, admin)
//  - todo lo demás → archivos de la app (carpeta public)
//  - cada 2 días → "despertador" para que Supabase no se pause
// =====================================================================
import * as registro from '../functions/api/registro.js';
import * as subir from '../functions/api/subir.js';
import * as foto from '../functions/api/foto.js';
import * as mover from '../functions/api/mover.js';
import * as admin from '../functions/api/admin.js';
import * as salud from '../functions/api/salud.js';

const RUTAS = {
  '/api/registro': registro,
  '/api/subir': subir,
  '/api/foto': foto,
  '/api/mover': mover,
  '/api/admin': admin,
  '/api/salud': salud,
};

function json(datos, estado) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const modulo = RUTAS[url.pathname.replace(/\/+$/, '')];

    if (modulo) {
      const manejador = request.method === 'GET' ? modulo.onRequestGet
        : request.method === 'POST' ? modulo.onRequestPost : null;
      if (!manejador) return json({ error: 'Método no permitido.' }, 405);
      return manejador({ request, env, ctx });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'No existe.' }, 404);

    return env.ASSETS.fetch(request);
  },

  // Despertador de Supabase (se programa en wrangler.jsonc → triggers)
  async scheduled(evento, env, ctx) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return;
    const base = env.SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
    ctx.waitUntil(fetch(base + '/rest/v1/rpc/ping', {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: '{}',
    }));
  },
};
