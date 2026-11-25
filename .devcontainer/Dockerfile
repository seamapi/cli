ARG VARIANT="26"

FROM mcr.microsoft.com/devcontainers/javascript-node:${VARIANT}

USER node
WORKDIR /home/node

RUN mkdir -p .config/git \
 && echo ".vscode/*" >> .config/git/ignore \
 && echo "*.code-workspace" >> .config/git/ignore \
 && echo ".history/" >> .config/git/ignore
