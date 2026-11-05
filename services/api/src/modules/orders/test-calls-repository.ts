import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type TestCallStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type TestCall = { id: string; companyId: string; professionalId: string; status: TestCallStatus; expiresAt: string };
type CallRow = RowDataPacket & { id: string; company_id: string; professional_user_id: string; status: TestCallStatus; expires_at: string };
const callColumns = "id,company_id,professional_user_id,status,CONCAT(DATE_FORMAT(expires_at, '%Y-%m-%dT%H:%i:%s.%f'),'Z') AS expires_at";

function toCall(row: CallRow): TestCall {
  return { id: row.id, companyId: row.company_id, professionalId: row.professional_user_id, status: row.status, expiresAt: new Date(row.expires_at).toISOString() };
}

export class TestCallsRepository {
  constructor(private readonly pool: Pool) {}

  async isCompanyMember(userId: string, companyId: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT 1 FROM companies c WHERE c.id=? AND c.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.user_id=? AND m.company_id=c.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=? AND r.code='platform_admin')) LIMIT 1", [companyId, userId, userId]);
    return rows.length > 0;
  }

  async isProfessionalLinked(professionalId: string, companyId: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT 1 FROM company_professionals cp JOIN companies c ON c.id=cp.company_id JOIN users u ON u.id=cp.professional_user_id WHERE cp.company_id=? AND cp.professional_user_id=? AND cp.status='active' AND c.status='active' AND u.status='active' LIMIT 1", [companyId, professionalId]);
    return rows.length > 0;
  }

  async companies(userId: string) {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT c.id,c.name FROM companies c WHERE c.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.user_id=? AND m.company_id=c.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=? AND r.code='platform_admin')) ORDER BY c.name", [userId, userId]);
    return rows.map(row => ({ id: String(row.id), name: String(row.name) }));
  }

  async professionals(companyId: string) {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT u.id,u.name,COALESCE(s.on_duty,FALSE) AS on_duty,COALESCE(s.online,FALSE) AS online FROM company_professionals cp JOIN users u ON u.id=cp.professional_user_id JOIN professional_profiles p ON p.user_id=u.id LEFT JOIN professional_duty_state s ON s.professional_user_id=u.id WHERE cp.company_id=? AND cp.status='active' AND u.status='active' ORDER BY u.name", [companyId]);
    return rows.map(row => ({ id: String(row.id), name: String(row.name), onDuty: Boolean(row.on_duty), online: Boolean(row.online) }));
  }

  async setDuty(professionalId: string, onDuty: boolean) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      if (onDuty) await connection.execute('UPDATE professional_profiles SET location_consent_at=COALESCE(location_consent_at, UTC_TIMESTAMP()) WHERE user_id=?', [professionalId]);
      await connection.execute('INSERT INTO professional_duty_state (professional_user_id,on_duty,online,last_seen_at) VALUES (?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE on_duty=VALUES(on_duty),online=VALUES(online),last_seen_at=VALUES(last_seen_at)', [professionalId, onDuty, onDuty]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async setOffline(professionalId: string) {
    await this.pool.execute('UPDATE professional_duty_state SET online=FALSE,last_seen_at=UTC_TIMESTAMP(3) WHERE professional_user_id=?', [professionalId]);
  }

  async dutyStatuses(professionalId: string) {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT cp.company_id,s.professional_user_id,s.on_duty,s.online FROM company_professionals cp JOIN professional_duty_state s ON s.professional_user_id=cp.professional_user_id WHERE cp.professional_user_id=? AND cp.status='active'", [professionalId]);
    return rows.map(row => ({ companyId: String(row.company_id), professionalId: String(row.professional_user_id), onDuty: Boolean(row.on_duty), online: Boolean(row.online) }));
  }

  async recordLocation(professionalId: string, latitude: number, longitude: number, accuracy: number) {
    const [result] = await this.pool.execute<ResultSetHeader>("INSERT INTO professional_locations (professional_user_id,latitude,longitude,accuracy_m,recorded_at) SELECT professional_user_id,?,?,?,UTC_TIMESTAMP() FROM professional_duty_state WHERE professional_user_id=? AND on_duty=TRUE ON DUPLICATE KEY UPDATE latitude=VALUES(latitude),longitude=VALUES(longitude),accuracy_m=VALUES(accuracy_m),recorded_at=VALUES(recorded_at)", [latitude, longitude, accuracy, professionalId]);
    return result.affectedRows > 0;
  }

  async create(companyId: string, professionalId: string, actorId: string): Promise<TestCall | null> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const id = randomUUID();
      const [inserted] = await connection.execute<ResultSetHeader>("INSERT INTO pickup_test_calls (id,company_id,professional_user_id,created_by,status,created_at,expires_at) SELECT ?,c.id,cp.professional_user_id,?,'pending',UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 SECOND) FROM companies c JOIN company_professionals cp ON cp.company_id=c.id JOIN users u ON u.id=cp.professional_user_id JOIN professional_profiles p ON p.user_id=u.id WHERE c.id=? AND cp.professional_user_id=? AND cp.status='active' AND c.status='active' AND u.status='active' AND (EXISTS (SELECT 1 FROM company_members m JOIN roles r ON r.id=m.role_id WHERE m.user_id=? AND m.company_id=c.id AND m.status='active' AND r.code IN ('company_admin','attendant')) OR EXISTS (SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id=ugr.role_id WHERE ugr.user_id=? AND r.code='platform_admin'))", [id, actorId, companyId, professionalId, actorId, actorId]);
      if (!inserted.affectedRows) { await connection.rollback(); return null; }
      await this.event(connection, id, actorId, 'pending');
      const [rows] = await connection.execute<CallRow[]>(`SELECT ${callColumns} FROM pickup_test_calls WHERE id=?`, [id]);
      await connection.commit();
      return toCall(rows[0]);
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async respond(callId: string, professionalId: string, answer: 'accepted' | 'rejected'): Promise<TestCall | null> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [updated] = await connection.execute<ResultSetHeader>("UPDATE pickup_test_calls SET status=?,responded_at=UTC_TIMESTAMP(3) WHERE id=? AND professional_user_id=? AND status='pending' AND expires_at>UTC_TIMESTAMP(3) AND EXISTS (SELECT 1 FROM company_professionals cp JOIN companies c ON c.id=cp.company_id WHERE cp.company_id=pickup_test_calls.company_id AND cp.professional_user_id=pickup_test_calls.professional_user_id AND cp.status='active' AND c.status='active')", [answer, callId, professionalId]);
      if (!updated.affectedRows) { await connection.rollback(); return null; }
      await this.event(connection, callId, professionalId, answer);
      const [rows] = await connection.execute<CallRow[]>(`SELECT ${callColumns} FROM pickup_test_calls WHERE id=?`, [callId]);
      await connection.commit();
      return toCall(rows[0]);
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async pending(professionalId: string): Promise<TestCall[]> {
    const [rows] = await this.pool.execute<CallRow[]>(`SELECT ${callColumns} FROM pickup_test_calls WHERE professional_user_id=? AND status='pending' AND expires_at>UTC_TIMESTAMP(3) AND EXISTS (SELECT 1 FROM company_professionals cp JOIN companies c ON c.id=cp.company_id WHERE cp.company_id=pickup_test_calls.company_id AND cp.professional_user_id=pickup_test_calls.professional_user_id AND cp.status='active' AND c.status='active') ORDER BY created_at LIMIT 100`, [professionalId]);
    return rows.map(toCall);
  }

  async companyCall(callId: string, companyId: string): Promise<TestCall | null> {
    const [rows] = await this.pool.execute<CallRow[]>(`SELECT ${callColumns} FROM pickup_test_calls WHERE id=? AND company_id=?`, [callId, companyId]);
    return rows.length ? toCall(rows[0]) : null;
  }

  async expiredIds(): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT id FROM pickup_test_calls WHERE status='pending' AND expires_at<=UTC_TIMESTAMP(3) LIMIT 100");
    return rows.map(row => String(row.id));
  }

  async expire(callId: string): Promise<TestCall | null> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [updated] = await connection.execute<ResultSetHeader>("UPDATE pickup_test_calls SET status='expired',responded_at=UTC_TIMESTAMP(3) WHERE id=? AND status='pending' AND expires_at<=UTC_TIMESTAMP(3)", [callId]);
      if (!updated.affectedRows) { await connection.rollback(); return null; }
      await this.event(connection, callId, null, 'expired');
      const [rows] = await connection.execute<CallRow[]>(`SELECT ${callColumns} FROM pickup_test_calls WHERE id=?`, [callId]);
      await connection.commit();
      return toCall(rows[0]);
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  private async event(connection: PoolConnection, callId: string, actorId: string | null, status: TestCallStatus) {
    await connection.execute('INSERT INTO pickup_test_call_events (id,call_id,actor_user_id,status,occurred_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))', [randomUUID(), callId, actorId, status]);
  }
}
