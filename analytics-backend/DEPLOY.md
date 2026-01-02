# Q-Flash Analytics - Deployment Guide

Hướng dẫn deploy hệ thống Analytics lên VPS.

## Cấu trúc thư mục

```
analytics-backend/
├── src/
│   ├── server.js          # Main server
│   ├── db/
│   │   ├── schema.sql     # Database schema
│   │   ├── init.js        # DB initialization
│   │   └── connection.js  # DB connection
│   ├── routes/
│   │   ├── analytics.js   # Tracking endpoints
│   │   ├── auth.js        # Authentication
│   │   └── stats.js       # Stats API
│   └── services/
│       └── realtime.js    # WebSocket service
├── scripts/
│   └── create-admin.js    # Create admin user
├── dashboard/             # Admin Dashboard (React)
│   ├── src/
│   ├── package.json
│   └── ...
└── package.json
```

## Step 1: Upload to VPS

### Option A: Using Git
```bash
# On VPS
cd /opt
git clone <your-repo-url> q-flash-analytics
# Or copy the analytics-backend folder
```

### Option B: Using SCP
```bash
# From local machine
scp -r analytics-backend/ user@your-vps-ip:/opt/q-flash-analytics
```

## Step 2: Install Dependencies

```bash
cd /opt/q-flash-analytics
npm install
```

## Step 3: Initialize Database

```bash
npm run init-db
```

Output should show:
```
🗄️  Initializing database at: /opt/q-flash-analytics/analytics.db
✅ Database initialized successfully!
📊 Tables created:
   - sessions
   - pageviews
   - events
   - errors
   - admin_users
   - daily_stats
```

## Step 4: Create Admin User

```bash
npm run create-admin admin your-secure-password
```

⚠️ **IMPORTANT**: Use a strong password! This is the login for your dashboard.

## Step 5: Configure Nginx

### Edit main site config (xuannguyen.site)

```bash
sudo nano /etc/nginx/sites-available/xuannguyen.site
```

Add this inside the `server` block:

```nginx
# Analytics API proxy
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
}

# Socket.io for realtime
location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Create admin subdomain config

```bash
sudo nano /etc/nginx/sites-available/admin.xuannguyen.site
```

Add:

```nginx
server {
    listen 80;
    server_name admin.xuannguyen.site;
    
    root /opt/q-flash-analytics/dashboard/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable the config

```bash
sudo ln -s /etc/nginx/sites-available/admin.xuannguyen.site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Setup SSL with Certbot

```bash
sudo certbot --nginx -d admin.xuannguyen.site
```

## Step 7: Build Dashboard

```bash
cd /opt/q-flash-analytics/dashboard
npm install
npm run build
```

## Step 8: Start Analytics Server with PM2

```bash
cd /opt/q-flash-analytics
pm2 start src/server.js --name analytics-api
pm2 save
pm2 startup  # Follow instructions to auto-start on reboot
```

## Step 9: Update Q-Flash-Web Frontend

Make sure the Q-Flash-Web has the analytics tracking integrated:

1. The `src/services/analytics.ts` should use production URL:
```typescript
const ANALYTICS_ENDPOINT = 'https://xuannguyen.site/api/analytics';
```

2. Rebuild and deploy Q-Flash-Web:
```bash
cd /path/to/Q-Flash-Web
npm run build
# Copy dist/ to your web server
```

## Step 10: Verify Deployment

### Test API
```bash
curl https://xuannguyen.site/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2026-01-03T...","uptime":123}
```

### Test Dashboard
1. Open https://admin.xuannguyen.site
2. Login with the admin credentials you created
3. Visit https://xuannguyen.site and check if data appears

## Troubleshooting

### Check PM2 logs
```bash
pm2 logs analytics-api
```

### Check if port 3001 is in use
```bash
sudo lsof -i :3001
```

### Restart services
```bash
pm2 restart analytics-api
sudo systemctl restart nginx
```

### Database location
```bash
/opt/q-flash-analytics/analytics.db
```

### View database content
```bash
sqlite3 /opt/q-flash-analytics/analytics.db
sqlite> .tables
sqlite> SELECT COUNT(*) FROM sessions;
sqlite> .quit
```

## Environment Variables (Optional)

Create `/opt/q-flash-analytics/.env`:
```
PORT=3001
JWT_SECRET=your-very-secure-secret-key-here
NODE_ENV=production
```

Then modify `server.js` to use dotenv if needed.

---

## Quick Commands Reference

```bash
# Start analytics server
pm2 start analytics-api

# Stop analytics server
pm2 stop analytics-api

# Restart analytics server
pm2 restart analytics-api

# View logs
pm2 logs analytics-api

# Check status
pm2 status

# Rebuild dashboard
cd /opt/q-flash-analytics/dashboard && npm run build

# Reload nginx
sudo systemctl reload nginx
```
