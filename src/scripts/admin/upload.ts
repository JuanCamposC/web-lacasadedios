import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contexto } from './tipos';
import { esc, pesoLegible } from './ui';

/** Ancho máximo al que se reducen las imágenes antes de subirlas. */
const ANCHO_MAX = 1600;

/**
 * Reduce y recomprime la imagen en el navegador antes de subirla.
 * Una foto de teléfono son 4–8 MB; en el sitio nunca se ve a más de 1600 px.
 * Subir el original malgastaría almacenamiento y haría más lenta la página.
 */
export async function prepararImagen(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= ANCHO_MAX) return file;

    const escala = ANCHO_MAX / bitmap.width;
    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO_MAX;
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext('2d')!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

    const blob: Blob | null = await new Promise((r) => lienzo.toBlob(r, 'image/webp', 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // si el navegador no puede, se sube tal cual
  }
}

/**
 * Zona de imagen: arrastrar el archivo encima, verlo antes de guardar y
 * reducirlo en el navegador.
 */
export function initImagenes(ctx: Contexto) {
  ctx.root.querySelectorAll<HTMLElement>('[data-zona]').forEach((zona) => {
    const campo = zona.dataset.zona!;
    const input = zona.querySelector('input[type="file"]') as HTMLInputElement;
    const drop = zona.querySelector('[data-drop]') as HTMLElement;
    const prev = zona.querySelector(`[data-preview="${campo}"]`) as HTMLElement;

    const mostrar = async (file: File) => {
      prev.innerHTML = `<p class="text-xs text-base-content/55">Preparando imagen…</p>`;
      const blob = await prepararImagen(file);
      ctx.imagenesListas.set(campo, blob);
      const ahorro =
        blob.size < file.size
          ? ` · reducida de ${pesoLegible(file.size)} a ${pesoLegible(blob.size)}`
          : ` · ${pesoLegible(blob.size)}`;
      prev.innerHTML = `<div class="flex items-center gap-3 rounded border border-base-300 p-2">
            <img src="${URL.createObjectURL(blob)}" alt="" class="h-16 w-16 rounded object-cover" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium">${esc(file.name)}</p>
              <p class="text-xs text-base-content/55">Lista para subir${ahorro}</p>
            </div>
            <button type="button" data-quitar class="btn btn-ghost btn-xs">Quitar</button>
          </div>`;
      prev.querySelector('[data-quitar]')?.addEventListener('click', () => {
        ctx.imagenesListas.delete(campo);
        input.value = '';
        prev.innerHTML = '';
      });
    };

    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) mostrar(f);
    });

    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add('border-primary', 'bg-base-200');
      }),
    );
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove('border-primary', 'bg-base-200');
      }),
    );
    drop.addEventListener('drop', (e) => {
      const f = (e as DragEvent).dataTransfer?.files?.[0];
      if (f) mostrar(f);
    });
  });
}

/** Sube el blob al bucket `media` y devuelve su URL pública. */
export async function subirImagen(
  supabase: SupabaseClient,
  tabla: string,
  blob: Blob,
  nombre: string,
): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp' : nombre.split('.').pop() || 'jpg';
  const base = nombre
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w-]/g, '_')
    .slice(0, 40);
  const path = `${tabla}/${Date.now()}-${base}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
