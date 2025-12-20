import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/jail - Get jail status and options
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player jail status
    const playerResult = await pool.query(
      `SELECT in_jail, jail_release_at, cash, level, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player.in_jail || !player.jail_release_at || new Date(player.jail_release_at) <= new Date()) {
      res.json({
        success: true,
        data: {
          inJail: false,
          jailRecord: null,
          bailAmount: 0,
          escapeChance: 0
        }
      });
      return;
    }

    // Get current jail record
    const jailRecordResult = await pool.query(
      `SELECT * FROM jail_records
       WHERE player_id = $1 AND released_at IS NULL
       ORDER BY jailed_at DESC LIMIT 1`,
      [playerId]
    );

    const jailRecord = jailRecordResult.rows[0] || null;
    const remainingMinutes = Math.ceil((new Date(player.jail_release_at).getTime() - Date.now()) / 60000);

    // Calculate bail amount (based on remaining time and level)
    const baseBail = 1000;
    const levelMultiplier = player.level * 100;
    const timeMultiplier = remainingMinutes * 50;
    const bailAmount = Math.floor(baseBail + levelMultiplier + timeMultiplier);

    // Calculate escape chance (decreases with each attempt)
    const attempts = jailRecord?.escape_attempts || 0;
    const baseEscapeChance = 25; // 25% base chance
    const levelBonus = Math.min(player.level, 10); // Up to 10% bonus from level
    const attemptPenalty = attempts * 10; // -10% per previous attempt
    const escapeChance = Math.max(5, Math.min(50, baseEscapeChance + levelBonus - attemptPenalty));

    // Get visitors (friends who can help reduce sentence)
    const visitorsResult = await pool.query(
      `SELECT p.id, p.username, p.level
       FROM friends f
       JOIN players p ON (
         CASE WHEN f.player_id = $1 THEN f.friend_id ELSE f.player_id END
       ) = p.id
       WHERE (f.player_id = $1 OR f.friend_id = $1)
         AND f.status = 'accepted'
         AND p.in_jail = FALSE
       LIMIT 5`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        inJail: true,
        releaseAt: player.jail_release_at,
        remainingMinutes,
        jailRecord: jailRecord ? {
          id: jailRecord.id,
          sentenceMinutes: jailRecord.sentence_minutes,
          bailAmount: jailRecord.bail_amount || bailAmount,
          bailPaid: jailRecord.bail_paid,
          escapeAttempts: jailRecord.escape_attempts,
          jailedAt: jailRecord.jailed_at
        } : null,
        bailAmount,
        escapeChance,
        potentialVisitors: visitorsResult.rows
      }
    });
  } catch (error) {
    console.error('Jail status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get jail status' });
  }
});

// POST /api/jail/bail - Pay bail to get out early
router.post('/bail', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player status
    const playerResult = await pool.query(
      `SELECT in_jail, jail_release_at, cash, bank, level, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player.in_jail || !player.jail_release_at || new Date(player.jail_release_at) <= new Date()) {
      res.status(400).json({ success: false, error: 'You are not in jail' });
      return;
    }

    const remainingMinutes = Math.ceil((new Date(player.jail_release_at).getTime() - Date.now()) / 60000);
    const baseBail = 1000;
    const levelMultiplier = player.level * 100;
    const timeMultiplier = remainingMinutes * 50;
    const bailAmount = Math.floor(baseBail + levelMultiplier + timeMultiplier);

    const totalMoney = player.cash + player.bank;
    if (totalMoney < bailAmount) {
      res.status(400).json({
        success: false,
        error: `Insufficient funds. Bail is ${bailAmount.toLocaleString()} but you only have ${totalMoney.toLocaleString()}`
      });
      return;
    }

    // Deduct from cash first, then bank
    let remainingBail = bailAmount;
    let cashDeducted = Math.min(player.cash, remainingBail);
    remainingBail -= cashDeducted;
    let bankDeducted = remainingBail;

    // Release from jail
    await pool.query(
      `UPDATE players SET
        in_jail = FALSE,
        jail_release_at = NULL,
        cash = cash - $2,
        bank = bank - $3
       WHERE id = $1`,
      [playerId, cashDeducted, bankDeducted]
    );

    // Update jail record
    await pool.query(
      `UPDATE jail_records
       SET bail_paid = TRUE, bail_amount = $2, released_at = NOW()
       WHERE player_id = $1 AND released_at IS NULL`,
      [playerId, bailAmount]
    );

    res.json({
      success: true,
      data: {
        message: `Paid $${bailAmount.toLocaleString()} bail and released from jail!`,
        bailPaid: bailAmount,
        cashDeducted,
        bankDeducted
      }
    });
  } catch (error) {
    console.error('Bail error:', error);
    res.status(500).json({ success: false, error: 'Failed to pay bail' });
  }
});

// POST /api/jail/escape - Attempt to escape from jail
router.post('/escape', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player status
    const playerResult = await pool.query(
      `SELECT in_jail, jail_release_at, level, nerve, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player.in_jail || !player.jail_release_at || new Date(player.jail_release_at) <= new Date()) {
      res.status(400).json({ success: false, error: 'You are not in jail' });
      return;
    }

    // Check nerve (escape costs nerve)
    const nerveCost = 20;
    if (player.nerve < nerveCost) {
      res.status(400).json({
        success: false,
        error: `Escape attempt requires ${nerveCost} nerve. You have ${player.nerve}.`
      });
      return;
    }

    // Get jail record for attempt count
    const jailRecordResult = await pool.query(
      `SELECT * FROM jail_records
       WHERE player_id = $1 AND released_at IS NULL
       ORDER BY jailed_at DESC LIMIT 1`,
      [playerId]
    );

    const jailRecord = jailRecordResult.rows[0];
    const attempts = jailRecord?.escape_attempts || 0;

    // Check max attempts
    if (attempts >= 3) {
      res.status(400).json({
        success: false,
        error: 'Maximum escape attempts reached. Wait for release or pay bail.'
      });
      return;
    }

    // Deduct nerve
    await pool.query(
      `UPDATE players SET nerve = nerve - $2 WHERE id = $1`,
      [playerId, nerveCost]
    );

    // Calculate escape chance
    const baseEscapeChance = 25;
    const levelBonus = Math.min(player.level, 10);
    const attemptPenalty = attempts * 10;
    const escapeChance = Math.max(5, Math.min(50, baseEscapeChance + levelBonus - attemptPenalty));

    // Roll for escape
    const roll = Math.random() * 100;
    const escaped = roll < escapeChance;

    if (escaped) {
      // Successful escape!
      await pool.query(
        `UPDATE players SET in_jail = FALSE, jail_release_at = NULL WHERE id = $1`,
        [playerId]
      );

      await pool.query(
        `UPDATE jail_records
         SET escaped = TRUE, escape_attempts = escape_attempts + 1, released_at = NOW()
         WHERE player_id = $1 AND released_at IS NULL`,
        [playerId]
      );

      res.json({
        success: true,
        data: {
          escaped: true,
          message: 'You successfully escaped from jail! Stay low for a while.',
          roll: Math.floor(roll),
          neededUnder: escapeChance
        }
      });
    } else {
      // Failed escape - add time to sentence
      const additionalMinutes = 5;
      const newReleaseAt = new Date(new Date(player.jail_release_at).getTime() + additionalMinutes * 60000);

      await pool.query(
        `UPDATE players SET jail_release_at = $2 WHERE id = $1`,
        [playerId, newReleaseAt]
      );

      await pool.query(
        `UPDATE jail_records
         SET escape_attempts = escape_attempts + 1, sentence_minutes = sentence_minutes + $2
         WHERE player_id = $1 AND released_at IS NULL`,
        [playerId, additionalMinutes]
      );

      res.json({
        success: true,
        data: {
          escaped: false,
          message: `Escape failed! Guards caught you. ${additionalMinutes} minutes added to your sentence.`,
          roll: Math.floor(roll),
          neededUnder: escapeChance,
          additionalTime: additionalMinutes
        }
      });
    }
  } catch (error) {
    console.error('Escape error:', error);
    res.status(500).json({ success: false, error: 'Failed to attempt escape' });
  }
});

// POST /api/jail/bribe - Bribe a guard to reduce sentence
router.post('/bribe', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    if (!amount || amount < 500) {
      res.status(400).json({ success: false, error: 'Minimum bribe is $500' });
      return;
    }

    // Get player status
    const playerResult = await pool.query(
      `SELECT in_jail, jail_release_at, cash, level FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player.in_jail || !player.jail_release_at || new Date(player.jail_release_at) <= new Date()) {
      res.status(400).json({ success: false, error: 'You are not in jail' });
      return;
    }

    if (player.cash < amount) {
      res.status(400).json({ success: false, error: 'Insufficient cash for bribe' });
      return;
    }

    // Deduct bribe money
    await pool.query(
      `UPDATE players SET cash = cash - $2 WHERE id = $1`,
      [playerId, amount]
    );

    // Calculate time reduction (roughly $100 per minute reduced)
    const minutesReduced = Math.floor(amount / 100);
    const currentRelease = new Date(player.jail_release_at);
    const newRelease = new Date(currentRelease.getTime() - minutesReduced * 60000);
    const now = new Date();

    if (newRelease <= now) {
      // Bribe got us out!
      await pool.query(
        `UPDATE players SET in_jail = FALSE, jail_release_at = NULL WHERE id = $1`,
        [playerId]
      );

      await pool.query(
        `UPDATE jail_records SET released_at = NOW() WHERE player_id = $1 AND released_at IS NULL`,
        [playerId]
      );

      res.json({
        success: true,
        data: {
          message: `Your $${amount.toLocaleString()} bribe worked! The guard let you out.`,
          released: true,
          minutesReduced
        }
      });
    } else {
      // Reduced sentence
      await pool.query(
        `UPDATE players SET jail_release_at = $2 WHERE id = $1`,
        [playerId, newRelease]
      );

      await pool.query(
        `UPDATE jail_records SET sentence_minutes = sentence_minutes - $2 WHERE player_id = $1 AND released_at IS NULL`,
        [playerId, minutesReduced]
      );

      res.json({
        success: true,
        data: {
          message: `Guard accepted your $${amount.toLocaleString()} bribe. Sentence reduced by ${minutesReduced} minutes.`,
          released: false,
          minutesReduced,
          newReleaseAt: newRelease
        }
      });
    }
  } catch (error) {
    console.error('Bribe error:', error);
    res.status(500).json({ success: false, error: 'Failed to bribe guard' });
  }
});

// POST /api/jail/visit - Friend visits to reduce sentence
router.post('/visit', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { targetPlayerId } = req.body;

    if (!targetPlayerId) {
      res.status(400).json({ success: false, error: 'Target player ID required' });
      return;
    }

    // Check if target is actually in jail
    const targetResult = await pool.query(
      `SELECT id, username, in_jail, jail_release_at FROM players WHERE id = $1`,
      [targetPlayerId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const target = targetResult.rows[0];
    if (!target.in_jail || !target.jail_release_at || new Date(target.jail_release_at) <= new Date()) {
      res.status(400).json({ success: false, error: 'That player is not in jail' });
      return;
    }

    // Check if they are friends
    const friendResult = await pool.query(
      `SELECT * FROM friends
       WHERE ((player_id = $1 AND friend_id = $2) OR (player_id = $2 AND friend_id = $1))
         AND status = 'accepted'`,
      [playerId, targetPlayerId]
    );

    if (friendResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You can only visit friends' });
      return;
    }

    // Check if visitor is in jail
    const visitorResult = await pool.query(
      `SELECT in_jail FROM players WHERE id = $1`,
      [playerId]
    );

    if (visitorResult.rows[0].in_jail) {
      res.status(400).json({ success: false, error: 'You cannot visit while in jail yourself' });
      return;
    }

    // Reduce sentence by 2 minutes per visit (max once per day)
    const minutesReduced = 2;
    const currentRelease = new Date(target.jail_release_at);
    const newRelease = new Date(currentRelease.getTime() - minutesReduced * 60000);
    const now = new Date();

    if (newRelease <= now) {
      await pool.query(
        `UPDATE players SET in_jail = FALSE, jail_release_at = NULL WHERE id = $1`,
        [targetPlayerId]
      );

      await pool.query(
        `UPDATE jail_records SET released_at = NOW() WHERE player_id = $1 AND released_at IS NULL`,
        [targetPlayerId]
      );

      res.json({
        success: true,
        data: {
          message: `Your visit helped ${target.username} get released early!`,
          released: true,
          minutesReduced
        }
      });
    } else {
      await pool.query(
        `UPDATE players SET jail_release_at = $2 WHERE id = $1`,
        [targetPlayerId, newRelease]
      );

      res.json({
        success: true,
        data: {
          message: `You visited ${target.username}. Their sentence was reduced by ${minutesReduced} minutes.`,
          released: false,
          minutesReduced,
          newReleaseAt: newRelease
        }
      });
    }
  } catch (error) {
    console.error('Visit error:', error);
    res.status(500).json({ success: false, error: 'Failed to visit player' });
  }
});

// GET /api/jail/history - Get jail history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const historyResult = await pool.query(
      `SELECT jr.*, c.name as crime_name
       FROM jail_records jr
       LEFT JOIN crimes c ON jr.crime_id = c.id
       WHERE jr.player_id = $1
       ORDER BY jr.jailed_at DESC
       LIMIT 20`,
      [playerId]
    );

    // Get stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_arrests,
        SUM(CASE WHEN bail_paid THEN 1 ELSE 0 END) as times_bailed,
        SUM(CASE WHEN escaped THEN 1 ELSE 0 END) as successful_escapes,
        SUM(escape_attempts) as total_escape_attempts,
        COALESCE(SUM(sentence_minutes), 0) as total_time_served
       FROM jail_records WHERE player_id = $1`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        history: historyResult.rows.map(record => ({
          id: record.id,
          crimeName: record.crime_name || 'Unknown',
          sentenceMinutes: record.sentence_minutes,
          bailAmount: record.bail_amount,
          bailPaid: record.bail_paid,
          escaped: record.escaped,
          escapeAttempts: record.escape_attempts,
          jailedAt: record.jailed_at,
          releasedAt: record.released_at
        })),
        stats: {
          totalArrests: Number(statsResult.rows[0]?.total_arrests) || 0,
          timesBailed: Number(statsResult.rows[0]?.times_bailed) || 0,
          successfulEscapes: Number(statsResult.rows[0]?.successful_escapes) || 0,
          totalEscapeAttempts: Number(statsResult.rows[0]?.total_escape_attempts) || 0,
          totalTimeServed: Number(statsResult.rows[0]?.total_time_served) || 0
        }
      }
    });
  } catch (error) {
    console.error('Jail history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get jail history' });
  }
});

export default router;
