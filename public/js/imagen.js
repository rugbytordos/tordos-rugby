// Achicar fotos en el celular antes de subirlas, y leer la fecha en que se sacaron.

export const LADO_FOTO = 2048;      // lado mayor de la foto que se guarda en Drive
export const CALIDAD_FOTO = 0.85;
export const LADO_MINIATURA = 480;  // miniatura para la galería
export const CALIDAD_MINIATURA = 0.72;

export function leerImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => resolver({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la foto "' + (archivo.name || '') + '". Probá con otra.'));
    };
    img.src = url;
  });
}

// Dibuja la imagen achicada y devuelve un JPG.
// recorteCuadrado: para fotos de perfil.
export function achicar(img, ladoMax, calidad, { recorteCuadrado = false } = {}) {
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (recorteCuadrado) {
    const lado = Math.min(sw, sh);
    sx = (sw - lado) / 2; sy = (sh - lado) / 2; sw = sh = lado;
  }
  const escala = Math.min(1, ladoMax / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * escala));
  const hgt = Math.max(1, Math.round(sh * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = hgt;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, hgt);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, hgt);

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob((b) => (b ? resolver({ blob: b, ancho: w, alto: hgt }) : rechazar(new Error('No se pudo procesar la foto.'))),
      'image/jpeg', calidad);
  });
}

// Lee la fecha guardada dentro de la foto (si el celular la guardó).
// Las fotos reenviadas por WhatsApp normalmente no la tienen.
export async function fechaDeFoto(archivo) {
  try {
    const buf = await archivo.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let p = 2;
    while (p + 4 < v.byteLength) {
      const marca = v.getUint16(p);
      const largo = v.getUint16(p + 2);
      if (marca === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) return leerExif(v, p + 10);
      if ((marca & 0xFF00) !== 0xFF00) break;
      p += 2 + largo;
    }
  } catch { /* sin fecha */ }
  return null;
}

function leerExif(v, tiff) {
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = (o) => v.getUint16(o, le);
  const u32 = (o) => v.getUint32(o, le);

  const buscar = (ifd, etiqueta) => {
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === etiqueta) return e;
    }
    return null;
  };
  const texto = (e) => {
    const cant = u32(e + 4);
    const off = cant > 4 ? tiff + u32(e + 8) : e + 8;
    let s = '';
    for (let i = 0; i < cant - 1 && off + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(off + i));
    return s;
  };

  const ifd0 = tiff + u32(tiff + 4);
  let fecha = null;
  const exifPtr = buscar(ifd0, 0x8769);
  if (exifPtr) {
    const exif = tiff + u32(exifPtr + 8);
    const e = buscar(exif, 0x9003) || buscar(exif, 0x9004);
    if (e) fecha = texto(e);
  }
  if (!fecha) {
    const e = buscar(ifd0, 0x0132);
    if (e) fecha = texto(e);
  }
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(fecha || '');
  if (!m) return null;
  const anio = +m[1], mes = +m[2];
  if (anio < 2015 || anio > 2100 || mes < 1 || mes > 12) return null;
  return { anio, mes };
}
