# Zap Platform

Base inicial da plataforma Zap Encomendas: uma API Fastify, uma home pública e três frontends operacionais independentes.

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run build
npm run dev:api
```

A API fica em `http://localhost:3000` e expõe `GET /health`. O banco Hostinger ainda precisa ser confirmado quanto a engine, acesso remoto, SSL e suporte a Node.
