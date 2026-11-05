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

Para apontar os aplicativos para outro ambiente, altere as URLs em `app/build.gradle` ou passe propriedades Gradle no build. As notificações deste primeiro APK são locais, para teste do fluxo. Notificações remotas e chamadas de voz dentro do aplicativo dependem da API de eventos e de um provedor push, que ainda não estão configurados no contrato atual.
