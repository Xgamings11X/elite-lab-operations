import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export async function database(url) {
  const client = url ? new pg.Pool({ connectionString: url }) : new PGlite();
  const schema = await readFile(process.cwd()+'/database/schema.sql', 'utf8');
  if (url) await client.query(schema);
  else await client.exec(schema);
  return {
    query: client.query.bind(client),
    close: () => url ? client.end() : client.close(),
    async transaction(fn) {
      if (!url) return client.transaction(fn);
      const connection = await client.connect();
      try {
        await connection.query('BEGIN');
        const result = await fn(connection);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export const rows = async (db, sql, ...params) => (await db.query(sql, params)).rows;
export const first = async (db, sql, ...params) => (await rows(db, sql, ...params))[0];

export function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const { year, month, day, hour, minute, second } = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return { date: [year,month,day].join('-'), time: [hour,minute,second].join(':'), now };
}
export const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();
