// Fuseau du Luxembourg pour tous les tests de dates (à charger en premier).
process.env.TZ = 'Europe/Luxembourg';
const offsetJuly = new Date(2026, 6, 1).getTimezoneOffset();   // CEST = UTC+2 -> -120
const offsetJan = new Date(2026, 0, 1).getTimezoneOffset();    // CET  = UTC+1 -> -60
if (offsetJuly !== -120 || offsetJan !== -60) {
  throw new Error(`Fuseau Europe/Luxembourg non appliqué (offsets ${offsetJan}/${offsetJuly}) : lancer avec TZ=Europe/Luxembourg`);
}
