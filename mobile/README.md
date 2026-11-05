# Aplicativos Android de teste

Este diretório contém um único projeto Android com dois produtos, ambos usando a aplicação web publicada por URL:

- `motorista`: `https://profissional.dotas.site/`
- `transportadora`: `https://empresa.dotas.site/`

Os APKs são cascas nativas pequenas. A tela, autenticação e operação continuam no frontend web atual. A ponte nativa expõe localização, notificações locais, agenda de contatos e discador telefônico para a versão móvel.

## Gerar os APKs

Com Android SDK, Java 17+ e Gradle disponíveis:

```bash
cd mobile/android
./gradlew assembleMotoristaDebug assembleTransportadoraDebug
```

Para compilar e atualizar automaticamente os downloads da home pública, use na raiz do repositório:

```bash
npm run build:mobile
```

Esse comando copia os APKs atualizados para `apps/home-web/public/downloads/`. O build web raiz preserva esses arquivos no pacote público.

Saídas:

```text
app/build/outputs/apk/motorista/debug/app-motorista-debug.apk
app/build/outputs/apk/transportadora/debug/app-transportadora-debug.apk
```

Para apontar as páginas para outro ambiente, altere as URLs em `app/build.gradle` ou passe propriedades Gradle no build. O serviço nativo de teste conecta à API em `https://api.dotas.site` enquanto o motorista estiver em serviço. Ele solicita localização, mantém uma notificação persistente e apresenta chamadas recebidas pela conexão com opções de aceitar ou recusar. Sem Firebase ou outro provedor push, não há garantia de recebimento quando o processo for encerrado pelo sistema, o usuário forçar parada, o telefone estiver desligado ou a rede indisponível. Testar em aparelhos reais, inclusive com a tela bloqueada, permissões negadas e reconexão. Os APKs debug são somente para teste; atualizações exigem assinatura compatível com a instalação anterior.
