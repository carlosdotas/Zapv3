import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { distanceKm, validatePickupDetails } from './pickup-details.js';
export type Call = { id: string; companyId: string; professionalId: string; status: string; expiresAt: string; companyName: string; pickupName: string | null; pickupAddress: string | null; distanceKm: number | null; pickupLatitude: number | null; pickupLongitude: number | null };
type Row = RowDataPacket & { id: string; company_id: string; professional_user_id: string; status: string; expires_at: Date };
const mapCall = (r: Row): Call => ({ id: r.id, companyId: r.company_id, professionalId: r.professional_user_id, status: r.status, expiresAt: new Date(r.expires_at).toISOString(), companyName: r.display_company_name, pickupName: r.pickup_name ?? null, pickupAddress: r.pickup_address ?? null, distanceKm: r.distance_km == null ? null : Number(r.distance_km), pickupLatitude: r.pickup_latitude == null ? null : Number(r.pickup_latitude), pickupLongitude: r.pickup_longitude == null ? null : Number(r.pickup_longitude) });
const detailColumns = 't.*,COALESCE(d.company_name,c.name) AS display_company_name,d.pickup_name,d.pickup_address,d.distance_km,d.pickup_latitude,d.pickup_longitude';
export class PickupStore {
  constructor(private pool: Pool, private linksReady: Promise<void> = Promise.resolve()) {}
  private async getCall(id: string, db: Pool | PoolConnection = this.pool) {
    const [rows] = await db.execute<Row[]>(`SELECT ${detailColumns} FROM pickup_test_calls t JOIN companies c ON c.id=t.company_id LEFT JOIN pickup_test_details d ON d.call_id=t.id WHERE t.id=?`,[id]);
    return mapCall(rows[0]);
  }
  async company(userId: string, companyId: string, db: Pool | PoolConnection = this.pool) {
    const [rows] = await db.execute<RowDataPacket[]>(`SELECT c.id FROM companies c JOIN users u ON u.id=? AND u.status='active' WHERE c.id=? AND c.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.company_id=c.id AND m.user_id=u.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='platform_admin'))`, [userId,companyId]);
    if (!rows.length) throw new Error('FORBIDDEN');
  }
  async companies(userId: string) {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT c.id,c.name FROM companies c JOIN users u ON u.id=? AND u.status='active' WHERE c.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.company_id=c.id AND m.user_id=u.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='platform_admin'))`,[userId]); return rows;
  }
  async canReceive(userId: string, companyId: string) {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT 1 FROM company_professionals cp JOIN companies c ON c.id=cp.company_id JOIN users u ON u.id=cp.professional_user_id JOIN user_global_roles ugr ON ugr.user_id=u.id JOIN roles r ON r.id=ugr.role_id WHERE cp.company_id=? AND cp.professional_user_id=? AND cp.status='active' AND c.status='active' AND u.status='active' AND r.code='professional' LIMIT 1`,[companyId,userId]);
    return rows.length>0;
  }
  async professionals(userId: string, companyId: string) {
    await this.company(userId,companyId);
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT u.id,u.name,u.phone_e164 AS phone,(d.on_duty=1 AND d.last_seen_at>UTC_TIMESTAMP(3)-INTERVAL 90 SECOND) AS online FROM company_professionals cp JOIN users u ON u.id=cp.professional_user_id JOIN professional_profiles p ON p.user_id=u.id LEFT JOIN professional_duty d ON d.user_id=u.id WHERE cp.company_id=? AND cp.status='active' AND u.status='active' AND EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='professional') ORDER BY online DESC,u.name LIMIT 200`,[companyId]); return rows;
  }
  async linkProfessional(userId: string, companyId: string, phone: string) {
    try { await this.linksReady; } catch { throw new Error('LINK_UNAVAILABLE'); }
    const db = await this.pool.getConnection();
    try {
      await db.beginTransaction();
      const [admins] = await db.execute<RowDataPacket[]>(`SELECT c.id FROM companies c JOIN users u ON u.id=? AND u.status='active' WHERE c.id=? AND c.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.company_id=c.id AND m.user_id=u.id AND m.status='active' AND r.code='company_admin') OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='platform_admin'))`, [userId, companyId]);
      if (!admins.length) throw new Error('FORBIDDEN');
      if (!/^\+55\d{10,11}$/.test(phone)) throw new Error('INVALID_PHONE');
      const [drivers] = await db.execute<RowDataPacket[]>(`SELECT u.id FROM users u JOIN professional_profiles p ON p.user_id=u.id JOIN user_global_roles ugr ON ugr.user_id=u.id JOIN roles r ON r.id=ugr.role_id AND r.code='professional' WHERE u.phone_e164=? AND u.status='active' LIMIT 1 FOR UPDATE`, [phone]);
      if (!drivers.length) throw new Error('DRIVER_NOT_FOUND');
      const driverId = String(drivers[0].id);
      const [links] = await db.execute<RowDataPacket[]>('SELECT status FROM company_professionals WHERE company_id=? AND professional_user_id=? FOR UPDATE', [companyId, driverId]);
      if (links.length && links[0].status !== 'active') throw new Error('LINK_INACTIVE');
      if (!links.length) {
        await db.execute('INSERT INTO company_professionals (company_id,professional_user_id) VALUES (?,?)', [companyId, driverId]);
        await db.execute('INSERT INTO company_professional_link_events (id,company_id,professional_user_id,actor_user_id) VALUES (?,?,?,?)', [randomUUID(), companyId, driverId, userId]);
      }
      await db.commit();
      return { linked: true };
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
  }
  async setupSelfTest(userId: string) {
    const db = await this.pool.getConnection();
    try {
      await db.beginTransaction();
      const [users] = await db.execute<RowDataPacket[]>(`SELECT u.id,u.phone_e164 FROM users u JOIN professional_profiles p ON p.user_id=u.id WHERE u.id=? AND u.status='active' AND EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='platform_admin') AND EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='professional') FOR UPDATE`,[userId]);
      if (!users.length) throw new Error('FORBIDDEN');
      const [existing] = await db.execute<RowDataPacket[]>(`SELECT s.company_id,c.status AS company_status,cp.status AS link_status FROM pickup_self_test_setups s JOIN companies c ON c.id=s.company_id LEFT JOIN company_professionals cp ON cp.company_id=c.id AND cp.professional_user_id=s.admin_user_id WHERE s.admin_user_id=?`,[userId]);
      let companyId: string;
      if (existing.length) {
        if (existing[0].company_status !== 'active' || existing[0].link_status !== 'active') throw new Error('SETUP_INACTIVE');
        companyId = String(existing[0].company_id);
      } else {
        companyId = randomUUID();
        await db.execute('INSERT INTO companies (id,name) VALUES (?,?)',[companyId,'Transportadora de teste']);
        await db.execute('INSERT INTO company_professionals (company_id,professional_user_id) VALUES (?,?)',[companyId,userId]);
        await db.execute('INSERT INTO pickup_self_test_setups (admin_user_id,company_id) VALUES (?,?)',[userId,companyId]);
      }
      await db.commit();
      return { companyId, professionalId: userId, phone: String(users[0].phone_e164) };
    } catch(e) { await db.rollback(); throw e; } finally { db.release(); }
  }
  async create(userId: string, companyId: string, professionalId: string, input?: unknown) {
    const details = validatePickupDetails(input);
    const db = await this.pool.getConnection();
    try {
      await db.beginTransaction(); await this.company(userId,companyId,db);
      const [targets] = await db.execute<RowDataPacket[]>(`SELECT cp.professional_user_id FROM company_professionals cp JOIN users u ON u.id=cp.professional_user_id JOIN professional_profiles p ON p.user_id=u.id JOIN professional_duty d ON d.user_id=u.id WHERE cp.company_id=? AND cp.professional_user_id=? AND cp.status='active' AND u.status='active' AND d.on_duty=1 AND d.last_seen_at>UTC_TIMESTAMP(3)-INTERVAL 90 SECOND AND EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='professional') FOR UPDATE`,[companyId,professionalId]);
      if (!targets.length) throw new Error('UNAVAILABLE');
      const [recent] = await db.execute<RowDataPacket[]>(`SELECT id FROM pickup_test_calls WHERE professional_user_id=? AND created_at>UTC_TIMESTAMP(3)-INTERVAL 30 SECOND LIMIT 1`,[professionalId]);
      if (recent.length) throw new Error('RATE_LIMIT');
      const id=randomUUID();
      const [inserted] = await db.execute<ResultSetHeader>(`INSERT INTO pickup_test_calls (id,company_id,professional_user_id,created_by,created_at,expires_at) SELECT ?,c.id,cp.professional_user_id,u.id,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 120 SECOND FROM companies c JOIN users u ON u.id=? AND u.status='active' JOIN company_professionals cp ON cp.company_id=c.id AND cp.professional_user_id=? AND cp.status='active' WHERE c.id=? AND c.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.company_id=c.id AND m.user_id=u.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='platform_admin'))`,[id,userId,professionalId,companyId]);
      if (!inserted.affectedRows) throw new Error('FORBIDDEN');
      await db.execute(`INSERT INTO pickup_test_events (id,call_id,actor_user_id,status) VALUES (?,?,?,'pending')`,[randomUUID(),id,userId]);
      let distance: number | null = null;
      if (details.latitude !== null && details.longitude !== null) {
        const [locations] = await db.execute<RowDataPacket[]>(`SELECT latitude,longitude FROM professional_locations WHERE professional_user_id=? AND recorded_at>=UTC_TIMESTAMP()-INTERVAL 2 MINUTE AND recorded_at<=UTC_TIMESTAMP()+INTERVAL 5 SECOND AND accuracy_m IS NOT NULL AND accuracy_m BETWEEN 0 AND 150`,[professionalId]);
        if (locations.length) distance = distanceKm(details.latitude,details.longitude,Number(locations[0].latitude),Number(locations[0].longitude));
      }
      await db.execute(`INSERT INTO pickup_test_details (call_id,company_name,pickup_name,pickup_address,pickup_latitude,pickup_longitude,distance_km) SELECT ?,name,?,?,?,?,? FROM companies WHERE id=?`,[id,details.pickupName,details.pickupAddress,details.latitude,details.longitude,distance,companyId]);
      const call=await this.getCall(id,db); await db.commit(); return call;
    } catch(e) { await db.rollback(); throw e; } finally { db.release(); }
  }
  async respond(userId: string,id: string, answer: 'accepted' | 'rejected') {
    const db=await this.pool.getConnection();
    try {
      await db.beginTransaction();
      const [rows]=await db.execute<Row[]>(`SELECT *,expires_at<=UTC_TIMESTAMP(3) AS elapsed FROM pickup_test_calls WHERE id=? AND professional_user_id=? AND EXISTS (SELECT 1 FROM company_professionals cp JOIN companies c ON c.id=cp.company_id WHERE cp.company_id=pickup_test_calls.company_id AND cp.professional_user_id=pickup_test_calls.professional_user_id AND cp.status='active' AND c.status='active') FOR UPDATE`,[id,userId]);
      const row=rows[0]; if (!row) throw new Error('FORBIDDEN');
      if (row.status==='pending') {
        row.status=row.elapsed ? 'expired' : answer;
        await db.execute("UPDATE pickup_test_calls SET status=? WHERE id=? AND status='pending'",[row.status,id]);
        await db.execute('INSERT INTO pickup_test_events (id,call_id,actor_user_id,status) VALUES (?,?,?,?)',[randomUUID(),id,userId,row.status]);
      }
      const call=await this.getCall(id,db); await db.commit(); return call;
    } catch(e) { await db.rollback(); throw e; } finally { db.release(); }
  }
  async expire() {
    const db=await this.pool.getConnection();
    try {
      await db.beginTransaction(); const [rows]=await db.query<Row[]>(`SELECT * FROM pickup_test_calls WHERE status='pending' AND expires_at<=UTC_TIMESTAMP(3) LIMIT 200 FOR UPDATE`);
      for(const row of rows) {
        await db.execute(`UPDATE pickup_test_calls SET status='expired' WHERE id=?`,[row.id]);
        await db.execute(`INSERT INTO pickup_test_events (id,call_id,status) VALUES (?,?,'expired')`,[randomUUID(),row.id]); row.status='expired';
      }
      if (!rows.length) { await db.commit(); return []; }
      const [calls] = await db.execute<Row[]>(`SELECT ${detailColumns} FROM pickup_test_calls t JOIN companies c ON c.id=t.company_id LEFT JOIN pickup_test_details d ON d.call_id=t.id WHERE t.id IN (${rows.map(()=>'?').join(',')})`,rows.map(row=>row.id));
      await db.commit(); return calls.map(mapCall);
    } catch(e) { await db.rollback(); throw e; } finally { db.release(); }
  }
  async sync(userId: string) {
    const [rows]=await this.pool.execute<Row[]>(`SELECT DISTINCT ${detailColumns} FROM pickup_test_calls t JOIN companies c ON c.id=t.company_id AND c.status='active' LEFT JOIN pickup_test_details d ON d.call_id=t.id JOIN users u ON u.id=? AND u.status='active' WHERE ((t.professional_user_id=u.id AND EXISTS (SELECT 1 FROM company_professionals cp JOIN user_global_roles ugr ON ugr.user_id=cp.professional_user_id JOIN roles r ON r.id=ugr.role_id WHERE cp.company_id=t.company_id AND cp.professional_user_id=u.id AND cp.status='active' AND r.code='professional')) OR EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.company_id=t.company_id AND m.user_id=u.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=u.id AND r.code='platform_admin')) AND t.created_at>UTC_TIMESTAMP(3)-INTERVAL 1 DAY ORDER BY t.created_at DESC LIMIT 100`,[userId]); return rows.map(mapCall);
  }
  async duty(userId:string,on:boolean) {
    await this.pool.execute(`INSERT INTO professional_duty (user_id,on_duty,last_seen_at) VALUES (?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE on_duty=VALUES(on_duty),last_seen_at=VALUES(last_seen_at)`,[userId,on]);
    await this.pool.execute(`UPDATE professional_profiles SET availability=?,location_consent_at=IF(?,UTC_TIMESTAMP(),location_consent_at) WHERE user_id=?`,[on?'available':'offline',on,userId]);
  }
  async heartbeat(userId:string) { await this.pool.execute('UPDATE professional_duty SET last_seen_at=UTC_TIMESTAMP(3) WHERE user_id=?',[userId]); }
  async location(userId:string,latitude:number,longitude:number,accuracy:number,recordedAt:string) {
    await this.pool.execute(`INSERT INTO professional_locations (professional_user_id,latitude,longitude,accuracy_m,recorded_at) SELECT ?,?,?,?,? FROM professional_duty WHERE user_id=? AND on_duty=1 AND last_seen_at>UTC_TIMESTAMP(3)-INTERVAL 90 SECOND ON DUPLICATE KEY UPDATE latitude=IF(VALUES(recorded_at)>recorded_at,VALUES(latitude),latitude),longitude=IF(VALUES(recorded_at)>recorded_at,VALUES(longitude),longitude),accuracy_m=IF(VALUES(recorded_at)>recorded_at,VALUES(accuracy_m),accuracy_m),recorded_at=GREATEST(recorded_at,VALUES(recorded_at))`,[userId,latitude,longitude,accuracy,new Date(recordedAt),userId]);
  }
}
