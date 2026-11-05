# Banco de dados

Alvo MySQL 8 compatível com MariaDB, UUID `CHAR(36)`, UTC, FKs, índices e SQL parametrizado. Antes da execução em Hostinger, confirmar engine, versão, acesso remoto, SSL/firewall e hospedagem Node.

`003_pickup_test_calls.sql` acrescenta as relações de empresas/profissionais se ausentes, estado de serviço, localização mais recente e tabelas de chamadas de teste e histórico. O prazo e as transições são controlados pelo servidor/banco; o aceite usa atualização condicional em transação. A migração é aditiva e executada na inicialização junto da migração de identidade. Ela não cria empresas, vínculos nem pedidos automaticamente.
