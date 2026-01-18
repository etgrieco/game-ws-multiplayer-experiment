FROM node:22-slim

ARG CLIENT_WS_SERVER_URL="ws://localhost:8080" # Embedded client reference to the server address
ARG SERVER_HOST="0.0.0.0" # Embedded reference to the server host
ARG PORT="8080" # Embedded server reference to the server port

# Install pnpm globally
RUN npm install -g pnpm

# Set pnpm as the package manager (optional, but recommended)
ENV COREPACK_ENABLE=1
RUN corepack enable

# Verify pnpm installation (optional)
RUN pnpm --version

# the image comes with a node user:
USER node

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY --chown=node:node package.json .
COPY --chown=node:node server/package.json ./server/package.json
COPY --chown=node:node shared/package.json ./shared/package.json
COPY --chown=node:node client/package.json ./client/package.json
COPY --chown=node:node pnpm-lock.yaml .
COPY --chown=node:node pnpm-workspace.yaml .
RUN pnpm install --frozen-lockfile --prod=false

COPY --chown=node:node . .

# Build the server
RUN pnpm --filter @repo/game-server build

# Build the client
RUN VITE_WS_SERVER_URL=$CLIENT_WS_SERVER_URL pnpm --filter @repo/game-client build

# Run the server
ENV CLIENT_STATIC_DIR=/home/node/app/client/dist
ENV PORT=$PORT
ENV SERVER_HOST=$SERVER_HOST

CMD ["node","server/dist/server/src/index.js"]