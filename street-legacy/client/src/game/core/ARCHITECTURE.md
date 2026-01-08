# Core Module Architecture

This directory contains **generic, reusable game engine components** that are not specific to Street Legacy.

## Design Principles

1. **No Game-Specific Logic**: Core modules MUST NOT contain references to:
   - Crime, crew, Sarah, heat, NPC, district
   - Terminal commands
   - Street Legacy-specific game mechanics
   - Game-specific asset keys (hardcoded)

2. **Config Injection**: All game-specific behavior must be injectable via:
   - Constructor config objects
   - Method parameters
   - Callback functions

3. **Backwards Compatibility**: When extracting modules to core:
   - Keep the original file in game layer
   - Re-export from core for existing imports
   - Add game-specific configuration in game layer wrapper

## Directory Structure

```
core/
├── index.js                    # Main exports
├── managers/
│   ├── index.js
│   ├── SceneReadinessManager.js   # Scene lifecycle management
│   ├── InputManager.js            # Centralized input handling
│   └── AudioManager.js            # Generic audio system
├── scenes/
│   ├── index.js
│   └── CoreBaseScene.js           # Generic scene base class
├── utils/
│   ├── index.js
│   ├── AnimationHelper.js         # Tween/animation utilities
│   ├── GestureHandler.js          # Touch gesture detection
│   ├── MobileUtils.js             # Device/responsive utilities
│   ├── ParticleHelper.js          # Visual particle effects
│   └── StatBar.js                 # Progress bar component
└── ARCHITECTURE.md                # This file
```

## Dependency Rules

### Core Modules MAY Import:
- Phaser (the game engine)
- Other core modules
- Injected configurations

### Core Modules MUST NOT Import:
- Game scenes (game/scenes/)
- Game managers (game/managers/ - except re-exports)
- Game data (game/data/, game/config/)
- Game-specific UI (game/ui/)
- Game-specific systems (game/npc/, game/sarah/, etc.)

### Game Layer MAY Import:
- Core modules
- Other game layer modules
- Services

### Game Layer Scenes MUST NOT:
- Be imported by other modules (scenes import others, not vice versa)

## Module Descriptions

### SceneReadinessManager
**Purpose**: Manages scene lifecycle with proper async handling

**Config Options**:
- `overlayScene`: Name of the overlay scene (default: 'UIScene')
- `mainScene`: Name of the main game scene (default: 'GameScene')

**Usage**:
```javascript
import { SceneReadinessManager } from '../core/managers/SceneReadinessManager'

this.readiness = new SceneReadinessManager(this, {
  overlayScene: 'UIScene',
  mainScene: 'GameScene'
})
```

### InputManager
**Purpose**: Centralized input handling with event-based architecture

**Config Options**:
- `confirmKeys`: Keys for confirm action (default: ['ENTER', 'SPACE'])
- `cancelKeys`: Keys for cancel action (default: ['ESC'])
- `upKeys`, `downKeys`, `leftKeys`, `rightKeys`: Navigation keys
- `pauseKeys`: Keys for pause action

**Usage**:
```javascript
import { InputManager } from '../core/managers/InputManager'

this.inputManager = new InputManager(this)
this.inputManager.on('confirm', () => this.handleConfirm())
this.inputManager.setupKeyboard()
```

### CoreAudioManager
**Purpose**: Generic audio system with config-injectable audio keys

**Config Options**:
- `storageKey`: localStorage key for settings
- `audioKeys`: Object mapping audio key names to asset keys
- `gameTypeBGMMap`: Map of game types to BGM keys
- `sceneBGMMap`: Map of scene names to BGM keys

**Usage**:
```javascript
import { CoreAudioManager } from '../core/managers/AudioManager'

const audioManager = new CoreAudioManager({
  storageKey: 'myGame_audioSettings',
  audioKeys: { BGM: { MENU: 'menu_music' }, SFX: { CLICK: 'click_sound' } }
})
```

### CoreBaseScene
**Purpose**: Generic base scene with lifecycle hooks and cleanup

**Config Options** (via constructor):
- `onSceneReady`: Callback when scene is ready
- `onSceneWake`: Callback when scene wakes from sleep

**Features**:
- Automatic cleanup of tweens, timers, listeners
- Scene lifecycle hooks (sleep, wake, pause, resume)
- Generic transition helpers
- Memory leak prevention

## Adding New Core Modules

1. Create the module in the appropriate core directory
2. Use config injection for any customizable behavior
3. Export from the relevant index.js
4. Create a game layer wrapper that:
   - Re-exports from core
   - Adds game-specific configuration
5. Update this ARCHITECTURE.md

## Migration Checklist

When moving a module to core:

- [ ] Remove all game-specific imports
- [ ] Replace hardcoded values with config parameters
- [ ] Add default values for backwards compatibility
- [ ] Create re-export in original location
- [ ] Update game layer to inject game-specific config
- [ ] Test that existing functionality still works
- [ ] Update ARCHITECTURE.md
