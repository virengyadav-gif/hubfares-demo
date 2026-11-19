import { openDb, dbFilePath } from '../src/server/db/client';
const h = openDb(dbFilePath());
console.log(`Migrations applied to ${h.file}`);
h.sqlite.close();
