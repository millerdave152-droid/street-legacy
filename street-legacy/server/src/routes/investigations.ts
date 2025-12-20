import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Investigation stages and their durations
const STAGE_DURATIONS = {
  preliminary: 3 * 24 * 60 * 60 * 1000, // 3 days
  active: 7 * 24 * 60 * 60 * 1000, // 7 days
  subpoena: 5 * 24 * 60 * 60 * 1000 // 5 days
};

// Consequences by severity
const CONSEQUENCES = {
  1: { fineMin: 5000, fineMax: 25000, jailHoursMin: 0, jailHoursMax: 2, assetSeizurePercent: 5 },
  2: { fineMin: 25000, fineMax: 100000, jailHoursMin: 2, jailHoursMax: 8, assetSeizurePercent: 15 },
  3: { fineMin: 100000, fineMax: 500000, jailHoursMin: 8, jailHoursMax: 24, assetSeizurePercent: 25 },
  4: { fineMin: 500000, fineMax: 2000000, jailHoursMin: 24, jailHoursMax: 72, assetSeizurePercent: 40 },
  5: { fineMin: 2000000, fineMax: 10000000, jailHoursMin: 72, jailHoursMax: 168, assetSeizurePercent: 60 }
};

// GET /api/investigations/active - Get player's active investigations
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const investigationsResult = await pool.query(
      `SELECT i.*, bf.name as business_name
       FROM investigations i
       LEFT JOIN business_fronts bf ON i.business_id = bf.id
       WHERE i.player_id = $1 AND i.stage NOT IN ('resolved', 'dismissed')
       ORDER BY i.started_at DESC`,
      [playerId]
    );

    // Check if player has attorney
    const attorneyResult = await pool.query(
      `SELECT * FROM player_attorney_relationships
       WHERE player_id = $1 AND is_active = true AND retainer_paid_until > NOW()`,
      [playerId]
    );
    const hasAttorney = attorneyResult.rows.length > 0;
    const attorney = attorneyResult.rows[0];

    const investigations = investigationsResult.rows.map(inv => {
      // Calculate if player should know about this investigation
      const isKnown = inv.stage !== 'preliminary' || inv.player_notified_at;

      return {
        id: inv.id,
        businessId: inv.business_id,
        businessName: inv.business_name,
        type: inv.investigation_type,
        triggerReason: isKnown ? inv.trigger_reason : 'Unknown',
        stage: isKnown ? inv.stage : 'unknown',
        severity: inv.severity,
        evidenceStrength: isKnown ? inv.evidence_strength : null,
        leadAgent: isKnown ? inv.lead_agent : null,
        agency: inv.agency,
        startedAt: inv.started_at,
        playerNotifiedAt: inv.player_notified_at,
        subpoenaIssuedAt: inv.subpoena_issued_at,
        chargesFiledAt: inv.charges_filed_at,
        isKnown,
        canRespond: inv.stage === 'subpoena' || inv.stage === 'charges_filed',
        possibleConsequences: isKnown ? CONSEQUENCES[inv.severity as keyof typeof CONSEQUENCES] : null
      };
    });

    res.json({
      success: true,
      data: {
        investigations,
        totalActive: investigations.length,
        knownInvestigations: investigations.filter(i => i.isKnown).length,
        hasAttorney,
        attorneyName: attorney?.attorney_name,
        attorneyHelpPercent: attorney?.audit_reduction_percent
      }
    });
  } catch (error) {
    console.error('Get investigations error:', error);
    res.status(500).json({ success: false, error: 'Failed to get investigations' });
  }
});

// GET /api/investigations/:id - Get investigation details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const investigationId = parseInt(req.params.id);

    const investigationResult = await pool.query(
      `SELECT i.*, bf.name as business_name
       FROM investigations i
       LEFT JOIN business_fronts bf ON i.business_id = bf.id
       WHERE i.id = $1 AND i.player_id = $2`,
      [investigationId, playerId]
    );

    if (investigationResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Investigation not found' });
      return;
    }

    const inv = investigationResult.rows[0];
    const isKnown = inv.stage !== 'preliminary' || inv.player_notified_at;

    if (!isKnown) {
      res.status(403).json({ success: false, error: 'You are not aware of this investigation yet' });
      return;
    }

    // Get player's attorney
    const attorneyResult = await pool.query(
      `SELECT * FROM player_attorney_relationships
       WHERE player_id = $1 AND is_active = true AND retainer_paid_until > NOW()`,
      [playerId]
    );
    const attorney = attorneyResult.rows[0];

    // Calculate defense options
    const defenseOptions = [];

    if (inv.stage === 'subpoena') {
      defenseOptions.push({
        id: 'comply',
        name: 'Full Compliance',
        description: 'Provide all requested documents. May reduce severity but confirms wrongdoing.',
        cost: 0,
        successChance: 30,
        severityReduction: 1
      });

      defenseOptions.push({
        id: 'partial',
        name: 'Partial Compliance',
        description: 'Provide some documents, claim others are lost.',
        cost: attorney ? 5000 : 10000,
        successChance: 50,
        severityReduction: 0
      });

      if (attorney) {
        defenseOptions.push({
          id: 'legal_challenge',
          name: 'Legal Challenge',
          description: 'Your attorney challenges the subpoena validity.',
          cost: attorney.retainer_fee * 2,
          successChance: 40 + attorney.audit_reduction_percent,
          severityReduction: 2
        });
      }
    }

    if (inv.stage === 'charges_filed') {
      defenseOptions.push({
        id: 'plea_deal',
        name: 'Accept Plea Deal',
        description: 'Plead guilty to reduced charges.',
        cost: 0,
        successChance: 100,
        consequence: 'Reduced fine and jail time by 50%'
      });

      defenseOptions.push({
        id: 'fight',
        name: 'Fight Charges',
        description: 'Go to trial. Could win completely or face full consequences.',
        cost: attorney ? attorney.retainer_fee * 5 : 50000,
        successChance: attorney ? 30 + attorney.audit_reduction_percent : 20,
        consequence: 'Win: All charges dropped. Lose: Full penalties.'
      });

      if (attorney && attorney.attorney_tier >= 3) {
        defenseOptions.push({
          id: 'technicality',
          name: 'Dismiss on Technicality',
          description: 'Your elite attorney finds a procedural error.',
          cost: attorney.retainer_fee * 10,
          successChance: attorney.audit_reduction_percent,
          consequence: 'Case dismissed entirely.'
        });
      }
    }

    res.json({
      success: true,
      data: {
        investigation: {
          id: inv.id,
          businessId: inv.business_id,
          businessName: inv.business_name,
          type: inv.investigation_type,
          triggerReason: inv.trigger_reason,
          stage: inv.stage,
          severity: inv.severity,
          evidenceStrength: inv.evidence_strength,
          evidenceCollected: inv.evidence_collected,
          leadAgent: inv.lead_agent,
          agency: inv.agency,
          startedAt: inv.started_at,
          playerNotifiedAt: inv.player_notified_at,
          subpoenaIssuedAt: inv.subpoena_issued_at,
          chargesFiledAt: inv.charges_filed_at,
          notes: inv.notes
        },
        possibleConsequences: CONSEQUENCES[inv.severity as keyof typeof CONSEQUENCES],
        defenseOptions,
        hasAttorney: !!attorney,
        attorneyName: attorney?.attorney_name
      }
    });
  } catch (error) {
    console.error('Get investigation detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to get investigation details' });
  }
});

// POST /api/investigations/:id/respond - Respond to investigation
router.post('/:id/respond', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const investigationId = parseInt(req.params.id);
    const { action } = req.body;

    if (!action) {
      res.status(400).json({ success: false, error: 'Action required' });
      return;
    }

    // Get investigation
    const investigationResult = await pool.query(
      `SELECT i.*, bf.name as business_name
       FROM investigations i
       LEFT JOIN business_fronts bf ON i.business_id = bf.id
       WHERE i.id = $1 AND i.player_id = $2 AND i.stage IN ('subpoena', 'charges_filed')`,
      [investigationId, playerId]
    );

    if (investigationResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Investigation not found or cannot respond' });
      return;
    }

    const inv = investigationResult.rows[0];

    // Get attorney
    const attorneyResult = await pool.query(
      `SELECT * FROM player_attorney_relationships
       WHERE player_id = $1 AND is_active = true AND retainer_paid_until > NOW()`,
      [playerId]
    );
    const attorney = attorneyResult.rows[0];

    // Get player funds
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );
    const playerCash = playerResult.rows[0].cash;

    let result: {
      success: boolean;
      outcome: string;
      fineAmount?: number;
      jailHours?: number;
      assetsSeized?: number;
      chargesDropped?: boolean;
    };

    const consequences = CONSEQUENCES[inv.severity as keyof typeof CONSEQUENCES];

    switch (action) {
      case 'comply':
        // Full compliance - reduces severity but confirms guilt
        const newSeverity = Math.max(1, inv.severity - 1);
        const complyConsequences = CONSEQUENCES[newSeverity as keyof typeof CONSEQUENCES];
        const complyFine = Math.floor(Math.random() * (complyConsequences.fineMax - complyConsequences.fineMin) + complyConsequences.fineMin);
        const complyJail = Math.floor(Math.random() * (complyConsequences.jailHoursMax - complyConsequences.jailHoursMin) + complyConsequences.jailHoursMin);

        result = {
          success: true,
          outcome: 'Your cooperation was noted. Reduced penalties applied.',
          fineAmount: complyFine,
          jailHours: complyJail,
          assetsSeized: 0
        };

        await resolveInvestigation(investigationId, playerId, 'convicted_plea', complyFine, complyJail, 0);
        break;

      case 'partial':
        const partialCost = attorney ? 5000 : 10000;
        if (playerCash < partialCost) {
          res.status(400).json({ success: false, error: 'Cannot afford this option' });
          return;
        }

        await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [partialCost, playerId]);

        if (Math.random() * 100 < 50) {
          // Success - investigation stalls
          result = {
            success: true,
            outcome: 'The investigation has stalled due to lack of evidence.',
            chargesDropped: true
          };
          await pool.query(
            `UPDATE investigations SET stage = 'dismissed', resolved_at = NOW(), outcome = 'dismissed_insufficient_evidence'
             WHERE id = $1`,
            [investigationId]
          );
        } else {
          // Caught lying - increases severity
          const newSev = Math.min(5, inv.severity + 1);
          await pool.query(
            `UPDATE investigations SET severity = $1,
             notes = notes || $2::jsonb
             WHERE id = $3`,
            [newSev, JSON.stringify([{ type: 'obstruction', text: 'Subject attempted to obstruct investigation' }]), investigationId]
          );
          result = {
            success: false,
            outcome: 'Your deception was discovered. Investigation severity increased.'
          };
        }
        break;

      case 'legal_challenge':
        if (!attorney) {
          res.status(400).json({ success: false, error: 'Requires an attorney' });
          return;
        }

        const challengeCost = attorney.retainer_fee * 2;
        if (playerCash < challengeCost) {
          res.status(400).json({ success: false, error: 'Cannot afford legal challenge' });
          return;
        }

        await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [challengeCost, playerId]);

        const challengeChance = 40 + attorney.audit_reduction_percent;
        if (Math.random() * 100 < challengeChance) {
          result = {
            success: true,
            outcome: `${attorney.attorney_name} successfully challenged the subpoena. Case dismissed!`,
            chargesDropped: true
          };
          await pool.query(
            `UPDATE investigations SET stage = 'dismissed', resolved_at = NOW(), outcome = 'dismissed_legal_challenge'
             WHERE id = $1`,
            [investigationId]
          );
        } else {
          result = {
            success: false,
            outcome: 'Legal challenge failed. Case proceeds to charges.'
          };
          await pool.query(
            `UPDATE investigations SET stage = 'charges_filed', charges_filed_at = NOW() WHERE id = $1`,
            [investigationId]
          );
        }
        break;

      case 'plea_deal':
        const pleaFine = Math.floor((consequences.fineMin + consequences.fineMax) / 4);
        const pleaJail = Math.floor((consequences.jailHoursMin + consequences.jailHoursMax) / 4);

        result = {
          success: true,
          outcome: 'Plea deal accepted. Reduced penalties applied.',
          fineAmount: pleaFine,
          jailHours: pleaJail,
          assetsSeized: 0
        };

        await resolveInvestigation(investigationId, playerId, 'convicted_plea', pleaFine, pleaJail, 0);
        break;

      case 'fight':
        const fightCost = attorney ? attorney.retainer_fee * 5 : 50000;
        if (playerCash < fightCost) {
          res.status(400).json({ success: false, error: 'Cannot afford to fight charges' });
          return;
        }

        await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [fightCost, playerId]);

        const fightChance = attorney ? 30 + attorney.audit_reduction_percent : 20;
        if (Math.random() * 100 < fightChance) {
          result = {
            success: true,
            outcome: 'NOT GUILTY! All charges have been dropped.',
            chargesDropped: true
          };
          await pool.query(
            `UPDATE investigations SET stage = 'dismissed', resolved_at = NOW(), outcome = 'acquitted'
             WHERE id = $1`,
            [investigationId]
          );
        } else {
          const fullFine = Math.floor(Math.random() * (consequences.fineMax - consequences.fineMin) + consequences.fineMin);
          const fullJail = Math.floor(Math.random() * (consequences.jailHoursMax - consequences.jailHoursMin) + consequences.jailHoursMin);
          const seizure = Math.floor(playerCash * consequences.assetSeizurePercent / 100);

          result = {
            success: false,
            outcome: 'GUILTY. Full penalties applied.',
            fineAmount: fullFine,
            jailHours: fullJail,
            assetsSeized: seizure
          };

          await resolveInvestigation(investigationId, playerId, 'convicted_trial', fullFine, fullJail, seizure);
        }
        break;

      case 'technicality':
        if (!attorney || attorney.attorney_tier < 3) {
          res.status(400).json({ success: false, error: 'Requires tier 3 attorney' });
          return;
        }

        const techCost = attorney.retainer_fee * 10;
        if (playerCash < techCost) {
          res.status(400).json({ success: false, error: 'Cannot afford this defense' });
          return;
        }

        await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [techCost, playerId]);

        if (Math.random() * 100 < attorney.audit_reduction_percent) {
          result = {
            success: true,
            outcome: `${attorney.attorney_name} found a fatal procedural error. Case dismissed with prejudice!`,
            chargesDropped: true
          };
          await pool.query(
            `UPDATE investigations SET stage = 'dismissed', resolved_at = NOW(), outcome = 'dismissed_technicality'
             WHERE id = $1`,
            [investigationId]
          );
        } else {
          result = {
            success: false,
            outcome: 'No procedural errors found. Case proceeds normally.'
          };
        }
        break;

      default:
        res.status(400).json({ success: false, error: 'Invalid action' });
        return;
    }

    // Update attorney cases handled
    if (attorney) {
      await pool.query(
        `UPDATE player_attorney_relationships SET cases_handled = cases_handled + 1 WHERE player_id = $1`,
        [playerId]
      );
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Respond to investigation error:', error);
    res.status(500).json({ success: false, error: 'Failed to respond to investigation' });
  }
});

// Helper function to resolve investigation with consequences
async function resolveInvestigation(
  investigationId: number,
  playerId: number,
  outcome: string,
  fineAmount: number,
  jailHours: number,
  assetsSeized: number
): Promise<void> {
  // Update investigation
  await pool.query(
    `UPDATE investigations
     SET stage = 'resolved', resolved_at = NOW(), outcome = $1,
         fine_amount = $2, jail_time_hours = $3, assets_seized = $4
     WHERE id = $5`,
    [outcome, fineAmount, jailHours, assetsSeized, investigationId]
  );

  // Apply fine
  if (fineAmount > 0) {
    await pool.query(
      `UPDATE players SET cash = GREATEST(0, cash - $1) WHERE id = $2`,
      [fineAmount, playerId]
    );
  }

  // Apply asset seizure
  if (assetsSeized > 0) {
    await pool.query(
      `UPDATE players SET cash = GREATEST(0, cash - $1) WHERE id = $2`,
      [assetsSeized, playerId]
    );
  }

  // Apply jail time
  if (jailHours > 0) {
    const releaseAt = new Date(Date.now() + jailHours * 60 * 60 * 1000);
    await pool.query(
      `UPDATE players SET in_jail = true, jail_release_at = $1 WHERE id = $2`,
      [releaseAt, playerId]
    );
  }

  // Increment investigation count
  await pool.query(
    `UPDATE players SET financial_investigation_count = financial_investigation_count + 1 WHERE id = $1`,
    [playerId]
  );

  // Reduce business legitimacy
  const invResult = await pool.query(
    `SELECT business_id FROM investigations WHERE id = $1`,
    [investigationId]
  );

  if (invResult.rows[0]?.business_id) {
    await pool.query(
      `UPDATE business_fronts SET legitimacy_rating = GREATEST(0, legitimacy_rating - 25),
       is_under_investigation = false WHERE id = $1`,
      [invResult.rows[0].business_id]
    );
  }
}

// GET /api/investigations/history - Get resolved investigations
router.get('/history/all', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const historyResult = await pool.query(
      `SELECT i.*, bf.name as business_name
       FROM investigations i
       LEFT JOIN business_fronts bf ON i.business_id = bf.id
       WHERE i.player_id = $1 AND i.stage IN ('resolved', 'dismissed')
       ORDER BY i.resolved_at DESC
       LIMIT 20`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        history: historyResult.rows.map(inv => ({
          id: inv.id,
          businessName: inv.business_name,
          type: inv.investigation_type,
          outcome: inv.outcome,
          fineAmount: inv.fine_amount,
          jailHours: inv.jail_time_hours,
          assetsSeized: inv.assets_seized,
          resolvedAt: inv.resolved_at
        }))
      }
    });
  } catch (error) {
    console.error('Get investigation history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// Process investigation progression (call periodically)
export async function processInvestigations(): Promise<void> {
  try {
    // Convert durations to days for SQL
    const preliminaryDays = STAGE_DURATIONS.preliminary / (24 * 60 * 60 * 1000); // 3 days
    const activeDays = STAGE_DURATIONS.active / (24 * 60 * 60 * 1000); // 7 days
    const subpoenaDays = STAGE_DURATIONS.subpoena / (24 * 60 * 60 * 1000); // 5 days

    // Progress preliminary investigations - SECURITY: Use make_interval
    const prelimResult = await pool.query(
      `SELECT * FROM investigations
       WHERE stage = 'preliminary'
       AND started_at < NOW() - make_interval(days => $1)`,
      [preliminaryDays]
    );

    for (const inv of prelimResult.rows) {
      // Chance to dismiss or escalate
      if (inv.evidence_strength < 30 || Math.random() < 0.3) {
        await pool.query(
          `UPDATE investigations SET stage = 'dismissed', resolved_at = NOW(), outcome = 'dismissed_insufficient_evidence'
           WHERE id = $1`,
          [inv.id]
        );
      } else {
        // Escalate and notify player
        await pool.query(
          `UPDATE investigations SET stage = 'active', player_notified_at = NOW(),
           lead_agent = $1
           WHERE id = $2`,
          [`Agent ${['Smith', 'Johnson', 'Williams', 'Brown', 'Davis'][Math.floor(Math.random() * 5)]}`, inv.id]
        );

        // Mark business as under investigation
        if (inv.business_id) {
          await pool.query(
            `UPDATE business_fronts SET is_under_investigation = true WHERE id = $1`,
            [inv.business_id]
          );
        }
      }
    }

    // Progress active investigations to subpoena - SECURITY: Use make_interval
    await pool.query(
      `UPDATE investigations SET stage = 'subpoena', subpoena_issued_at = NOW()
       WHERE stage = 'active'
       AND player_notified_at < NOW() - make_interval(days => $1)`,
      [activeDays]
    );

    // Progress subpoenas to charges if not responded - SECURITY: Use make_interval
    const subpoenaResult = await pool.query(
      `SELECT * FROM investigations
       WHERE stage = 'subpoena'
       AND subpoena_issued_at < NOW() - make_interval(days => $1)`,
      [subpoenaDays]
    );

    for (const inv of subpoenaResult.rows) {
      // Increase severity for not responding
      await pool.query(
        `UPDATE investigations SET stage = 'charges_filed', charges_filed_at = NOW(),
         severity = LEAST(5, severity + 1)
         WHERE id = $1`,
        [inv.id]
      );
    }

    console.log('Investigation processing complete');
  } catch (error) {
    console.error('Process investigations error:', error);
  }
}

export default router;
