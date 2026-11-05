type SessionUser = { id: string; name: string; roles: string[] };
export type LoginResult = { token: string; user: SessionUser };
export async function login(baseUrl: string, phone: string, password: string): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ phone, password }) });
  } catch {
    throw new Error('LOGIN_CONNECTION_ERROR');
  }
  if (!response.ok) throw new Error(response.status === 401 ? 'LOGIN_FAILED' : 'LOGIN_SERVER_ERROR');
  try { return await response.json() as LoginResult; }
  catch { throw new Error('LOGIN_SERVER_ERROR'); }
}
export async function registerProfessional(baseUrl: string, input: { name: string; phone: string; password: string }): Promise<{ user: SessionUser }> { const response = await fetch(`${baseUrl}/api/v1/auth/register-professional`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(input) }); if (!response.ok) throw new Error(response.status === 409 ? 'PHONE_EXISTS' : 'REGISTER_FAILED'); return response.json() as Promise<{ user: SessionUser }>; }
export async function getMe(baseUrl: string, token: string): Promise<{user: SessionUser}> {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  let response: Response;
  try { response=await fetch(`${baseUrl}/api/v1/me`,{headers:{authorization:`Bearer ${token}`},signal:controller.signal}); }
  catch { throw new Error('SESSION_UNAVAILABLE'); } finally { clearTimeout(timeout); }
  if(response.status===401 || response.status===403)throw new Error('SESSION_INVALID');
  if(!response.ok)throw new Error('SESSION_UNAVAILABLE');
  try { return await response.json() as {user:SessionUser}; } catch { throw new Error('SESSION_UNAVAILABLE'); }
}
export async function logoutSession(baseUrl: string, token: string, portal: 'admin'|'company'|'professional'): Promise<void> {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(`${baseUrl}/api/v1/auth/logout`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({portal}),signal:controller.signal});
    if(!response.ok && response.status!==401)throw new Error('LOGOUT_UNAVAILABLE');
  } catch { throw new Error('LOGOUT_UNAVAILABLE'); } finally { clearTimeout(timeout); }
}
