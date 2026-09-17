/**
 * La IP de quien pide, para los frenos por dirección.
 *
 * En Cloudflare se lee `CF-Connecting-IP`, que la pone el propio borde y **no
 * se puede falsear desde fuera**: si la petición la trae, viene de Cloudflare.
 * `x-forwarded-for` sí es falsificable —cualquiera puede mandarla— y por eso
 * queda de respaldo y no de primera opción; con ella sola, saltarse un freno
 * por IP sería tan fácil como inventar una dirección distinta en cada intento.
 *
 * Vive aparte porque la usan dos endpoints: el alta al boletín y el formulario
 * de contacto. Estaba escrita dentro del primero, y el segundo nació sin freno.
 */
export function ipDe(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for') ?? '';
  const primera = xff.split(',')[0]?.trim();
  return primera || request.headers.get('x-real-ip')?.trim() || 'desconocida';
}
