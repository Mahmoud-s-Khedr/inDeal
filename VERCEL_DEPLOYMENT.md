# Vercel Deployment Guide for inDeal API

## ✅ Implementation Complete

Your inDeal API has been refactored for Vercel serverless deployment.

### What Changed

1. **Created `vercel.json`** - Routes all requests to the serverless function
2. **Created `api/index.js`** - Serverless entry point for Vercel
3. **Updated `src/server.js`** - Now only runs for local development
4. **Socket.io disabled** - Not compatible with serverless; use external service for real-time
5. **Removed schema execution** - Database migrations should be run separately
6. **Created `.vercelignore`** - Excludes unnecessary files from deployment

### Deployment Steps

#### 1. Push to GitHub (if not already)

```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

#### 2. Configure Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables and add:

**Required:**

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@host:5432/dbname
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_USERNAME=default
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=7d
SESSION_ACCESS_TTL_MIN=15
SESSION_REFRESH_TTL_DAYS=7
SESSION_ROTATE_LEEWAY_SECONDS=300
SESSION_ENFORCE_LATEST_JTI=true
```

**Storage (Cloudflare R2):**

```env
R2_BUCKET_NAME=your-bucket
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_REGION=auto
R2_PUBLIC_URL=https://your-public-url.r2.dev
R2_SIGNED_URL_TTL_SECONDS=300
R2_MAX_FILE_SIZE_BYTES=20971520
```

**Email (Resend):**

```env
RESEND_API_KEY=your-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=inDeal Support
COMPANY_REVIEW_NOTIFICATION_EMAIL=admin@yourdomain.com
```

**Frontend Integration:**

```env
FRONTEND_BASE_URL=https://yourdomain.com
FORGOT_PASSWORD_ENABLED=true
FORGOT_PASSWORD_OTP_TTL_MINUTES=30
FORGOT_PASSWORD_MAX_ATTEMPTS=3
FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS=3600
FORGOT_PASSWORD_RATE_LIMIT_FORGOT_PER_EMAIL=5
FORGOT_PASSWORD_RATE_LIMIT_FORGOT_PER_IP=10
FORGOT_PASSWORD_RATE_LIMIT_RESET_PER_EMAIL=10
FORGOT_PASSWORD_RATE_LIMIT_RESET_PER_IP=15
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=1440
EMAIL_VERIFICATION_API_BASE_URL=https://your-vercel-url.vercel.app
EMAIL_VERIFICATION_PATH=/api/v1/auth/verify-email
```

**Optional (Firebase):**

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key here\n-----END PRIVATE KEY-----\n"
```

#### 3. Run Database Migrations

Before deploying, ensure your database schema is up to date. SSH into your database or use a local connection:

```bash
# Connect to your database
psql $DATABASE_URL

# Then run the schema
\i AI_DOCS/schema.sql

# Or if you have migrations
\i AI_DOCS/migrations/2026-01-01_company_portfolio.sql
\i AI_DOCS/migrations/2026-01-01_password_history.sql
\i AI_DOCS/migrations/2026-01-02_company_portfolio_v2.sql
```

#### 4. Deploy to Vercel

In the Vercel dashboard, click **Deploy** or push to your connected GitHub branch.

### Local Development

For local development, everything works as before:

```bash
# Install dependencies
npm install

# Set up .env file (copy from .env.example)
cp .env .env.local

# Run migrations
npm run db:schema

# Start development server
npm run dev
```

To enable Socket.io locally, add to your `.env`:

```env
ENABLE_SOCKETIO=true
```

### Important Notes

#### ⚠️ Real-Time Features (Socket.io)

Socket.io is **disabled** on Vercel because:

- Vercel functions are stateless and short-lived
- WebSockets require persistent connections

**Solutions:**

1. Use a managed service: [Pusher](https://pusher.com), [Ably](https://ably.com), or [Socket.io Cloud](https://socket.io/cloud)
2. Deploy WebSocket server separately to Railway/Render
3. Use polling instead of WebSockets (less efficient)

#### 🔄 Background Jobs (BullMQ)

BullMQ workers won't run on Vercel Functions. Options:

1. Use Vercel Cron Jobs for scheduled tasks
2. Deploy workers separately to Railway/Render
3. Use managed queue services (AWS SQS, Google Cloud Tasks)

#### 💾 Database Connection Pooling

Serverless functions can exhaust database connections. Recommendations:

- Use connection pooling services (PgBouncer)
- Use serverless-friendly databases (Supabase, Neon, PlanetScale)
- Configure your PostgreSQL `max_connections` appropriately

#### 📊 Cold Starts

First request after inactivity may be slow (1-3s). This is normal for serverless.

### Testing Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-app.vercel.app/

# API health
curl https://your-app.vercel.app/api/v1/health

# Test authentication
curl -X POST https://your-app.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Monitoring

Monitor your deployment:

1. Vercel Dashboard → Your Project → Logs
2. Check function execution time and errors
3. Monitor database connection pool usage
4. Watch for rate limit hits

### Troubleshooting

**"Cannot find module" errors:**

- Ensure all dependencies are in `package.json` (not devDependencies)
- Check `.vercelignore` isn't excluding required files

**Database connection timeouts:**

- Verify `DATABASE_URL` is correct
- Check database allows connections from Vercel IPs
- Use connection pooling (PgBouncer/Supabase)

**Redis connection errors:**

- Ensure Redis is accessible from internet
- Check firewall rules
- Verify username/password if required

**Environment variables not working:**

- Redeploy after adding env vars
- Check for typos in variable names
- Ensure no spaces around `=` in Vercel dashboard

### Next Steps

1. ✅ Configure all environment variables in Vercel
2. ✅ Run database migrations
3. ✅ Deploy and test endpoints
4. 🔄 Set up real-time features with external service (if needed)
5. 🔄 Configure background workers on separate service (if needed)
6. 📈 Set up monitoring and alerts
7. 🔒 Configure CORS for your frontend domain
8. 🌐 Add custom domain in Vercel settings

### Support

For issues:

- Check Vercel logs: `vercel logs`
- Review PostgreSQL logs
- Check Redis connection
- Verify all env vars are set

---

**Deployment Status:** ✅ Ready to Deploy

You can now click **Deploy** in Vercel!
