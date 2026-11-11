#!/usr/bin/env bash
# Prepara un server Ubuntu (Oracle Cloud Always Free, ARM) per FantaSoccorritore.
# Uso (come root):  bash installa.sh <TAILSCALE_AUTH_KEY>
# Non tocca nessun dato di gioco: i dati arrivano dopo, dal PC, con locale/5-sposta-sul-server.ps1
set -euo pipefail
KEY="${1:-}"
BASE=/opt/fantasoccorritore
REPO=$BASE/repo
export DEBIAN_FRONTEND=noninteractive

echo ">> Memoria di scorta (swap 4 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ">> Pacchetti di base, Docker, Node 20"
apt-get update -y
apt-get install -y git curl ca-certificates unzip jq postgresql-client
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'J'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "3" } }
J
systemctl enable --now docker && systemctl restart docker
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v20" ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo ">> Tailscale"
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
if [ -n "$KEY" ]; then tailscale up --ssh --authkey "$KEY" --hostname fantaserver; else tailscale up --ssh --hostname fantaserver; fi

echo ">> Codice del gioco"
mkdir -p $BASE/arrivo $BASE/backup
[ -d $REPO/.git ] || git clone https://github.com/leomelosi2003-beep/fantasoccorritore $REPO
git config --global --add safe.directory $REPO
chmod +x $REPO/server/*.sh

echo ">> Servizi automatici"
cat > /etc/systemd/system/fs-web.service <<U
[Unit]
Description=FantaSoccorritore sito
After=network-online.target docker.service
[Service]
WorkingDirectory=$REPO/web
Environment=PORT=3000 NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
U
cat > /etc/systemd/system/fs-guardiano.service <<U
[Unit]
Description=FantaSoccorritore guardiano e aggiornamenti
[Service]
Type=oneshot
ExecStart=$REPO/server/guardiano.sh
U
cat > /etc/systemd/system/fs-guardiano.timer <<U
[Unit]
Description=Ogni 2 minuti
[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
U
cat > /etc/systemd/system/fs-backup.service <<U
[Unit]
Description=FantaSoccorritore backup
[Service]
Type=oneshot
ExecStart=$REPO/server/backup.sh
U
cat > /etc/systemd/system/fs-backup.timer <<U
[Unit]
Description=Backup notturno 04:00 ora italiana
[Timer]
OnCalendar=*-*-* 04:00:00 Europe/Rome
Persistent=true
[Install]
WantedBy=timers.target
U
systemctl daemon-reload
systemctl enable fs-web.service fs-guardiano.timer fs-backup.timer
timedatectl set-timezone Europe/Rome || true
echo ">> PRONTO. Ora dal PC lancia locale/5-sposta-sul-server.ps1"
