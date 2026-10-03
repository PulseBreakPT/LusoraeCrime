# Lusorae — Google Play Release Guide (2026)

> Estado alvo: **Google Play Store**, Android 16 / API 36, Android App Bundle (AAB), Google Sign-In e backend FastAPI.

## Identidade da app

| Campo | Valor |
|---|---|
| Nome | Lusorae |
| Package / Application ID | `pt.lusorae.crime` |
| Categoria sugerida | Jogo · Estratégia |
| Público definido pelo projeto | 16+ |
| Frontend | React 19 + Capacitor 8 |
| Backend | FastAPI + MongoDB |
| Formato Play | AAB |
| Target SDK | 36 |
| Compile SDK | 36 |
| Min SDK | 24 |

> O package ID deve ser considerado permanente depois da primeira publicação na Google Play.

## Requisitos Google Play relevantes

### Obrigatórios no projeto

- Target Android 16 / API 36 para novos envios a partir de 31/08/2026.
- Publicação em Android App Bundle (AAB).
- Política de Privacidade pública e acessível sem login.
- Formulário Data Safety preenchido de acordo com o comportamento real da app e SDKs.
- Classificação etária IARC concluída.
- Declaração App Access preenchida se existirem áreas protegidas por autenticação.
- Eliminação de conta dentro da aplicação e através de recurso web externo quando a app permite criar contas.
- Ícone, feature graphic, screenshots, descrições e restantes recursos da Store Listing.
- AAB assinado com uma upload key e Play App Signing ativo/recomendado.
- Testes de estabilidade, Android vitals e ausência de crashes/ANRs bloqueadores.

### Contas pessoais recentes

Se a conta de programador for **pessoal e criada depois de 13/11/2023**, a Google exige atualmente um teste fechado com pelo menos **12 testers** continuamente inscritos durante **14 dias** antes de permitir pedido de acesso à produção.

## URLs para Play Console

Depois do deploy do GitHub Pages:

- Política de Privacidade:  
  `https://pulsebreakpt.github.io/LusoraeCrime/privacy.html`
- Eliminação de conta:  
  `https://pulsebreakpt.github.io/LusoraeCrime/delete-account.html`
- Site/demo:  
  `https://pulsebreakpt.github.io/LusoraeCrime/`

## Google Sign-In

O projeto usa Google Sign-In com:

1. Credential Manager no Android, através do plugin Capacitor.
2. Google ID token recebido no dispositivo.
3. Envio do ID token ao endpoint `POST /api/auth/google`.
4. Validação server-side com `google-auth`.
5. Verificação da audiência através de `GOOGLE_WEB_CLIENT_ID`.
6. Verificação de email confirmado.
7. Ligação segura a conta existente quando o mesmo email já existe.
8. Criação de conta Lusorae e jogador quando é um utilizador novo.
9. Emissão dos JWT access/refresh normais do Lusorae.

### Dados Google minimizados

O Lusorae não precisa de guardar foto de perfil nem nome real Google. Atualmente o fluxo persiste apenas o identificador Google necessário à associação da conta e o email verificado, além dos dados internos do jogo.

## Configurar Google Cloud

Usar **o mesmo projeto Google Cloud** para os clientes OAuth.

### 1. OAuth consent / Google Auth Platform

Configurar:

- App name: `Lusorae`
- Support email: email oficial
- Developer contact: `geral@lusorae.pt`
- Privacy policy: `https://pulsebreakpt.github.io/LusoraeCrime/privacy.html`
- Authorized domain/site conforme a infraestrutura final
- Publicar a configuração para produção quando estiver pronta para review

### 2. Web OAuth client

Criar um OAuth Client ID do tipo **Web application**.

O Client ID deste cliente é o valor usado em:

- backend: `GOOGLE_WEB_CLIENT_ID`
- frontend build: `REACT_APP_GOOGLE_WEB_CLIENT_ID`
- GitHub Actions variable: `GOOGLE_WEB_CLIENT_ID`

Nunca guardar Client Secret no frontend. Para o fluxo atual de ID token não é necessário expor um client secret na app.

### 3. Android OAuth client

Criar um OAuth Client ID do tipo **Android** com:

- Package name: `pt.lusorae.crime`
- SHA-1: certificado usado na build/teste

Para produção com Play App Signing:

1. Upload inicial da app para a Play Console.
2. Abrir **Setup / App integrity**.
3. Copiar o SHA-1 do **App signing key certificate**.
4. Criar/adicionar esse SHA-1 ao Android OAuth client no mesmo projeto Google Cloud.

Também é útil ter um Android OAuth client para a upload/debug key usada fora da Play Store.

## Variáveis do GitHub

Em **Repository → Settings → Secrets and variables → Actions → Variables**:

### `GOOGLE_WEB_CLIENT_ID`

Valor do Web OAuth Client ID.

Usado pelo frontend e deve corresponder à audiência validada pelo backend.

### `ANDROID_BACKEND_URL`

URL HTTPS do backend de produção, sem `/api`.

Exemplo:

```
https://api.exemplo.pt
```

Enquanto esta variável não estiver definida, o workflow Android usa o backend preview existente apenas para validação técnica.

## Backend de produção

No `.env.production`:

```env
GOOGLE_WEB_CLIENT_ID=<web-oauth-client-id>
CORS_ORIGINS=https://teudominio.pt,https://pulsebreakpt.github.io,https://localhost
```

Depois reconstruir backend e frontend.

O `https://localhost` é a origem WebView utilizada pela configuração Capacitor atual.

## Eliminação de conta

### Dentro da app

`Definições → Conta → Eliminar conta`

- Contas email/password confirmam com a password atual.
- Contas Google-only não possuem password Lusorae; usam a sessão autenticada.
- O backend elimina o utilizador e dados de jogo associados.

### Fora da app

A página pública `delete-account.html` permite iniciar um pedido através de `geral@lusorae.pt`, sem enviar passwords/tokens.

## Data Safety — mapa preliminar do Lusorae

A declaração final deve sempre refletir a versão efetivamente publicada.

### Dados tratados pela app

| Categoria | Exemplo no Lusorae | Finalidade |
|---|---|---|
| Personal info · Email address | Email da conta / Google | Account management, authentication |
| User IDs | ID Lusorae + Google subject | Account management, authentication |
| App activity | Progresso, ações, missões e estado do jogo | App functionality |
| Other user-generated/internal game data | Organização, equipas, recursos | App functionality |
| Security data | IP / tentativas de login / aceitação legal | Security, fraud prevention, legal |

### Não usados atualmente

- localização GPS do dispositivo;
- contactos;
- fotografias/vídeos do utilizador;
- microfone/câmara;
- SMS/chamadas;
- advertising ID;
- anúncios comportamentais;
- Google Analytics;
- venda de dados pessoais.

> Escolher um QG num mapa **não é recolha da localização física do dispositivo**. A app não solicita permissão de localização para esse fluxo.

### Google como fornecedor de autenticação

Quando o utilizador escolhe Google Sign-In, a Google participa no fluxo de autenticação. Isto deve ser refletido de forma coerente na Política de Privacidade e no Data Safety.

## IARC / classificação etária

Responder ao questionário com base no conteúdo real, não na intenção.

O Lusorae contém:

- temática criminal ficcional;
- referências a armas;
- assaltos e operações criminosas simuladas;
- polícia/perseguições;
- gestão de risco/calor;
- apostas virtuais em corridas no módulo Cidade Viva.

As apostas são atualmente com moeda do jogo, sem prémios convertíveis em dinheiro real. Ainda assim, a presença de **simulated gambling/wagering** deve ser declarada quando a pergunta IARC aplicável aparecer.

Não selecionar uma classificação etária manualmente: a classificação final é determinada pelo questionário IARC e pelas autoridades regionais.

## Monetização

A loja atual usa **dinheiro do jogo**.

Se no futuro forem vendidos por dinheiro real:

- moeda virtual;
- VIP;
- boosts;
- cosméticos;
- slots;
- outros bens digitais;

a compra dentro da app Android distribuída pela Play deverá usar **Google Play Billing**, salvo exceção aplicável nas regras em vigor no país/programa relevante.

## App Access para review

O jogo cria automaticamente uma conta através do Google Sign-In, por isso o reviewer pode testar com uma Conta Google quando:

- Google Auth Platform estiver publicada para produção;
- o OAuth não estiver limitado a test users;
- o backend de produção estiver online;
- o Client ID estiver correto.

Na secção **App access** da Play Console, fornecer instruções claras:

1. Abrir a app.
2. Tocar **Continuar com Google**.
3. Escolher uma Conta Google.
4. Aceitar os documentos apresentados.
5. Escolher o Quartel-General no mapa.
6. O jogo fica acessível.

Se for usado um ambiente restrito, fornecer também uma conta de teste reutilizável e credenciais válidas durante todo o período de review.

## Store Listing

Preparar:

- App icon: PNG 512×512.
- Feature graphic: 1024×500.
- Screenshots de telemóvel reais da build final.
- Nome da app.
- Short description.
- Full description.
- Support email.
- Website.
- Privacy policy URL.

As imagens e descrições não devem prometer funções inexistentes.

## Android build

Workflow:

`.github/workflows/android.yml`

A pipeline:

1. usa Node 22;
2. usa Java 17;
3. instala API 36;
4. verifica sintaxe do auth backend;
5. compila React;
6. cria o projeto Capacitor Android;
7. aplica a integração SocialLogin/Credential Manager;
8. verifica compile/target SDK 36 e minSdk 24;
9. gera AAB de validação;
10. publica o AAB como artifact do GitHub Actions.

### Build local

```bash
cd frontend
yarn install
PUBLIC_URL=/ yarn build
npx cap add android
npx cap sync android
node scripts/patch-capacitor-android.mjs
cd android
./gradlew bundleDebug
```

## Upload key e AAB release

O AAB enviado à Play Store deve estar assinado.

Gerar uma **upload key** e guardá-la fora do repositório:

```bash
keytool -genkeypair -v \
  -keystore lusorae-upload.jks \
  -alias lusorae-upload \
  -keyalg RSA -keysize 4096 \
  -validity 10000
```

Nunca commitar o `.jks`, passwords ou secrets.

Ativar **Play App Signing** no primeiro release. A Google passa a proteger a app signing key; a tua upload key é usada para autenticar futuros uploads.

## GitHub Secrets para AAB release assinado

Depois de criares a upload key, adiciona estes valores em **Settings → Secrets and variables → Actions → Secrets**:

- `ANDROID_UPLOAD_KEYSTORE_BASE64` — conteúdo base64 do ficheiro `.jks`.
- `ANDROID_UPLOAD_KEYSTORE_PASSWORD` — password do keystore.
- `ANDROID_UPLOAD_KEY_ALIAS` — alias da chave.
- `ANDROID_UPLOAD_KEY_PASSWORD` — password da chave.

Exemplo para obter o base64 localmente:

```bash
base64 -w 0 lusorae-upload.jks
```

Em macOS:

```bash
base64 < lusorae-upload.jks | tr -d '\n'
```

O workflow nunca grava a upload key no repositório: reconstrói-a temporariamente no runner, gera o AAB e remove o ficheiro no final.

### Versionamento Android

Em **Actions → Variables** podes definir:

- `ANDROID_VERSION_CODE` — inteiro crescente obrigatório em cada upload Play.
- `ANDROID_VERSION_NAME` — versão visível, por exemplo `1.0.0`.

Se não existirem, a pipeline usa `1` e `1.0.0`.

Com os quatro secrets de assinatura configurados, o artifact final chama-se:

`lusorae-google-play-aab`

Sem esses secrets, a pipeline continua a validar tudo e gera apenas:

`lusorae-android-debug-aab`

---

## Testes antes da submissão

- Instalação numa build Android real.
- Google Sign-In: conta nova.
- Google Sign-In: conta existente.
- Logout/login.
- Refresh token.
- Eliminação de conta Google-only.
- Eliminação de conta password.
- QG em Portugal.
- Mapa e Leaflet no WebView.
- Voltar/retomar app.
- Sem rede e recuperação.
- Dispositivos Android 8+ (minSdk 24) até Android 16.
- 64-bit.
- 16 KB page-size compatibility.
- Ausência de crashes/ANRs.
- Links de Termos, Privacidade e Eliminação.
- Orientação e safe areas.
- Performance/memória em dispositivo médio.

## Antes de clicar “Send for review”

- [ ] Google Cloud OAuth configurado.
- [ ] `GOOGLE_WEB_CLIENT_ID` configurado no backend e GitHub.
- [ ] Android OAuth client com package + SHA-1.
- [ ] Play App Signing SHA-1 adicionado ao OAuth Android client.
- [ ] Backend de produção online por HTTPS.
- [ ] `ANDROID_BACKEND_URL` aponta ao backend final.
- [ ] Privacy URL acessível sem login.
- [ ] Account deletion URL acessível sem login.
- [ ] Data Safety preenchido.
- [ ] IARC preenchido honestamente.
- [ ] Target audience selecionado corretamente.
- [ ] App Access preenchido.
- [ ] Ads declaration = No, se continuar sem anúncios.
- [ ] Content declarations completas.
- [ ] AAB release assinado.
- [ ] Store listing e screenshots finais.
- [ ] Closed testing concluído, se a conta estiver sujeita à regra 12/14 dias.
- [ ] Pre-launch report sem erros bloqueadores.
