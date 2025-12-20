# Street Legacy - Comprehensive Code Audit Report

## Executive Summary

After a deep dive analysis of the entire codebase, I've identified **critical bugs**, **security vulnerabilities**, **performance issues**, and **design improvements** needed across the application.

---

## CRITICAL BUGS

### 1. Database Connection Missing Error Handling
**File:** `server/src/db/connection.ts:1-10`
**Issue:** No connection pooling configuration, no error handling, no retry logic
**Impact:** Server will crash on database connection failures

```typescript
// CURRENT (problematic)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// FIXED VERSION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});
```

### 2. Missing JWT_SECRET Validation
**File:** `server/src/middleware/auth.ts:25`
**Issue:** `process.env.JWT_SECRET!` uses non-null assertion without validation
**Impact:** Server crashes if JWT_SECRET is not set

```typescript
// Add at server startup in index.ts
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 3. SQL Injection Risk in Cooldown Query
**File:** `server/src/routes/game.ts:409-413`
**Issue:** String interpolation used for SQL interval
**Impact:** Potential SQL injection vulnerability

```typescript
// CURRENT (vulnerable)
await pool.query(
  `INSERT INTO player_cooldowns... NOW() + INTERVAL '${actualCooldown} seconds'`
);

// FIXED VERSION
await pool.query(
  `INSERT INTO player_cooldowns (player_id, crime_id, available_at)
   VALUES ($1, $2, NOW() + $3 * INTERVAL '1 second')
   ON CONFLICT (player_id, crime_id) DO UPDATE SET available_at = NOW() + $3 * INTERVAL '1 second'`,
  [playerId, crimeId, actualCooldown]
);
```

### 4. Race Condition in Crime Execution
**File:** `server/src/routes/game.ts:196-482`
**Issue:** No transaction wrapping for crime execution
**Impact:** Player can exploit timing to commit multiple crimes simultaneously

```typescript
// Should use transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... crime logic
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### 5. Missing Input Validation
**File:** `server/src/routes/auth.ts:10-14`
**Issue:** No email format validation, no username sanitization
**Impact:** Invalid data stored in database, XSS potential

```typescript
// Add validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ success: false, error: 'Invalid email format' });
}

if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
  return res.status(400).json({ success: false, error: 'Invalid username format' });
}
```

---

## SECURITY VULNERABILITIES

### 1. No Rate Limiting
**Impact:** API vulnerable to brute force attacks, DoS
**Fix:** Add rate limiting middleware

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests' }
});

app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts
  message: { success: false, error: 'Too many login attempts' }
});

app.use('/api/auth/login', authLimiter);
```

### 2. No CSRF Protection
**Impact:** Cross-site request forgery attacks possible
**Fix:** Add CSRF tokens for state-changing operations

### 3. Password Policy Too Weak
**File:** `server/src/routes/auth.ts:18-20`
**Issue:** Only 6 character minimum, no complexity requirements

```typescript
// Enhanced validation
if (password.length < 8) {
  return res.status(400).json({ error: 'Password must be at least 8 characters' });
}
if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  return res.status(400).json({ error: 'Password must contain uppercase and number' });
}
```

### 4. Sensitive Data in JWT
**Issue:** Username stored in JWT payload, visible to client
**Fix:** Only store user ID in JWT, fetch username from database

### 5. No Request Body Size Limit
**File:** `server/src/index.ts:77`
**Fix:** Add body size limit

```typescript
app.use(express.json({ limit: '10kb' }));
```

---

## PERFORMANCE ISSUES

### 1. N+1 Query Problem in Game State
**File:** `server/src/routes/game.ts:23-137`
**Issue:** Multiple sequential queries that could be combined
**Fix:** Use JOINs and batch queries

### 2. No Database Connection Pooling Config
**File:** `server/src/db/connection.ts`
**Fix:** Configure proper pool settings

### 3. Missing Indexes for Common Queries
**Required indexes:**
```sql
CREATE INDEX idx_players_heat ON players(heat);
CREATE INDEX idx_combat_sessions_active ON combat_sessions(status, updated_at);
CREATE INDEX idx_bounties_amount ON bounties(amount DESC) WHERE status = 'active';
```

### 4. No Caching Layer
**Fix:** Add Redis for session and frequently accessed data

### 5. Client-Side Over-Fetching
**File:** `client/src/stores/gameStore.ts:140`
**Issue:** Full state refresh after every crime
**Fix:** Return only changed data, use optimistic updates

---

## CLIENT-SIDE ISSUES

### 1. Memory Leak in Game.tsx
**File:** `client/src/pages/Game.tsx:63-67`
**Issue:** Interval not properly cleaned on unmount in all cases

```typescript
// Current - potential leak if fetchState changes
useEffect(() => {
  fetchState();
  const interval = setInterval(fetchState, 30000);
  return () => clearInterval(interval);
}, [fetchState]); // fetchState in deps causes re-creation
```

### 2. Inline Styles Causing Re-renders
**File:** `client/src/pages/Game.tsx:633-1140`
**Issue:** 500+ lines of inline styles object
**Fix:** Move to CSS modules or Tailwind classes

### 3. No Error Boundaries
**Impact:** Single component error crashes entire app
**Fix:** Add React Error Boundaries

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh.</div>;
    }
    return this.props.children;
  }
}
```

### 4. No Loading States for Components
**Issue:** Many components don't show loading indicators
**Fix:** Add skeleton loaders

### 5. Accessibility Issues
- No ARIA labels on interactive elements
- Missing keyboard navigation
- Low color contrast in some areas

---

## API ROUTE ISSUES

### 1. Duplicate Route Registration
**File:** `server/src/index.ts:86 & 118`
```typescript
app.use('/api/shop', inventoryRoutes);      // Line 86
app.use('/api/missions', missionsRoutes);    // Line 89
app.use('/api/missions', missionsAvailableRoutes); // Line 118 - DUPLICATE BASE PATH
```
**Fix:** Consolidate or use sub-routes

### 2. Inconsistent Error Response Format
**Issue:** Some routes return `{ error: 'message' }`, others `{ success: false, error: 'message' }`
**Fix:** Standardize all error responses

### 3. Missing Route Validation
**Multiple files** lack input validation using a schema validator
**Fix:** Add Zod or Joi validation

```typescript
import { z } from 'zod';

const crimeSchema = z.object({
  crimeId: z.number().int().positive()
});

router.post('/crime', async (req, res) => {
  const result = crimeSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.message });
  }
  // ...
});
```

---

## ARCHITECTURAL IMPROVEMENTS

### 1. Add Service Layer
Currently, business logic is in route handlers. Extract to services:

```
server/src/
  routes/      - HTTP handling only
  services/    - Business logic
  repositories/ - Database access
  middleware/  - Request processing
```

### 2. Add Request/Response DTOs
Create typed DTOs for API contracts

### 3. Add Logging Infrastructure
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 4. Add Health Check Improvements
**File:** `server/src/index.ts:138-147`
```typescript
app.get('/api/health', async (_req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');

    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: { status: 'unhealthy', database: 'disconnected' }
    });
  }
});
```

### 5. Environment Configuration
Create proper config management:

```typescript
// server/src/config/index.ts
export const config = {
  port: parseInt(process.env.PORT || '3001'),
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '20')
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  }
};
```

---

## DATABASE SCHEMA ISSUES

### 1. Missing Foreign Key Constraints
Some tables lack proper ON DELETE behavior

### 2. No Soft Deletes
Add `deleted_at` columns for audit trail

### 3. Missing Timestamps
Some tables lack `created_at` and `updated_at`

### 4. Data Type Issues
- Using INTEGER for money (should use DECIMAL/NUMERIC for precision)
- No check constraints on many numeric fields

---

## RECOMMENDED PRIORITY FIXES

### IMMEDIATE (Critical Security)
1. Add rate limiting
2. Fix SQL injection vulnerability
3. Add JWT_SECRET validation
4. Add request body size limits

### HIGH (Stability)
5. Add database connection error handling
6. Wrap crime execution in transactions
7. Add input validation throughout
8. Add Error Boundaries in React

### MEDIUM (Performance)
9. Add connection pooling config
10. Implement caching layer
11. Fix N+1 queries
12. Add missing database indexes

### LOW (Code Quality)
13. Extract inline styles to CSS
14. Add service layer architecture
15. Standardize error responses
16. Add comprehensive logging

---

## MISSING FEATURES

1. **Email Verification** - No email confirmation on registration
2. **Password Reset** - No forgot password functionality
3. **2FA** - No two-factor authentication
4. **Audit Logging** - No tracking of sensitive actions
5. **WebSocket** - Chat uses polling, should use WebSocket
6. **API Versioning** - No `/api/v1` prefix for future compatibility

---

## TESTING GAPS

1. No unit tests
2. No integration tests
3. No E2E tests
4. No load testing

---

## FILES REQUIRING IMMEDIATE ATTENTION

| File | Priority | Issue |
|------|----------|-------|
| `server/src/db/connection.ts` | CRITICAL | No error handling |
| `server/src/routes/game.ts` | CRITICAL | SQL injection, race conditions |
| `server/src/middleware/auth.ts` | HIGH | JWT_SECRET validation |
| `server/src/routes/auth.ts` | HIGH | Input validation |
| `server/src/index.ts` | HIGH | Rate limiting, body limits |
| `client/src/pages/Game.tsx` | MEDIUM | Memory leak, performance |

---

## CONCLUSION

The application has a solid foundation but requires significant security hardening and performance optimization before production deployment. The critical issues should be addressed immediately, with high-priority items completed within the next sprint.

Total estimated effort: 2-3 weeks for critical and high priority fixes.
