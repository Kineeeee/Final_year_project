# EC2 Deployment (Docker + Caddy)

This folder contains the production stack used on AWS EC2.

## 1) Prepare EC2 (Ubuntu)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Open these Security Group ports:

- 22 (only your IP)
- 80
- 443

## 2) Prepare deploy directory

```bash
sudo mkdir -p /opt/snake
sudo chown -R $USER:$USER /opt/snake
```

Copy files from this folder to `/opt/snake` and create runtime env files:

```bash
cd /opt/snake
cp .env.example .env
cp api.env.example api.env
```

Update all placeholder values in `.env` and `api.env`.

## 3) Login to GHCR and run stack

```bash
echo "<your_ghcr_token>" | docker login ghcr.io -u <your_github_username> --password-stdin
docker compose -f compose.prod.yml --env-file .env pull
docker compose -f compose.prod.yml --env-file .env up -d --remove-orphans
```

## 4) Verify

```bash
docker compose -f compose.prod.yml --env-file .env ps
docker compose -f compose.prod.yml --env-file .env logs -f api
```

## Notes

- Caddy automatically provisions and renews TLS certificates.
- Keep `.env` and `api.env` only on EC2. Do not commit them.
- `IMAGE_TAG` can be set to a commit SHA for rollback/roll-forward.
