let seq = 0;

/**
 * Id numérico único entre dispositivos sin base de datos:
 * timestamp + fragmente aleatorio + contador local.
 */
export function newId(): number {
  seq += 1;
  const base = Math.floor(Date.now() / 1000) * 1000;
  const rnd = Math.floor(Math.random() * 1000);
  return base + rnd + (seq % 1000);
}