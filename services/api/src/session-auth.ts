import type { IdentityStore } from './store.js';
import { parseSession } from './security.js';

export async function authenticateSession(store: IdentityStore, token: string | undefined, secret: string) {
  const session=parseSession(token,secret);
  if(!session || !await store.sessionValid(session.sessionId,session.userId,session.legacy))return undefined;
  const user=await store.findById(session.userId);
  if(!user || user.status!=='active')return undefined;
  return {user,session};
}
