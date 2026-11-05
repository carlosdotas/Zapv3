import { Server, type Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { IdentityStore } from '../../store.js';
import { sessionUser } from '../../security.js';
import type { PickupStore, Call } from './pickup-store.js';
export function registerRealtime(app: FastifyInstance, identity: IdentityStore, store: PickupStore, secret: string, origins: string[]) {
  const io=new Server(app.server,{cors:{origin:origins},maxHttpBufferSize:8192,allowRequest:(request,callback)=>callback(null,!request.headers.origin || origins.includes(request.headers.origin))});
  const authenticate=async(token:string) => {
    const id=sessionUser(token,secret); const user=id ? await identity.findById(id) : undefined;
    if(!user || user.status!=='active') throw new Error('UNAUTHENTICATED'); return user;
  };
  io.use(async(socket,next)=>{try { await identity.ready; if(identity.callsReady) await identity.callsReady; socket.data.token=socket.handshake.auth.token; const user=await authenticate(socket.data.token); socket.data.userId=user.id; next(); } catch { next(new Error('Sessão inválida ou serviço indisponível.')); }});
  const publish=async(call:Call) => {
    for(const socket of io.sockets.sockets.values()) {
      try {
        const user=await authenticate(socket.data.token);
        if(user.id===call.professionalId) { if(!user.roles.includes('professional') || !await store.canReceive(user.id,call.companyId)) continue; }
        else await store.company(user.id,call.companyId);
        socket.emit('pickup:updated',call);
      } catch { /* No delivery outside the current authorized scope. */ }
    }
  };
  const actions=(socket:Socket) => {
    let lastLocation=0; let operations=0;
    const on=(event:string,work:(userId:string,body:any)=>Promise<unknown>,professional=false)=>socket.on(event,async(body,ack)=>{
      if(typeof ack!=='function') return;
      if(operations>=4) { ack({error:'Aguarde a conclusão da solicitação.'}); return; }
      operations++;
      try { const user=await authenticate(socket.data.token); if(professional && !user.roles.includes('professional')) throw new Error('FORBIDDEN'); ack({data:await work(user.id,body)}); }
      catch(e) { const code=(e as Error).message; ack({error:code==='FORBIDDEN'?'Você não tem permissão para esta solicitação.':code==='UNAVAILABLE'?'Motorista fora de serviço ou indisponível.':code==='RATE_LIMIT'?'Aguarde 30 segundos antes de outra chamada.':code==='SETUP_INACTIVE'?'A configuração de teste está inativa. Solicite a revisão do acesso.':'Não foi possível concluir a solicitação.'}); }
      finally { operations--; }
    });
    on('pickup:sync',id=>store.sync(id));
    on('company:list',id=>store.companies(id));
    on('pickup:setup-self-test',id=>store.setupSelfTest(id));
    on('professional:list',(id,b)=>store.professionals(id,String(b?.companyId??'')));
    on('pickup:create',async(id,b)=>{ const call=await store.create(id,String(b?.companyId??''),String(b?.professionalId??'')); await publish(call); return call; });
    on('pickup:respond',async(id,b)=>{if(!['accepted','rejected'].includes(b?.answer)) throw new Error('INVALID'); const call=await store.respond(id,String(b.id),b.answer); await publish(call); return call;},true);
    on('duty:set',async(id,b)=>{if(typeof b?.onDuty!=='boolean') throw new Error('INVALID'); await store.duty(id,b.onDuty); return {onDuty:b.onDuty};},true);
    on('presence:heartbeat',async(id)=>{await store.heartbeat(id);return {ok:true};},true);
    on('location:update',async(id,b)=>{
      const {latitude,longitude,accuracy,recordedAt}=b??{};
      if(Date.now()-lastLocation<4000 || ![latitude,longitude,accuracy].every(Number.isFinite) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || accuracy<0 || accuracy>1000 || typeof recordedAt!=='string' || !Number.isFinite(Date.parse(recordedAt)) || Math.abs(Date.now()-Date.parse(recordedAt))>120000) throw new Error('INVALID');
      lastLocation=Date.now(); await store.location(id,latitude,longitude,accuracy,recordedAt); await store.heartbeat(id);return {ok:true};
    },true);
  };
  io.on('connection',actions);
  let expiring=false; let callsAvailable=!identity.callsReady;
  if(identity.callsReady) void identity.callsReady.then(()=>{callsAvailable=true;}).catch(()=>console.error('Falha ao inicializar as chamadas; confira as tabelas e permissões do MySQL.'));
  const timer=setInterval(async()=>{if(expiring||!callsAvailable)return;expiring=true;try{for(const call of await store.expire()) await publish(call);}catch{app.log.error('Falha ao expirar chamadas de teste.');}finally{expiring=false;}},1000); timer.unref();
  app.addHook('onClose',async()=>{clearInterval(timer); await new Promise<void>(resolve=>io.close(()=>resolve()));});
}
