# Deploy do SUBMUNDO na Hostinger (VPS Ubuntu) — Guia rápido

Stack **100% Docker**, um único comando. Sem CloudPanel, sem Nginx manual,
sem build de frontend à parte. O Caddy trata do HTTPS automaticamente.

```
Internet :80/:443
   │
   ▼
┌──────────────────────────────────────┐
│ Caddy (container "web")              │
│  • HTTPS automático (Let's Encrypt)  │
│  • /        → React estático (/srv)  │
│  • /api/*   → backend:8001           │
└───────────────┬──────────────────────┘
                │ rede interna Docker
        ┌───────┴────────┐
        ▼                ▼
   backend (FastAPI)   mongo (MongoDB 7)
```

---

## O teu VPS

| | |
|---|---|
| IP | `195.200.14.60` |
| Hostname (já resolve, DNS pronto) | `srv1758509.hstgr.cloud` |
| Acesso | `ssh root@195.200.14.60` |

Este guia usa `srv1758509.hstgr.cloud` como domínio — a Hostinger já o
associa ao IP do VPS, por isso o Caddy consegue emitir HTTPS **sem
precisares de comprar um domínio próprio**. Quando (ou se) comprares um
domínio, basta re-correr o setup com `SITE_DOMAIN=teudominio.pt`.

---

## ⚠️ Estás a substituir o projeto antigo

Se o VPS ainda tem outro stack a correr (o RedeSocial, ou uma tentativa
anterior de deploy deste próprio projeto), ele **ocupa as portas 80 e
443** — o novo stack não consegue arrancar enquanto isso não for
resolvido. O nome do projeto Docker Compose varia (`lusorae`,
`crimelife`, etc.) — confirma qual é antes de parares nada:

```bash
ssh root@195.200.14.60

# Vê o que está a correr e a que projeto Compose pertence
docker ps
docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' <nome-do-container>

# Pára esse stack (liberta as portas 80/443, mantém os dados no volume)
docker compose -p <nome-do-projeto> down
```

Isto **não apaga dados** — só pára os containers. Os volumes do stack
antigo continuam no disco (`docker volume ls`) até decidires removê-los
explicitamente. Só faz `docker volume rm` se tiveres a certeza de que já
não precisas desses dados.

---

## Instalação (3 comandos)

O repositório é privado — clona por SSH (usa a deploy key já configurada
em Settings → Deploy keys do repo; se o VPS ainda não tiver a chave
privada correspondente, gera uma nova e adiciona-a lá antes deste passo).

```bash
# 1. SSH no VPS
ssh root@195.200.14.60

# 2. Clonar o repositório (SSH — não pede password)
git clone git@github.com:PulseBreakPT/SUBMUNDO.git submundo-app
cd submundo-app

# 3. Correr o setup (instala Docker, gera segredos, faz build e arranca tudo)
sudo bash deploy/hostinger-setup.sh
```

O script demora ~5-8 min na primeira vez. No fim mostra:
- As **credenciais de admin** geradas (guarda-as!).
- O estado dos containers.
- O URL do site.

Abre **https://srv1758509.hstgr.cloud** no browser. O certificado HTTPS é
emitido no primeiro acesso (aguarda ~30s se vires aviso de certificado).

---

## Domínio próprio mais tarde?

Compra o domínio, aponta o registo `A` para `195.200.14.60`, espera o DNS
propagar e re-corre:

```bash
cd ~/submundo-app
sudo SITE_DOMAIN=oteudominio.pt ACME_EMAIL=tu@email.com bash deploy/hostinger-setup.sh
```

(Isto reconstrói o frontend com o novo domínio embutido e pede um novo
certificado — o `.env.production` existente não é apagado, mas as linhas
`SITE_DOMAIN`/`CORS_ORIGINS` têm de ser atualizadas manualmente nele se o
script não as tiver sobrescrito porque o ficheiro já existia.)

Alternativa mais rápida, sem correr o script todo outra vez (usa isto se
o `.env.production` já existir e só quiseres trocar o domínio):

```bash
cd ~/submundo-app/deploy
sed -i 's/^SITE_DOMAIN=.*/SITE_DOMAIN=oteudominio.pt/' .env.production
sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://oteudominio.pt,https://www.oteudominio.pt|' .env.production
docker compose --env-file .env.production up -d --build --remove-orphans backend web
```

O `Caddyfile` já inclui um redirect automático de `www.<domínio>` para o
domínio canónico (só emite certificado para o `www` se esse subdomínio
também resolver para este VPS — caso contrário fica só um aviso nos logs,
sem afetar o domínio principal).

---

## Operações do dia-a-dia

```bash
cd ~/submundo-app/deploy

# Ver logs
docker compose --env-file .env.production logs -f
docker compose --env-file .env.production logs -f backend
docker compose --env-file .env.production logs -f web

# Estado
docker compose --env-file .env.production ps

# Reiniciar
docker compose --env-file .env.production restart

# Parar / arrancar
docker compose --env-file .env.production down
docker compose --env-file .env.production up -d
```

### Atualizar após mudanças no GitHub

O setup instala um comando global `submundo` — é o teu novo
`sudo submundo web` de sempre:

```bash
sudo submundo              # atualiza tudo (backend + frontend)
sudo submundo backend      # só API (mais rápido)
sudo submundo web          # só frontend
```

Faz `git fetch` + `git reset --hard origin/main` + rebuild dos containers
afetados, e espera o backend ficar saudável antes de terminar.

### Backups do MongoDB

```bash
# Backup manual (guarda em /var/backups/lusoraecrime/mongo/)
sudo bash deploy/scripts/backup-mongo.sh

# Cron diário às 03:30
( sudo crontab -l 2>/dev/null | grep -v backup-mongo.sh;
  echo "30 3 * * * /bin/bash ~/submundo-app/deploy/scripts/backup-mongo.sh >> /var/log/lusoraecrime-backup.log 2>&1"
) | sudo crontab -
```

Retenção automática de 14 dias. O comando de restauro é impresso no fim de
cada backup.

---

## Resolução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Aviso de certificado / HTTPS falha | Portas 80/443 fechadas ou domínio não resolve para este VPS | `dig +short srv1758509.hstgr.cloud` deve dar `195.200.14.60`. Abre 80/443. Aguarda e recarrega. |
| `port is already allocated` (80/443) | Outro serviço (o projeto antigo, CloudPanel, Nginx) ocupa as portas | Ver secção "Estás a substituir o projeto antigo" acima. |
| Backend não fica saudável | Erro de arranque (env var em falta, Mongo não ligou) | `docker compose --env-file .env.production logs --tail=80 backend` |
| Página em branco | Build do frontend falhou | `docker compose --env-file .env.production logs web` e `... up -d --build web` |
| Esqueci a password de admin | — | `grep ADMIN_PASSWORD deploy/.env.production` |

---

## Notas técnicas

- O frontend chama a API através de `REACT_APP_BACKEND_URL` (definido em
  build-time como `https://<SITE_DOMAIN>`) — ver `frontend/src/lib/api.js`.
  Se mudares de domínio, tens de fazer rebuild do `web` (o setup já trata
  disso).
- O backend corre com **1 worker** (o arranque corre migrações de dados
  e cria o admin — duplicar isto com >1 worker causaria condições de
  corrida). Não aumentar `--workers`.
- O MongoDB **não está exposto** ao exterior — só acessível na rede Docker.
- Os certificados Caddy persistem no volume `lusoraecrime_caddy_data`
  (sobrevivem a reinícios e rebuilds).
- O backend fica em `127.0.0.1:8001` no host apenas para debug local
  (`curl http://127.0.0.1:8001/api/`).
