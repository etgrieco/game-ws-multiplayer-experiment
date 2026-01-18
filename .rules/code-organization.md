# Code Organization Patterns

## Architecture Overview

This project follows an **ECS (Entity Component System)** architecture using the `koota` library, with clear separation between client, server, and shared code.

## ECS Architecture

### Components (Traits)
**Location**: `game/shared/ecs/trait.ts`

Components define data structures attached to entities:
- `Position2` - 2D position (x, z coordinates)
- `Velocity2` - 2D velocity
- `Collision2` - Axis-aligned bounding box collision
- `Health` - Health points
- `Damage` - Damage per second tracking
- `DamageZone` - Area that inflicts damage
- `Player` - Player identification
- `IsObstacle` - Obstacle marker

**Pattern**: Components are pure data schemas, no logic.

### Systems
**Location**: `game/shared/ecs/system.ts`

Systems contain game logic that operates on entities with specific component combinations:

- `movePosition2ByVelocitySystem` - Moves entities by velocity, handles collision
- `moveDamageZoneFollowPlayer` - Syncs damage zones with player positions
- `triggerDamageBeingDamagedByCollisionWithEnemy` - Applies damage on collision
- `takeDamageOverTimeSystem` - Applies damage over time to health
- `destroyHealthZeroSystem` - Destroys entities when health reaches zero

**Pattern**: Systems query entities and update components based on game rules.

### Entity Spawning
**Location**: `game/shared/ecs/spawn.ts`

Utilities for creating entities with predefined component sets.

## Client Code Organization

### React Components
**Location**: `game/client/src/ui/`

- `Game.tsx` - Main game component wrapper
- `GamePlayers.tsx` - Player rendering and synchronization
- `GameCamera.tsx` - Camera controls
- `Terrain.tsx` - Terrain rendering
- `TerrainTrees.tsx` - Tree/obstacle rendering
- `BadGuys.tsx` - Enemy entity rendering
- `CollisionDebug.tsx` - Debug visualization
- `GameStart.tsx` - Game initialization UI

### UI Components
**Location**: `game/client/src/components/ui/`

Reusable shadcn/ui-style components:
- `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `tabs.tsx`, `sonner.tsx`

### Network Layer
**Location**: `game/client/src/net/gameSession.tsx`

WebSocket client session management:
- Connection handling
- Event sending/receiving
- State synchronization with server

### Game Logic
**Location**: `game/client/src/game/game.tsx`

Client-side game loop and ECS world integration.

## Server Code Organization

### Entry Point
**Location**: `game/server/src/index.ts`

Server initialization:
- Fastify HTTP server setup
- WebSocket server setup
- Static file serving
- Route handlers

### Game Session Management
**Location**: `game/server/src/MultiplayerGameContainer.ts`

Multiplayer session lifecycle:
- Session creation/joining
- Game state management
- Player management

### Event Handling
**Location**: `game/server/src/handle-events-incoming.ts`

WebSocket message routing:
- Client event handlers
- Server event responses
- State updates

### Game Factory
**Location**: `game/server/src/game-factory.ts`

Game world initialization:
- ECS world setup
- Entity spawning
- System registration

## Shared Code Organization

### Game Types
**Location**: `game/shared/game/types.ts`

Shared TypeScript types:
- `GameData` - World and session data
- `GameSimulation` - Simulation state and controls
- `MultiplayerSessionStatus` - Session state enum

### Network Messages
**Location**: `game/shared/net/messages.ts`

WebSocket protocol definitions:
- `GameSessionClientEvent` - Client → Server messages
- `GameSessionServerEvent` - Server → Client messages

**Message Types**:
- Session management (CREATE, JOIN, REJOIN, START)
- Player updates (velocity, position)
- Game state updates (positions, level data, status)

## Naming Conventions

### Files
- **TypeScript files**: `camelCase.ts` or `PascalCase.tsx` (React components)
- **Config files**: `kebab-case.json`

### Components/Systems
- **Systems**: `verbNounSystem` (e.g., `movePosition2ByVelocitySystem`)
- **Components**: `PascalCase` (e.g., `Position2`, `Collision2`)
- **Functions**: `camelCase` (e.g., `checkAABBCollision`)

### Package Names
- **Scoped**: `@repo/game-*` (client, server, shared, config)

## Code Sharing Principles

### What Goes in `shared/`?
✅ **Should be shared**:
- ECS components (traits)
- ECS systems (game logic)
- Type definitions used by both client and server
- Network message type definitions
- Game configuration schemas

❌ **Should NOT be shared**:
- React components
- Server routing logic
- Client rendering code
- UI state management
- Platform-specific implementations

### Import Path Resolution

All packages use TypeScript path aliases configured in their `tsconfig.json`:
- Shared imports use package names: `@repo/game-shared/...`
- Relative imports use `.js` extensions for ESM compatibility

## Build Configuration

### TypeScript
- **Base config**: `@repo/typescript-config/tsconfig.base.json`
- **Client**: Extends base + browser-specific settings
- **Server**: Extends base + Node.js-specific settings
- **Path aliases**: Resolved at build time (`tsc-alias` for server)

### Output Directories
- **Client build**: `game/client/dist/` (Vite output)
- **Server build**: `game/server/dist/` (TypeScript compilation)
- **Shared**: No build output (imported as source TypeScript)
