# Street Legacy Audio Assets

This directory contains audio files for Street Legacy. Audio files are loaded by the PreloadScene and managed by the AudioManager.

## Directory Structure

```
assets/audio/
├── bgm/           # Background music (looping)
│   ├── menu.mp3       # Main menu (chill, atmospheric)
│   ├── game.mp3       # Main game (urban, ambient)
│   ├── crime.mp3      # Crime scene (tense, suspenseful)
│   ├── action.mp3     # Mini-games (upbeat, energetic)
│   └── victory.mp3    # Success screen (triumphant)
│
└── sfx/           # Sound effects (one-shot)
    ├── click.mp3          # Button press
    ├── hover.mp3          # Button hover (subtle)
    ├── tab.mp3            # Tab switch
    ├── modal_open.mp3     # Popup open
    ├── modal_close.mp3    # Popup close
    ├── error.mp3          # Invalid action buzz
    ├── cash.mp3           # Money received (coin sound)
    ├── level_up.mp3       # Level up fanfare
    ├── crime_success.mp3  # Successful crime
    ├── crime_fail.mp3     # Busted/failed
    ├── achievement.mp3    # Achievement unlocked
    ├── notification.mp3   # Toast notification
    ├── countdown.mp3      # 3, 2, 1 beeps
    ├── game_start.mp3     # Mini-game begins
    ├── game_win.mp3       # Mini-game victory
    ├── game_lose.mp3      # Mini-game fail
    ├── perfect.mp3        # Perfect score sparkle
    ├── hit.mp3            # Positive action
    ├── miss.mp3           # Negative action
    └── tick.mp3           # Timer tick (last 10 sec)
```

## Audio Specifications

### Background Music (BGM)
- Format: MP3 or OGG
- Sample Rate: 44100 Hz
- Channels: Stereo
- Bitrate: 128-192 kbps
- Duration: 1-3 minutes (will loop)
- Volume: Normalized to -14 LUFS

### Sound Effects (SFX)
- Format: MP3 or OGG
- Sample Rate: 44100 Hz
- Channels: Mono or Stereo
- Bitrate: 128 kbps
- Duration: 0.1 - 3 seconds
- Volume: Normalized to -12 LUFS

## Recommended Audio Sources

Free game audio resources:
- [Freesound.org](https://freesound.org) - CC licensed sounds
- [OpenGameArt.org](https://opengameart.org) - Free game assets
- [Mixkit](https://mixkit.co/free-sound-effects/) - Free sound effects
- [Pixabay](https://pixabay.com/sound-effects/) - Royalty-free sounds

## Audio Manager Usage

```javascript
import { audioManager, AUDIO_KEYS } from '../managers/AudioManager'

// Initialize with scene
audioManager.init(scene)

// Play background music
audioManager.playBGM(AUDIO_KEYS.BGM.GAME)
audioManager.crossfadeBGM(AUDIO_KEYS.BGM.CRIME)  // Smooth transition

// Play sound effect
audioManager.playSFX(AUDIO_KEYS.SFX.CLICK)

// UI sound helpers
audioManager.playClick()
audioManager.playHover()
audioManager.playTab()
audioManager.playModalOpen()
audioManager.playModalClose()
audioManager.playError()

// Game sound helpers
audioManager.playCashGain(5000)  // Pitch varies by amount
audioManager.playLevelUp()
audioManager.playAchievement()
audioManager.playCrimeSuccess()
audioManager.playCrimeFail()
audioManager.playNotification()

// Mini-game sound helpers
audioManager.playCountdown()
audioManager.playMiniGameStart()
audioManager.playMiniGameWin()
audioManager.playMiniGameLose()
audioManager.playPerfect()
audioManager.playHit()
audioManager.playMiss()
audioManager.playTick()

// Volume controls
audioManager.setMasterVolume(0.8)
audioManager.setMusicVolume(0.5)
audioManager.setSFXVolume(0.7)
audioManager.toggleMusic()
audioManager.toggleSFX()
```

## Missing Audio Handling

The game gracefully handles missing audio files:
- Missing files are logged as warnings in console
- Game continues without playing the missing sound
- Add files as needed; the AudioManager will pick them up automatically
