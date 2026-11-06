# Zap Encomendas V3

Sistema de gestão de encomendas com mapa, clientes, motoristas, transportadoras, despacho de coletas e financeiro. A aplicação web usa React e Vite; o servidor usa Express, Prisma e MySQL. O projeto Android está em [apk/README.md](apk/README.md).

Este checkout é destinado ao ambiente de teste `Zapv3`. Consulte a [configuração da Hostinger](docs/ambiente-teste-hostinger.md), incluindo a nova entrada `server.js`, porta e banco isolado.

## Ambiente de desenvolvimento

Ambiente usado nas verificações desta revisão: Node.js `24.22.1` e npm `11.9.0`. O projeto usa npm, com a versão de referência declarada em `packageManager` e as dependências fixadas em `package-lock.json`. Use `npm ci` para reproduzir a instalação.

1. Copie `.env.example` para `.env` na raiz e configure `DATABASE_URL` para o MySQL de desenvolvimento. Caracteres especiais na senha devem ser codificados na URL.
2. Instale as dependências:

   ```bash
   npm ci
   ```

   O `postinstall` gera o cliente Prisma; para gerá-lo novamente, use `npm run db:generate`. A dependência direta de esbuild sem uso foi removida, permitindo resolver as dependências de Vite sem `--legacy-peer-deps`.

3. Em um banco de desenvolvimento preparado para receber o esquema, execute `npm run db:push`. Esse comando sincroniza as tabelas com `backend/prisma/schema.prisma` e pode alterar o banco configurado.
4. Inicie a aplicação:

   ```bash
   npm run dev
   ```

O servidor atende a interface, a API e o WebSocket em `http://localhost:3000`. Para outra porta, use `npm run dev -- --port 3001`. O backend lê `--port`; a entrada de produção `server.js`, usada por `npm start`, também converte `PORT` fornecida pela hospedagem para esse argumento. `dotenv.config()` carrega `.env`; `.env.local` não é o arquivo carregado por essa chamada do backend.

### Configuração de integrações

- `GOOGLE_MAPS_API_KEY`: chave para as rotas de busca, geocodificação e direções no servidor.
- `IMAGE_SERVER_URL` e `IMAGE_SERVER_PASSWORD`: conexão com o servidor externo PHP de imagens. Há também armazenamento local de uploads no backend; algumas operações do painel de imagens exigem o servidor PHP configurado.
- `APP_BUILD_ID`: identificador retornado por `/api/app-version`; quando ausente, o servidor cria um identificador ao iniciar.
- `NODE_ENV=production` ou `npm start`: selecionam o modo de produção.

`GEMINI_API_KEY` permanece no exemplo por compatibilidade de configuração, mas não é consumida pelo código atual e não é necessária para iniciar a aplicação. Os mapas usam integrações HTTP próprias, sem dependência do SDK Gemini.

## Dados e importação

O cadastro de motoristas exige MySQL. Conta, CPF e veículo são salvos em `users`, com informações adicionais em `extra`. A tabela `drivers` é distinta e exige CNH; o formulário de cadastro não a preenche. Se o cadastro for salvo e o login falhar, o usuário deve tentar entrar pela tela de login.

Pedidos e transportadoras exigem MySQL para leitura e escrita. Se o banco estiver indisponível, a API retorna erro. Outros modelos ainda podem usar o armazenamento alternativo em `backend/localDb.ts`. Dados antigos desse armazenamento não são automaticamente transferidos ao MySQL; precisam de reconciliação antes de sua retirada.

Para importar um dump existente, use `npm run db:import -- /caminho/arquivo.sql`. O arquivo padrão é `backend/database/u195978639_dotas.sql`, que não é versionado. **A importação apaga os dados das tabelas importadas antes de inserir o dump**; utilize um banco destinado a essa operação e uma cópia de segurança. Ela não é necessária para simplesmente iniciar o servidor.

Outros comandos disponíveis: `db:import-users`, `db:link-clients`, `db:fix-receivables` e `db:studio`. Consulte a implementação de cada script antes de executá-lo sobre dados existentes.

## Verificação e build

```bash
npm run lint
npm test
npm run build
npm start
```

`lint` executa a checagem TypeScript. `test` usa o executor do Node com `tsx` e descobre automaticamente os testes de `backend/`, `src/` e `scripts/`. Isso inclui busca de locais e observações de pedidos, sem depender de uma lista manual de arquivos.

O teste de armazenamento local foi atualizado para usar um diretório temporário e dados próprios. A exigência de MySQL para pedidos e transportadoras continua protegida por `backend/persistentDatabase.test.ts`; os testes não precisam alterar o banco ou os dados locais reais.

`npm run build` executa `prebuild`, verificando primeiro a distribuição PHP de imagens e depois atualizando `public/app-version.json` e `apk/android/version.properties`, e depois gera `dist/` com o PWA. Para verificar somente a compilação sem atualizar os manifestos, use `npx --no-install vite build`. `npm start` serve o resultado junto à API; `npm run preview` serve somente a prévia Vite e não inicia o backend.

O projeto Android tem um `package.json` separado; seu script de compilação atual utiliza comandos do Windows. O lock da raiz corresponde à aplicação web e ao backend, sem modificar as dependências do projeto Android.

## Sincronização e organização

O WebSocket `/ws/tracking` transmite rastreamento e avisos de mudanças. Esses avisos levam a interface a buscar novamente os dados pela API. Há também consultas periódicas: atribuições a cada 10 segundos e atualização de pedidos/configurações em ciclos próprios. Os caminhos com e sem `/api` são preservados conforme os registradores de rotas.

O financeiro usa o cliente HTTP compartilhado, enviando o token de sessão e respeitando a URL de API configurada. Consultas e baixas têm timeout de 30 segundos e não são repetidas automaticamente. Uploads também respeitam essa URL e enviam o token no cabeçalho, mantendo o envio sem o timeout curto das consultas. O rastreamento web e a configuração da ponte Android usam o host e o protocolo da API para o WebSocket. O caminho do socket continua sendo `/ws/tracking` na raiz desse host, conforme o contrato nativo; um proxy que use prefixo para HTTP precisa expor também esse caminho.

- `src/components/`: telas e componentes por assunto.
- `src/context/`: coordenação, hooks por responsabilidade e projeções do estado da interface.
- `src/services/`, `src/utils/` e `src/types/`: comunicação, regras auxiliares e modelos da interface.
- `backend/`: registradores por domínio, persistência, transporte, despacho, notificações e integrações.
- `shared/`: regras e funções puras usadas pelo frontend e backend.
- `scripts/` e `public/`: geração e distribuição de artefatos web e Android.

A [auditoria estrutural](AUDITORIA_ESTRUTURAL_V3.md) registra o diagnóstico da revisão inicial e o roteiro de modularização. Ela deve ser lida como referência daquela revisão; as refatorações seguintes são incrementais.

As diferenças entre IDs de pedidos, pontos de operação e chaves de atribuição estão descritas em [Identificadores de pedidos](docs/identificadores-pedidos.md).

A geração e publicação dos arquivos PHP estão descritas em [Manutenção do servidor de imagens](docs/servidor-imagens.md).

A divisão dos adaptadores e seus caminhos de compatibilidade estão descritos em [Adaptadores da API](docs/adaptadores.md).

O [relatório final da refatoração](REFATORACAO_ESTRUTURAL_V3.md) reúne as etapas executadas, a arquitetura atual, as verificações e os limites da validação.
