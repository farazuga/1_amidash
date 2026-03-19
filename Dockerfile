FROM node:20-slim AS base

# Install only essential system deps (no Playwright/Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Skip browser downloads
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install production dependencies only
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Production
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
