#!/bin/bash

# ============================================
# Bookly - Auto Installer
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ██████╗  ██████╗  ██████╗ ██╗  ██╗██╗  ██╗   ██╗"
echo "  ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝██║  ╚██╗ ██╔╝"
echo "  ██████╔╝██║   ██║██║   ██║█████╔╝ ██║   ╚████╔╝ "
echo "  ██╔══██╗██║   ██║██║   ██║██╔═██╗ ██║    ╚██╔╝  "
echo "  ██████╔╝╚██████╔╝╚██████╔╝██║  ██╗███████╗██║   "
echo "  ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝   "
echo -e "${NC}"
echo -e "${GREEN}  پلتفرم رزرو نوبت هوشمند${NC}"
echo "  =================================="
echo ""

# ---- Collect Info ----
echo -e "${YELLOW}اطلاعات مورد نیاز:${NC}"
echo ""

read -p "دامنه (مثال: bookly.example.com): " DOMAIN
read -p "GitHub Token: " GITHUB_TOKEN
read -p "Telegram Bot Token: " BOT_TOKEN
read -p "Admin Telegram ID: " ADMIN_ID
read -p "مسیر فایل backup دیتابیس (یا Enter برای رد): " DB_BACKUP

echo ""
echo -e "${YELLOW}شروع نصب...${NC}"
echo ""

# ---- System Update ----
echo -e "${BLUE}[1/10] آپدیت سیستم...${NC}"
apt update -qq && apt upgrade -y -qq
apt install -y -qq curl wget git unzip build-essential python3-certbot-nginx

# ---- Node.js ----
echo -e "${BLUE}[2/10] نصب Node.js 20...${NC}"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20 --silent
nvm use 20
nvm alias default 20

# ---- PostgreSQL ----
echo -e "${BLUE}[3/10] نصب PostgreSQL...${NC}"
apt install -y -qq postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
sudo -u postgres psql << SQL
CREATE USER bookingapp WITH PASSWORD '$DB_PASS';
CREATE DATABASE bookingdb OWNER bookingapp;
GRANT ALL PRIVILEGES ON DATABASE bookingdb TO bookingapp;
ALTER USER bookingapp CREATEDB;
SQL

# ---- Redis ----
echo -e "${BLUE}[4/10] نصب Redis...${NC}"
apt install -y -qq redis-server
REDIS_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
sed -i "s/# requirepass foobared/requirepass $REDIS_PASS/" /etc/redis/redis.conf
systemctl restart redis-server

# ---- Nginx ----
echo -e "${BLUE}[5/10] نصب Nginx...${NC}"
apt install -y -qq nginx
systemctl start nginx
systemctl enable nginx

# ---- PM2 ----
echo -e "${BLUE}[6/10] نصب PM2...${NC}"
npm install -g pm2 -q
pm2 startup | tail -1 | bash

# ---- Clone Project ----
echo -e "${BLUE}[7/10] دانلود پروژه از GitHub...${NC}"
git clone https://$GITHUB_TOKEN@github.com/lukadium-maker/bookly.git /root/app
mkdir -p /root/app/uploads/businesses
mkdir -p /root/app/static

# ---- Config .env ----
echo -e "${BLUE}[8/10] تنظیم environment...${NC}"
WEBHOOK_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

cat > /root/app/backend/.env << ENV
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://bookingapp:$DB_PASS@localhost:5432/bookingdb
REDIS_URL=redis://:$REDIS_PASS@localhost:6379
BOT_TOKEN=$BOT_TOKEN
WEBHOOK_SECRET=$WEBHOOK_SECRET
APP_URL=https://$DOMAIN
ENV

# Update hardcoded DB connection in db.ts
sed -i "s|postgresql://bookingapp:.*@localhost:5432/bookingdb|postgresql://bookingapp:$DB_PASS@localhost:5432/bookingdb|g" /root/app/backend/src/db.ts

# Update admin ID in owner.ts
sed -i "s/24247682/$ADMIN_ID/g" /root/app/backend/src/routes/owner.ts
sed -i "s/24247682/$ADMIN_ID/g" /root/app/backend/src/bot.ts

# Update domain in bot.ts and frontend
sed -i "s|bookly.kindtoy.ir|$DOMAIN|g" /root/app/backend/src/bot.ts
sed -i "s|bookly.kindtoy.ir|$DOMAIN|g" /root/app/frontend/src/App.tsx
sed -i "s|bookly.kindtoy.ir|$DOMAIN|g" /root/app/frontend/src/MyAppointments.tsx
sed -i "s|bookly.kindtoy.ir|$DOMAIN|g" /root/app/frontend/src/AdminPanel.tsx
sed -i "s|bookly.kindtoy.ir|$DOMAIN|g" /root/app/frontend/src/OwnerDashboard.tsx

# ---- Install Dependencies ----
echo -e "${BLUE}[9/10] نصب وابستگی‌ها و build...${NC}"

# Add swap if needed
if [ $(free -m | awk '/^Mem:/{print $2}') -lt 1500 ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cd /root/app/backend
npm install
npx prisma generate
npx prisma migrate deploy

# Restore database if backup provided
if [ -n "$DB_BACKUP" ] && [ -f "$DB_BACKUP" ]; then
  echo "Restoring database from backup..."
  gunzip -c "$DB_BACKUP" | sudo -u postgres psql bookingdb
fi

# Build frontend
cd /root/app/frontend
npm install
sed -i "s|bookly.kindtoy.ir|$DOMAIN|g" vite.config.ts 2>/dev/null || true
./deploy.sh

# Copy landing page
cp /root/app/static/landing.html /root/app/frontend/dist/landing.html 2>/dev/null || true

# ---- Nginx Config ----
echo -e "${BLUE}[10/10] تنظیم Nginx و SSL...${NC}"

# Get SSL certificate
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN

cat > /etc/nginx/sites-available/bookingapp << NGINX
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    client_max_body_size 10M;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location = / {
        root /root/app/static;
        try_files /landing.html =404;
    }

    location /app {
        root /root/app/frontend/dist;
        try_files /index.html =404;
    }

    location = /appointments {
        root /root/app/frontend/dist;
        try_files /appointments.html =404;
    }

    location ~* \\.sql\\.gz\$ {
        root /root/app/frontend/dist;
        add_header Content-Disposition "attachment";
        add_header Content-Type "application/gzip";
    }

    location /assets/ {
        root /root/app/frontend/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias /root/app/uploads/;
        expires 7d;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 60s;
    }

    location /webhook/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bookingapp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

chmod 755 /root
chmod -R 755 /root/app/frontend/dist

# ---- Start Backend ----
cd /root/app/backend
pm2 start src/index.ts \
  --name booking-backend \
  --interpreter node \
  --interpreter-args "-r ts-node/register" \
  --watch src
pm2 save

# ---- Set Webhook ----
sleep 5
curl -s "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://$DOMAIN/webhook/bot" > /dev/null

# ---- Health Check ----
sleep 5
HEALTH=$(curl -s "https://$DOMAIN/api/health" | grep -o '"status":"ok"' || echo "failed")

echo ""
echo "  =================================="
if [ "$HEALTH" = '"status":"ok"' ]; then
  echo -e "${GREEN}  نصب با موفقیت انجام شد!${NC}"
else
  echo -e "${YELLOW}  نصب انجام شد - health check را بررسی کنید${NC}"
fi
echo ""
echo -e "  دامنه: ${GREEN}https://$DOMAIN${NC}"
echo -e "  پنل مدیریت: ${GREEN}https://t.me/$(curl -s https://api.telegram.org/bot$BOT_TOKEN/getMe | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["username"])')${NC}"
echo ""
echo -e "${YELLOW}  اطلاعات دیتابیس را ذخیره کنید:${NC}"
echo "  DB Password: $DB_PASS"
echo "  Redis Password: $REDIS_PASS"
echo "  =================================="
