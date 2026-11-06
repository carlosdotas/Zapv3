# Ambiente de teste Zapv3 na Hostinger

Este repositório recebe o Zap Encomendas V3 refatorado. O projeto anterior fica preservado na branch `backup/projeto-anterior-20261106`. A substituição do código não migra nem apaga o banco da hospedagem.

## Configuração do Web App Node

Configure o repositório `carlosdotas/Zapv3`, branch `main`, com:

| Campo | Valor |
| --- | --- |
| Node.js | 24 LTS; mínimo 22.12 |
| Diretório raiz do projeto | `./` |
| Instalação | `npm ci` |
| Build | `npm run build` |
| Diretório da aplicação/saída | `./`, contendo `server.js`, `backend/`, `shared/`, `dist/` e dependências |
| Entrada JavaScript | `server.js` |
| Comando de inicialização, quando disponível | `npm start` |

O antigo caminho `services/api/dist/server.js` pertence ao projeto substituído e deixa de existir. `dist/` contém somente a interface; executar apenas uma hospedagem estática não inicia a API. A entrada `server.js` carrega o backend TypeScript por `tsx` e respeita `PORT` fornecida pela hospedagem ou `--port` explícita. Sem configuração, usa a porta 3000.

O proxy precisa encaminhar HTTP e WebSocket `/ws/tracking` ao mesmo processo. A aplicação utiliza a origem atual para a API quando `VITE_API_BASE_URL` e `VITE_API_URL` não estão definidas. Remova valores antigos dessas variáveis se apontarem para outro ambiente.

## Banco e integrações

Configure `NODE_ENV=production` e uma `DATABASE_URL` MySQL/MariaDB exclusiva de teste. O schema deste sistema é diferente do projeto anterior; não execute `db:push` no banco anterior sem revisão e cópia de segurança. `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DEFAULT_ADMIN_*` e `SESSION_SECRET` do projeto anterior não substituem a configuração deste sistema.

Em um banco novo e autorizado para este sistema, o provisionamento é `npm run db:push`. Esse comando altera tabelas e não é executado automaticamente pelo build ou pela inicialização. Credenciais devem ficar no painel da Hostinger, fora do Git. O cadastro de usuários pode ser realizado pela interface; o bootstrap de administrador do projeto anterior não se aplica.

`GOOGLE_MAPS_API_KEY` habilita as integrações Google do servidor. `IMAGE_SERVER_URL` e `IMAGE_SERVER_PASSWORD` são opcionais para a integração PHP e devem apontar para um servidor de imagens de teste. PHP não é executado pelo processo Node. Não conecte o ambiente de teste ao banco ou ao servidor de imagens de produção por conveniência.

Dados de `backend/database/`, uploads e arquivos locais de ferramentas da origem não foram copiados. O fallback inicializa somente seus padrões quando não há arquivos; pedidos e transportadoras continuam exigindo MySQL. Preserve os arquivos gerados em execução e configure a persistência/backup antes de depender desses dados entre deploys.

Os APKs e suas fontes foram preservados como artefatos existentes. Eles não foram recompilados nem reconfigurados para o endereço deste teste; use inicialmente o navegador/PWA. Publicar este repositório não atualiza automaticamente o aplicativo instalado.

## Verificação após publicar

1. Confirme o commit publicado no painel e abra a URL HTTPS do teste.
2. Confira `/api/app-version`, cadastro/login e abertura do mapa.
3. Com MySQL preparado, crie e consulte um pedido exclusivamente de teste.
4. Confira a conexão `/ws/tracking` e a atualização entre duas sessões.
5. Verifique reinício do processo, persistência e logs antes de usar dados relevantes.

Os comandos locais são `npm run lint`, `npm test`, `npm run build` e `npm start`. A aprovação local não comprova que a Hostinger recebeu o deploy. É necessário validar a URL hospedada depois da publicação.
