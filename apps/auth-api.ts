import { login, registerProfessional } from '@zap/api-client';

type Credentials = { phone: string; password: string };

export function createAuthActions(baseUrl: string) {
  return {
    signIn: ({ phone, password }: Credentials) => login(baseUrl, phone, password),
    async signUp(input: Credentials & { name: string }) {
      await registerProfessional(baseUrl, input);
      try { return await login(baseUrl, input.phone, input.password); }
      catch { throw new Error('REGISTERED_LOGIN_FAILED'); }
    },
  };
}
