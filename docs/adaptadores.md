# Adaptadores da API

`src/services/apiAdapters.ts` permanece como entrada compatível dos adaptadores: os nomes, assinaturas e tipos públicos foram mantidos. Os consumidores existentes não precisam mudar seus imports.

## Responsabilidades

Os módulos estão em `src/services/adapters/`:

| Módulo | Responsabilidade |
| --- | --- |
| `photoAdapters.ts` | Normalização de caminhos, variantes, listas de fotos e formatos legados. |
| `placeAdapters.ts` | Conversão de locais cadastrados para pontos no mapa. |
| `customerAdapters.ts` | Conversão de usuários para clientes, incluindo cidade, endereço e contatos. |
| `driverAdapters.ts` | Conversão de motoristas e dados de localização para apresentação. |
| `orderDates.ts` | Datas de referência dos pedidos no fuso de São Paulo. |
| `orderCoordinates.ts` | Extração de coordenadas e resolução dos endereços conhecidos já existentes. |
| `orderAssignments.ts` | Identificação de motorista por operação, incluindo compatibilidade com atribuições locais. |
| `orderDetails.ts` | Pagamento, itens, dimensões e metadados de cada ponto do pedido. |
| `orderAdapters.ts` | Conversão do pedido único, dos múltiplos pontos e dos marcadores de rastreamento. |

As três conversões de pedidos continuam distintas: `backendPedidoToPlace`, `backendPedidoToPlaces` e `backendOrderMarkerToPlace` recebem dados e produzem projeções diferentes. Esta extração não tenta unificá-las. O módulo de pedidos ficou com 843 linhas; a entrada compatível passou de 1.583 para 12 linhas.

Os módulos usam imports diretos entre responsabilidades. Não importe a fachada `apiAdapters.ts` de dentro de um adaptador. `RoutePointKey`, `getRoutePointMetadata` e `persistedMapOrderDetails` são compartilhados internamente e não foram acrescentados às exportações da fachada.

## Configuração das imagens

O estado da URL e a promessa de inicialização foram movidos de `api.ts` para `src/services/imageServerConfig.ts`. As exportações `getImageServerUrl` e `initializeImageServerConfig` continuam disponíveis por `api.ts`; todos os caminhos usam o mesmo estado e a mesma requisição de inicialização.

O adaptador de fotos usa esse módulo diretamente e obtém a URL de API de `httpClient.ts`, sem carregar a fachada geral `api.ts`. A URL padrão, o endpoint de configuração, o tratamento de falha e a promessa compartilhada foram preservados. O momento da inicialização em `main.tsx` também permanece igual.

## Compatibilidade e verificação

Os corpos das implementações foram movidos sem alteração de regras, inclusive os formatos legados de fotos, os padrões de coordenadas, o cache de atribuições e as particularidades de cada conversão de pedidos. Alterações nesses comportamentos devem ser feitas separadamente, com seus próprios critérios de aceite.

Uma comparação antes/depois, com relógio e entradas fixos, encontrou resultados idênticos em 100 casos de fotos, 240 conversões de pedidos e 40 casos auxiliares. Essa amostra também comparou as exportações disponíveis em execução; ela não constitui prova de todos os casos possíveis.

Os testes permanentes em `src/services/adapters/photoAdapters.test.ts` cobrem variantes PHP, fotos originais Node, listas/JSON legados, deduplicação, URL de API e compartilhamento da configuração entre os caminhos antigos e novos. Os testes existentes de `apiAdapters`, payloads, local padrão, atribuições, despacho e cadastro continuam exercitando a entrada compatível. TypeScript e build Vite/PWA também foram verificados.
