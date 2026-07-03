# Deployment do LusoraeCrime

Stack **100% Docker**: MongoDB + FastAPI + Caddy (serve o React e faz
reverse-proxy de `/api`, com HTTPS automático via Let's Encrypt).

## 👉 Guia de instalação

**[HOSTINGER.md](./HOSTINGER.md)** — deploy num VPS Ubuntu em 3 comandos.

```bash
git clone git@github.com:PulseBreakPT/LusoraeCrime.git lusoraecrime-app
cd lusoraecrime-app
sudo bash deploy/hostinger-setup.sh
```

## Conteúdo desta pasta

| Ficheiro | Função |
|----------|--------|
| `hostinger-setup.sh` | Setup completo num comando (instala Docker, gera segredos, build + arranque, instala o comando `lusoraecrime`) |
| `docker-compose.yml` | Stack completo: `mongo` + `backend` + `web` (Caddy) |
| `Caddyfile` | Config do Caddy (SPA + proxy `/api` + HTTPS automático) |
| `frontend/Dockerfile` | Build multi-stage do React → servido pelo Caddy |
| `backend/Dockerfile` | Imagem de produção do FastAPI |
| `backend/requirements.production.txt` | Dependências Python de produção (subconjunto mínimo do que o código importa) |
| `.env.production.example` | Template/documentação das variáveis de ambiente |
| `auto-deploy.sh` | Deploy manual (git pull + rebuild), alternativa ao comando `lusoraecrime` |
| `scripts/backup-mongo.sh` | Backup do MongoDB (ver secção Backups em HOSTINGER.md) |
