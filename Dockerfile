# =============================================================================
# PDF Forge — Production Dockerfile
# =============================================================================
# This Dockerfile builds a Node.js image with all the system-level dependencies
# that Chromium (used by Puppeteer) requires to run in a headless container.
#
# Key decisions:
#   - We use node:20-slim as the base to keep the image small while still
#     having a Debian package manager available for installing Chromium deps.
#   - Chromium is installed from the Debian repos instead of letting Puppeteer
#     download its own copy, which saves ~400 MB of image size.
#   - The app runs as the non-root "pptruser" for security; Chromium is
#     launched with --no-sandbox because the container already provides
#     isolation (and the sandbox requires privileges we intentionally drop).
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — Base image with Chromium dependencies
# ---------------------------------------------------------------------------
FROM node:20-slim

# -- System packages required by headless Chromium ---------------------------
# This list comes from the Puppeteer troubleshooting guide for Debian/Ubuntu.
# Each library group is annotated so future maintainers know why it's needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chromium itself (from Debian repos)
    chromium \
    # Font rendering
    fonts-liberation \
    fonts-noto-color-emoji \
    # Shared libraries Chromium expects at runtime
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    # Misc utilities
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# -- Tell Puppeteer to skip its bundled Chromium download --------------------
# We already installed Chromium above, so there is no need for Puppeteer to
# fetch another copy during `npm install`.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# -- Point Puppeteer to the system Chromium binary ---------------------------
ENV CHROMIUM_PATH=/usr/bin/chromium

# -- Enable the --no-sandbox flag automatically inside the container ---------
ENV PUPPETEER_NO_SANDBOX=true

# ---------------------------------------------------------------------------
# Stage 2 — Application code
# ---------------------------------------------------------------------------

# Create a non-root user so Chromium doesn't complain about running as root
# and to follow the principle of least privilege.
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser /app

WORKDIR /app

# -- Install Node.js dependencies first (leverages Docker layer caching) -----
# By copying only package*.json before the rest of the source code, Docker
# can cache the expensive `npm install` step as long as dependencies haven't
# changed.
COPY package*.json ./
RUN npm ci --omit=dev

# -- Copy application source code -------------------------------------------
COPY . .

# -- Switch to the non-root user --------------------------------------------
USER pptruser

# -- Expose the application port ---------------------------------------------
EXPOSE 3003

# -- Health check (optional but nice for orchestrators) ----------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3003/api/templates || exit 1

# -- Start the server --------------------------------------------------------
CMD ["node", "src/app.js"]
