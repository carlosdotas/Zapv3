# Operações

Executar `npm run typecheck`, `npm test` e `npm run build`. Para a publicação unificada na Hostinger, use a raiz `./`, o build `npm run build`, a saída `services/api/dist` e a entrada `server.js`; conecte os domínios ao mesmo Web App Node. O processo entrega `dotas.site` como home, `empresa.dotas.site`, `profissional.dotas.site` e `admin.dotas.site` como portais, e `api.dotas.site` para a API. Backup/restauração, observabilidade, push e GPS real permanecem checklist pré-produção.

Para habilitar o usuário administrativo de teste, informe `DEFAULT_ADMIN_NAME`, `DEFAULT_ADMIN_PHONE` e `DEFAULT_ADMIN_PASSWORD` nas variáveis do Web App da Hostinger. Não coloque a senha no repositório. Na implementação atual, o armazenamento de identidade é temporário em memória; a conta é recriada no reinício enquanto essas variáveis estiverem configuradas, até a persistência MySQL ser conectada ao módulo de identidade.
