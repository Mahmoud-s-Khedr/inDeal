# ============================================
# Base Stage - Common setup
# ============================================
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY package*.json ./

# ============================================
# Development Stage
# ============================================
FROM base AS development

# Install all dependencies (including devDependencies)
RUN HUSKY=0 npm install && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

USER nodejs

EXPOSE 3000

CMD ["dumb-init", "npm", "run", "dev"]

# ============================================
# Production Dependencies Stage
# ============================================
FROM base AS prod-deps

# Install only production dependencies with clean cache
RUN HUSKY=0 npm ci --omit=dev && npm cache clean --force

# ============================================
# Production Stage - Minimal final image
# ============================================
FROM node:20-alpine AS production

# Install only dumb-init, nothing else
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules

# Copy only necessary application files
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs prisma ./prisma

USER nodejs

ENV NODE_ENV=production

EXPOSE 3000

CMD ["dumb-init", "sh", "scripts/prod-entrypoint.sh"]
