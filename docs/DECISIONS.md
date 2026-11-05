# Decisões

- MySQL 8/MariaDB é o alvo inicial por compatibilidade com Hostinger; o serviço usa `mysql2` para identidade persistente em produção.
- O adaptador em memória permanece para desenvolvimento e testes; a autenticação em produção não usa fallback em memória.
- Chamadas de teste usam Socket.IO e tabelas próprias, sem criar pedidos reais ou depender de Firebase/Redis; o Android mantém a conexão apenas enquanto o serviço está ativo.
