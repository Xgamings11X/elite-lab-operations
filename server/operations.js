import { admin } from './auth.js';
import { localDate, rows } from './db.js';

export function recordAdminChange(db, user, action, entityId, detail) {
  return rows(db,`INSERT INTO admin_changes (actor_id, action, entity_id, detail)
    VALUES ($1,$2,$3,$4)`,user.id,action,entityId,detail);
}

export function registerOperations(app,db) {
  app.get('/api/insights',async(req,res)=>{
    const today=localDate().date;
    const [trend,activity]=await Promise.all([
      rows(db,`WITH dates AS (
          SELECT $1::date - offset_day AS day
          FROM generate_series(0,13) AS offset_day
        )
        SELECT dates.day::text AS date,
          count(a.id) FILTER (WHERE a.status='present')::int AS present,
          count(a.id) FILTER (WHERE a.status IN ('excused','competition'))::int AS excused
        FROM dates LEFT JOIN attendances a ON a.date=dates.day
        GROUP BY dates.day ORDER BY dates.day`,today),
      rows(db,`SELECT action,title,happened_at FROM (
          SELECT mark.action,m.full_name AS title,
            (a.date + mark.at_time) AT TIME ZONE 'Asia/Jakarta' AS happened_at
          FROM attendances a JOIN members m ON m.id=a.member_id
          CROSS JOIN LATERAL (VALUES ('check_in',a.check_in_time),('check_out',a.check_out_time)) AS mark(action,at_time)
          WHERE a.date BETWEEN $1::date-6 AND $1::date AND a.status='present' AND mark.at_time IS NOT NULL
          UNION ALL
          SELECT CASE WHEN kind='piket' THEN 'picket_report' ELSE 'activity_report' END, caption, created_at
          FROM reports WHERE created_at >= (($1::date-6)::timestamp AT TIME ZONE 'Asia/Jakarta')
        ) AS events WHERE happened_at <= now() ORDER BY happened_at DESC,action,title LIMIT 6`,today),
    ]);
    res.json({trend,activity});
  });
  app.get('/api/admin/audit',admin,async(req,res)=>{
    res.json(await rows(db,`SELECT c.id,c.action,c.entity_id,c.detail,c.created_at,u.email AS actor_email
      FROM admin_changes c JOIN users u ON u.id=c.actor_id
      ORDER BY c.id DESC LIMIT 30`));
  });
}
