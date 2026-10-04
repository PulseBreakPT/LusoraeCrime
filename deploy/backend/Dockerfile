# =============================================================================
# SUBMUNDO backend — Dockerfile de produção
# =============================================================================
# Python 3.11 slim + uvicorn com 1 worker único.
# =============================================================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 submundo \
    && useradd --system --uid 1001 --gid submundo --home /app --shell /usr/sbin/nologin submundo

WORKDIR /app

COPY deploy/backend/requirements.production.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r /app/requirements.txt

COPY --chown=submundo:submundo backend/ /app/

USER submundo

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/api/', timeout=3).status==200 else 1)"

# 1 worker único: o startup corre migrações (migrate_v2/migrate_v4) e seed do
# admin uma única vez — escalar para >1 worker duplicaria esse trabalho.
CMD ["uvicorn", "server:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "1", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--access-log", \
     "--log-level", "info"]
