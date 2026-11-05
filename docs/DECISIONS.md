# Decisões

- MySQL 8/MariaDB é o alvo inicial por compatibilidade com Hostinger; o serviço usa `mysql2` para identidade persistente em produção.
- O adaptador em memória permanece para desenvolvimento e testes; a autenticação em produção não usa fallback em memória.

- Pickup test calls use Socket.IO (Node/client and native Java client) as explicitly requested. SQL request state and immutable history are authoritative, including deadline and first response. Existing session authentication is reused. No Firebase, Redis, hybrid mobile framework or operational order is introduced. Android foreground location starts only through the visible duty action; the service owns connection/location and notification actions. Multi-process delivery and guaranteed terminated-process wake-up are outside this implementation.
