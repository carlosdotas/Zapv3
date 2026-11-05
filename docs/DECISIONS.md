# Decisões

- MySQL 8/MariaDB é o alvo inicial por compatibilidade com Hostinger; o serviço usa `mysql2` para identidade persistente em produção.
- O adaptador em memória permanece para desenvolvimento e testes; a autenticação em produção não usa fallback em memória.

- Pickup test calls use Socket.IO (Node/client and native Java client) as explicitly requested. SQL request state and immutable history are authoritative, including deadline and first response. Existing session authentication is reused. No Firebase, Redis, hybrid mobile framework or operational order is introduced. Android foreground location starts only through the visible duty action; the service owns connection/location and notification actions. Multi-process delivery and guaranteed terminated-process wake-up are outside this implementation.
- The driver duty screen uses OpenStreetMap's public tile service through the existing `MapsProvider` boundary, without a key or added dependency. Tiles render as images so third-party map scripts cannot access the Android WebView's native bridge. Keep visible attribution, load only the current viewport, and treat tile availability as best effort; while location is unavailable, show a Brazil overview without a fabricated position.
