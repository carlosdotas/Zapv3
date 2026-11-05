# Operações

Executar `npm run typecheck`, `npm test` e `npm run build`. Para a publicação unificada na Hostinger, use a raiz `./`, o build `npm run build`, a saída `services/api/dist` e a entrada `server.js`; conecte os domínios ao mesmo Web App Node. O processo entrega `dotas.site` como home, `empresa.dotas.site`, `profissional.dotas.site` e `admin.dotas.site` como portais, e `api.dotas.site` para a API. Backup/restauração, observabilidade, push e GPS real permanecem checklist pré-produção.

Em produção, configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` ou uma `DATABASE_URL` MySQL válida. As variáveis `DB_*` têm prioridade quando `DB_HOST` está definido. O endereço `localhost` só funciona se o MySQL estiver acessível no mesmo servidor do aplicativo. O usuário do banco precisa poder criar as tabelas de identidade e gravar dados nelas.

Para criar o primeiro administrador, configure `DEFAULT_ADMIN_NAME`, `DEFAULT_ADMIN_PHONE` (formato internacional, por exemplo `+55` seguido do DDD e telefone) e `DEFAULT_ADMIN_PASSWORD`. A inicialização aplica `002_identity_bootstrap.sql` e cria o administrador e perfil de motorista somente se não houver administrador. Se o telefone já existir, a inicialização recusa promover a conta automaticamente. Depois de criado, alterações nas variáveis não redefinem a senha. Não coloque a senha no repositório. A migração `001_initial_schema.sql` não deve ser executada integralmente sobre as tabelas já criadas; sua aplicação no banco existente exige reconciliação prévia.

## Chamadas de teste e Android

A versão 0.2.0 usa Socket.IO no mesmo processo Node e serviço Android nativo de localização. A hospedagem precisa encaminhar `/socket.io` (WebSocket e polling) para esse processo. A inicialização aplica a migração aditiva e idempotente `003_pickup_calls.sql` após `002`, sob bloqueio SQL próprio; se a nova migração falhar, o login permanece disponível e as chamadas ficam indisponíveis até a correção e o reinício. Não execute `001` integralmente no banco atual. A conta SQL precisa de permissão CREATE para as novas tabelas. Nenhum vínculo de empresa ou profissional é criado automaticamente: provisione empresas ativas, `company_members` com função autorizada e `company_professionals` ativos. O administrador global pode acessar empresas existentes sem vínculo individual.

A migração aditiva `004_pickup_self_test.sql` registra o vínculo de teste individual. Na tela da transportadora, um administrador que também tenha perfil de motorista pode escolher **Usar meu número para teste**: isso cria, somente após a ação explícita, uma transportadora identificada como teste e vincula apenas sua própria conta. Repetir a ação reutiliza a configuração; se ela tiver sido bloqueada ou revogada, não é reativada automaticamente. Para chamadas a outros motoristas, é necessário vínculo ativo prévio.

Configure `SESSION_SECRET` forte e `CORS_ORIGINS` com os domínios dos portais. Use UTC no servidor e na conexão SQL. A implementação atual usa um único processo Node; múltiplas réplicas exigem solução explícita de distribuição dos eventos antes de escalar.

No motorista, entre na conta, autorize notificações/localização e toque em **Entrar em serviço** com o aplicativo visível. O Foreground Service mantém GPS e Socket.IO, sem depender de temporizadores do WebView. A localização usa GPS a cada 10 s/10 m e rede a cada 30 s/25 m, com envio limitado. A notificação de chamada oferece Aceitar/Recusar e expira conforme o prazo do servidor. Sair de serviço interrompe imediatamente a coleta de GPS e tenta confirmar a saída ao servidor antes de fechar a conexão. Sem confirmação, a presença fica indisponível após o prazo de 90 s.

As novas chamadas têm prazo de dois minutos. O Android 0.3.0 reapresenta o alerta a cada oito segundos enquanto a chamada estiver pendente, sujeito às configurações e limitações do sistema; dispositivos que ainda usarem o APK 0.2.0 alertam uma vez e exibem o texto antigo de 30 segundos. No navegador, o som repetido depende de interação prévia para entrar em serviço e da página permanecer visível.

O motorista Android 0.4.0 oferece uma tela nativa de atendimento sobre o bloqueio, sem desbloquear o telefone; a resposta continua sendo confirmada pelo servidor. No Android 14 ou posterior, se necessário, use **Permitir chamadas em tela cheia** para abrir a permissão especial do sistema. Permita também notificações e mantenha o canal de chamadas com alta importância. Quando a permissão não estiver disponível, o Android pode apresentar somente a notificação destacada. Políticas de distribuição podem limitar o uso da permissão a aplicativos elegíveis; validar antes de publicar em lojas.

A migração aditiva `005_pickup_test_details.sql` guarda os detalhes da coleta de teste, incluindo o nome da transportadora no momento do envio. Na transportadora, informe local e endereço; a localização do aparelho só deve ser usada quando ele estiver no endereço da coleta. A distância exibida é aproximada, em linha reta, e só é calculada com GPS recente e preciso do motorista. Os dados da coleta aparecem na tela bloqueada durante a chamada. O Android 0.5.0 usa o áudio fornecido no canal de chamadas; o sistema e as configurações de som do usuário continuam controlando sua reprodução.

Não é solicitada permissão de localização permanente: o serviço de localização é iniciado com a Activity visível e usa a permissão durante o uso e o tipo `location` do Foreground Service. Não há início automático no boot ou reinício garantido após encerramento do processo. Com tela bloqueada o Android pode manter o serviço; aparelho desligado, sem internet, aplicativo forçado a parar ou processo encerrado não recebem chamadas. Modos silencioso/Não perturbe e configurações do canal podem impedir som/vibração.

Validação física pendente: Android 13/14/15+, autorização e recusa de permissões, bloqueio de tela por pelo menos 15 minutos, GPS na central, queda/retorno de rede, som/vibração, ações da notificação, expiração e encerramento do serviço. `adb install -r` exige certificado compatível com o APK instalado; preserve a chave original para atualizações. APKs debug são destinados a testes.

Teste de integração em banco local descartável: defina `ZAP_TEST_DATABASE_URL` para uma instância local autorizada, com nome de banco começando por `zap_test`, e execute `npm test`. O teste cria e remove somente seu banco isolado `zap_test_<timestamp>`; nunca use credenciais de produção.

### Ferramentas verificadas neste ambiente (2026-11-05)

Foram instalados e usados para compilar as duas variantes: JDK 17 em `/workspace/jdk17`, SDK 35/build-tools 35.0.0/platform-tools em `/workspace/android-sdk` e Gradle Wrapper 8.14.3. Reutilize essas ferramentas nesta sessão. Em uma nova máquina, confira os caminhos; a presença do Gradle Wrapper no Git não instala automaticamente o SDK/JDK.

```bash
ANDROID_HOME=/workspace/android-sdk \
ANDROID_USER_HOME=/workspace/android-user/.android \
GRADLE_USER_HOME=/workspace/gradle-cache \
JAVA_HOME=/workspace/jdk17 \
JAVA_TOOL_OPTIONS='-Duser.home=/workspace/android-user -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts -Dhttps.proxyHost=proxy -Dhttps.proxyPort=8080 -Dhttp.proxyHost=proxy -Dhttp.proxyPort=8080' \
npm run build:mobile
```

As opções de proxy/CA acima são específicas deste ambiente gerenciado. Preserve a verificação TLS. O comando sincroniza os APKs debug com os caminhos existentes do site; `npm run build` monta o artefato web/API para a Hostinger. O repositório não contém workflow GitHub Actions de implantação da Hostinger. Publicar o commit não comprova que a hospedagem atualizou.

Os APKs 0.2.0-debug (versionCode 2, minSdk 26, targetSdk 35) desta sessão têm assinatura validada, porém o certificado debug difere do APK anteriormente versionado. A chave anterior não está disponível neste checkout. A atualização sobre a instalação anterior exige a chave original; para testes, desinstale o APK anterior e instale o novo. Preserve a nova chave privada fora do Git para builds futuros. Não publique uma versão release sem configurar a assinatura oficial.

Os downloads 0.5.0-debug usam a mesma chave das versões 0.3.0 e 0.4.0 e podem ser instalados sobre elas. A chave difere da versão 0.2.0: dispositivos que ainda usarem 0.2.0 precisam desinstalá-la antes da instalação, o que pode apagar dados locais. Preserve a chave atual para futuras atualizações; não publique uma versão release sem configurar a assinatura oficial.
