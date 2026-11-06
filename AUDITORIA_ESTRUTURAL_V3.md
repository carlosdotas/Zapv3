# Auditoria estrutural — Zap Encomendas V3

Data: 06/11/2026. Base analisada: `86f87ac` (`main`). Escopo: repositório completo; somente auditoria estática e criação deste documento.

## 1. Visão geral da arquitetura atual

### Método e limites

Foram inventariados 321 arquivos fora de `.git`, incluindo 242 arquivos textuais nas extensões de código, configuração e documentação examinadas. A inspeção combinou contagem de linhas, comparação de conteúdo por hash, comparação dos PHPs, grafo de imports relativos, busca de símbolos e leitura dos pontos de entrada e fluxos. Componentes, serviços, servidor, banco, scripts, arquivos públicos, projeto Android e configurações foram abrangidos. Não houve execução da aplicação, instalação, build, testes ou acesso ao banco. Portanto, ausência de referência significa ausência no código versionado inspecionado; desempenho e uso externo precisam de validação posterior.

Não foram encontrados arquivos `AGENTS.md` no repositório. As contagens de linhas e referências são desta revisão. O grafo de imports é estático: inclui imports que o compilador pode apagar por serem usados apenas como tipos; não representa sozinho o grafo de execução.

### Módulos e dependências

| Área | Arquivos e responsabilidades atuais |
| --- | --- |
| Inicialização web | `index.html` → `src/main.tsx` → `src/App.tsx` → `MapProvider` e `MainAppContent`. O caminho `/rastreio/:token` abre `PublicOrderTrackingPage` separadamente. |
| Interface | `src/components/` já agrupa telas por assunto: pedidos, clientes, motoristas, mapa, financeiro, autenticação e administração. Alguns componentes também consultam serviços e implementam regras. |
| Estado central | `src/context/MapContext.tsx`: autenticação, modais, filtros, GPS, rotas, clientes, pedidos, atribuições, sincronização e persistência local. Há 34 módulos importadores diretos. |
| Serviços web | `httpClient.ts` transporta requisições; `api.ts` é uma fachada parcialmente delegada a `orderService`, `userService` e `placeService`. Outros serviços mantêm seus próprios caches, assinaturas e consultas periódicas. |
| Adaptação e regras | `apiAdapters.ts` converte contratos para modelos da interface e também trata fotos, datas, endereços conhecidos e atribuições. `apiTypes.ts`, `src/types/`, `src/utils/` e `src/constants/` completam os modelos e funções. |
| Entrada do servidor | `backend/index.ts`: Express, HTTP/WebSocket, uploads, proxy PHP, Google, registro das rotas, Vite em desenvolvimento e arquivos compilados em produção. |
| API e domínio | `backend/routes.ts` concentra autenticação, usuários, pedidos, locais, cidades, empresas, ganhos e financeiro; `mappers.ts` traduz modelos Prisma e contratos legados. Há módulos menores úteis como `pickupTransition.ts`, `companyLocations.ts`, `assignmentKeys.ts`, `orderPhotos.ts`, `driverCollections.ts` e `access.ts`. |
| Tempo real | `backend/realtime.ts` registra REST e WebSocket, mantém motoristas/ofertas em memória, carrega/persiste atribuições, decide despachos e emite notificações. |
| Persistência | Prisma/MySQL em `backend/prisma/schema.prisma`; `backend/db.ts` fornece um proxy com armazenamento alternativo via `LocalDbStore`. `orders` e `transportadoras` exigem MySQL; outros modelos podem recorrer ao armazenamento local. |
| Imagens | Upload original em Node, proxy para servidor PHP e dois exemplares de `images.php`, com painel administrativo e redimensionamento. |
| PWA | `vite.config.ts`, `pwaUpdateService.ts`, hooks e componentes de instalação/atualização; manifestos de versão em `public/` e script `update-version-manifest.mjs`. |
| Android | Projeto Capacitor em `apk/`, interface remota configurada em `capacitor.config.json`, código Java para permissões, localização, ofertas, notificações, compartilhamento e atualização de APK. |
| Ferramentas e dados | `scripts/` gera ícones e manifestos; scripts `backend/import*.ts`, `linkOrderClients.ts` e `fixReceivables.ts` tratam importação/reconciliação. `backend/database/`, `backend/uploads/` e `google-api-cache.json` contêm dados/artefatos, não módulos descartáveis. |

Tecnologias efetivamente referenciadas: React 19, TypeScript, Leaflet, Lucide, Tailwind, Vite/PWA, Express, Prisma/MySQL, `ws`, `bcryptjs`, `dotenv`, `tsx`, Capacitor, Java/Gradle e OkHttp. `sharp` é utilizado por `scripts/generate-pwa-icons.js`. As integrações Google são feitas por HTTP em `backend/google.ts`, `geocodingService.ts` e `routingService.ts`; isso não comprova uso de Gemini.

### Rastreamento dos fluxos críticos

| Fluxo | Caminho e contratos a preservar |
| --- | --- |
| Autenticação | `LoginModal` → `api.login` → `httpClient.request` → `/login/login` em `routes.ts` → `users` e `user_sessions`. `api.isLogged`, `loginWithAccount`/`logout` do contexto e `resolveCaller` em `access.ts` completam sessão e restauração. `registrationService.registerAndLogin` verifica a correspondência entre cadastro e sessão. Preservar formatos de token, telefone, papel e armazenamento. |
| Pedidos | `NewOrderModal` → `MapContext.addNewOrder` → `buildMapOrderPayload` → `api.savePedido` → `orderService.savePedido` → `/pedidos/save` e `pedidoFromBackend`. Na leitura, `listAllPedidos`, `pedidoToBackend`, `backendPedidoToPlaces` e marcadores transformam um pedido em pontos de operação. IDs e pontos não são intercambiáveis. |
| Coleta e despacho | `assignPlaceToDriver`/`claimPublicOrder`, `realtimeAssignmentService` e `UrgentOrderOfferOverlay` → endpoints `/api/realtime/*` → `registerRealtime`, `serializeByKey`, `nearestAvailableDriver`, `assignmentStore` e tabela `assignments`. Ofertas duram 30 s e mantêm candidatos já tentados. Baixas passam por `/pedidos/marcar_coleta_entrega`, `claimPickupTransition` e regras de propriedade da coleta. |
| Motoristas | Cadastro em `/users/register` exige `persistentDatabase`; `backendMotoristaToDriver` adapta a listagem. Há modelos `users` e `drivers` distintos: o README registra que cadastro não preenche `drivers`, pois não coleta CNH. GPS web/nativo → cliente de rastreamento/serviço Java → WebSocket e endpoints de tracking → motoristas ativos e histórico. Não fundir as duas tabelas como se fossem cópias. |
| Transportadoras | `CompanyManagementPage` → `companyService` → `/companies*` → `transportadoras` com dados JSON e ligação a `locations` por `companyLocations.ts`. A tabela `company`, usada também em preços/configurações, é uma responsabilidade diferente. `canUserAccessPlace`/`canUserAccessCustomer` filtram a interface; `access.ts` decide visibilidade no servidor. |
| Atualizações | `driverTrackingClient` recebe `orders:changed` e dispara `zap:refresh-orders`; o contexto consulta novamente pedidos/atribuições. Existem consultas periódicas independentes em contexto, serviços e notificações. WebSocket e consultas periódicas têm papéis complementares. |
| Notificações | Rotas/despacho → `notifyNewOrder`, `notifyOrderProgress`, `notifyUser` → tabela `notifications` → endpoints registrados por `registerNotifications` → `notificationService`/`NotificationMenu`. Ofertas urgentes também têm alerta nativo em `UrgentOfferConnection`, `UrgentNotification` e `UrgentOfferWindow`. Notificação persistente e convite temporário são contratos diferentes. |
| Financeiro | `FinancialModalFullScreen` → `financialService` → `/api/financial/{payable,receivable}/{list,settle}` em `routes.ts`; ganhos usam `driverEarningsService`, rotas `/driver-earnings/*` e `driver_earnings`. `financialUtils`, `customerBilling`, preços por cidade e condições de pagamento participam dos cálculos. Preservar filtros, agrupamentos, totais, baixa parcial e dados legados. |
| Android/PWA | `main.tsx` inicializa atualização PWA; Vite gera o service worker. `androidBridge` e `backgroundGeolocationService` conversam com `window.AndroidApp`, exposto por `MainActivity`/`WebAppInterface`; `LocationService` mantém localização e conexão urgente. `ApkUpdateChecker`/`ApkUpdateVersion` usam o manifesto publicado por `publish-apk-manifest.mjs`. Interface remota, cache web e binário Android têm ciclos de atualização diferentes. |

## 2. Duplicações confirmadas e suspeitas

“Canônico” abaixo indica a implementação existente recomendada como origem da responsabilidade; não autoriza substituição automática.

### Confirmadas

| ID | Evidência e diferença de comportamento | Origem recomendada e encaminhamento |
| --- | --- | --- |
| D1 | `backend/images.php` e `public/images.php`, 1.093 linhas cada. `diff` mostra uma única linha de conteúdo diferente: `$CONFIG['password']`. Além disso, `__DIR__ . '/uploads/images/'` resolve para diretórios diferentes em cada cópia. Portanto, são duplicação de implementação, mas não arquivos literalmente idênticos nem instalações equivalentes. | Eleger `backend/images.php` como fonte de manutenção **proposta**, após verificar qual arquivo é publicado em PHP. Gerar a distribuição em `public/` preservando configuração e diretório de cada implantação. Não trocar por um `include` dependente de arquivos ausentes no servidor remoto. |
| D2 | `src/components/place/PlaceDetailCard.tsx:196` define `calculateDistanceKm` com o mesmo cálculo de `src/utils/geoUtils.ts:5`. O componente o usa para distância exibida e proximidade, aproximadamente nas linhas 834 e 1391. | `geoUtils.calculateDistanceKm`; a troca local é pequena e não exige unificação global. |
| D3 | Haversine reaparece em `routingService.calculateCrowDistance:208`, `placeService.getLocaisNearby`, `driverCityUtils.getDistanceKm:39`, `placeUtils.calculateDistanceMeters:126`, `monitorData.distanceKm:15`, `backend/urgentDispatch.distanceInKm:8`, `/locais/nearby` em `routes.ts:1096` e busca próxima em `google.ts` perto da linha 380. | Núcleo geográfico de `geoUtils` como referência matemática; manter adaptadores de unidade e arredondamento. `calculateCrowDistance` arredonda a uma casa, `monitorData` usa `asin`, e alguns chamadores esperam metros. Não são todos substitutos diretos. |
| D4 | `api.savePedido:220` repete o bloqueio de motorista já presente em `orderService.savePedido`. `api.deletePedido`, por outro lado, já delega ao serviço. | `orderService` para validação do cliente, com `api.ts` preservado como fachada. Autoridade final continua nas rotas do servidor. Há diferença de log na fachada; registrar se deve ser preservada. |
| D5 | Trechos iguais de cabeçalho/retorno em `NavigationSettingsPage.tsx:42`, `ServerSyncSettingsPage.tsx:52`, `PaymentSettingsPage.tsx:45` e `UserFieldsSettingsPage.tsx:95`; outra repetição em `ImageServerSettingsPage.tsx:144` e `SecurityOperationSettingsPage.tsx:117`. Comparação encontrou blocos de 18 linhas iguais após remoção de espaços nas extremidades. | Extrair somente a moldura visual compartilhada de configurações; manter formulários e salvamento nos componentes atuais. Não há hoje um componente canônico único. |
| D6 | `backend/routes.ts:147` e `src/components/navigation/NavigationStatus.tsx:19` repetem `fmtDistance`. | Uma função pura de apresentação pode ser compartilhada mais tarde; ganho pequeno isoladamente. Preservar separador decimal e limiar de 1.000 m. |
| D7 | Hashes iguais para `apk/zap-encomendas.apk` e `public/download/zap-encomendas.apk`; ícones públicos e equivalentes em `apk/`; `public/icon.svg` e `public/logo.svg`; diversos ícones Android redondos/normais. | Duplicação de artefatos de distribuição. `publish-apk-manifest.mjs` exige explicitamente as duas cópias do APK e compara seus hashes ao compilado. Manter destinos; automatizar sua produção, sem apagá-los como código redundante. |

### Sobreposição comprovada, equivalência ainda não comprovada

| ID | Locais e evidência | Decisão arquitetural proposta |
| --- | --- | --- |
| S1 | `orderService.cleanOrderId`, `src/utils/orderIds.cleanOrderId`, `backend/mappers.cleanPedidoId`, `presenceService.pedidoIdFromPlace` e `backend/assignmentKeys.ts` tratam IDs de pedido. O utilitário web tolera sufixo sem distinguir maiúsculas; o serviço usa regex sem essa opção. Presença também extrai números de `orderCode`; chaves de atribuição preservam a operação. | `orderIds` para IDs da interface, `assignmentKeys` para identidade de atribuição. Criar matriz de entradas antes de compartilhar somente o núcleo equivalente. Não substituir todos por uma regex. |
| S2 | `backendPedidoToPlace:692`, `backendPedidoToPlaces:905` e `backendOrderMarkerToPlace:1291` em `apiAdapters.ts` repetem composição de `Place`, fotos, atribuição e detalhes. Os dados de entrada e número de pontos são diferentes. | Adaptador de pedidos como responsável canônico; extrair fragmentos somente após testes de paridade. Preservar `pedidoPaymentFields`, `persistedMapOrderDetails` e `getRoutePointMetadata`, que já compartilham partes. |
| S3 | Busca de locais e endereços aparece em `geocodingService.searchAddress`/`reverseGeocode`, `placeService`, `backend/google.ts` e modais de mapa. Existem busca no banco, proxy Google, chamada direta e Nominatim. | `geocodingService` deve coordenar o cliente e `google.ts` os provedores no servidor; preservar ordem de busca, cache, modo independente e limite de ajuste ao ponto. Fallbacks não são legado comprovado. |
| S4 | `companyService.canUserAccessPlace` e `backend/access.canCallerSeeOrder` decidem visibilidade em representações diferentes; `apiAdapters.extractDriverAssignmentFromPedido` e serviço de atribuições conciliam referências de motorista. | Servidor permanece autoridade; filtros web continuam necessários à interface. Compartilhar apenas regras puras demonstravelmente iguais, sem deslocar autorização para o cliente. |
| S5 | `settingsService`, `pricingSettingsService` e `paymentSettingsService` mantêm configurações relacionadas. Os dois últimos usam chaves locais `geoexplorer_pricing_settings_v1` e `geoexplorer_payment_condition_rules`; o primeiro sincroniza configuração remota. | Documentar escopo local versus global antes de consolidar. Não apagar chaves antigas: podem conter preferências de instalações existentes. |

Não há evidência suficiente para declarar todos os fluxos de fotos equivalentes: `persistOrderPhoto` faz upload **e vínculo ao pedido**, `uploadImage` transporta o arquivo e `orderPhotos.ts` compara/remove referências persistidas. São etapas complementares, apesar do assunto comum.

## 3. Candidatos sem uso e legado

### Ausência de chamadores no código atual

| Candidato | Verificação | Classificação e ação futura |
| --- | --- | --- |
| `src/components/map/MapControls.tsx` / `MapControls` | Sem importadores no grafo; busca do identificador encontra somente a definição. | Candidato a componente desconectado. Verificar uso esperado dos controles de mapa antes de excluir. |
| `src/components/profile/UserProfileMenu.tsx` / `UserProfileMenu` | Sem importadores ou referências externas; `MainAppContent` monta `UserProfilePage`. | Candidato a implementação anterior do perfil; equivalência funcional com a página não foi comprovada. |
| `src/components/order/OrderScheduleResponsibleStep.tsx` | Nome somente na interface de propriedades e definição; sem importadores. | Etapa aparentemente desconectada. Comparar com `OrderScheduleModal` antes de qualquer descarte. |
| Exportações sem consumidor de produção | `getGpsSignalLabel` em `driverUtils.ts`; `getTop20MostUsedPlaces` em `mostUsedPlaces.ts`; `findNearestPlace` em `placeUtils.ts`; `getGeocodingCacheStats`/`clearGeocodingCache` em `geocodingService.ts`; `OSM_URL`/`FALLBACK_TILE_CONFIG` em `tileCache.ts`; `searchDatabaseCustomers` em `customerSearchService.ts`. | Candidatos a API interna excedente. Ausência lexical de consumidores não prova ausência de uso externo ou futuro. Os módulos que os contêm continuam ativos. |
| Funções com uso apenas em testes identificado | `backgroundScheduler.runInBackground`, `driverCityUtils.filterPlacesByDriverCity`, `orderNotesUtils.formatStageObservations` e `buildWhatsAppUrl`. | Não classificar como sem referências. Manter ou conectar ao fluxo após avaliar os respectivos testes e equivalentes usados na interface. |

### Itens legados ou gerados que continuam referenciados

- `backend/localDb.ts` lê `local-store.json`, importa usuários de `importedUsers.legacy.json` e usa `backup-pedidos-fantasma-1793695267771.json` como semente quando necessário. `importUsers.ts` também referencia o arquivo de usuários legado. São dados operacionais referenciados; a palavra “legacy” não permite exclusão.
- `backend/db.ts` usa efetivamente `fallbackStore`; sua retirada exige plano próprio de reconciliação. O proxy proíbe fallback de pedidos/transportadoras, mas o armazenamento local ainda sabe carregar esses dados antigos.
- Os scripts de importação/reparo não têm importadores porque são pontos de entrada declarados no `package.json`. `vite.config.ts`, PostCSS, Tailwind, `src/main.tsx` e scripts de versão também são descobertos por ferramentas/comandos. Não são arquivos mortos.
- `apk/www/index.html` é o diretório web configurado no Capacitor; o site remoto é a interface principal. O arquivo local não deve ser descartado por não conter o aplicativo React compilado.
- Fotos em `backend/uploads/` e `google-api-cache.json` são recursos/dados. Foi encontrado um par de fotos de usuários com hash igual; referências por caminho podem ser distintas, portanto não se recomenda deduplicação física nesta etapa.

### Dependências e documentação

1. `@google/genai` e `motion`: nenhuma importação ou uso correspondente foi encontrado no código, scripts e configurações examinados; ambos estão em `package.json`. São candidatos fortes a dependências desnecessárias. Confirmar resolução/build antes de removê-los. A presença de endpoints Google Maps não implica uso de `@google/genai`.
2. `@types/leaflet`, `@types/ws`, `@vitejs/plugin-react`, `postcss` e `vite` estão em `dependencies`, enquanto ferramentas semelhantes ficam em `devDependencies`. É uma organização inconsistente, mas Vite é importado dinamicamente pelo servidor no modo de desenvolvimento; classificar conforme os comandos reais de implantação antes de mover.
3. Plugins Capacitor de geolocalização e notificações constam das dependências e do Gradle gerado. O Java mantém implementação própria para várias dessas capacidades. É uma **suspeita** de sobreposição; não está comprovado que os plugins possam ser retirados sem afetar registro nativo e compatibilidade.
4. Não há arquivo de lock versionado no inventário. As faixas de versão dos manifestos permitem resoluções diferentes entre instalações, dificultando reproduzir refatorações. Definir gerenciador e ambiente suportados antes de gerar um lock.
5. O README ainda apresenta template AI Studio/Gemini e recomenda `.env.local`, enquanto `backend/index.ts` chama `dotenv.config()` e o SDK Gemini não tem uso encontrado. `api.ts` menciona contratos em `src/routes`, diretório ausente. A documentação de sincronização no README menciona consultas periódicas, mas omite parte do WebSocket atual. Corrigir documentação sem remover integrações ativas.

## 4. Módulos extensos e acoplamentos

### Concentração por arquivo

| Arquivo | Linhas | Responsabilidades a separar gradualmente |
| --- | ---: | --- |
| `src/components/place/PlaceDetailCard.tsx` | 5.641 | Detalhes, contato/navegação externa, coleta/entrega, proximidade, fotos, preços e decisões de operação. |
| `src/components/order/NewOrderModal.tsx` | 4.439 | Formulário, seleção de cliente/endereço, histórico, mapas, tarifação e transporte. |
| `src/context/MapContext.tsx` | 3.536 | Estado de interface, sessão, entidades, filtros, GPS, rotas, mutações, sincronização e armazenamento. |
| `src/components/map/FullscreenMap.tsx` | 3.390 | Camadas, ícones, marcadores, seleção, rotas, animação de GPS e interface de navegação. |
| `backend/routes.ts` | 1.824 | Transporte HTTP, autenticação, persistência, conversões, transições e cálculos de vários domínios. |
| `src/components/order/EmbeddedLocationMapStep.tsx` | 1.819 | Edição de endereço, busca e mapa dentro do fluxo de pedido. |
| `src/services/apiAdapters.ts` | 1.583 | Fotos/URLs, datas, coordenadas/endereço conhecido, pedido, ponto de operação, cliente e motorista. |
| `CompanyManagementPage.tsx` em `src/components/admin/settings/` | 1.462 | Cadastro de empresa, local associado e seleção de pessoas. |
| `AdminUsersPage.tsx`, `CustomerSelectorDrawer.tsx`, `FinancialModalFullScreen.tsx` | 1.194 / 1.147 / 1.141 | Telas extensas com consulta, filtros, edição e apresentação. |
| `backend/realtime.ts` | 902 | Transporte, estado em memória, persistência de atribuições, despacho urgente, timers e notificações. |
| `MainActivity.java` em `apk/android/app/src/main/java/com/zapencomendas/app/` | 870 | Ciclo Android, WebView, permissões e integração de recursos do aparelho. |
| `src/services/geocodingService.ts` | 812 | Provedores, links, três caches, busca e geocodificação reversa. |

Tamanho isolado não comprova defeito. Nesses arquivos, a leitura mostrou responsabilidades de vários tipos, aumentando o contexto necessário para uma alteração localizada. Separar funções por domínio é preferível a apenas repartir arquivos por número de linhas.

### Problemas estruturais confirmados

**A1 — Ciclo de execução entre rotas e notificações.** `backend/routes.ts:7` importa funções de `notifications.ts`; `notifications.ts:4` importa `parseRawJsonBody` de `routes.ts:36`. `realtime.ts:4` também depende do arquivo inteiro de rotas apenas por esse leitor. A utilidade de transporte obriga módulos consumidores a carregar o agregador de domínio. Não se observou falha de execução nesta auditoria; o problema confirmado é o ciclo e o custo de compreensão/inicialização.

**A2 — Ciclos de tipos entre componentes.** `NewOrderModal` importa `CustomerOrderHistoryFullScreen` e `CustomerSelectorDrawer`; ambos importam `PastOrderRecord` do próprio `NewOrderModal` (`CustomerOrderHistoryFullScreen.tsx:27`, `CustomerSelectorDrawer.tsx:35`). Existe ainda o percurso `NewOrderModal` → `EmbeddedLocationMapStep` → `FloatingSearchBar` → `CustomerSelectorDrawer` → `NewOrderModal`. As arestas de retorno examinadas são de tipo. Extraí-lo para `src/types/` e usar `import type` elimina a dependência estrutural; não afirmar ciclo de execução sem examinar o código emitido.

**A3 — Componentes reutilizáveis dependem de uma tela grande.** `NewOrderModal.tsx:53` importa `createPlaceMarkerIcon` de `FullscreenMap.tsx`, que também consome contexto e serviços. A fábrica visual deve residir em módulo próprio de marcadores. Conservar parâmetros e CSS dos ícones.

**A4 — Estado amplo e múltiplas projeções.** `MapContextType:84` mistura vários domínios; o `Provider:3373` entrega um objeto literal com muitos valores. Cada atualização do valor notifica consumidores do contexto, mesmo quando só usam outro campo. `allPlaces`, `completedOrders`, `selectedPlace`, marcas concluídas e atribuições representam projeções relacionadas; `refreshServerData:652` reconcilia esses dados e atualiza a seleção. É custo de sincronização confirmado, não prova de que cada projeção seja dispensável. Hooks internos ajudam a leitura, mas só contextos menores reduzem a propagação entre domínios. Medir renderizações antes/depois.

**A5 — Consultas de atribuição sobrepostas.** O construtor de `realtimeAssignmentService.ts:31` inicia consultas a cada 10 s. O ciclo do contexto perto de `MapContext.tsx:1026` chama `fetchServerAssignments` novamente a cada 30 s e em eventos. `driverTrackingClient.ts:114` e `NotificationMenu.tsx:66` disparam o mesmo evento de atualização de pedidos. O contexto já contém bloqueio de execução e enfileiramento; isso não centraliza todos os solicitantes. Recomendação: serviço de atribuições dono da consulta e invalidações coordenadas, conservando recuperação após reconexão e retorno à tela.

**A6 — Transporte HTTP inconsistente no financeiro.** `financialService.getHeaders` deriva identidade da conta salva e seus quatro métodos usam `fetch('/api/financial/...')` diretamente. Eles não aplicam URL configurável nem o token Bearer de `httpClient.request`; `routes.ts:1562` e demais rotas financeiras consultam `resolveCaller`, que lê sessão por token. Há incompatibilidade estática entre o transporte e a expectativa de sessão, com possível falha funcional. Caracterizar o comportamento no ambiente real e migrar preservando formatos/totais, sem trocar contratos do servidor.

**A7 — Outras exceções de transporte.** `imageUploadService.uploadImage` usa endpoint relativo e `fetch` próprio; `DriverTrackingClient.connect` constrói o WebSocket com `window.location.host`, enquanto HTTP permite `setApiBaseUrl`. Esses caminhos podem apontar para servidores diferentes ao configurar uma API remota. Consolidar resolução de destino, sem submeter todo upload ao mesmo timeout de consultas curtas.

**A8 — Backend importa pasta de interface.** `access.ts`, `routes.ts` e `realtime.ts` importam `src/utils/collectionOwnership`; `realtime.ts` importa `driverColorUtils`; `nearbyPlace.ts` importa `placeUtils`. Algumas funções são puras e reutilizáveis, mas a localização expressa uma direção de dependência errada. Um diretório compartilhado deve conter somente funções e tipos independentes de React, DOM, armazenamento e Prisma. Manter exportações antigas durante a transição.

**A9 — Políticas de persistência implícitas.** `db.ts:createPrismaProxy` escolhe MySQL ou armazenamento local por modelo. `$transaction` no fallback usa `Promise.all` ou callback com proxy, sem a mesma garantia transacional do MySQL. `registerRealtime` carrega atribuições por esse proxy e mantém mapas/timers; `access.ts` é também dono de `assignmentStore`. Não substituir o armazenamento nem alterar transações em uma divisão mecânica de arquivos. Tornar explícitos os donos da atribuição e os requisitos de persistência, preservando as políticas atuais.

**A10 — Efeitos no carregamento de módulos.** Os singletons de `companyService`, `realtimeAssignmentService` e `driverTrackingClient` iniciam consulta/conexão em seus construtores; `db.ts` testa conexão ao carregar. Isso acopla imports a rede e dificulta isolamento em testes. Adotar inicialização explícita em uma etapa própria, mantendo a ordem e limpeza atuais, sem criar um contêiner de dependências novo.

**A11 — Cobertura selecionada manualmente.** `package.json:test` enumera testes. `src/services/placesSearch.test.ts` e `src/utils/orderNotesUtils.test.ts` existem, mas não estão nessa lista. Assim, sucesso de `npm test` não incluiria esses arquivos. Não foi medida cobertura nem executada a suíte nesta auditoria.

## 5. Arquitetura modular proposta

Evoluir o projeto existente, conservando React, Express, Prisma, Capacitor e contratos. Os caminhos abaixo são destinos propostos, ainda não criados.

```text
src/
  app/                    composição dos provedores e inicialização
  features/
    auth/                 sessão e formulários
    orders/               ações, adaptação, histórico e formulário
    dispatch/             atribuições e ofertas urgentes
    drivers/              presença, tracking e apresentação
    customers/            agenda, seleção e edição
    companies/            transportadoras e vínculo com local
    financial/            consultas, filtros e apresentação
    map/                  camadas, marcadores e navegação
    settings/             configuração e formulários
  services/               fachadas e caminhos atuais durante migração
  platform/               HTTP, Android, PWA e armazenamento
  components/common/      componentes visuais já reutilizados
  types/                  contratos da interface fora das telas
backend/
  http/                   leitor de JSON e registro compatível de rotas
  modules/                auth, users, orders, companies, financial
  realtime/               transporte, tracking e atribuições
  dispatch/               seleção, oferta, expiração e aceite
  notifications/          emissão e endpoints separados
  persistence/            políticas atuais de banco/armazenamento
shared/                   tipos e funções puras realmente comuns
```

Direção desejada: tela → ação/serviço do domínio → transporte; rota → operação do domínio → persistência; transporte de tempo real → operações de despacho/atribuição. `shared/` não importa `src/` ou `backend/`. Não criar uma camada genérica para cada função: aproveitar os módulos menores já existentes.

Divisão recomendada dos arquivos prioritários:

- `MapContext`: começar por funções puras e hooks de sessão, sincronização, pedidos, GPS/rotas e interface. Preservar `useMapStore` e sua assinatura como fachada. Depois introduzir provedores separados e migrar consumidores por domínio; não reescrever os 34 consumidores simultaneamente.
- `apiAdapters`: separar fotos, pedidos/pontos, clientes e motoristas; datas e coordenadas ficam em funções pequenas. Reexportar os identificadores atuais de `apiAdapters.ts` durante a migração. Tratar adaptações de pedido e marcador como contratos distintos.
- `routes`: manter `registerApiRoutes` como composição, extraindo registradores por domínio. Preservar `app.all`, aliases com e sem `/api`, `/pedidos/save_pedido`, corpos de entrada, respostas e códigos HTTP.
- `realtime`: manter `registerRealtime` como composição; separar armazenamento de atribuições, transporte, registro de motoristas e máquina de ofertas. Preservar serialização por pedido/operação, destinatários, prazos, recuperação e limpeza de timers.
- Componentes grandes: extrair primeiro funções puras, tipos e apresentação sem efeito; depois hooks de consulta/ação. A fábrica de marcadores deve ser independente de `FullscreenMap`.
- PHP: fonte única e artefato distribuído após confirmar publicação e configurações. O PHP precisa continuar instalável isoladamente.

Para desenvolvimento assistido por IA, cada módulo deve ter responsabilidade explícita, exports pequenos e caminhos previsíveis; uma breve tabela de domínio → entrada → testes é suficiente. Evitar novos agregadores que reexportem todo o sistema e recriem ciclos.

## 6. Roteiro priorizado

Impacto considera redução de acoplamento e confiabilidade; risco considera regressão; esforço é relativo, não estimativa de prazo. Cada etapa deve ser pequena e revisável.

| Ordem | Achados | Entrega futura | Impacto | Risco | Esforço | Validação necessária |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 | Extrair `parseRawJsonBody` mantendo reexportação. | Alto | Baixo | Baixo | Casos de parsing, integração de atribuição/urgência e análise de imports. |
| 2 | A2, D2 | Mover `PastOrderRecord` para tipos; reutilizar `geoUtils` no card em alterações separadas. | Médio | Baixo | Baixo | Tipagem/build; histórico; distância e limiar de proximidade. |
| 3 | A11, dependências | Incluir os dois testes omitidos; revisar SDKs sem uso, documentação e política de lock. | Médio | Baixo a médio | Baixo | Executar testes incluídos; build antes/depois da remoção de cada pacote. |
| 4 | A6, A7 | Unificar transporte financeiro, depois resolução HTTP/WebSocket/upload. | Alto | Médio | Médio | Sessão, URL remota, falhas, filtros/totais e limites de upload. |
| 5 | D4, S1 | Simplificar fachada de pedidos e caracterizar normalização de IDs. | Médio | Baixo a médio | Baixo a médio | Motorista bloqueado; IDs por operação, caixa, prefixos e dados legados. |
| 6 | D1 | Definir fonte PHP e geração de distribuição com configuração preservada. | Médio | Médio | Médio | PHP isolado: upload, variantes, cache, painel, lista e exclusão em ambos os destinos. |
| 7 | S2 | Dividir `apiAdapters` por responsabilidade com reexports. | Alto | Médio | Médio | Suíte de adaptadores, payload e testes de atribuições; fotos e múltiplos pontos. |
| 8 | A3, D5 | Extrair fábrica de ícones e moldura das configurações. | Médio | Baixo a médio | Médio | Aparência, cliques, mapa embutido e navegação de retorno. |
| 9 | A1, rotas extensas | Extrair registradores de empresas/configurações, usuários, financeiro e pedidos, um domínio por alteração. | Alto | Médio | Alto | Paridade de aliases, respostas, permissões e persistência; regressão por domínio. |
| 10 | A5, A10 | Coordenar consultas e inicialização dos singletons. | Alto | Médio a alto | Médio | Concorrência, reconexão, foco, logout e quantidade de requisições. |
| 11 | A4, telas extensas | Extrair lógica do contexto e dividir provedores/consumidores progressivamente. | Alto | Alto | Alto | Navegação completa, estado selecionado, GPS, sincronização e renderizações medidas. |
| 12 | A8, A9, tempo real | Organizar funções comuns, persistência e máquina de despacho. | Alto | Alto | Alto | Aceite concorrente, recuperação, MySQL indisponível, expiração e Android em segundo plano. |
| 13 | candidatos sem uso | Excluir somente candidatos confirmados após a migração e revisão de usos externos. | Baixo a médio | Variável | Baixo | Busca de referências, build e fluxos relacionados. |

Critérios para avançar: comportamento compatível documentado, verificação da etapa anterior concluída, alteração pequena e possibilidade de reversão. Não misturar modularização com mudanças de schema, regras de preço, políticas de acesso ou protocolo de mensagens.

## 7. Primeira refatoração recomendada

**Extrair `parseRawJsonBody` para um módulo HTTP independente.** É uma função já reutilizada; a extração quebra o ciclo concreto do backend antes de dividir seus módulos grandes.

### Arquivos exatos e mudança futura

| Arquivo | Alteração proposta |
| --- | --- |
| `backend/http/parseRawJsonBody.ts` — novo | Receber a implementação atual de `backend/routes.ts:36`, usando `import type { Request } from 'express'`. |
| `backend/routes.ts` | Importar a função do módulo HTTP, usá-la no registrador e reexportá-la para compatibilidade com consumidores existentes. |
| `backend/notifications.ts:4` | Importar diretamente do módulo HTTP. |
| `backend/realtime.ts:4` | Importar diretamente do módulo HTTP. |

Antes de executar, repetir busca pontual por `parseRawJsonBody` na revisão de trabalho para incluir eventuais consumidores novos. `backend/index.ts` hoje também importa o símbolo de `routes.ts`; a reexportação mantém essa entrada compatível. Não alterar `express.raw({ type: '*/*', limit: '50mb' })`, métodos HTTP ou registro de rotas.

**Benefícios:** elimina `routes → notifications → routes`, evita importar o agregador de rotas apenas para parsing, reduz dependências ao entender ou testar notificações e tempo real. Não exige nova biblioteca ou camada de domínio.

**Riscos:** diferenças acidentais no parsing, mudança da ordem de inicialização ou quebra do caminho de import usado por testes. A extração deve preservar exatamente: Buffer JSON válido → valor decodificado; Buffer inválido → `{}`; corpo objeto → próprio objeto; corpo ausente/primitivo → `{}`. Não endurecer validação ou mudar o tratamento de arrays/null nesta etapa.

### Testes e critérios de aceite para a implementação futura

1. Caracterizar o parser com Buffer válido, inválido, vazio, JSON de array/primitivo/null, objeto já processado e ausência de corpo. Esses casos protegem um comportamento de fronteira real.
2. Executar `backend/access.test.ts`, `backend/assignmentFlow.test.ts` e `backend/urgentDispatchFlow.test.ts`, que protegem acesso e registro/uso das rotas de tempo real. Examinar também o registro de notificações com corpo Buffer e objeto, pois não há teste dedicado de notificações no inventário.
3. Executar `npm run lint` e `npm run build` no ambiente com dependências preparadas. Registrar a versão Node e distinguir falhas preexistentes. O build executa `prebuild` e pode atualizar manifesto; revisar qualquer artefato gerado.
4. Confirmar por análise de imports que `notifications.ts` e `realtime.ts` deixam de importar `routes.ts`; confirmar que a reexportação antiga continua disponível e que aliases/respostas permanecem iguais.

**Estado desta entrega:** apenas este relatório foi criado. Nenhuma refatoração, exclusão de código, alteração de contrato, schema ou dependência foi realizada. Os testes acima são requisitos da futura implementação, não resultados desta auditoria.
