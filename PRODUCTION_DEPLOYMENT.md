# Production Deployment Guide

This setup targets a single VM with:

- `Nginx` on the host for TLS termination and reverse proxy
- `PostgreSQL` on the host VM
- `api`, `worker`, and `valkey` in Docker

## Files Added for Production

- `docker-compose.production.yml`
- `.env.production.example`
- `deploy/nginx/indeal.conf`
- `scripts/deploy-production.sh`
- `scripts/smoke-production.sh`

## 1. Prepare the VM

Install:

- Docker Engine with Compose
- Nginx
- PostgreSQL
- Certbot or your preferred TLS certificate flow

Recommended host posture:

- expose only `80` and `443` publicly
- keep PostgreSQL bound to `127.0.0.1` or a private interface
- do not expose Valkey publicly

## 2. Prepare App Configuration

Create the production env file:

```bash
cp .env.production.example .env.production
```

Fill in real production values for:

- database credentials
- `JWT_SECRET`
- `CHAT_MASTER_KEY`
- R2 credentials
- Resend credentials
- public frontend and API URLs

Recommended production values:

- `NODE_ENV=production`
- `LOG_FORMAT=json`
- `AUTH_DEBUG_OTP_ENABLED=false`
- `SWAGGER_ENABLED=false`

## 3. Configure PostgreSQL on the Host

Create the production database and user on the VM. Then ensure the app can connect through:

- `DB_HOST=host.docker.internal`
- `DB_PORT=5432`

On Linux, the production Compose file maps `host.docker.internal` to the Docker host using `host-gateway`.

## 4. Configure Nginx

Copy the sample site config:

```bash
sudo cp deploy/nginx/indeal.conf /etc/nginx/sites-available/indeal.conf
sudo ln -s /etc/nginx/sites-available/indeal.conf /etc/nginx/sites-enabled/indeal.conf
```

Then edit:

- `server_name`
- certificate paths

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The sample config already includes:

- HTTP to HTTPS redirect
- reverse proxy to `127.0.0.1:3000`
- WebSocket forwarding for `/socket.io/`
- access and error log files

## 5. Deploy the Application

Release flow:

```bash
sh scripts/deploy-production.sh
```

That script does the following:

1. builds the `api` and `worker` images
2. starts `valkey`
3. runs `prisma migrate deploy`
4. starts or replaces `api` and `worker`

Manual equivalent:

```bash
docker compose -f docker-compose.production.yml build api worker
docker compose -f docker-compose.production.yml up -d valkey
docker compose -f docker-compose.production.yml --profile ops run --rm migrate
docker compose -f docker-compose.production.yml up -d api worker
```

## 6. Verify the Deployment

Local smoke checks against the API bind port:

```bash
sh scripts/smoke-production.sh
```

Checks through Nginx:

```bash
curl -I https://api.example.com/
curl https://api.example.com/api/v1/health
curl https://api.example.com/api/v1/system/config
```

Operational checks:

- confirm `docker compose -f docker-compose.production.yml ps`
- confirm worker logs show all three workers started
- confirm Nginx logs requests successfully
- confirm Socket.IO can connect through the public domain

## 7. Backups and Monitoring

Minimum production baseline:

- daily PostgreSQL backups on the host
- Docker restart policy already enabled for `api`, `worker`, and `valkey`
- monitor:
  - `/api/v1/health`
  - PostgreSQL disk usage
  - Valkey memory
  - queue backlog and failed jobs
  - Nginx error log

## 8. Operational Notes

- `api` handles HTTP and Socket.IO only
- `worker` handles BullMQ workers and scheduled cleanup jobs
- do not scale `worker` horizontally without revisiting repeatable-job ownership
- if you need multiple API replicas later, keep `ENABLE_REDIS_ADAPTER=true`
