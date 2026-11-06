# Decisões de organização estrutural

Este registro guarda decisões duradouras para reduzir redescoberta. A motivação não autoriza alterações de contrato fora do escopo.

## Fronteiras do sistema

- O browser e o servidor compartilham somente regras sem dependências de ambiente por `shared/`.
- O backend não importa implementações de `src/`.
- `backend/routes.ts`, `backend/realtime.ts` e `src/services/apiAdapters.ts` são entradas de compatibilidade/composição. Novos handlers e adaptadores vão aos módulos por domínio já existentes.
- `MapContext.tsx` mantém a fachada compatível durante a separação progressiva em hooks e projeções; consumidores podem migrar uma área por vez.

## Compatibilidade durante extrações

- Ao mover uma função ainda importada por caminho antigo, mantenha uma reexportação nesse caminho e busque referências de produção, testes e integrações antes de removê-la.
- Mover JSX para componente próprio só vale quando a seção tem fronteira visual e conjunto de dependências manejável. Evite passar o modelo inteiro do formulário ou dezenas de props para uma apresentação que não isolou responsabilidade.
- Não una cálculos geográficos sem comparar unidade, arredondamento, ordem de operações e casos de entrada.
- Não una normalizadores de pedidos que ainda tenham diferenças observáveis; o histórico em `docs/identificadores-pedidos.md` registra um desses casos.

## Persistência e artefatos locais

- A escolha entre MySQL e armazenamento local segue a política existente em `backend/persistence/modelPolicy.ts`; reorganização não altera fallback nem schema.
- Dados, uploads, chaves e `.env` são estado local/operacional. Não devem ser tratados como fonte canônica para extrações nem copiados em relatórios.
- PHP é mantido em `backend/images.php` e distribuído em `public/images.php` por script, preservando separadamente a configuração do destino.

## Registro de mudança

Atualize esta página somente para decisões reutilizáveis por trabalhos futuros. Registre aqui a regra e sua razão; registre a etapa concluída em `ESTADO_ATUAL.md` e detalhes históricos em `REFATORACAO_ESTRUTURAL_V3.md` se necessário.
