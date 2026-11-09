// Installation NEUVE seulement : affiche le SQL qui crée une première clé d'accès (le serveur ne stocke que
// l'empreinte de la clé) et celui qui promeut le premier compte en administrateur.
//   node tools/bootstrap-sql.mjs LZ-DEMAR-RAGE2 monidentifiant
import crypto from 'node:crypto';

const [key, username] = process.argv.slice(2);
if (!key || !username) { console.error('Usage : node tools/bootstrap-sql.mjs <clé de départ> <identifiant du futur administrateur>'); process.exit(1); }
const normalized = key.trim().toUpperCase().replace(/\s+/g, '');
const hash = crypto.createHash('sha256').update(normalized).digest('hex');
const id = crypto.randomBytes(16).toString('hex');
const user = username.trim().toLowerCase().replace(/'/g, '');
console.log(`-- 1. À exécuter dans la console D1 :
INSERT INTO invites (id, code_hash, label, created_at, max_uses) VALUES ('${id}', '${hash}', 'clé de départ', ${Date.now()}, 1);

-- 2. Créez ensuite votre compte dans l'application avec la clé « ${normalized} », puis exécutez :
UPDATE users SET role = 'admin', entitlements = '["course"]' WHERE username = '${user}';`);
