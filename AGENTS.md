# Orientações para agentes de IA

Este repositório contém a aplicação existente **Zap Encomendas V3**. Continue a estrutura atual gradualmente e conserve os fluxos já usados. A reestruturação atual prioriza organização e responsabilidades; deixe senhas e outras frentes fora do escopo, salvo solicitação direta do usuário.

## Antes de alterar código

1. Leia este arquivo e `docs/ESTADO_ATUAL.md`.
2. Leia somente as partes pertinentes de `docs/ARQUITETURA.md`, `docs/DECISOES_ESTRUTURAIS.md`, contratos de domínio, README ou relatórios existentes.
3. Inspecione o arquivo alvo, seus importadores diretos, exports, tipos e testes. Confirme cada referência antes de mover, combinar ou remover código.
4. Escolha uma etapa pequena, com limite claro. Mantenha a API pública local compatível por meio de reexports quando houver consumidores.
5. Mova primeiro o código preservando a lógica. Não altere contratos de API, banco, armazenamento, fluxo visual ou comportamento durante uma extração estrutural.
6. Ao concluir uma etapa, atualize `docs/ESTADO_ATUAL.md` e registre decisão ou mudança duradoura no documento correspondente. Não reescreva o histórico da auditoria inicial.

## Limites desta refatoração

- Trabalhe em organização de arquivos e separação de responsabilidades.
- Não aproveite uma extração para mudar validações, permissões, regras de negócio ou formato de dados.
- Não conclua que duas regras são equivalentes só por parecerem semelhantes; compare chamadas e resultados.
- Preserve os limites existentes: interface em `src/`, API em `backend/`, regras puras compartilhadas em `shared/`.
- Não faça deploy, migre banco ou publique APK como parte de refatoração local.
- Use delegação de agentes para revisões independentes e tarefas realmente paralelas; o agente implementador integra os resultados e valida o diff.

## Verificação e comunicação

Faça a verificação proporcional à alteração: diff sem ruído, tipagem/build e testes relevantes quando a extração afetar comportamento de execução. Registre quais comandos realmente rodaram. Se alguma verificação não for possível, descreva o limite com precisão. Não afirme resultados herdados como se tivessem sido executados novamente.

Responda e escreva documentação em português brasileiro; mantenha identificadores de código como estão. Ao terminar, diga arquivos alterados, verificações executadas e próximo item do plano em poucas linhas.
