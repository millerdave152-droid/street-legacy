# Street Legacy - Claude Code Instructions

## PROJECT TYPE: Pure Phaser Game (NOT React)

This project uses **Phaser 3** for the frontend. There is NO React.

## Directory Structure

```
Game 3.1.1/
├── street-legacy/
│   ├── client/          ← PHASER GAME (main frontend)
│   ├── server/          ← Backend API
│   └── shared/          ← Shared types/utilities
└── supabase/            ← Database migrations
```

## Commands to Use

### To run the Phaser game:
```bash
cd street-legacy/client && npm run dev
```
**Runs on: http://localhost:5175**

### To build the Phaser game:
```bash
cd street-legacy/client && npm run build
```

### NEVER run these from the root folder:
- Do NOT run `npm run dev` from `Game 3.1.1/`
- Do NOT look for React components (there are none)
- Do NOT create .tsx or .jsx files

## Tech Stack

- **Frontend**: Phaser 3.90 + TypeScript + Vite
- **Audio**: Howler.js + Web Audio API (procedural)
- **Backend**: Supabase (optional, works in local-only mode)
- **State**: Local Storage for offline play

## Key Files

- `street-legacy/client/src/main.ts` - Game entry point
- `street-legacy/client/src/game/config.js` - Phaser config
- `street-legacy/client/src/game/scenes/` - All game scenes
- `street-legacy/client/src/game/managers/` - Game systems

## When User Says "Run the game"

ALWAYS use:
```bash
cd "C:\Users\davem\OneDrive\Desktop\Game 3.1.1\street-legacy\client" && npm run dev
```

Then open: http://localhost:5175
