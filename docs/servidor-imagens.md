# Manutenção do servidor de imagens

## Fonte e distribuição

`backend/images.php` é a fonte de manutenção da implementação. `public/images.php` é uma distribuição gerada e completa, instalável sozinha em uma hospedagem PHP, sem `include` ou dependência de uma pasta `backend` no destino.

O repositório não declara qual cópia foi instalada no servidor externo. Esta etapa organiza os arquivos locais; não publica arquivos nem modifica instalações existentes.

## Configuração por destino

Cada arquivo mantém seu bloco `$CONFIG`. A geração preserva esse bloco inteiro em `public/images.php`, incluindo senha, limites, formatos, compressão e caminhos. As senhas originais dos arquivos continuam distintas. O gerador não mostra valores de configuração nos logs.

`__DIR__` continua sendo avaliado no arquivo instalado. `uploads/images/` e `uploads/cache/` permanecem relativos ao diretório de cada instalação. A geração não copia imagens, cache ou índice de hashes entre destinos.

Para personalizar a distribuição local, altere somente `$CONFIG` em `public/images.php`. Para alterar funções, rotas ou painel, edite `backend/images.php` e regenere. Novas opções de configuração exigem revisão explícita do bloco de cada destino; os parâmetros locais não são automaticamente substituídos pelos da origem.

Mantenha a declaração `$CONFIG = [` e o fechamento `];` em linhas próprias. O gerador recusa configurações ausentes ou ambíguas. Se o arquivo público estiver ausente, restaure-o com sua configuração antes de gerar; o script não inventa uma senha ou destino de armazenamento.

## Comandos

```bash
npm run images:sync
npm run images:check
npm run images:test
```

- `images:sync`: gera a distribuição, preservando a configuração existente do destino.
- `images:check`: detecta divergências de implementação sem escrever arquivos; configurações locais podem diferir da origem.
- `images:test`: verifica paridade, preservação de configurações personalizadas, idempotência e recusa de entradas ambíguas.

`npm test` também inclui os testes do gerador. `npm run build` verifica a distribuição no início de `prebuild`; uma divergência faz o comando falhar antes de atualizar os manifestos de versão. Sincronize e revise a diferença antes de tentar novamente.

## Publicação

1. Revise a implementação e a configuração do destino.
2. Execute sincronização, verificação e testes.
3. Compare a configuração da hospedagem PHP com a distribuição preparada. O gerador preserva o arquivo **local**, sem consultar a configuração remota.
4. Publique o arquivo completo com a configuração apropriada, mantendo os diretórios de imagens e cache da instalação.
5. Configure `IMAGE_SERVER_URL` e `IMAGE_SERVER_PASSWORD` no backend Node para a instalação escolhida.

Express/Vite não executam PHP. O arquivo em `public/` ou `dist/` é um artefato; sua execução exige hospedagem PHP. O redimensionamento também precisa da extensão GD e de permissão de escrita nos diretórios configurados.

## Validação desta etapa

Passaram quatro testes do gerador, TypeScript e build Vite/PWA. Também foram executados testes HTTP com PHP 8.3 e GD em um contêiner temporário. Cada arquivo foi copiado para um diretório isolado, com senha e imagem de teste, sem utilizar uploads reais.

Nos dois destinos foram verificados: sintaxe, ping, CORS/OPTIONS, recusa sem autenticação, upload JSON/base64, deduplicação, leitura do original, variantes `icon`/`thumb`/`md`/`lg`, recorte, reutilização do cache, resposta 304, listagem, login no painel, logout e exclusão do original e das miniaturas. O contêiner foi removido ao final. A hospedagem externa não foi alterada nem validada.
