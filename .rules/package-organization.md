# Package Organization and Dependencies

## Package Structure

### Root Package (`package.json`)
- **Purpose**: Workspace coordination and shared tooling
- **Manager**: pnpm 10.28.0
- **Node Version**: 22
- **Linting**: Biome (code checking and formatting)
- **Workspaces**: Defined in `pnpm-workspace.yaml`

### Client Package (`game/client/`)
- **Name**: `@repo/game-client`
- **Dependencies**:
  - `@repo/game-server` (workspace) - For shared types/interfaces
  - `@repo/game-shared` (workspace) - ECS and game types
  - `@repo/game-config` (workspace) - Configuration files
  - React 19, Three.js, React Three Fiber
  - Tailwind CSS v4, Radix UI components
  - Zustand (state management), Leva (debug UI)
- **Build**: TypeScript compilation + Vite bundling

### Server Package (`game/server/`)
- **Name**: `@repo/game-server`
- **Dependencies**:
  - `@repo/game-shared` (workspace) - ECS and game logic
  - `@repo/game-config` (workspace) - Configuration files
  - Fastify (HTTP server)
  - `ws` (WebSocket server)
  - `koota` (ECS library)
- **Build**: TypeScript compilation with path alias resolution (`tsc-alias`)

### Shared Package (`game/shared/`)
- **Name**: `@repo/game-shared`
- **Purpose**: Code shared between client and server
- **Dependencies**:
  - `koota` (ECS library) - Only external dependency
- **Exports**: ECS traits, systems, game types, network message types

### Config Package (`game/config/`)
- **Name**: `@repo/game-config`
- **Purpose**: Shared game configuration (level configs, etc.)
- **Used by**: Both client and server

### TypeScript Config Package (`packages/typescript-config/`)
- **Name**: `@repo/typescript-config`
- **Purpose**: Shared TypeScript configuration presets
- **Used by**: All game packages via `devDependencies`

## Dependency Management

### Workspace Protocol
- Packages reference each other using `workspace:*` protocol
- Example: `"@repo/game-client": "workspace:*"`

### Catalog (pnpm)
- Centralized version management for common dependencies
- Currently catalogued:
  - `typescript: 5.9.3`
  - `koota: 0.6.3`
- References: `"typescript": "catalog:"`

### Module System
- All packages use **ES Modules** (`"type": "module"`)
- Imports use `.js` extensions in TypeScript (for ESM compatibility)
- Example: `import { Position2 } from "./trait.js"`

## Import Patterns

### Client → Shared
```typescript
import { Position2, Velocity2 } from "@repo/game-shared/ecs/trait";
import type { GameData } from "@repo/game-shared/game/types";
```

### Server → Shared
```typescript
import { movePosition2ByVelocitySystem } from "@repo/game-shared/ecs/system";
import type { GameSessionClientEvent } from "@repo/game-shared/net/messages";
```

### TypeScript Configs
```json
{
  "extends": "@repo/typescript-config/tsconfig.base.json"
}
```

## Build Dependencies

### Client
- **Development**: Vite, React plugins, TypeScript
- **Runtime**: React, Three.js, WebSocket client logic

### Server
- **Development**: `tsx` (TypeScript execution), `tsc-alias` (path resolution)
- **Runtime**: Fastify, WebSocket server, compiled JavaScript

### Shared
- **Development**: TypeScript only
- **Runtime**: koota ECS library (used by both client and server)
