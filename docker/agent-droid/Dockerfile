FROM node:22-slim

# Install git and other essentials
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates curl jq && \
    rm -rf /var/lib/apt/lists/*

# Install Factory Droid CLI (installs to /root/.local/bin/droid and /root/.factory/bin/rg)
RUN curl -fsSL https://app.factory.ai/cli | sh && \
    cp /root/.local/bin/droid /usr/local/bin/droid && \
    cp /root/.factory/bin/rg /usr/local/bin/rg

# Install pnpm (project requires pnpm workspace)
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Install OpenSpec CLI globally
RUN npm install -g @fission-ai/openspec@latest

# Create workspace, output, and config directories
RUN mkdir -p /workspace /output

# Create non-root user
RUN useradd -m -s /bin/bash agent && \
    chown -R agent:agent /workspace /output

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user
USER agent

# Ensure Factory config directory exists
RUN mkdir -p /home/agent/.factory

# Default working directory
WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
