# Mapa da arquitetura atual

Este mapa descreve as fronteiras existentes após a refatoração estrutural. Leia somente as áreas relacionadas à mudança em andamento; os nomes são ponto de entrada, não inventário exaustivo de funções.

## Aplicação web

- `src/App.tsx` e `src/main.tsx`: montagem da aplicação e providers.
- `src/components/`: interface, agrupada por assunto (`order`, `place`, `map`, `driver`, `customer`, `financial`, entre outros).
- `src/context/MapContext.tsx`: coordena estado e fluxos do mapa. `src/context/hooks/` concentra operações separadas. `mapStoreContext.ts` define a superfície contextual e suas projeções.
- `src/services/`: API, HTTP, estado operacional e integrações do cliente. `src/services/adapters/` normaliza representações recebidas/enviadas.
- `src/utils/`: regras auxiliares do cliente. Manter funções puras aqui quando não dependem de React ou infraestrutura.
- `src/types/`: tipos usados pela aplicação.

## Servidor

- `server.js`: entrada de produção da hospedagem, inicia o backend TypeScript e adapta `PORT` ao argumento aceito pelo servidor.
- `backend/index.ts`: cria Express, HTTP e WebSocket; inicia dependências do servidor.
- `backend/routes.ts`: registra, na ordem declarada, os módulos HTTP em `backend/modules/`.
- `backend/http/`: registro de handlers, tipos de dependência e leitura de corpo.
- `backend/modules/`: endpoints agrupados por domínio; `support/` guarda funções compartilhadas pelos handlers.
- `backend/realtime.ts`: composição de sockets, rotas, armazenamento, timers e despacho. Implementações ficam em `backend/realtime/` e `backend/dispatch/`.
- `backend/db.ts`, `backend/persistence/` e `backend/localDb.ts`: acesso e regras de persistência existentes. Pedidos e transportadoras exigem MySQL conforme a política já aplicada.
- `backend/images.php`: origem de manutenção da implementação PHP. `public/images.php` é a distribuição gerada e conferida pelo script em `scripts/`.

## Fronteira compartilhada e artefatos

- `shared/`: regras puras usadas pelos lados web e servidor; não importa de `src/` ou `backend/`.
- `public/`: arquivos web distribuídos, incluindo interface compilada no build e artefatos públicos.
- `apk/`: projeto Android/Capacitor com ciclo próprio, não incluído no processo de inicialização do backend.
- `scripts/`: checagem do PHP, atualização de manifesto e operações auxiliares.
- `docs/`: operação e manutenção. `AUDITORIA_ESTRUTURAL_V3.md` registra a linha de base; `REFATORACAO_ESTRUTURAL_V3.md` registra mudanças e validações daquele ciclo.

## Fluxo de dependência desejado

`components → context/hooks → services → backend/modules → persistência`.

`shared/` pode ser importado pelo cliente e servidor, mas não conhece detalhes de nenhum dos dois. Handlers chamam serviços e persistência conforme a organização existente; extrações não devem forçar camadas novas onde ainda não há necessidade.

Preserve entradas públicas e aliases existentes ao reorganizar módulos. Leia as importações reais para identificar o sentido de dependência de cada área; este diagrama não autoriza a movimentação automática de arquivos.
