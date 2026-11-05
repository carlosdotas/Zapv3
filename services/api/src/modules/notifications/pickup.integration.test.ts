import { afterAll, beforeAll, expect, test } from 'vitest';
import mysql, { type Pool } from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import Fastify from 'fastify';
import { io, type Socket } from 'socket.io-client';
import { PickupStore } from './pickup-store.js';
import { registerRealtime } from './realtime.js';
import { MemoryStore } from '../../store.js';
import { sessionToken } from '../../security.js';
const enabled=Boolean(process.env.ZAP_TEST_DATABASE_URL);
let pool:Pool;let store:PickupStore;let admin:Pool;const database='zap_test_'+Date.now();
let app:ReturnType<typeof Fastify>;let base:string;const sockets:Socket[]=[];
const secret='integration-test-secret';
const identity=new MemoryStore();
beforeAll(async()=>{
 if(!enabled)return;
 const url=new URL(process.env.ZAP_TEST_DATABASE_URL!);if(!url.pathname.startsWith('/zap_test'))throw new Error('Use um banco de teste zap_test.');
 admin=mysql.createPool(url.toString());await admin.query('CREATE DATABASE `'+database+'`');url.pathname='/'+database;pool=mysql.createPool(url.toString());store=new PickupStore(pool);
 for(const file of ['002_identity_bootstrap.sql','003_pickup_calls.sql'])for(const sql of (await readFile(`../../database/migrations/${file}`,'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await pool.query(sql);
 await pool.query(`INSERT INTO roles (id,code) VALUES ('r-company','company_admin'),('r-professional','professional')`);
 for(const id of ['company-user','other-company-user','pro','outsider']) {
  await pool.execute('INSERT INTO users (id,name,phone_e164,password_hash) VALUES (?,?,?,?)',[id,id,id,'unused']);
  identity.users.set(id,{id,name:id,phone:id,passwordHash:'unused',roles:id.includes('company')?['company_admin']:['professional'],companyIds:[],status:'active'});
 }
 await pool.query(`INSERT INTO companies (id,name) VALUES ('company','Empresa'),('other','Outra empresa')`);
 await pool.query(`INSERT INTO company_members (id,company_id,user_id,role_id) VALUES ('member','company','company-user','r-company'),('other-member','other','other-company-user','r-company')`);
 await pool.query(`INSERT INTO professional_profiles (user_id) VALUES ('pro'),('outsider')`);
 await pool.query(`INSERT INTO company_professionals (company_id,professional_user_id) VALUES ('company','pro')`);
 await store.duty('pro',true);
 app=Fastify();registerRealtime(app,identity,store,secret,[]);base=await app.listen({port:0,host:'127.0.0.1'});
},30000);
afterAll(async()=>{for(const s of sockets)s.disconnect();if(app)await app.close();if(pool)await pool.end();if(admin){await admin.query('DROP DATABASE `'+database+'`');await admin.end();}});
function connect(user:string,token=sessionToken(user,secret)) {const socket=io(base,{auth:{token},reconnection:false});sockets.push(socket);return new Promise<Socket>((resolve,reject)=>{socket.once('connect',()=>resolve(socket));socket.once('connect_error',reject);});}
function emit(s:Socket,event:string,body:unknown={}) {return new Promise<any>((resolve,reject)=>s.timeout(4000).emit(event,body,(err:any,r:any)=>err?reject(err):resolve(r)));}
test.skipIf(!enabled)('SQL: tenant isolation, target validation, atomic response, history and server expiration',async()=>{
 await expect(store.create('other-company-user','company','pro')).rejects.toThrow('FORBIDDEN');
 await expect(store.create('company-user','company','outsider')).rejects.toThrow('UNAVAILABLE');
 const call=await store.create('company-user','company','pro');
 expect(Date.parse(call.expiresAt)-Date.now()).toBeGreaterThan(28000);
 await expect(store.respond('outsider',call.id,'accepted')).rejects.toThrow('FORBIDDEN');
 const results=await Promise.all([store.respond('pro',call.id,'accepted'),store.respond('pro',call.id,'rejected')]);
 expect(new Set(results.map(r=>r.status)).size).toBe(1);
 const [history]=await pool.query<any[]>('SELECT * FROM pickup_test_events WHERE call_id=?',[call.id]);expect(history).toHaveLength(2);
 expect(await store.sync('other-company-user')).toHaveLength(0);
 await pool.execute('UPDATE pickup_test_calls SET created_at=UTC_TIMESTAMP(3)-INTERVAL 1 MINUTE WHERE id=?',[call.id]);
 const expired=await store.create('company-user','company','pro');await pool.execute('UPDATE pickup_test_calls SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',[expired.id]);
 expect((await store.respond('pro',expired.id,'accepted')).status).toBe('expired');
 await pool.query('UPDATE pickup_test_calls SET created_at=UTC_TIMESTAMP(3)-INTERVAL 1 MINUTE');
 const abandoned=await store.create('company-user','company','pro');await pool.execute('UPDATE pickup_test_calls SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',[abandoned.id]);
 expect((await store.expire()).some(c=>c.id===abandoned.id&&c.status==='expired')).toBe(true);
 expect(await store.expire()).toHaveLength(0);
});
test.skipIf(!enabled)('Socket.IO: authenticated delivery, reconnect recovery, tenant rejection and GPS consent',async()=>{
 await expect(connect('pro','invalid')).rejects.toThrow();
 const professional=await connect('pro');const company=await connect('company-user');const other=await connect('other-company-user');
 await pool.query('UPDATE pickup_test_calls SET created_at=UTC_TIMESTAMP(3)-INTERVAL 1 MINUTE');
 const delivered=new Promise<any>(resolve=>professional.once('pickup:updated',resolve));
 const response=await emit(company,'pickup:create',{companyId:'company',professionalId:'pro'});expect(response.error).toBeUndefined();expect((await delivered).id).toBe(response.data.id);
 expect((await emit(other,'professional:list',{companyId:'company'})).error).toBeTruthy();
 professional.disconnect();const reconnect=await connect('pro');expect((await emit(reconnect,'pickup:sync')).data.some((c:any)=>c.id===response.data.id)).toBe(true);
 expect((await emit(reconnect,'location:update',{latitude:200,longitude:0,accuracy:5,recordedAt:new Date().toISOString()})).error).toBeTruthy();
 expect((await emit(reconnect,'location:update',{latitude:-16.6,longitude:-49.2,accuracy:5,recordedAt:new Date().toISOString()})).data.ok).toBe(true);
 await emit(reconnect,'duty:set',{onDuty:false});
 await store.location('pro',0,0,5,new Date(Date.now()+1000).toISOString());
 const [locations]=await pool.query<any[]>('SELECT latitude FROM professional_locations WHERE professional_user_id=?',['pro']);expect(Number(locations[0].latitude)).toBe(-16.6);
});
