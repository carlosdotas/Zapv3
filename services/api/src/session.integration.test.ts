import { afterAll, beforeAll, expect, test } from 'vitest';
import mysql, { type Pool } from 'mysql2/promise';
import { io, type Socket } from 'socket.io-client';
import { buildApp } from './app.js';
import { MysqlStore } from './mysql-store.js';
import { parseSession, sessionToken } from './security.js';
import { randomUUID } from 'node:crypto';

const enabled=Boolean(process.env.ZAP_TEST_DATABASE_URL);
const database=`zap_test_session_${Date.now()}`;
const keys=['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','DEFAULT_ADMIN_PHONE','DEFAULT_ADMIN_PASSWORD'] as const;
const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
let admin:Pool; let store:MysqlStore; let app:ReturnType<typeof buildApp>; let base:string; let socket:Socket|undefined;

beforeAll(async()=>{
  if(!enabled)return;
  const url=new URL(process.env.ZAP_TEST_DATABASE_URL!);
  if(!url.pathname.startsWith('/zap_test'))throw new Error('Use um banco de teste zap_test.');
  admin=mysql.createPool(url.toString());await admin.query('CREATE DATABASE `'+database+'`');
  process.env.DB_HOST=url.hostname;process.env.DB_PORT=url.port || '3306';process.env.DB_USER=decodeURIComponent(url.username);process.env.DB_PASSWORD=decodeURIComponent(url.password);process.env.DB_NAME=database;
  process.env.DEFAULT_ADMIN_PHONE='+5562999999999';process.env.DEFAULT_ADMIN_PASSWORD='SenhaTeste123';
  store=new MysqlStore();await store.ready;await store.callsReady;await store.linksReady;app=buildApp(store);base=await app.listen({host:'127.0.0.1',port:0});
},30000);
afterAll(async()=>{
  socket?.disconnect();if(app)await app.close();else if(store)await store.close();
  if(admin){await admin.query('DROP DATABASE `'+database+'`');await admin.end();}
  for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});

test.skipIf(!enabled)('sessão persiste no SQL, pode ser renovada e logout revoga acesso e serviço',async()=>{
  const credentials={phone:'+5562999999999',password:'SenhaTeste123'};
  const first=(await app.inject({method:'POST',url:'/api/v1/auth/login',payload:credentials})).json().token as string;
  const second=(await app.inject({method:'POST',url:'/api/v1/auth/login',payload:credentials})).json().token as string;
  const session=parseSession(first,process.env.SESSION_SECRET ?? 'development-only-change-me-32-characters')!;
  expect(session.legacy).toBe(false);
  expect(Number(first.split('.')[1])).toBeGreaterThan(Date.now()+365*86400000);
  const secret=process.env.SESSION_SECRET ?? 'development-only-change-me-32-characters';
  const unregistered=sessionToken(session.userId,secret,randomUUID(),true);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${unregistered}`}})).statusCode).toBe(401);
  const legacy=sessionToken(session.userId,secret);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${legacy}`}})).statusCode).toBe(200);
  expect((await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:{authorization:`Bearer ${legacy}`},payload:{portal:'company'}})).statusCode).toBe(200);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${legacy}`}})).statusCode).toBe(401);
  const restartedStore=new MysqlStore();await restartedStore.ready;await restartedStore.callsReady;await restartedStore.linksReady;const restartedApp=buildApp(restartedStore);
  expect((await restartedApp.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${first}`}})).statusCode).toBe(200);
  await restartedApp.close();
  await store.pool.execute('UPDATE auth_sessions SET expires_at=UTC_TIMESTAMP()+INTERVAL 300 DAY WHERE id=?',[session.sessionId]);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${first}`}})).statusCode).toBe(200);
  const [renewed]=await store.pool.execute<any[]>('SELECT expires_at>UTC_TIMESTAMP()+INTERVAL 360 DAY AS renewed FROM auth_sessions WHERE id=?',[session.sessionId]);expect(renewed[0].renewed).toBe(1);
  await store.pool.execute('INSERT INTO professional_duty (user_id,on_duty,last_seen_at) VALUES (?,1,UTC_TIMESTAMP(3))',[session.userId]);
  socket=io(base,{auth:{token:first},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  const response=await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:{authorization:`Bearer ${first}`},payload:{portal:'professional'}});expect(response.statusCode).toBe(200);
  const [duty]=await store.pool.execute<any[]>('SELECT on_duty FROM professional_duty WHERE user_id=?',[session.userId]);expect(duty[0].on_duty).toBe(0);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${first}`}})).statusCode).toBe(401);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${second}`}})).statusCode).toBe(200);
  const result=await new Promise<any>((resolve,reject)=>socket!.timeout(4000).emit('pickup:sync',{},(error:Error|null,value:any)=>error?reject(error):resolve(value)));
  expect(result.error).toBeTruthy();
  const secondSession=parseSession(second,process.env.SESSION_SECRET ?? 'development-only-change-me-32-characters')!;
  await store.pool.execute('UPDATE auth_sessions SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=?',[secondSession.sessionId]);
  expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${second}`}})).statusCode).toBe(401);
},20000);

test.skipIf(!enabled)('cadastro do motorista persiste no MySQL e permite login depois de reiniciar o acesso',async()=>{
  const input={name:'Motorista de teste',phone:'+5562988887777',password:'SenhaTeste123'};
  const registered=await app.inject({method:'POST',url:'/api/v1/auth/register-professional',payload:input});
  expect(registered.statusCode).toBe(201);
  const userId=registered.json().user.id;
  const [profiles]=await store.pool.execute<any[]>('SELECT u.phone_e164 FROM users u JOIN professional_profiles p ON p.user_id=u.id WHERE u.id=?',[userId]);
  expect(profiles).toHaveLength(1);expect(profiles[0].phone_e164).toBe(input.phone);
  const restartedStore=new MysqlStore();await restartedStore.ready;await restartedStore.callsReady;await restartedStore.linksReady;
  const restartedApp=buildApp(restartedStore);
  expect((await restartedApp.inject({method:'POST',url:'/api/v1/auth/login',payload:{phone:input.phone,password:input.password}})).statusCode).toBe(200);
  await restartedApp.close();
},20000);
