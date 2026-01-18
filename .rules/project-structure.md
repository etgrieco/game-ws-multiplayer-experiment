# Project Structure

## Overview

This is a **monorepo multiplayer game project** using:
- **pnpm workspaces** for package management
- **TypeScript** across all packages
- **React + Three.js** for the client (Vite)
- **Fastify + WebSocket** for the server
- **ECS (Entity Component System)** architecture using `koota` library
- **Shared code** between client and server for game logic and types

## Root Directory Structure

```
game-ws-multiplayer-experiment/
├── .rules/              # Project documentation and rules (this directory)
├── bak/                 # Backup files (JSON exports)
├── game/                # Main game code (pnpm workspace root)
│   ├── client/         # React/Three.js frontend application
│   ├── server/         # Fastify WebSocket server
│   ├── shared/         # Shared code between client/server (ECS, types, messages)
│   └── config/         # Game configuration files
├── packages/            # Shared infrastructure packages
│   └── typescript-config/  # Shared TypeScript configurations
├── node_modules/        # Root-level dependencies
├── biome.json          # Biome linter/formatter config
├── Dockerfile          # Docker containerization
├── fly.toml            # Fly.io deployment configuration
├── package.json        # Root workspace configuration
├── pnpm-lock.yaml      # pnpm lockfile
├── pnpm-workspace.yaml # pnpm workspace definitions
└── README.md           # Project documentation
```

## Main Packages (`game/`)

### `game/client/` - Frontend Application
- **Framework**: React 19 + TypeScript
- **3D Rendering**: Three.js with React Three Fiber
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives

**Key Directories:**
- `src/components/ui/` - Reusable UI components (button, card, input, etc.)
- `src/ui/` - Game-specific React components (Game.tsx, GamePlayers.tsx, Terrain.tsx, etc.)
- `src/game/` - Core game logic integration
- `src/net/` - WebSocket client session management
- `dist/` - Build output (Vite production build)

### `game/server/` - Backend Server
- **Framework**: Fastify
- **WebSocket**: Native `ws` library
- **Runtime**: Node.js 22 with TypeScript (tsx for dev)

**Key Files:**
- `src/index.ts` - Server entry point
- `src/MultiplayerGameContainer.ts` - Game session management
- `src/handle-events-incoming.ts` - WebSocket event handlers
- `src/game-factory.ts` - Game initialization logic
- `dist/` - Compiled JavaScript output

### `game/shared/` - Shared Code
**Purpose**: Code shared between client and server for consistency

**Structure:**
- `ecs/` - Entity Component System code
  - `trait.ts` - Component definitions (Position2, Velocity2, Health, etc.)
  - `system.ts` - Game systems (movement, collision, damage, etc.)
  - `spawn.ts` - Entity spawning utilities
- `game/types.ts` - Shared game data types (GameData, GameSimulation, etc.)
- `net/messages.ts` - WebSocket message type definitions (client ↔ server)

### `game/config/` - Configuration
- Shared game configuration files (level configs, etc.)
- Used by both client and server

## Shared Infrastructure (`packages/`)

### `packages/typescript-config/`
- Shared TypeScript configuration files
- `tsconfig.base.json` - Base TypeScript config
- `tsconfig.browser.json` - Browser-specific TypeScript config
- Referenced via `@repo/typescript-config` workspace dependency

## Workspace Configuration

The project uses **pnpm workspaces** with a catalog for shared dependency versions:

- **Workspace packages**: `game/*` and `packages/*`
- **Catalog dependencies**: TypeScript and koota versions are managed centrally
- **Package naming**: `@repo/game-*` for game packages

## Build Outputs

- **Client**: `game/client/dist/` - Static assets for deployment
- **Server**: `game/server/dist/` - Compiled JavaScript (TypeScript → JS via `tsc`)

## Development Workflow

- **Root scripts**: `pnpm check` (linting with Biome)
- **Client**: `pnpm --filter @repo/game-client dev` (Vite dev server)
- **Server**: `pnpm --filter @repo/game-server dev` (tsx watch mode)
- **Type checking**: TypeScript configured in each package
