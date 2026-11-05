# Arquitetura

Monorepo npm com Node.js LTS, TypeScript e Fastify em um monólito modular. React/Vite compila uma home pública (`apps/home-web`) e três aplicações operacionais independentes: administração da plataforma, operação da empresa e operação do profissional. SQL somente pela API. Integrações externas usam portas `MapsProvider`, `GeocodingProvider`, `PushProvider` e `StorageProvider`.
