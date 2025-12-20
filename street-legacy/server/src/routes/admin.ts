import { Router, Response, Request, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import { adminAudit, logAuditWithRequest, getAuditLogs, getSecurityAlerts, getLoginHistory } from '../utils/auditLog.js';
import type { AuditCategory, AuditSeverity } from '../utils/auditLog.js';
import { runDistrictStateCalculation, getJobStatus } from '../jobs/districtStateCalculator.job.js';
import { getAllDistrictStates, getDistrictHistory } from '../services/districtEcosystem.service.js';

const router = Router();

// Admin payload interface
interface AdminPayload {
  id: number;
  username: string;
  role: 'superadmin' | 'moderator';
}

interface AdminRequest extends Request {
  admin?: AdminPayload;
}

// Admin auth middleware
function adminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Admin authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET! + '_admin') as AdminPayload;
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid admin token' });
  }
}

// Superadmin-only middleware
function superadminOnly(req: AdminRequest, res: Response, next: NextFunction) {
  if (req.admin?.role !== 'superadmin') {
    res.status(403).json({ success: false, error: 'Superadmin access required' });
    return;
  }
  next();
}

// POST /api/admin/login - Admin login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    const result = await pool.query(
      `SELECT id, username, password_hash, role FROM admin_users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);

    if (!validPassword) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET! + '_admin',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        admin: { id: admin.id, username: admin.username, role: admin.role }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// All routes below require admin auth
router.use(adminAuth);

// GET /api/admin/dashboard - Dashboard statistics
router.get('/dashboard', async (req: AdminRequest, res: Response) => {
  try {
    // Total players
    const totalPlayersResult = await pool.query(`SELECT COUNT(*) as count FROM players`);
    const totalPlayers = parseInt(totalPlayersResult.rows[0].count);

    // Active today (last 24 hours)
    const activeTodayResult = await pool.query(
      `SELECT COUNT(*) as count FROM players WHERE last_seen > NOW() - INTERVAL '24 hours'`
    );
    const activeToday = parseInt(activeTodayResult.rows[0].count);

    // New signups this week
    const newSignupsResult = await pool.query(
      `SELECT COUNT(*) as count FROM players WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    const newSignupsThisWeek = parseInt(newSignupsResult.rows[0].count);

    // Signups by day (last 7 days)
    const signupsByDayResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM players
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // Total economy
    const economyResult = await pool.query(
      `SELECT SUM(cash) as total_cash, SUM(bank) as total_bank FROM players`
    );
    const totalCash = parseInt(economyResult.rows[0].total_cash) || 0;
    const totalBank = parseInt(economyResult.rows[0].total_bank) || 0;

    // Crew banks
    const crewBanksResult = await pool.query(`SELECT SUM(bank) as total FROM crews`);
    const crewBanks = parseInt(crewBanksResult.rows[0].total) || 0;

    // Active players by district
    const districtActivityResult = await pool.query(
      `SELECT d.id, d.name, COUNT(p.id) as player_count
       FROM districts d
       LEFT JOIN players p ON p.current_district = d.id AND p.last_seen > NOW() - INTERVAL '5 minutes'
       GROUP BY d.id, d.name
       ORDER BY player_count DESC`
    );

    // Recent crimes (last 50)
    const recentCrimesResult = await pool.query(
      `SELECT cl.id, cl.success, cl.cash_gained, cl.caught, cl.created_at,
              p.username, c.name as crime_name, d.name as district_name
       FROM crime_logs cl
       JOIN players p ON cl.player_id = p.id
       JOIN crimes c ON cl.crime_id = c.id
       JOIN districts d ON cl.district_id = d.id
       ORDER BY cl.created_at DESC
       LIMIT 50`
    );

    // Pending reports
    const pendingReportsResult = await pool.query(
      `SELECT COUNT(*) as count FROM player_reports WHERE status = 'pending'`
    );
    const pendingReports = parseInt(pendingReportsResult.rows[0].count);

    // Active bans
    const activeBansResult = await pool.query(
      `SELECT COUNT(*) as count FROM players WHERE banned_at IS NOT NULL`
    );
    const activeBans = parseInt(activeBansResult.rows[0].count);

    res.json({
      success: true,
      data: {
        stats: {
          totalPlayers,
          activeToday,
          newSignupsThisWeek,
          totalEconomy: totalCash + totalBank + crewBanks,
          totalCash,
          totalBank,
          crewBanks,
          pendingReports,
          activeBans
        },
        signupsByDay: signupsByDayResult.rows,
        districtActivity: districtActivityResult.rows,
        recentCrimes: recentCrimesResult.rows.map(c => ({
          id: c.id,
          username: c.username,
          crimeName: c.crime_name,
          districtName: c.district_name,
          success: c.success,
          cashGained: c.cash_gained,
          caught: c.caught,
          createdAt: c.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

// GET /api/admin/players - Search players
router.get('/players', async (req: AdminRequest, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT p.id, p.username, p.email, p.level, p.cash, p.bank, p.street_cred,
             p.prestige_level, p.created_at, p.last_seen, p.banned_at, p.ban_reason,
             p.muted_until, c.name as crew_name, c.tag as crew_tag
      FROM players p
      LEFT JOIN crews c ON p.crew_id = c.id
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE p.username ILIKE $1 OR p.email ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY p.last_seen DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM players`;
    if (search) {
      countQuery += ` WHERE username ILIKE $1 OR email ILIKE $1`;
    }
    const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        players: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Search players error:', error);
    res.status(500).json({ success: false, error: 'Failed to search players' });
  }
});

// GET /api/admin/players/:id - Get player details
router.get('/players/:id', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Player info
    const playerResult = await pool.query(
      `SELECT p.*, c.name as crew_name, c.tag as crew_tag,
              d.name as district_name
       FROM players p
       LEFT JOIN crews c ON p.crew_id = c.id
       LEFT JOIN districts d ON p.current_district = d.id
       WHERE p.id = $1`,
      [id]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Player stats
    const statsResult = await pool.query(
      `SELECT * FROM player_stats WHERE player_id = $1`,
      [id]
    );

    // Inventory
    const inventoryResult = await pool.query(
      `SELECT pi.*, i.name, i.type, i.price
       FROM player_inventory pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.player_id = $1`,
      [id]
    );

    // Achievements
    const achievementsResult = await pool.query(
      `SELECT a.name, a.icon, pa.unlocked_at
       FROM player_achievements pa
       JOIN achievements a ON pa.achievement_id = a.id
       WHERE pa.player_id = $1
       ORDER BY pa.unlocked_at DESC`,
      [id]
    );

    // Recent crimes
    const crimesResult = await pool.query(
      `SELECT cl.*, c.name as crime_name
       FROM crime_logs cl
       JOIN crimes c ON cl.crime_id = c.id
       WHERE cl.player_id = $1
       ORDER BY cl.created_at DESC
       LIMIT 20`,
      [id]
    );

    // Street cred transactions
    const credTransactionsResult = await pool.query(
      `SELECT * FROM street_cred_transactions
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      success: true,
      data: {
        player,
        stats: statsResult.rows[0] || null,
        inventory: inventoryResult.rows,
        achievements: achievementsResult.rows,
        recentCrimes: crimesResult.rows,
        credTransactions: credTransactionsResult.rows
      }
    });
  } catch (error) {
    console.error('Get player details error:', error);
    res.status(500).json({ success: false, error: 'Failed to get player details' });
  }
});

// POST /api/admin/players/:id/ban - Ban a player
router.post('/players/:id/ban', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await pool.query(
      `UPDATE players SET banned_at = NOW(), ban_reason = $1 WHERE id = $2`,
      [reason || 'Banned by admin', id]
    );

    // Audit log: ban player
    await adminAudit.banPlayer(req, req.admin!.id, parseInt(id), reason || 'Banned by admin');

    res.json({ success: true, data: { message: 'Player banned' } });
  } catch (error) {
    console.error('Ban player error:', error);
    res.status(500).json({ success: false, error: 'Failed to ban player' });
  }
});

// POST /api/admin/players/:id/unban - Unban a player
router.post('/players/:id/unban', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE players SET banned_at = NULL, ban_reason = NULL WHERE id = $1`,
      [id]
    );

    // Audit log: unban player
    await adminAudit.unbanPlayer(req, req.admin!.id, parseInt(id));

    res.json({ success: true, data: { message: 'Player unbanned' } });
  } catch (error) {
    console.error('Unban player error:', error);
    res.status(500).json({ success: false, error: 'Failed to unban player' });
  }
});

// POST /api/admin/players/:id/mute - Mute a player
router.post('/players/:id/mute', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { minutes, reason } = req.body;

    const muteUntil = new Date(Date.now() + (minutes || 60) * 60 * 1000);

    await pool.query(
      `UPDATE players SET muted_until = $1 WHERE id = $2`,
      [muteUntil, id]
    );

    // Audit log: mute player
    await adminAudit.mutePlayer(req, req.admin!.id, parseInt(id), `${minutes || 60} minutes`, reason);

    res.json({ success: true, data: { message: `Player muted until ${muteUntil}` } });
  } catch (error) {
    console.error('Mute player error:', error);
    res.status(500).json({ success: false, error: 'Failed to mute player' });
  }
});

// POST /api/admin/players/:id/unmute - Unmute a player
router.post('/players/:id/unmute', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(`UPDATE players SET muted_until = NULL WHERE id = $1`, [id]);

    // Audit log: unmute player
    await adminAudit.unmutePlayer(req, req.admin!.id, parseInt(id));

    res.json({ success: true, data: { message: 'Player unmuted' } });
  } catch (error) {
    console.error('Unmute player error:', error);
    res.status(500).json({ success: false, error: 'Failed to unmute player' });
  }
});

// POST /api/admin/players/:id/give - Give items or cash
router.post('/players/:id/give', superadminOnly, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type, amount, itemId, reason } = req.body;

    if (type === 'cash') {
      await pool.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [amount, id]);

      // Audit log: modify cash
      await adminAudit.modifyCash(req, req.admin!.id, parseInt(id), amount, reason || 'Admin gift');

      res.json({ success: true, data: { message: `Gave $${amount} cash` } });
    } else if (type === 'cred') {
      await pool.query(`UPDATE players SET street_cred = street_cred + $1 WHERE id = $2`, [amount, id]);
      await pool.query(
        `INSERT INTO street_cred_transactions (player_id, amount, type, description)
         VALUES ($1, $2, 'bonus', 'Admin gift')`,
        [id, amount]
      );

      // Audit log: modify stats (street cred)
      await adminAudit.modifyStats(req, req.admin!.id, parseInt(id), { street_cred: amount, reason: reason || 'Admin gift' });

      res.json({ success: true, data: { message: `Gave ${amount} street cred` } });
    } else if (type === 'item' && itemId) {
      await pool.query(
        `INSERT INTO player_inventory (player_id, item_id) VALUES ($1, $2)
         ON CONFLICT (player_id, item_id) DO NOTHING`,
        [id, itemId]
      );

      // Audit log: modify stats (item)
      await adminAudit.modifyStats(req, req.admin!.id, parseInt(id), { item_added: itemId, reason: reason || 'Admin gift' });

      res.json({ success: true, data: { message: 'Item added to inventory' } });
    } else {
      res.status(400).json({ success: false, error: 'Invalid type or missing data' });
    }
  } catch (error) {
    console.error('Give to player error:', error);
    res.status(500).json({ success: false, error: 'Failed to give to player' });
  }
});

// GET /api/admin/reports - Get player reports
router.get('/reports', async (req: AdminRequest, res: Response) => {
  try {
    const { status = 'pending' } = req.query;

    const result = await pool.query(
      `SELECT pr.*,
              rp.username as reporter_username,
              rd.username as reported_username,
              a.username as reviewed_by_username
       FROM player_reports pr
       JOIN players rp ON pr.reporter_id = rp.id
       JOIN players rd ON pr.reported_id = rd.id
       LEFT JOIN admin_users a ON pr.reviewed_by = a.id
       WHERE pr.status = $1
       ORDER BY pr.created_at DESC
       LIMIT 50`,
      [status]
    );

    res.json({ success: true, data: { reports: result.rows } });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, error: 'Failed to get reports' });
  }
});

// POST /api/admin/reports/:id/review - Review a report
router.post('/reports/:id/review', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    await pool.query(
      `UPDATE player_reports SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [status, notes, req.admin!.id, id]
    );

    res.json({ success: true, data: { message: 'Report reviewed' } });
  } catch (error) {
    console.error('Review report error:', error);
    res.status(500).json({ success: false, error: 'Failed to review report' });
  }
});

// GET /api/admin/chat - Get chat logs
router.get('/chat', async (req: AdminRequest, res: Response) => {
  try {
    const { channel = 'global', limit = 100, before } = req.query;

    let query = `
      SELECT cm.*, p.username
       FROM chat_messages cm
       JOIN players p ON cm.player_id = p.id
       WHERE cm.channel = $1
    `;
    const params: any[] = [channel];

    if (before) {
      query += ` AND cm.id < $2`;
      params.push(before);
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const result = await pool.query(query, params);

    res.json({ success: true, data: { messages: result.rows } });
  } catch (error) {
    console.error('Get chat logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get chat logs' });
  }
});

// POST /api/admin/events/trigger - Trigger a global event
router.post('/events/trigger', async (req: AdminRequest, res: Response) => {
  try {
    const { name, description, type, bonusType, bonusValue, durationHours, districtId } = req.body;

    const endTime = new Date(Date.now() + (durationHours || 2) * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO events (name, description, type, bonus_type, bonus_value, affected_district_id, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, description, type, bonusType, bonusValue, districtId || null, endTime]
    );

    res.json({
      success: true,
      data: { eventId: result.rows[0].id, message: `Event "${name}" started!` }
    });
  } catch (error) {
    console.error('Trigger event error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger event' });
  }
});

// POST /api/admin/events/schedule - Schedule a future event
router.post('/events/schedule', async (req: AdminRequest, res: Response) => {
  try {
    const { eventType, eventConfig, scheduledFor } = req.body;

    const result = await pool.query(
      `INSERT INTO scheduled_events (event_type, event_config, scheduled_for, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [eventType, eventConfig, scheduledFor, req.admin!.id]
    );

    res.json({
      success: true,
      data: { scheduledEventId: result.rows[0].id, message: 'Event scheduled' }
    });
  } catch (error) {
    console.error('Schedule event error:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule event' });
  }
});

// GET /api/admin/events/scheduled - Get scheduled events
router.get('/events/scheduled', async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT se.*, a.username as created_by_username
       FROM scheduled_events se
       LEFT JOIN admin_users a ON se.created_by = a.id
       WHERE se.executed = FALSE AND se.scheduled_for > NOW()
       ORDER BY se.scheduled_for`
    );

    res.json({ success: true, data: { events: result.rows } });
  } catch (error) {
    console.error('Get scheduled events error:', error);
    res.status(500).json({ success: false, error: 'Failed to get scheduled events' });
  }
});

// POST /api/admin/create - Create new admin (superadmin only)
router.post('/create', superadminOnly, async (req: AdminRequest, res: Response) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
      [username, hashedPassword, role || 'moderator']
    );

    // Audit log: grant admin (creating new admin)
    await logAuditWithRequest(req, {
      playerId: req.admin!.id,
      category: 'admin',
      action: 'grant_admin',
      severity: 'critical',
      details: { newAdminUsername: username, role: role || 'moderator', newAdminId: result.rows[0].id }
    });

    res.json({ success: true, data: { message: 'Admin created' } });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, error: 'Failed to create admin' });
  }
});

// =============================================================================
// SESSION MANAGEMENT (ADMIN)
// =============================================================================

// POST /api/admin/players/:id/revoke-sessions - Revoke all sessions for a player (security action)
router.post('/players/:id/revoke-sessions', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Verify player exists
    const playerResult = await pool.query(
      `SELECT id, username FROM players WHERE id = $1`,
      [id]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Invalidate all sessions by setting the invalidation timestamp
    await pool.query(
      `UPDATE players SET sessions_invalidated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Also revoke session records if session tracking is enabled
    const revokeResult = await pool.query(
      `UPDATE player_sessions
       SET revoked_at = NOW(), revoked_reason = $1
       WHERE player_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [reason || 'admin', id]
    );

    const sessionsRevoked = revokeResult.rows.length;

    // Audit log: force logout
    await adminAudit.forceLogout(req, req.admin!.id, parseInt(id), sessionsRevoked);

    console.log(`[Admin] ${req.admin?.username} revoked all sessions for player ${player.username} (ID: ${id}). Reason: ${reason || 'admin action'}. Sessions revoked: ${sessionsRevoked}`);

    res.json({
      success: true,
      data: {
        message: `All sessions for ${player.username} have been revoked.`,
        sessionsRevoked
      }
    });
  } catch (error) {
    console.error('Admin revoke sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke sessions' });
  }
});

// GET /api/admin/players/:id/sessions - Get active sessions for a player
router.get('/players/:id/sessions', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, device_info, ip_address, created_at, last_active_at
       FROM player_sessions
       WHERE player_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_active_at DESC
       LIMIT 50`,
      [id]
    );

    // Also get the invalidation timestamp
    const playerResult = await pool.query(
      `SELECT sessions_invalidated_at FROM players WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        sessions: result.rows,
        sessionsInvalidatedAt: playerResult.rows[0]?.sessions_invalidated_at
      }
    });
  } catch (error) {
    console.error('Admin get sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

// POST /api/admin/players/:id/force-logout - Force logout a player immediately
// This is used when banning a player to ensure they can't continue playing
router.post('/players/:id/force-logout', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Invalidate all sessions
    await pool.query(
      `UPDATE players SET sessions_invalidated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Revoke all session records
    const result = await pool.query(
      `UPDATE player_sessions
       SET revoked_at = NOW(), revoked_reason = 'admin_force_logout'
       WHERE player_id = $1 AND revoked_at IS NULL`,
      [id]
    );

    // Audit log: force logout
    await adminAudit.forceLogout(req, req.admin!.id, parseInt(id), result.rowCount || 0);

    console.log(`[Admin] ${req.admin?.username} force-logged out player ID: ${id}`);

    res.json({
      success: true,
      data: { message: 'Player has been force logged out' }
    });
  } catch (error) {
    console.error('Admin force logout error:', error);
    res.status(500).json({ success: false, error: 'Failed to force logout' });
  }
});

// =============================================================================
// AUDIT LOG ENDPOINTS
// =============================================================================

// GET /api/admin/audit-logs - Get audit logs with filtering
router.get('/audit-logs', async (req: AdminRequest, res: Response) => {
  try {
    const {
      playerId,
      category,
      action,
      severity,
      targetType,
      targetId,
      ipAddress,
      success,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const logs = await getAuditLogs({
      playerId: playerId ? parseInt(playerId as string) : undefined,
      category: category as AuditCategory | undefined,
      action: action as string | undefined,
      severity: severity as AuditSeverity | undefined,
      targetType: targetType as string | undefined,
      targetId: targetId ? parseInt(targetId as string) : undefined,
      ipAddress: ipAddress as string | undefined,
      success: success !== undefined ? success === 'true' : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: Number(limit),
      offset
    });

    // Get total count for pagination
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM audit_logs`);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit logs' });
  }
});

// GET /api/admin/audit-logs/security-alerts - Get recent security alerts
router.get('/audit-logs/security-alerts', async (req: AdminRequest, res: Response) => {
  try {
    const { hours = 24, limit = 100 } = req.query;

    const alerts = await getSecurityAlerts(Number(hours), Number(limit));

    res.json({
      success: true,
      data: { alerts }
    });
  } catch (error) {
    console.error('Get security alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get security alerts' });
  }
});

// GET /api/admin/audit-logs/player/:id/login-history - Get login history for a player
router.get('/audit-logs/player/:id/login-history', async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { days = 30, limit = 50 } = req.query;

    const history = await getLoginHistory(parseInt(id), Number(days), Number(limit));

    res.json({
      success: true,
      data: { history }
    });
  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get login history' });
  }
});

// GET /api/admin/audit-logs/categories - Get available audit categories and actions
router.get('/audit-logs/categories', async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT category, action, description, default_severity
       FROM audit_action_types
       ORDER BY category, action`
    );

    // Group by category
    const categories: Record<string, Array<{action: string; description: string; severity: string}>> = {};
    for (const row of result.rows) {
      if (!categories[row.category]) {
        categories[row.category] = [];
      }
      categories[row.category].push({
        action: row.action,
        description: row.description,
        severity: row.default_severity
      });
    }

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Get audit categories error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit categories' });
  }
});

// GET /api/admin/audit-logs/stats - Get audit log statistics
router.get('/audit-logs/stats', async (req: AdminRequest, res: Response) => {
  try {
    const { hours = 24 } = req.query;

    // Get counts by category
    const categoryCounts = await pool.query(
      `SELECT category, COUNT(*) as count
       FROM audit_logs
       WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
       GROUP BY category
       ORDER BY count DESC`,
      [hours]
    );

    // Get counts by severity
    const severityCounts = await pool.query(
      `SELECT severity, COUNT(*) as count
       FROM audit_logs
       WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
       GROUP BY severity
       ORDER BY CASE severity
         WHEN 'critical' THEN 1
         WHEN 'error' THEN 2
         WHEN 'warning' THEN 3
         WHEN 'info' THEN 4
         WHEN 'debug' THEN 5
       END`,
      [hours]
    );

    // Get failed actions count
    const failedCount = await pool.query(
      `SELECT COUNT(*) as count
       FROM audit_logs
       WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
       AND success = false`,
      [hours]
    );

    // Get unique IPs with failed logins
    const suspiciousIps = await pool.query(
      `SELECT ip_address, COUNT(*) as failed_attempts
       FROM audit_logs
       WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
       AND category = 'auth'
       AND action = 'login_failed'
       GROUP BY ip_address
       HAVING COUNT(*) >= 3
       ORDER BY failed_attempts DESC
       LIMIT 10`,
      [hours]
    );

    res.json({
      success: true,
      data: {
        period: `${hours} hours`,
        byCategory: categoryCounts.rows,
        bySeverity: severityCounts.rows,
        failedActions: parseInt(failedCount.rows[0].count),
        suspiciousIps: suspiciousIps.rows
      }
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit stats' });
  }
});

// =============================================================================
// DISTRICT ECOSYSTEM ADMIN ENDPOINTS
// =============================================================================

// POST /api/admin/recalculate-districts - Manually trigger district state recalculation
router.post('/recalculate-districts', async (req: AdminRequest, res: Response) => {
  try {
    console.log(`[Admin] District recalculation triggered by admin: ${req.admin?.username}`);

    // Log the admin action
    await logAuditWithRequest(
      req,
      AuditCategory.ADMIN,
      'district_recalculation_triggered',
      {
        triggeredBy: req.admin?.username,
        triggeredAt: new Date().toISOString()
      },
      AuditSeverity.LOW,
      true,
      req.admin?.id
    );

    // Run the calculation
    const result = await runDistrictStateCalculation();

    res.json({
      success: true,
      data: {
        message: 'District state recalculation completed',
        processed: result.processed,
        failed: result.failed,
        statusChanges: result.statusChanges,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('District recalculation error:', error);
    res.status(500).json({ success: false, error: 'Failed to recalculate districts' });
  }
});

// GET /api/admin/district-job-status - Get district calculator job status
router.get('/district-job-status', async (req: AdminRequest, res: Response) => {
  try {
    const jobStatus = getJobStatus();

    res.json({
      success: true,
      data: {
        isRunning: jobStatus.isRunning,
        lastRunAt: jobStatus.lastRunAt,
        lastRunDuration: jobStatus.lastRunDuration,
        lastRunResults: jobStatus.lastRunResults,
        nextRunIn: jobStatus.nextRunIn,
        nextRunInMinutes: jobStatus.nextRunIn ? Math.round(jobStatus.nextRunIn / 60000) : null
      }
    });
  } catch (error) {
    console.error('Get district job status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get job status' });
  }
});

// GET /api/admin/district-states - Get all district states with full details
router.get('/district-states', async (req: AdminRequest, res: Response) => {
  try {
    const states = await getAllDistrictStates();

    // Calculate aggregate statistics
    const stats = {
      totalDistricts: states.length,
      byStatus: {} as Record<string, number>,
      avgCrimeIndex: 0,
      avgPolicePresence: 0,
      avgPropertyValues: 0,
      avgBusinessHealth: 0,
      avgStreetActivity: 0
    };

    let totalCrime = 0, totalPolice = 0, totalProperty = 0, totalBusiness = 0, totalActivity = 0;

    states.forEach(s => {
      stats.byStatus[s.status] = (stats.byStatus[s.status] || 0) + 1;
      totalCrime += s.crimeIndex;
      totalPolice += s.policePresence;
      totalProperty += s.propertyValues;
      totalBusiness += s.businessHealth;
      totalActivity += s.streetActivity;
    });

    if (states.length > 0) {
      stats.avgCrimeIndex = Math.round(totalCrime / states.length);
      stats.avgPolicePresence = Math.round(totalPolice / states.length);
      stats.avgPropertyValues = Math.round(totalProperty / states.length);
      stats.avgBusinessHealth = Math.round(totalBusiness / states.length);
      stats.avgStreetActivity = Math.round(totalActivity / states.length);
    }

    res.json({
      success: true,
      data: {
        districts: states.map(s => ({
          districtId: s.districtId,
          crimeIndex: s.crimeIndex,
          policePresence: s.policePresence,
          propertyValues: s.propertyValues,
          businessHealth: s.businessHealth,
          streetActivity: s.streetActivity,
          status: s.status,
          heatLevel: s.heatLevel,
          crewTension: s.crewTension,
          dailyCrimeCount: s.dailyCrimeCount,
          activeBusinesses: s.activeBusinesses,
          lastCalculated: s.lastCalculated,
          lastStatusChange: s.lastStatusChange
        })),
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Get district states error:', error);
    res.status(500).json({ success: false, error: 'Failed to get district states' });
  }
});

// GET /api/admin/district-events/:districtId - Get recent events for a specific district
router.get('/district-events/:districtId', async (req: AdminRequest, res: Response) => {
  try {
    const { districtId } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const events = await getDistrictHistory(districtId, limit);

    // Get event type breakdown
    const eventTypes: Record<string, number> = {};
    events.forEach(e => {
      eventTypes[e.eventType] = (eventTypes[e.eventType] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        districtId,
        events: events.map(e => ({
          id: e.id,
          eventType: e.eventType,
          severity: e.severity,
          playerId: e.playerId,
          targetPlayerId: e.targetPlayerId,
          crewId: e.crewId,
          crimeImpact: e.crimeImpact,
          policeImpact: e.policeImpact,
          propertyImpact: e.propertyImpact,
          businessImpact: e.businessImpact,
          activityImpact: e.activityImpact,
          metadata: e.metadata,
          processed: e.processed,
          createdAt: e.createdAt
        })),
        eventTypeCounts: eventTypes,
        totalEvents: events.length
      }
    });
  } catch (error) {
    console.error('Get district events error:', error);
    res.status(500).json({ success: false, error: 'Failed to get district events' });
  }
});

export default router;
