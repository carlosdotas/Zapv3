# Arquitetura

Monorepo npm com Node.js LTS, TypeScript e Fastify em um monólito modular. React/Vite compila uma home pública (`apps/home-web`) e três aplicações operacionais independentes: administração da plataforma, operação da empresa e operação do profissional. Em produção, o build reúne os quatro fronts em `services/api/dist/public` e o mesmo processo Node entrega a interface por host ou caminho (`/`, `/empresa/`, `/profissional/`, `/admin/`) e a API em `/api/v1`. SQL somente pela API. Integrações externas usam portas `MapsProvider`, `GeocodingProvider`, `PushProvider` e `StorageProvider`.

O processo único também hospeda Socket.IO autenticado para chamadas de teste e GPS. Estado e histórico das chamadas ficam no MySQL; a aplicação Android do motorista mantém uma conexão própria durante o serviço de primeiro plano. Não há provedor push: o recebimento depende do processo e da rede estarem ativos e das restrições do Android.
