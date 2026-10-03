# Lusorae — Play Console Submission Sheet

Documento operacional para preencher a Play Console de forma consistente com a implementação atual.

> Rever sempre contra a build que vai ser enviada. Não marcar funcionalidades/dados que ainda não existem.

## Store listing

### App name

**Lusorae**

### Short description

> Constrói e gere um império criminal fictício num mapa vivo de Portugal.

### Full description

> **Lusorae** é um jogo de estratégia e gestão criminal inteiramente ficcional, construído à volta de um mapa vivo de Portugal.
>
> Não controlas apenas uma personagem. Geres uma organização inteira: Quartel-General, equipas, operacionais, frota, armamento, propriedades, economia, influência e risco policial.
>
> Escolhe onde estabelecer o teu QG, acompanha oportunidades no mapa, prepara equipas adequadas a cada operação e gere as consequências das tuas decisões. Combustível, desgaste, moral, lealdade, salários, dinheiro limpo e sujo, calor policial e progressão fazem parte do mesmo sistema persistente.
>
> **Principais sistemas**
>
> • mapa operacional vivo e mundo gerado em redor do QG;  
> • dezenas de tipos de operações e missões;  
> • equipas e operacionais com atributos, especializações e progressão;  
> • veículos com combustível, condição, autonomia e notoriedade;  
> • armamento com compatibilidade, desgaste e fiabilidade;  
> • propriedades e evolução do Quartel-General;  
> • economia dupla e gestão de risco;  
> • Cidade Viva com territórios, contactos e atividades;  
> • grandes golpes em várias fases através do sistema Mastermind;  
> • presença policial PSP/GNR simulada conforme a área;  
> • interface tática mobile-first.
>
> Lusorae é uma obra de ficção destinada exclusivamente a entretenimento. Não ensina nem incentiva atividades ilegais reais.

### Category

**Game → Strategy**

### Contact

- Support / privacy email: `geral@lusorae.pt`
- Website: `https://pulsebreakpt.github.io/LusoraeCrime/`
- Privacy policy: `https://pulsebreakpt.github.io/LusoraeCrime/privacy.html`
- Account deletion: `https://pulsebreakpt.github.io/LusoraeCrime/delete-account.html`

## App access

A app requer autenticação para guardar progresso.

Texto sugerido para reviewers:

> The app can be accessed with Google Sign-In.  
> 1. Open Lusorae.  
> 2. Tap “Continuar com Google”.  
> 3. Select a Google account.  
> 4. The app creates or restores the Lusorae account automatically.  
> 5. For a new account, choose a Headquarters location on land in Portugal using the in-game map. No device GPS permission is required.  
> 6. The main game is then available.
>
> Google Sign-In must be in Production mode and not restricted to an internal test-user list during review.

Se o ambiente submetido não estiver aberto a qualquer Conta Google, fornecer uma conta de reviewer estável em vez de depender de um test user temporário.

## Ads

Implementação atual:

**No ads.**

Se forem adicionados SDKs de anúncios no futuro, atualizar esta declaração e a Política de Privacidade antes da release.

## Data Safety

### Dados recolhidos/geridos pelo serviço

#### Email address

- Collected: **Yes**
- Purpose: **App functionality / Account management**
- Required: necessário para uma conta persistente/autenticação.
- Google Sign-In pode fornecê-lo ao backend.

#### User IDs

- Collected: **Yes**
- Examples: Lusorae user ID, Google subject identifier.
- Purpose: **App functionality / Account management / Security**

#### App activity / gameplay

- Collected: **Yes**
- Examples: game progression, missions, resources, teams, assets, settings relevant to server state.
- Purpose: **App functionality**

#### Security information

A aplicação processa dados técnicos de segurança, incluindo IP em determinados fluxos de autenticação/legal e tentativas de acesso.

Confirmar na taxonomia atual da Play Console em que categoria estes dados devem ser declarados quando o formulário for preenchido.

### Dados não recolhidos pela implementação atual

- precise or approximate device location;
- contacts;
- photos or videos;
- microphone recordings;
- camera data;
- SMS;
- call logs;
- advertising ID for advertising;
- health data;
- financial/payment card data.

### Shared data

Não declarar “no sharing” apenas porque não há venda de dados. Rever as exceções de **service provider** da definição atual da Play Console para o fluxo Google Sign-In e infraestrutura de alojamento.

A Política de Privacidade já explica o uso da Google como fornecedor de identidade quando o utilizador escolhe esse método.

## Account deletion

### In-app

**Definições → Conta → Eliminar conta**

A ação apaga a conta Lusorae e o progresso associado.

### Web resource

`https://pulsebreakpt.github.io/LusoraeCrime/delete-account.html`

A página permite iniciar o pedido através do email oficial e identifica explicitamente Lusorae/PulseBreakPT.

## Content rating / IARC

Responder “Yes” quando a pergunta aplicável corresponder realmente a:

- fictional crime themes;
- weapons;
- violent/criminal operations;
- police chases;
- kidnapping/assassination references presentes no catálogo;
- simulated wagering/gambling mechanics (corridas com apostas em moeda virtual).

Não existe atualmente cash-out, aposta com dinheiro real nem prémio convertível em dinheiro real.

### Atenção à idade

Os documentos atuais do projeto indicam 16+. Não assumir que isto será a classificação da Store.

A classificação final deve seguir o resultado IARC. Devido à combinação de crime, armas, referências violentas e apostas simuladas, **verificar cuidadosamente se o resultado regional exige 18+**. Se exigir, atualizar também Termos, Política de Privacidade e Target Audience para permanecer consistente.

## Target audience

Não selecionar crianças.

Escolher os grupos etários apenas depois de concluir o IARC. Se o rating resultante for adulto numa região relevante, usar uma audiência compatível.

## News / health / finance / government

Implementação atual:

- News app: No.
- Health app: No.
- Government app: No.
- Financial-services app: No.
- Crypto wallet/exchange: No. A “Fraude de Criptomoedas” existente é apenas conteúdo ficcional de jogo.
- Real-money gambling: No.

## Advertising ID

A implementação atual não precisa de Advertising ID.

Evitar adicionar `com.google.android.gms.permission.AD_ID` ou SDKs que a introduzam sem necessidade. Se algum SDK futuro a adicionar, rever manifest e Data Safety.

## Permissions

O jogo deve continuar a funcionar sem:

- GPS/location;
- camera;
- microphone;
- contacts;
- storage/media broad permissions;
- SMS/phone.

Google Sign-In é feito através do Credential Manager e não exige estas permissões.

## Monetization / Play Billing

Atualmente a loja do jogo usa apenas moeda virtual obtida no próprio jogo.

Se surgir uma compra por dinheiro real de conteúdo digital, incluindo:

- VIP;
- moeda;
- boosts;
- cosméticos;
- slots;

integrar Google Play Billing antes da publicação dessa funcionalidade e atualizar a declaração de monetização.

## Store assets ainda necessários na Play Console

- 512×512 app icon.
- 1024×500 feature graphic.
- Phone screenshots da build Android final.
- Opcionalmente tablet screenshots se o layout for publicado para tablets.
- Video trailer opcional.

Os screenshots devem ser da aplicação final e não podem apresentar funcionalidades inexistentes.

## Release fields

### Package name

`pt.lusorae.crime`

### Target SDK

`36`

### Versioning

Primeira release sugerida:

- `versionCode = 1`
- `versionName = 1.0.0`

Cada AAB posterior precisa de um `versionCode` superior.

## Closed testing

Se a conta Play for pessoal e tiver sido criada após 13/11/2023:

- criar Closed testing track;
- obter 12 testers;
- todos devem permanecer opted-in continuamente;
- manter o teste por pelo menos 14 dias;
- depois pedir Production access na dashboard.

Não iniciar a contagem até a configuração da app estar suficientemente completa para o teste fechado.

## Pre-launch report

Antes de produção verificar:

- crashes;
- ANRs;
- renderização do mapa;
- login Google;
- fluxo de nova conta;
- eliminação de conta;
- navegação Android back;
- resume após background;
- rede lenta/sem rede;
- telas pequenas;
- Android 16;
- device com 16 KB memory page size.

## Review consistency rule

Os quatro locais abaixo têm de contar a mesma história:

1. comportamento real da app;
2. Privacy Policy;
3. Data Safety;
4. respostas App Content / IARC / Target Audience.

Se um deles mudar, rever os outros antes de enviar uma nova release.
