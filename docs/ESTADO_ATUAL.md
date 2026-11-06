# Estado da refatoração estrutural

Atualizado em 06/11/2026. Fonte: checkout publicado na `main`, commit `4d56278`.

`AUDITORIA_ESTRUTURAL_V3.md` e `REFATORACAO_ESTRUTURAL_V3.md` foram escritos antes da substituição do projeto e descrevem aquela etapa do checkout de origem. Use os documentos novos desta pasta para o estado deste repositório. O projeto anterior do Zapv3 está recuperável na branch `backup/projeto-anterior-20261106`.

## Objetivo em andamento

Organizar os módulos do Zap Encomendas V3 com mudanças graduais e revisão de referências. A prioridade é estrutura de código. O banco, os contratos existentes e os fluxos atuais ficam fora do escopo de mudanças estruturais.

## Já reorganizado

- API HTTP dividida em 13 módulos em `backend/modules/`; `backend/routes.ts` permanece como composição.
- Realtime dividido em transporte, tracking, atribuições, timers e despacho; `backend/realtime.ts` compõe os módulos.
- Adaptadores separados por assunto em `src/services/adapters/`, com fachada legada mantida.
- Estado do mapa distribuído entre hooks em `src/context/hooks/` e projeções em `mapStoreContext.ts`; `useMapStore` mantém a superfície de compatibilidade.
- Marcadores, ícones de veículos, cabeçalho das configurações, configuração de imagens e regras puras comuns extraídos.
- Corpo dos formulários de pedidos e do card de locais separados em hooks; suas telas visuais ainda são grandes.
- Etapas e resultados medidos estão no [relatório de refatoração](../REFATORACAO_ESTRUTURAL_V3.md). O [relatório de auditoria](../AUDITORIA_ESTRUTURAL_V3.md) descreve a estrutura antes das extrações e é histórico.

## Etapa concluída: rodapé do formulário

`src/components/order/NewOrderFooter.tsx` passou a conter a apresentação da navegação entre as quatro etapas. `NewOrderModal.tsx` encaminha sete propriedades explícitas; o hook `useNewOrderForm.tsx` conserva estado e handlers. O JSX do rodapé foi comparado integralmente com o original: condições, classes, textos e callbacks são idênticos. A prop de fechamento usa o contrato existente `(open: boolean) => void`.

Verificações desta etapa: revisão independente por agente, build Vite/PWA e interação no Chromium com uma fixture temporária do componente. Foram conferidos cancelamento, avanço pelas quatro etapas, retorno e encaminhamento da conclusão, sem erros de JavaScript. A fixture foi removida. A verificação inicial de tipos detectou uma assinatura de prop mais ampla que a original; ela foi corrigida e a tipagem foi executada novamente. Essas interações verificam o componente isolado, sem persistir pedidos; não constituem uma nova validação ponta a ponta de cadastro, preço ou salvamento.

As instruções em `AGENTS.md`, este estado, o mapa de arquitetura e as decisões estruturais passam a orientar as próximas etapas. O envio desta etapa à `main` do GitHub foi solicitado pelo usuário; o commit correspondente pode ser identificado no histórico Git. Isso não comprova uma nova implantação na hospedagem.

## Próximo recorte para avaliação

As telas e hooks ainda extensos são o principal trabalho estrutural restante. Avalie o cabeçalho de `NewOrderModal.tsx` e seus controles de busca antes de separar painéis maiores. O painel de carga reúne muitas dependências e exige recortes menores. Compare cada candidato com seções do card de locais; não mova várias etapas do formulário numa única mudança.

Cada etapa deve responder: qual responsabilidade sai, qual módulo passa a possuí-la, quem importa o módulo, quais contratos são preservados e como a mudança foi verificada. Se o JSX depender de grande parte do estado compartilhado, registre a conclusão e escolha uma fronteira melhor; não crie uma lista enorme de props apenas para reduzir linhas.

## Regras para manter este estado útil

- Atualize este arquivo só depois de uma mudança de código concluída ou quando a próxima recomendação mudar.
- Registre decisões duradouras em [decisões estruturais](DECISOES_ESTRUTURAIS.md); use o [mapa de arquitetura](ARQUITETURA.md) para diretórios estáveis.
- Diferencie checagens executadas nesta etapa das que constam no relatório anterior.
- Não registre URL de ambiente, credenciais, dados de usuário, pedido real ou valores secretos.
