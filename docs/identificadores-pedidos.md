# Identificadores de pedidos

Os identificadores possuem finalidades diferentes. A normalização não valida a existência do pedido nem substitui a autorização do servidor.

| Responsabilidade | Implementação canônica atual |
| --- | --- |
| ID enviado pelo serviço web de pedidos | `src/utils/orderIds.ts:cleanOrderRequestId`, usado por `src/services/orderService.ts` e pelas operações legadas da fachada `api.ts`. |
| ID de pedido tratado na interface | `src/utils/orderIds.ts:cleanOrderId`. |
| Agrupamento de pontos de um mesmo pedido | `getOrderKey` e `getBaseOrderId` em `src/utils/orderIds.ts`. |
| ID recebido pelas rotas do servidor | `backend/mappers.ts:cleanPedidoId`. |
| Pedido e operação de uma atribuição | `assignmentOrderNumber`, `assignmentOperation` e `sameAssignmentOperation` em `backend/assignmentKeys.ts`. |
| Extração a partir de ponto ou código de pedido para presença | `src/services/presenceService.ts:pedidoIdFromPlace`. |

## Diferenças preservadas

`cleanOrderRequestId` remove o prefixo, depois um sufixo minúsculo e, por último, os espaços nas extremidades. `cleanOrderId` remove espaços antes de processar o prefixo e aceita sufixos em qualquer caixa. `cleanPedidoId` também remove espaços antes do prefixo, mas só retira sufixos minúsculos. O prefixo dessas três funções continua sensível a maiúsculas.

Exemplos de resultados de uma passagem, em que `␠` representa espaço e `—` indica ausência de número de atribuição:

| Entrada | Transporte web | Interface | Backend | Número da atribuição |
| --- | --- | --- | --- | --- |
| `501` | `501` | `501` | `501` | `501` |
| `pedido-501-coleta` | `501` | `501` | `501` | `501` |
| `␠pedido-501-coleta␠` | `pedido-501-coleta` | `501` | `501` | — |
| `pedido-501-coleta␠` | `501-coleta` | `501` | `501` | — |
| `pedido-501-COLETA` | `501-COLETA` | `501` | `501-COLETA` | `501` |
| `PEDIDO-501-coleta` | `PEDIDO-501` | `PEDIDO-501` | `PEDIDO-501` | `501` |
| `501_coleta` | `501_coleta` | `501_coleta` | `501_coleta` | `501` |
| `EZ-501-GO` | `EZ-501-GO` | `EZ-501-GO` | `EZ-501-GO` | — |
| `draft-501` | `draft-501` | `draft-501` | `draft-501` | — |

`assignmentOrderNumber` exige correspondência da chave inteira e aceita operações separadas por hífen ou sublinhado. `assignmentOperation` identifica a operação. Assim, coleta e entrega podem compartilhar o número de pedido e ainda representar atribuições diferentes. `getOrderKey` agrupa pontos do pedido e não deve substituir a identidade da atribuição.

`pedidoIdFromPlace` é mais permissivo: tenta obter dígitos do ID do ponto, depois de `orderCode` e, por fim, do próprio ID. Essa regra existe para compatibilidade de presença; não é uma validação de pedido persistido. Rascunhos devem continuar passando pelas verificações de `isTemporaryOrderId` nos fluxos que exigem registro persistido.

## Compatibilidade da fachada

`api.marcarColetaEntrega`, `api.reverterBaixa`, `api.setEtapa` e `api.finalizarPedido` historicamente normalizam antes de chamar `orderService`, que normaliza novamente na fronteira HTTP. Essa sequência foi preservada, pois a transformação não é idempotente em todas as entradas:

- `␠pedido-501-coleta␠`: uma passagem produz `pedido-501-coleta`; duas produzem `501`.
- `pedido-pedido-501-coleta-coleta`: uma passagem produz `pedido-501-coleta`; duas produzem `501`.

As demais operações mantêm sua quantidade original de passagens. Uma futura simplificação dessa sequência exige uma decisão explícita sobre entradas legadas; remover uma passagem silenciosamente altera o payload enviado ao servidor.

`api.savePedido` delega a validação do papel a `orderService.savePedido`. Chamadas diretas ao serviço e chamadas pela fachada continuam bloqueadas para motoristas, sem requisição de salvamento. A autorização no backend permanece independente.

## Verificação

`src/services/orderService.test.ts` caracteriza os contratos antes e depois da extração: bloqueios por papel, sessão, payloads, confirmação do ID gerado pelo servidor, erros, variantes de ID e operações com duas passagens. Os testes de IDs, mapeadores, atribuição e transição de coleta complementam essa verificação.
