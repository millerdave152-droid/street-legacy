# THE NETWORK - Design Bible

## Street Legacy: Encrypted Communication Hub Identity

*"You're not playing a game. You're using THE NETWORK - the encrypted communication backbone of the criminal underworld."*

---

## Part 1: Visual Reference & Inspiration

### Real-World References

**Encrypted Criminal Networks (The Foundation)**
- **EncroChat** - Europe-based encrypted network with 60,000+ subscribers. Devices called "carbon units" with GPS, camera, microphone disabled. Apps included EncroChat (messaging), EncroTalk (voice), EncroNotes (encrypted notes).
- **Sky ECC** - 170,000+ users worldwide. Messages auto-deleted after 30 seconds. Emergency button wiped everything. Subscription: $950-$2,600 for 6 months.
- **Phantom Secure** - Custom phones stripped of GPS/mic/camera, sold for up to 3,000 euros. Launched the era of criminal-only devices.

*Key Takeaway: These weren't flashy. They were utilitarian, paranoid, secure. Raw function over form.*

### Game References

| Game | What to Take | What to Avoid |
|------|--------------|---------------|
| **Uplink (2001)** | The "Hollywood hacking" feel, stylized UI, freelance agent identity, job board system | Dated visuals |
| **Hacknet** | Real terminal commands, atmospheric soundtrack, immersive hacking feel | Too much actual typing |
| **Watch Dogs** | ctOS phone interface, everything as a hackable node, surveillance overlay | Too much AR/floating UI |
| **Deus Ex: Human Revolution** | Gold/black palette, augmented overlays, sleek panels | Too clean/corporate |
| **Cyberpunk 2077** | Glitch effects, scan aesthetics, street-level grit | Over-designed, too busy |

### The Sweet Spot: Our Unique Mix

```
THE NETWORK = EncroChat's paranoid utility
            + Uplink's agent-based job system
            + Watch Dogs' connected-city feel
            + 80s/90s CRT terminal aesthetic
            - Terminator's cold machine feel
            - Cyberpunk's overwhelming neon
```

**Think:** Burner phone meets surveillance terminal meets underground bulletin board.

---

## Part 2: Core Design Principles

### 1. Everything is Communication
Every action is framed as a message, transmission, or data exchange:
- Crimes = Intercepted opportunities
- Jobs = Contract negotiations
- Heists = Coordinated operations
- Properties = Network assets
- Bank = Secure transfers
- Travel = Node switching

### 2. Paranoid Security Aesthetic
- Lock icons everywhere
- "ENCRYPTED" badges on sensitive data
- Auto-delete timers on messages
- Node IDs instead of usernames
- Surveillance timestamps

### 3. Utilitarian Over Pretty
- Monospace fonts (Courier New)
- Sharp corners, not rounded
- Limited color palette (green/gold/red on black)
- Function labels, not decorative text
- Data density over whitespace

### 4. Living System Feel
- Pulsing indicators (connected, transmitting)
- Scanlines and CRT artifacts
- Timestamp updates
- "Processing" states
- Connection status always visible

### 5. Human Underground, Not Machine Dystopia
- Handler personas with personality (The Fixer talks differently than The Whisper)
- Street slang in messages
- Warmth in the green glow (not cold blue Terminator)
- Community feel (you're part of a network, not alone)

---

## Part 3: Scene-by-Scene Design Specifications

### A. Main Hub (GameScene)

**Identity:** Your encrypted terminal home screen

**Visual Elements:**
```
┌─────────────────────────────────────────┐
│ [REC] 🔒 ENCRYPTED    NODE-7X2K  14:32 │
│ LV.5 AGENT          $12,450  BNK $8,000 │
│ ═══════════════════════════════════════ │
│                                         │
│  [ DOWNTOWN DISTRICT ]                  │
│  ─────────────────────                  │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ CRIME   │  │  JOBS   │  │ HEISTS  │ │
│  │ [!] 3   │  │ [C] 2   │  │ [OP]    │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ TRADING │  │PROPERTY │  │  BANK   │ │
│  │ [T]     │  │ [P]     │  │ [$]     │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │  CREW   │  │ TRAVEL  │  │INVENTORY│ │
│  │ [👥]    │  │ [>]     │  │ [INV]   │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
│  ═══════════════════════════════════   │
│      [NET]    [MAP]    [CFG]           │
└─────────────────────────────────────────┘
```

**Design Notes:**
- Grid buttons have subtle glow in accent color
- Notification badges show pending intel/contracts
- District name in terminal brackets
- Scanline overlay across entire screen
- Bottom nav as network quick-access

---

### B. Crime Scene

**Identity:** Intercepted Opportunities Terminal

**Header:** `[ INTERCEPTED INTEL ]`
**Subtitle:** `SELECT TARGET // RISK ASSESSMENT ACTIVE`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ INTERCEPTED INTEL ]               │
│  ════ SELECT TARGET ════                │
│                                         │
│  RISK LEVEL: ▓▓▓░░ MODERATE            │
│  HEAT PROJECTION: +15%                  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ [!] MUGGING                         ││
│  │     Target: Civilian                ││
│  │     Payout: $50-150                 ││
│  │     Risk: LOW    Heat: +5%          ││
│  │     ──────────────────────          ││
│  │     [EXECUTE]                       ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ [!] ROBBERY                         ││
│  │     Target: Convenience Store       ││
│  │     Payout: $200-500                ││
│  │     Risk: MED    Heat: +15%         ││
│  │     ──────────────────────          ││
│  │     [EXECUTE]                       ││
│  └─────────────────────────────────────┘│
│                                         │
│  >> MORE TARGETS AVAILABLE AT LV.10    │
└─────────────────────────────────────────┘
```

**Messaging Integration:**
- Each crime is an "intercepted opportunity"
- Success/failure delivered as message from SCANNER
- Heat warnings come from The Whisper

---

### C. Jobs Scene

**Identity:** Contract Negotiation Terminal

**Header:** `[ INCOMING CONTRACTS ]`
**Subtitle:** `HANDLER: THE FIXER // SECURE CHANNEL`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ INCOMING CONTRACTS ]              │
│  ════ HANDLER: THE FIXER ════          │
│                                         │
│  "Got work if you want it."            │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ CONTRACT #1247                      ││
│  │ ───────────────────────────────     ││
│  │ DISHWASHER - Back room work         ││
│  │                                     ││
│  │ PAY      $35     DURATION  20min    ││
│  │ ENERGY   10      HEAT      +0%      ││
│  │                                     ││
│  │ Handler Note:                       ││
│  │ "Clean work. No questions asked."   ││
│  │                                     ││
│  │ ┌─────────┐  ┌─────────────────┐   ││
│  │ │ ACCEPT  │  │ VIEW CONTRACT   │   ││
│  │ └─────────┘  └─────────────────┘   ││
│  └─────────────────────────────────────┘│
│                                         │
│  ▼ 5 MORE CONTRACTS AVAILABLE          │
└─────────────────────────────────────────┘
```

**Handler Rotation:**
- Low-level jobs: The Cleaner
- Skilled jobs: The Mechanic
- Criminal jobs: The Shadow
- Each has unique voice/personality

---

### D. Heists Scene

**Identity:** Operation Coordination Center

**Header:** `[ OPERATION PLANNING ]`
**Subtitle:** `SECURE BRIEFING ROOM // EYES ONLY`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ OPERATION PLANNING ]              │
│  ════ SECURE BRIEFING ════              │
│                                         │
│  ACTIVE OPERATIONS: 2                   │
│  CREW STATUS: 3/4 READY                │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ OP: CORNER STORE SMASH              ││
│  │ ───────────────────────────────     ││
│  │ TYPE: Robbery    DIFFICULTY: ▓▓░░░  ││
│  │                                     ││
│  │ REQUIREMENTS:                       ││
│  │ • 2 Crew Members     [✓]            ││
│  │ • Lockpick           [✓]            ││
│  │ • Getaway Vehicle    [✗]            ││
│  │                                     ││
│  │ POTENTIAL TAKE: $2,000-5,000        ││
│  │ HEAT RISK: HIGH                     ││
│  │                                     ││
│  │ ┌───────────────────────────────┐   ││
│  │ │      INITIATE OPERATION       │   ││
│  │ └───────────────────────────────┘   ││
│  └─────────────────────────────────────┘│
│                                         │
│  >> SCANNER: "Police patrol nearby"    │
└─────────────────────────────────────────┘
```

**Messaging Integration:**
- Heist briefings come from The Fixer
- Updates during heist from SCANNER
- Success/failure from crew members

---

### E. Trading Scene

**Identity:** Black Market Exchange Terminal

**Header:** `[ UNDERGROUND EXCHANGE ]`
**Subtitle:** `SECURE MARKETPLACE // ANONYMOUS TRADES`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ UNDERGROUND EXCHANGE ]            │
│  ════ BLACK MARKET ════                 │
│                                         │
│  YOUR CASH: $12,450                     │
│  TRADER REP: ████░░ TRUSTED            │
│                                         │
│  ── BUY ──────────────────────────────  │
│  ┌─────────────────────────────────────┐│
│  │ LOCKPICK SET                        ││
│  │ "Opens most standard locks"         ││
│  │ PRICE: $500        [ACQUIRE]        ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ BURNER PHONE                        ││
│  │ "Disposable comms device"           ││
│  │ PRICE: $200        [ACQUIRE]        ││
│  └─────────────────────────────────────┘│
│                                         │
│  ── SELL ─────────────────────────────  │
│  │ STOLEN WATCH      $75    [SELL]     │
│  │ JEWELRY           $150   [SELL]     │
│                                         │
│  >> "Quality merch. No questions."     │
└─────────────────────────────────────────┘
```

---

### F. Property Scene

**Identity:** Network Asset Management

**Header:** `[ NETWORK ASSETS ]`
**Subtitle:** `PROPERTY PORTFOLIO // PASSIVE INCOME`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ NETWORK ASSETS ]                  │
│  ════ YOUR HOLDINGS ════                │
│                                         │
│  TOTAL VALUE: $45,000                   │
│  DAILY INCOME: $250                     │
│                                         │
│  ── OWNED ────────────────────────────  │
│  ┌─────────────────────────────────────┐│
│  │ [P] CORNER LOT                      ││
│  │     Value: $15,000                  ││
│  │     Income: $50/day                 ││
│  │     Status: ● OPERATIONAL           ││
│  └─────────────────────────────────────┘│
│                                         │
│  ── AVAILABLE ────────────────────────  │
│  ┌─────────────────────────────────────┐│
│  │ [?] ABANDONED WAREHOUSE             ││
│  │     Price: $25,000                  ││
│  │     Potential: $100/day             ││
│  │     Requires: LV.8                  ││
│  │                      [INVESTIGATE]  ││
│  └─────────────────────────────────────┘│
│                                         │
│  >> The Fixer: "Good investment."      │
└─────────────────────────────────────────┘
```

---

### G. Bank Scene

**Identity:** Secure Transfer Terminal

**Header:** `[ SECURE VAULT ]`
**Subtitle:** `ENCRYPTED TRANSFERS // OFFSHORE ACCESS`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ SECURE VAULT ]                    │
│  ════ ENCRYPTED BANKING ════            │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  CASH ON HAND     │  VAULT BALANCE  ││
│  │     $12,450       │     $8,000      ││
│  │    [ACCESSIBLE]   │   [SECURED]     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ── TRANSFER ─────────────────────────  │
│  │                                     │
│  │  AMOUNT: [___________]              │
│  │                                     │
│  │  ┌──────────┐    ┌──────────┐       │
│  │  │ DEPOSIT  │    │ WITHDRAW │       │
│  │  │  → VAULT │    │  → CASH  │       │
│  │  └──────────┘    └──────────┘       │
│  │                                     │
│                                         │
│  INTEREST RATE: 0.5% / day             │
│  VAULT PROTECTION: ████████░░ 80%      │
│                                         │
│  >> "Your assets are encrypted."       │
└─────────────────────────────────────────┘
```

---

### H. Crew Scene

**Identity:** Network Contacts Directory

**Header:** `[ TRUSTED CONTACTS ]`
**Subtitle:** `YOUR NETWORK // LOYALTY MATTERS`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ TRUSTED CONTACTS ]                │
│  ════ CREW MANAGEMENT ════              │
│                                         │
│  ACTIVE CREW: 3/5                       │
│  NETWORK STRENGTH: ████░░ SOLID        │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ [M] MARCUS "QUICK HANDS"            ││
│  │     Role: Locksmith                 ││
│  │     Loyalty: ████████░░ 85%         ││
│  │     Status: ● AVAILABLE             ││
│  │     Cut: 15%                        ││
│  │                                     ││
│  │     [MESSAGE]  [ASSIGN]  [PAY]      ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ [T] TONY "THE DRIVER"               ││
│  │     Role: Getaway                   ││
│  │     Loyalty: ██████░░░░ 60%         ││
│  │     Status: ● ON JOB                ││
│  │     Cut: 20%                        ││
│  └─────────────────────────────────────┘│
│                                         │
│  >> RECRUITING: 2 contacts available   │
└─────────────────────────────────────────┘
```

---

### I. Network Inbox (THE HUB)

**Identity:** Encrypted Message Center

**Already Implemented** - This is the core messaging hub that ties everything together.

**Enhancement Ideas:**
- Thread conversations with handlers
- Auto-archive old messages
- Priority sorting (contracts vs intel vs alerts)
- Search functionality
- Message expiration timers more prominent

---

### J. Travel Scene

**Identity:** Network Node Switching

**Header:** `[ NETWORK NODES ]`
**Subtitle:** `DISTRICT ACCESS // EXPAND YOUR REACH`

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│     [ NETWORK NODES ]                   │
│  ════ AVAILABLE DISTRICTS ════          │
│                                         │
│  CURRENT NODE: DOWNTOWN                 │
│  CONNECTION: ● STABLE                   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ◉ DOWNTOWN         [CURRENT]        ││
│  │   Heat: LOW    Opportunities: HIGH  ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ ○ INDUSTRIAL ZONE  [TRAVEL: $50]    ││
│  │   Heat: MED    Opportunities: MED   ││
│  │   "Warehouses. Less eyes."          ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ ○ UPTOWN           [LOCKED: LV.10]  ││
│  │   Heat: HIGH   Opportunities: HIGH  ││
│  │   "Rich targets. More security."    ││
│  └─────────────────────────────────────┘│
│                                         │
│  >> Travel time affects job cooldowns  │
└─────────────────────────────────────────┘
```

---

## Part 4: Color Language

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Primary Action | Terminal Green | #00ff41 | Buttons, highlights, success |
| Money/Value | Gold | #ffd700 | Cash, earnings, valuable items |
| Danger/Heat | Hot Pink-Red | #ff0040 | Warnings, police, heat |
| Information | Cool Blue | #00aaff | Info badges, tips |
| Warning | Amber | #ffaa00 | Caution states |
| Muted/Secondary | Gray | #666666 | Disabled, secondary text |
| Background | Near Black | #0a0a0a | Screen background |
| Panel | Dark Gray | #111111 | Card backgrounds |

---

## Part 5: Typography Rules

**Primary Font:** Courier New (monospace)
- All headers
- All data/numbers
- All terminal-style text

**Secondary Font:** Arial
- Body text in long descriptions
- Help text

**Sizing Scale:**
- Display: 32px (big announcements)
- XXL: 24px (scene titles)
- XL: 20px (section headers)
- LG: 16px (important labels)
- MD: 14px (body text)
- SM: 12px (secondary info)
- XS: 10px (timestamps, badges)

---

## Part 6: Animation Guidelines

**Pulse Effects (2-3 second cycles):**
- Unread indicators
- Connection status
- Active operations
- Glow borders

**Quick Transitions (100-200ms):**
- Button hovers
- Tab switches
- Card selections

**Dramatic Reveals (400-800ms):**
- Scene transitions
- Boot sequences
- Important notifications

**Ambient Effects (continuous):**
- Scanlines scrolling
- REC indicator blinking
- Timestamp updating

---

## Part 7: Sound Design Notes

**UI Sounds:**
- Click: Short, digital blip
- Hover: Subtle electronic tone
- Success: Ascending digital chime
- Error: Low buzz/static burst
- Message received: Encrypted "ping"

**Ambient:**
- Low electronic hum
- Occasional static crackle
- Distant radio chatter (very subtle)

---

## Part 8: Implementation Priority

### Phase 1: Core Identity (COMPLETE)
- [x] NetworkTheme.js base system
- [x] Boot sequence
- [x] Network inbox
- [x] Handler personas
- [x] Events → Intel messages
- [x] Jobs → Contracts
- [x] Visual polish pass

### Phase 2: Scene Redesign
- [ ] Crime Scene → "Intercepted Intel" redesign
- [ ] Jobs Scene → "Contract Terminal" redesign
- [ ] Heists Scene → "Operation Planning" redesign
- [ ] Trading Scene → "Underground Exchange" redesign

### Phase 3: Deep Integration
- [ ] Property Scene → "Network Assets"
- [ ] Bank Scene → "Secure Vault"
- [ ] Crew Scene → "Trusted Contacts"
- [ ] Travel Scene → "Network Nodes"

### Phase 4: Polish & Immersion
- [ ] Threaded conversations with handlers
- [ ] Message auto-delete timers
- [ ] More handler personalities
- [ ] Achievement messages from NETWORK
- [ ] Sound design implementation

---

## Sources & References

- [EncroChat - Wikipedia](https://en.wikipedia.org/wiki/EncroChat)
- [Sky ECC Shutdown - Wikipedia](https://en.wikipedia.org/wiki/Shutdown_of_Sky_Global)
- [What Criminals Plan Via Encrypted Messaging](https://insightcrime.org/news/what-criminals-plan-via-encrypted-messaging-services/)
- [Hacknet on Steam](https://store.steampowered.com/app/365450/Hacknet/)
- [Uplink: Hacker Elite](https://www.gog.com/en/game/uplink_hacker_elite)
- [Watch Dogs UI - HUDS+GUIS](https://www.hudsandguis.com/home/2013/07/24/watchdogs-hacking-ui)
- [Game UI Database](https://www.gameuidatabase.com/)
- [Deus Ex HR UI - Behance](https://www.behance.net/gallery/2465641/Deus-Ex-Human-Revolution-User-Interface)
- [Retro Terminal UI Design](https://medium.com/@benjamib/retro-terminal-ui-ae9ac8eae71a)
- [Cool-Retro-Term](https://github.com/Swordfish90/cool-retro-term)

---

*This document serves as the design bible for Street Legacy's visual identity. Every scene, every button, every message should feel like part of THE NETWORK.*
