ARG VARIANT="24"

FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT}

USER node
WORKDIR /home/node

RUN mkdir -p .config/git \
 && echo ".vscode/*" >> .config/git/ignore \
 && echo "*.code-workspace" >> .config/git/ignore \
 && echo ".history/" >> .config/git/ignore
