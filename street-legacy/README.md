# Street Legacy

A persistent multiplayer crime/business simulation game set in Toronto.

## Features

- **12 Toronto Districts** - Each with unique characteristics, dangers, and opportunities
- **Multiple Income Paths** - Crime, legitimate jobs, businesses, property investments
- **Crew System** - Form crews, build influence, and dominate districts together
- **Property Ownership** - True scarcity with finite, ownable parcels
- **Dynamic Economy** - Player-driven marketplace and economy
- **Real-time Social** - District chat, messaging, and leaderboards
- **Progressive Gameplay** - Level up, unlock new crimes, jobs, and districts

## Tech Stack

| Component | Technology |
|-----------|------------|
| Game Engine | Phaser 3 |
| Frontend | Vite, JavaScript |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) |
| Deployment | Docker, Nginx |

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account ([supabase.com](https://supabase.com))
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/street-legacy.git
   cd street-legacy
   ```

2. **Run setup script:**
   ```bash
   chmod +x scripts/*.sh
   ./scripts/setup.sh
   ```

3. **Configure environment:**
   ```bash
   # Edit with your Supabase credentials
   nano client/.env
   nano server/.env
   ```

4. **Run database migrations:**
   - Go to Supabase Dashboard > SQL Editor
   - Run each file in `server/supabase/migrations/` in order

5. **Deploy Edge Functions:**
   ```bash
   ./scripts/deploy-functions.sh
   ```

6. **Start development server:**
   ```bash
   cd client
   npm run dev
   ```

7. **Open game:**
   Navigate to `http://localhost:5173`

## Docker Deployment

### Development
```bash
docker-compose up client
```

### Production
```bash
docker-compose --profile production up -d client-prod
```

### With Scheduler (for maintenance jobs)
```bash
docker-compose --profile with-scheduler up -d
```

## Project Structure

```
street-legacy/
├── client/                    # Phaser game client
│   ├── src/
│   │   ├── game/             # Phaser scenes and game logic
│   │   │   ├── scenes/       # Game scenes (Boot, Main, Crime, etc.)
│   │   │   ├── GameManager.js # Backend integration
│   │   │   └── config.js     # Phaser configuration
│   │   ├── services/         # Supabase API services
│   │   └── utils/            # Helpers and formatters
│   ├── public/               # Static assets
│   ├── Dockerfile.dev        # Development container
│   ├── Dockerfile.prod       # Production container
│   └── nginx.conf            # Production web server config
│
├── server/                    # Backend configuration
│   ├── supabase/
│   │   ├── functions/        # Edge Functions
│   │   └── migrations/       # Database migrations
│   ├── scripts/              # Server scripts
│   └── Dockerfile.scheduler  # Cron job container
│
├── shared/                    # Shared types and utilities
│
├── scripts/                   # Project scripts
│   ├── setup.sh              # Initial setup
│   ├── deploy-functions.sh   # Deploy Edge Functions
│   └── run-migrations.sh     # Database migration guide
│
└── docker-compose.yml         # Container orchestration
```

## Game Scenes

| Scene | Purpose |
|-------|---------|
| BootScene | Authentication check |
| PreloadScene | Asset loading |
| MainMenuScene | Login/signup/character creation |
| GameScene | Main game hub |
| UIScene | HUD overlay (stats, currency) |
| CrimeScene | Criminal activities |
| JobScene | Legitimate work |
| MapScene | District travel |
| PropertyScene | Property/business management |
| InventoryScene | Item management |
| CrewScene | Crew features |
| BankScene | Banking (deposit/withdraw) |

## Environment Variables

### Client (`client/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=Street Legacy
```

### Server (`server/.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SCHEDULER_SECRET=your-scheduler-secret
```

## Scheduled Jobs

The scheduler container runs these maintenance tasks:

| Job | Frequency | Description |
|-----|-----------|-------------|
| energy-regen | Every 10 min | Regenerate player energy |
| jail-release | Every 5 min | Release players from jail |
| hourly | Every hour | Business income, property taxes |
| daily | Daily | Reset daily limits, decay heat |
| weekly | Weekly | Leaderboard rewards |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/street-legacy/issues)
- Discord: [Join our server](#)

---

Built with Phaser 3 and Supabase
