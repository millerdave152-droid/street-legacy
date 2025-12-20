# Street Legacy - Background Music Tracks

## Required Tracks (5 total)

### 1. menu.mp3 - Main Menu Theme (bgm_menu)
- **Mood:** Mysterious, anticipation, urban night
- **Tempo:** 80-100 BPM
- **Style:** Dark ambient with subtle hip-hop elements
- **Instruments:** Deep bass, soft pads, distant city sounds
- **Duration:** 2-3 minutes (loops seamlessly)
- **Reference:** GTA Vice City menu music, Hotline Miami menu

### 2. game.mp3 - Main Gameplay Theme (bgm_game)
- **Mood:** Street life, hustle, determination
- **Tempo:** 90-110 BPM
- **Style:** Lo-fi hip-hop / Trap instrumental
- **Instruments:** 808 bass, hi-hats, piano samples, vinyl crackle
- **Duration:** 3-4 minutes (loops seamlessly)
- **Reference:** Def Jam games, Sleeping Dogs ambient

### 3. crime.mp3 - Crime Scene Theme (bgm_crime)
- **Mood:** Tension, danger, suspense
- **Tempo:** 100-120 BPM
- **Style:** Dark trap / Drill instrumental
- **Instruments:** Heavy 808s, aggressive hi-hats, dark synths
- **Duration:** 2-3 minutes (loops seamlessly)
- **Reference:** GTA heist music, Payday 2 stealth music

### 4. action.mp3 - Mini-Game / Action Theme (bgm_action)
- **Mood:** Energetic, fast-paced, competitive
- **Tempo:** 120-140 BPM
- **Style:** Upbeat electronic / Energetic trap
- **Instruments:** Punchy drums, synth leads, bass drops
- **Duration:** 2-3 minutes (loops seamlessly)
- **Reference:** Racing game music, arcade game BGM

### 5. victory.mp3 - Victory / Success Theme (bgm_victory)
- **Mood:** Triumph, accomplishment, celebration
- **Tempo:** 110-130 BPM
- **Style:** Uplifting trap / Victory fanfare
- **Instruments:** Brass stabs, triumphant synths, energetic drums
- **Duration:** 30-60 seconds (can loop or fade)
- **Reference:** Level complete jingles, victory themes

## Technical Specifications

- **Format:** MP3 (192kbps) or OGG (quality 6+)
- **Sample Rate:** 44100 Hz
- **Channels:** Stereo
- **Loudness:** -14 LUFS (normalized)
- **Loop Points:** Seamless loop (no click/pop at loop point)

## Free Music Resources

1. **Uppbeat** (https://uppbeat.io) - Royalty-free music
2. **Pixabay Music** (https://pixabay.com/music/) - Free music
3. **Free Music Archive** (https://freemusicarchive.org) - CC music
4. **Incompetech** (https://incompetech.com) - Kevin MacLeod's music
5. **YouTube Audio Library** - Free for use

## Implementation Notes

The AudioManager will:
- Crossfade between tracks (2 second transition)
- Loop all BGM tracks by default
- Respect user volume settings
- Remember music enabled/disabled state
