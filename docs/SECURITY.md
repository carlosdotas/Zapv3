# Segurança

Senhas com Argon2id em produção, sessões expiráveis/revogáveis, RBAC por escopo, isolamento por empresa, rate limit, CORS explícito, HTTPS e logs sem segredos. GPS exige consentimento e uploads privados ficam fora da raiz pública.

O administrador inicial não deve ser gravado em código, migração ou seed versionado. Configure `DEFAULT_ADMIN_NAME`, `DEFAULT_ADMIN_PHONE` e `DEFAULT_ADMIN_PASSWORD` no ambiente do serviço. O bootstrap cria uma única conta MySQL com papéis globais `platform_admin` e `professional`, usando hash scrypt, somente se não houver administrador e o telefone ainda não existir. O papel `company_admin` depende de vínculo a uma empresa; a autorização por empresa ainda precisa ser implementada. A senha temporária deve ser substituída por uma credencial forte antes da produção.
