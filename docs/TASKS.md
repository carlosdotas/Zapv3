# Tarefas

| Papel | Escopo | Aceite | Estado |
|---|---|---|---|
| Architect/Integrator | workspace, contratos e docs | comandos reproduzíveis | concluído |
| SQL | migrações e seed | FKs, índices, UUID e UTC | concluído |
| API/Security | health, auth, RBAC e `/me` | testes de autenticação | fundação concluída |
| Admin/Company/Professional UI | login e landing protegida | conteúdo pt-BR | fundação concluída |
| QA/DevOps | typecheck, testes e build | comandos verdes | fundação concluída |
| SQL/API vertical slice | empresas, locais, pedido, oferta e aceitação atômica | banco Hostinger confirmado + testes de concorrência | próximo marco |

## Pickup calls / native duty

- Integrator/API: notifications module, additive migration, existing session/RBAC. Acceptance: real SQL race, expiry, tenant and reconnect tests.
- Company/professional UI: scoped dashboards, selection/test result, consent and duty controls. Acceptance: typecheck/build; physical-device workflow pending.
- Android: existing flavors, foreground location and native Socket.IO notification actions. Acceptance: both builds, signature inspection; Android 13–15 physical tests pending.
- Operations: preserve APK URLs, verify deployment separately; do not equate Git push with hosted release.
