# Refatoração estrutural — conclusão do roteiro

Data: 06/11/2026. Referência inicial: `86f87ac`. Este relatório descreve a implementação autorizada após a auditoria. `AUDITORIA_ESTRUTURAL_V3.md` permanece como registro histórico do diagnóstico inicial.

## Resultado

As etapas do roteiro foram executadas em mudanças incrementais: extração de responsabilidades, caminhos de compatibilidade, compartilhamento de código comprovadamente equivalente e validação dos fluxos relacionados. As alterações estão no workspace, sem publicação, push ou mudança de schema.

| Arquivo original | Linhas antes | Linhas atuais | Organização resultante |
| --- | ---: | ---: | --- |
| `src/services/apiAdapters.ts` | 1.583 | 12 | Entrada compatível de nove módulos em `src/services/adapters/`. |
| `backend/routes.ts` | 1.824 | 34 | Composição de 13 registradores de domínio em `backend/modules/`. |
| `backend/realtime.ts` | 902 | 64 | Composição de transporte, tracking, atribuições, repositório, timers e despacho. |
| `src/context/MapContext.tsx` | 3.536 | 1.711 | Coordenação com hooks por responsabilidade e contextos menores. |
| `src/components/map/FullscreenMap.tsx` | 3.390 | 2.198 | Renderização do mapa; marcadores e ícones de veículos em módulos próprios. |
| `src/components/place/PlaceDetailCard.tsx` | 5.641 | 3.198 | Apresentação; estado e ações em `usePlaceDetailCard.tsx`, auxiliares em `placeDetailHelpers.tsx`. |
| `src/components/order/NewOrderModal.tsx` | 4.439 | 2.050 | Apresentação; fluxo em `useNewOrderForm.tsx`, auxiliares em `newOrderHelpers.tsx`. |

As telas complexas continuam extensas. A separação estabelece fronteiras entre apresentação, estado e operações; não representa uma reescrita de todos os detalhes visuais em componentes pequenos. Evitou-se criar centenas de propriedades tipadas manualmente: os modelos das duas telas são inferidos dos hooks existentes.

## Etapas executadas

### 1. Leitor de JSON independente

`backend/http/parseRawJsonBody.ts` recebeu a implementação original. Notificações e tempo real passaram a importá-la diretamente; `routes.ts` mantém a reexportação antiga. Foram caracterizados corpos Buffer, JSON inválido, valores primitivos, arrays e objetos já processados. O ciclo entre rotas e notificações foi eliminado.

### 2. Tipos e cálculo geográfico

`PastOrderRecord` foi movido para `src/types/order.ts`, preservando a reexportação de `NewOrderModal`. Histórico e seleção de clientes usam imports de tipo diretos. O card de detalhes reutiliza o cálculo geográfico existente. A comparação incluiu o limite operacional de 1.000 metros.

### 3. Testes, dependências e execução reproduzível

Os testes omitidos de busca e observações passaram a fazer parte da execução principal. Ao final, `npm test` passou a descobrir automaticamente testes de `backend/`, `src/` e `scripts/`, usando o executor do Node com `tsx`.

Foram removidas as dependências diretas sem consumidores identificados: `@google/genai`, `motion` e esbuild. Esbuild continua disponível como dependência transitiva na versão compatível com Vite; deixou de existir a declaração direta incompatível. Foi gerado `package-lock.json` a partir de uma resolução limpa e declarada a referência `npm@11.9.0` em `packageManager`.

O README agora descreve `.env`, MySQL, porta por `--port`, instalação com `npm ci`, build, importação e sincronização reais. As variáveis antigas do exemplo foram documentadas sem remoção silenciosa de configuração.

### 4. Transporte HTTP e destinos

O financeiro passou a usar `httpClient.request`, com token de sessão, URL configurável, timeout de 30 segundos e sem repetição automática de baixas. Filtros, totais, IDs e formas de pagamento foram preservados. A exigência de sucesso HTTP é uma opção usada pelo financeiro; o comportamento padrão dos consumidores anteriores permanece disponível.

`getApiUrl` e `getApiWebSocketUrl` centralizam a resolução de destinos. Uploads mantêm seu tratamento específico e não recebem o timeout curto das consultas. Rastreamento web, fallback HTTP e configuração Android passam a usar o destino da API. O socket mantém `/ws/tracking` na raiz do host, conforme o contrato nativo.

### 5. Fachada de pedidos e identificadores

O bloqueio de salvamento por motorista ficou em `orderService`, que protege também chamadas diretas. `api.savePedido` delega ao serviço. A normalização equivalente do transporte foi compartilhada em `cleanOrderRequestId`; as diferenças de caixa, espaços, presença, códigos e chaves de operação foram mantidas e documentadas.

As quatro operações legadas da fachada mantêm suas duas passagens de normalização, pois a transformação não é idempotente em todas as entradas. Detalhes e exemplos estão em `docs/identificadores-pedidos.md`.

### 6. PHP com fonte única de manutenção

`backend/images.php` é a origem da implementação e `public/images.php` sua distribuição completa. `scripts/sync-image-server.mjs` preserva integralmente `$CONFIG` do destino; não copia senhas da origem nem move uploads. O PHP distribuído continua instalável sozinho.

Foram adicionados `images:sync`, `images:check` e `images:test`. O `prebuild` verifica a consistência antes de atualizar manifestos. A execução PHP/GD foi validada em contêiner temporário. Procedimentos em `docs/servidor-imagens.md`.

### 7. Adaptadores por responsabilidade

Fotos, locais, clientes, motoristas, datas, coordenadas, atribuições, metadados e conversões de pedidos têm módulos próprios. `imageServerConfig.ts` concentra o estado de configuração de imagens; as exportações anteriores de `api.ts` continuam disponíveis.

A comparação antes/depois preservou resultados em 100 casos de fotos, 240 conversões de pedidos e 40 casos auxiliares. As três conversões de pedidos continuam distintas. Organização em `docs/adaptadores.md`.

### 8. Marcadores e cabeçalho de configurações

`mapMarkers.ts` e `vehicleIcons.ts` receberam os geradores antes definidos em `FullscreenMap`. Formulários e card de detalhes importam os geradores diretamente; as exportações anteriores do mapa foram preservadas.

`SettingsPageHeader` substitui a moldura repetida em seis páginas de configurações. Formulários, ações de salvar, descrições e retorno continuam pertencendo às páginas.

### 9. API dividida por domínio

`backend/modules/` contém autenticação, usuários, pedidos, ganhos, rastreamento público, locais, cidades, configurações, empresas, preços, motoristas, marcadores e financeiro. O leitor de JSON, os tipos de dependência e o registrador HTTP ficam em `backend/http/`. Os auxiliares reutilizados ficam em `backend/modules/support/`.

A comparação do registro antes/depois manteve os 56 registros originais na mesma ordem, incluindo aliases com e sem `/api`, métodos e o alias de salvamento legado. Os handlers e suas respostas foram preservados; a extração não introduz uma nova camada de autorização ou um protocolo diferente.

### 10. Sincronização e ciclo de vida

`RealtimeAssignmentService` inicia consultas por um dono explícito, compartilha a leitura em andamento e permite solicitar uma leitura posterior a uma invalidação. Respostas de uma geração anterior são descartadas após logout. A última liberação encerra o timer; a liberação é idempotente.

O ciclo de 30 segundos do contexto deixou de repetir a consulta periódica de atribuições. Eventos de atualização ainda solicitam leitura recente. O serviço de atribuições mantém seu ciclo de 10 segundos.

`useOperationalServices` coordena início e encerramento conforme a sessão. Os singletons de empresas e tracking deixaram de abrir conexões no import. O tracking mantém caminhos de compatibilidade para instâncias explícitas e ganhou limpeza de listeners. Eventos tardios de um socket encerrado não substituem a conexão nova. A verificação inicial de MySQL ocorre explicitamente na entrada do servidor; operações de persistência continuam verificando disponibilidade.

### 11. Contexto e telas

`src/context/hooks/` separa sincronização, ações de clientes, edição, criação, atribuição, aceite, conclusão de pedidos, aquisição de GPS, navegação, interface e relógio do motorista.

`mapStoreTypes.ts` concentra tipos, `mapDefaults.ts` concentra padrões e `mapWorkflow.ts` mantém a identidade temporária compartilhada dos pedidos. `mapStoreContext.ts` oferece projeções de interface, sessão, dados e navegação. Consumidores atendidos por uma projeção foram migrados; `useMapStore` continua oferecendo os mesmos 144 campos para compatibilidade.

As telas de novo pedido e detalhes passaram a separar ações e estado da apresentação. Seus hooks mantêm os corpos dos fluxos existentes, incluindo guardas, fotos, navegação, chamadas e regras de preço. Os testes no navegador abriram ambas as telas e verificaram propagação das projeções.

### 12. Código comum, persistência e despacho

`shared/` contém regras puras de propriedade da coleta, cores permanentes e cálculos geográficos. O backend deixou de importar arquivos de `src/`. Os caminhos antigos do frontend mantêm reexportações ou os adaptadores necessários. Variações geográficas com unidades, arredondamento ou ordem de operações diferentes não foram fundidas indiscriminadamente.

`backend/persistence/modelPolicy.ts` explicita a regra já existente: pedidos e transportadoras exigem MySQL. O fallback e suas garantias transacionais não foram trocados por uma implementação diferente. `LocalDbStore` aceita um diretório explícito para permitir testes isolados, mantendo os caminhos padrão da aplicação.

O tempo real foi separado entre transporte de sockets, estado de tracking, rotas, armazenamento de atribuições, repositório e timers. `backend/dispatch/urgentOffers.ts` mantém seleção, tentativas, expiração e cancelamento de ofertas. `registerRealtime` compõe esses módulos e devolve limpeza idempotente. O encerramento cancela timers e invalida despacho pendente, preservando prazo, mensagens e contratos de aceite.

### 13. Legado e limpeza final

Após nova verificação de referências, foram removidos três componentes desconectados: `MapControls`, `UserProfileMenu` e `OrderScheduleResponsibleStep`. Nenhum era importado por um fluxo ativo. Imports excedentes das extrações foram simplificados.

O teste antigo de fallback não foi simplesmente desativado. Ele foi substituído por um teste de `LocalDbStore` com diretório temporário, usuário e sessão próprios, incluindo escrita e releitura. `persistentDatabase.test.ts` continua exigindo erro para pedidos e transportadoras quando MySQL está indisponível. A suíte completa passou sem a falha preexistente.

Dados legados referenciados, fotos, caches, APKs de distribuição e exportações de funções com uso externo incerto foram preservados. Ausência de consumidor de produção não foi usada como justificativa para eliminar todos os utilitários públicos ou funções exercitadas por testes.

## Verificações finais

| Verificação | Resultado |
| --- | --- |
| Instalação limpa | `npm ci --ignore-scripts --no-audit --no-fund`, seguida de `npm run db:generate`, concluída sem `--legacy-peer-deps`. |
| Suíte completa | `npm test`: 47 arquivos executados, 47 aprovados, nenhuma falha ou arquivo ignorado. |
| Tipagem | `npm run lint` aprovado. |
| PHP distribuído | `images:check` e quatro testes do gerador aprovados. |
| Build | Compilação Vite/PWA aprovada, com geração do service worker. A compilação foi executada diretamente para preservar os manifestos de versão existentes. |
| PHP em execução | Origem e distribuição aprovadas em PHP 8.3/GD: autenticação, upload, deduplicação, variantes, cache/304, painel, logout e exclusão. |
| Navegador | Chromium com API simulada: financeiro, calendário, configurações, card e formulário sem erros de JavaScript. |
| Renderizações | Consumidor de interface permaneceu em 1 renderização durante alterações separadas de dados e navegação; os consumidores afetados atualizaram normalmente. |
| Contratos | Mesmos 56 registros da API e mesmos 144 campos do contexto. |
| Imports | Nenhum ciclo estático de execução detectado entre os módulos de produção inspecionados; imports exclusivamente de tipo foram distinguidos. |
| Express real | Inicialização em produção com MySQL de teste indisponível: página e versão responderam 200; atribuições anônimas retornaram conjunto vazio e financeiro sem sessão respondeu 401, conforme os contratos anteriores. |
| Integridade do workspace | Schema, armazenamento local real e manifestos de versão preservados; arquivos e processos temporários de verificação removidos. |

## Limites e continuidade

Não houve publicação nem validação contra o banco ou o servidor PHP de produção. O Android foi verificado pela ponte simulada e pelos contratos existentes; permissões do aparelho, bateria, GPS em segundo plano e entrega de notificações precisam de validação em dispositivo. O APK não foi recompilado nesta refatoração web/backend.

As apresentações mais extensas e os hooks dos formulários ainda podem ser divididos em seções menores conforme mudanças futuras exigirem. As bases agora estão separadas por responsabilidade e possuem caminhos de compatibilidade. Não foi necessária uma reescrita de telas, nova biblioteca de estado ou mudança de modelo de dados.
