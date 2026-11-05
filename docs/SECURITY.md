# Segurança

Senhas com Argon2id em produção, sessões expiráveis/revogáveis, RBAC por escopo, isolamento por empresa, rate limit, CORS explícito, HTTPS e logs sem segredos. GPS exige consentimento e uploads privados ficam fora da raiz pública.

O administrador inicial não deve ser gravado em código, migração ou seed versionado. Na implantação, configure `DEFAULT_ADMIN_NAME`, `DEFAULT_ADMIN_PHONE` e `DEFAULT_ADMIN_PASSWORD` no ambiente do serviço. O bootstrap cria um usuário temporário com `platform_admin`, `company_admin` e `professional`, permitindo validar os três portais; a senha deve ser substituída por uma credencial forte antes da produção.
