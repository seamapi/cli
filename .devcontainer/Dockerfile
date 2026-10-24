ARG VARIANT="24-bookworm"

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS patched-node

FROM mcr.microsoft.com/devcontainers/javascript-node:${VARIANT}

# Patch the system binary and every inherited nvm copy used by interactive shells.
COPY --from=patched-node /usr/local/bin/node /tmp/patched-node
RUN install -m 0755 /tmp/patched-node /usr/local/bin/node \
 && if [ -d /usr/local/share/nvm/versions/node ]; then \
      find /usr/local/share/nvm/versions/node -type f -path "*/bin/node" \
        -exec install -m 0755 /tmp/patched-node {} \; ; \
    fi \
 && rm /tmp/patched-node \
 && test "$(node --version)" = "v24.22.1" \
 && test "$(/usr/local/bin/node --version)" = "v24.22.1"
ENV NODE_VERSION=24.22.1

USER node
WORKDIR /home/node

RUN mkdir -p .config/git \
 && echo ".vscode/*" >> .config/git/ignore \
 && echo "*.code-workspace" >> .config/git/ignore \
 && echo ".history/" >> .config/git/ignore
