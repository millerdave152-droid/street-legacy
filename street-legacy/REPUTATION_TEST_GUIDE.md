# Contextual Reputation System - Test Guide

## Quick Start

1. **Start the servers:**
   ```bash
   # Terminal 1 - Server
   cd street-legacy/server && npm run dev

   # Terminal 2 - Client
   cd street-legacy/client && npm run dev
   ```

2. **Open browser:** http://localhost:5173

---

## 1. Database Schema Verification

Run these SQL queries in Supabase or psql to verify tables exist:

```sql
-- Check player_reputations table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'player_reputations';

-- Check reputation_events table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reputation_events';

-- Check reputation_factions table (contextual reputation version)
SELECT * FROM reputation_factions LIMIT 5;

-- Check seed data
SELECT id, name, home_district, allies, enemies FROM reputation_factions;
```

Expected tables:
- `player_reputations` - Multi-dimensional reputation records
- `reputation_events` - Audit log of reputation changes
- `reputation_factions` - Faction definitions with allies/enemies (for contextual reputation)

---

## 2. API Endpoint Tests (with curl)

### Get Auth Token First
```bash
# Login (replace with your credentials)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Save the token from response
export TOKEN="your-jwt-token-here"
export PLAYER_ID="your-player-id"
```

### Reputation Endpoints

```bash
# Get full reputation web
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation"

# Get specific district reputation
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation/district/downtown"

# Modify reputation (POST)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation/district/downtown" \
  -d '{"changes":{"respect":5,"fear":2},"reason":"Test modification","propagate":true}'

# Get reputation history
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation/history?limit=10"

# Get all factions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/factions"

# Get specific faction
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/factions/black_dragons"

# Get factions in district
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/districts/downtown/factions"

# Get district reputation with factions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/districts/downtown/reputation"

# Calculate standing utility
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/reputation/standing/50/30/20"
```

### District Ecosystem with Reputation

```bash
# Get player-specific modifiers (includes reputation effects)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/districts/downtown/player-modifiers"

# Expected response includes:
# - Base modifiers (crimeDifficulty, propertyIncome, etc.)
# - Reputation modifiers (reputationBonus, crimeSuccessBonus, heatGenerationMod, recruitmentBonus)
# - Status reputation multiplier
```

---

## 3. Integration Tests (In-Game Actions)

### Crime System Test
1. Go to the Crimes page in the game
2. Note your current district reputation
3. Commit a crime
4. Check reputation changed:
   - Success: +respect, +fear, +heat
   - Failure: -respect, +heat (more if caught)

```bash
# Check reputation after crime
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation/district/downtown"
```

### PvP System Test
1. Go to PvP Arena
2. Attack another player
3. Check reputation:
   - Winner: +fear, +respect in district, +fear with defeated player
   - Loser: -respect in district

### Crew System Test
1. Create or join a crew
2. Check crew reputation created:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation/crew/CREW_ID"
```
3. Deposit money - should gain trust
4. Leave crew - should lose trust

### Faction System Test
1. Make first contact with a faction
2. Donate money
3. Check both legacy and contextual reputation increased:
```bash
# Legacy faction rep
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/factions/list"

# Contextual faction rep
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/reputation/players/$PLAYER_ID/reputation/faction/FACTION_ID"
```

---

## 4. Expected Reputation Values

### Score Ranges
- `respect`: -100 to 100 (Are you taken seriously?)
- `fear`: -100 to 100 (Are you dangerous?)
- `trust`: -100 to 100 (Can you be relied on?)
- `heat`: 0 to 100 (Are authorities watching you?)

### Standing Calculations
Based on combined score (respect + fear + trust):
- `unknown`: No significant reputation
- `known`: People know who you are
- `respected`: High respect
- `feared`: High fear
- `trusted`: High trust
- `legendary`: Exceptional combined reputation
- `hated`: Strongly negative
- `notorious`: High fear with negative respect

### District Status Multipliers
- `warzone`: 1.5x reputation gains
- `volatile`: 1.25x reputation gains
- `stable`: 1.0x (normal)
- `declining`: 1.1x reputation gains
- `gentrifying`: 0.9x reputation gains

---

## 5. Troubleshooting

### Common Issues

1. **"No token provided"**: Include Authorization header
2. **"You can only view your own reputation"**: Use your own player ID
3. **Empty reputation**: Actions create reputation records on first interaction

### Check Server Logs
The server logs reputation changes:
```
[ReputationRoutes] POST modify reputation: player=123, type=district, target=downtown
[ReputationRoutes] Changes: {"respect":5,"fear":2}, Reason: Test
```

### Database Direct Check
```sql
-- See all reputation records for a player
SELECT * FROM player_reputations WHERE player_id = 'your-uuid';

-- See recent reputation events
SELECT * FROM reputation_events
ORDER BY created_at DESC
LIMIT 20;

-- See propagation happening
SELECT * FROM reputation_events
WHERE reason LIKE '%propagated%'
ORDER BY created_at DESC;
```

---

## 6. Test Script

Run the automated test script:
```bash
cd street-legacy/server
node test-reputation.js
```

Note: Update the email/password in the script for your account.
