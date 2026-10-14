function todayStr(){ return new Date().toISOString().slice(0,10); }

// Différence en jours calendaires (UTC) entre deux dates 'YYYY-MM-DD'. daysBetween('2026-07-24','2026-07-27') = 3.
function daysBetween(dateStrA, dateStrB){
  const a = new Date(dateStrA + 'T00:00:00Z').getTime();
  const b = new Date(dateStrB + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

function mondayOf(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay();           // 0 = dimanche, 1 = lundi ...
  const shift = (dow === 0) ? 6 : dow - 1; // recule jusqu'au lundi
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0,10);
}

function addDaysStr(dateStr, n){
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0,10);
}

function formatDayFR(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', timeZone:'UTC' });
}
