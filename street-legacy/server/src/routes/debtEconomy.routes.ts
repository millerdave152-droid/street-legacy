/**
 * Debt Economy Routes
 * API endpoints for the favor/debt system between players
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  createDebt,
  getPlayerDebts,
  getDebtById,
  callInDebt,
  fulfillDebt,
  defaultOnDebt,
  forgiveDebt,
  transferDebt,
  getDebtHistory,
  getDebtSummary,
  getDebtsBetweenPlayers,
  getCalledInDebts,
  createDebtOffer,
  getOpenOffers,
  getOfferById,
  acceptOffer,
  withdrawOffer,
  getPlayerOffers
} from '../services/debtEconomy.service.js';
import {
  DEBT_TYPE_LABELS,
  DEBT_TYPE_DESCRIPTIONS,
  DEBT_STATUS_LABELS,
  MIN_DEBT_VALUE,
  MAX_DEBT_VALUE
} from '../types/debtEconomy.types.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const debtIdParamSchema = z.object({
  params: z.object({
    debtId: z.string().uuid('Invalid debt ID')
  })
});

const offerIdParamSchema = z.object({
  params: z.object({
    offerId: z.string().uuid('Invalid offer ID')
  })
});

const createDebtSchema = z.object({
  body: z.object({
    debtorId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
    debtType: z.enum(['favor', 'money', 'protection', 'service', 'information', 'blood_debt']),
    description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
    value: z.number().int().min(MIN_DEBT_VALUE).max(MAX_DEBT_VALUE),
    context: z.string().max(500).optional(),
    dueDays: z.number().int().positive().max(365).optional()
  })
});

const transferDebtSchema = z.object({
  params: z.object({
    debtId: z.string().uuid('Invalid debt ID')
  }),
  body: z.object({
    toCreditorId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
    reason: z.string().max(500).optional()
  })
});

const defaultDebtSchema = z.object({
  params: z.object({
    debtId: z.string().uuid('Invalid debt ID')
  }),
  body: z.object({
    reason: z.string().max(500).optional()
  }).optional()
});

const createOfferSchema = z.object({
  params: z.object({
    debtId: z.string().uuid('Invalid debt ID')
  }),
  body: z.object({
    askingPriceType: z.enum(['cash', 'favor', 'other_debt', 'service']),
    askingPriceValue: z.number().int().positive().optional(),
    askingPriceDetails: z.string().max(500).optional(),
    expiresDays: z.number().int().min(1).max(30).optional()
  })
});

const getDebtsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['outstanding', 'called_in', 'fulfilled', 'defaulted', 'transferred', 'forgiven']).optional(),
    includeResolved: z.enum(['true', 'false']).optional(),
    withPlayer: z.string().regex(/^\d+$/).optional()
  }).optional()
});

// =============================================================================
// DEBT ROUTES
// =============================================================================

/**
 * GET /api/debts
 * Get current player's debts (both owed and owing)
 */
router.get(
  '/',
  validate(getDebtsQuerySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const playerId = String(req.player!.id);
      const { withPlayer } = req.query as { withPlayer?: string };

      console.log(`[DebtEconomyRoutes] GET debts for player: ${playerId}`);

      // If withPlayer specified, get debts between two players
      if (withPlayer) {
        const debts = await getDebtsBetweenPlayers(playerId, withPlayer);
        res.json({
          success: true,
          data: {
            debts,
            total: debts.length
          }
        });
        return;
      }

      const debts = await getPlayerDebts(playerId);
      const summary = await getDebtSummary(playerId);

      res.json({
        success: true,
        data: {
          ...debts,
          total: debts.owedToYou.length + debts.youOwe.length,
          summary
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error getting debts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get debts'
      });
    }
  }
);

/**
 * GET /api/debts/summary
 * Get debt summary for current player
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = String(req.player!.id);

    console.log(`[DebtEconomyRoutes] GET debt summary for player: ${playerId}`);

    const summary = await getDebtSummary(playerId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[DebtEconomyRoutes] Error getting debt summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get debt summary'
    });
  }
});

/**
 * GET /api/debts/called-in
 * Get debts that have been called in (need action)
 */
router.get('/called-in', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = String(req.player!.id);

    console.log(`[DebtEconomyRoutes] GET called-in debts for player: ${playerId}`);

    const debts = await getCalledInDebts(playerId);

    res.json({
      success: true,
      data: {
        debts,
        total: debts.length,
        message: debts.length > 0
          ? `You have ${debts.length} debt(s) that have been called in`
          : 'No debts have been called in'
      }
    });
  } catch (error) {
    console.error('[DebtEconomyRoutes] Error getting called-in debts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get called-in debts'
    });
  }
});

/**
 * GET /api/debts/types
 * Get information about debt types (public info)
 */
router.get('/types', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[DebtEconomyRoutes] GET debt types`);

    const types = Object.entries(DEBT_TYPE_LABELS).map(([type, label]) => ({
      type,
      label,
      description: DEBT_TYPE_DESCRIPTIONS[type as keyof typeof DEBT_TYPE_DESCRIPTIONS]
    }));

    res.json({
      success: true,
      data: {
        types,
        statuses: DEBT_STATUS_LABELS,
        valueRange: { min: MIN_DEBT_VALUE, max: MAX_DEBT_VALUE }
      }
    });
  } catch (error) {
    console.error('[DebtEconomyRoutes] Error getting debt types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get debt types'
    });
  }
});

/**
 * GET /api/debts/marketplace
 * Get open debt offers (marketplace)
 */
router.get('/marketplace', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = String(req.player!.id);

    console.log(`[DebtEconomyRoutes] GET debt marketplace`);

    // Exclude player's own debts and offers
    const offers = await getOpenOffers(playerId);

    res.json({
      success: true,
      data: {
        offers,
        total: offers.length
      }
    });
  } catch (error) {
    console.error('[DebtEconomyRoutes] Error getting marketplace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get debt marketplace'
    });
  }
});

/**
 * GET /api/debts/offers
 * Get current player's debt offers
 */
router.get('/offers', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = String(req.player!.id);

    console.log(`[DebtEconomyRoutes] GET offers for player: ${playerId}`);

    const offers = await getPlayerOffers(playerId);

    res.json({
      success: true,
      data: {
        offers,
        total: offers.length
      }
    });
  } catch (error) {
    console.error('[DebtEconomyRoutes] Error getting player offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get offers'
    });
  }
});

/**
 * GET /api/debts/:debtId
 * Get single debt details
 */
router.get(
  '/:debtId',
  validate(debtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const playerId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] GET debt: ${debtId}`);

      const debt = await getDebtById(debtId);

      if (!debt) {
        res.status(404).json({
          success: false,
          error: 'Debt not found'
        });
        return;
      }

      // Must be creditor or debtor to view
      if (String(debt.creditorId) !== playerId && String(debt.debtorId) !== playerId) {
        res.status(403).json({
          success: false,
          error: 'You are not involved in this debt'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...debt,
          yourRole: String(debt.creditorId) === playerId ? 'creditor' : 'debtor'
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error getting debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get debt'
      });
    }
  }
);

/**
 * GET /api/debts/:debtId/history
 * Get transfer and default history for a debt
 */
router.get(
  '/:debtId/history',
  validate(debtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const playerId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] GET debt history: ${debtId}`);

      // Verify access
      const debt = await getDebtById(debtId);

      if (!debt) {
        res.status(404).json({
          success: false,
          error: 'Debt not found'
        });
        return;
      }

      if (String(debt.creditorId) !== playerId && String(debt.debtorId) !== playerId) {
        res.status(403).json({
          success: false,
          error: 'You are not involved in this debt'
        });
        return;
      }

      const history = await getDebtHistory(debtId);

      res.json({
        success: true,
        data: {
          debt,
          ...history,
          totalTransfers: history.transfers.length,
          hasDefaulted: history.defaults.length > 0
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error getting debt history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get debt history'
      });
    }
  }
);

/**
 * POST /api/debts
 * Create new debt (caller becomes creditor)
 */
router.post(
  '/',
  validate(createDebtSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const creditorId = String(req.player!.id);
      const { debtorId, debtType, description, value, context, dueDays } = req.body;

      console.log(`[DebtEconomyRoutes] Creating debt: ${creditorId} -> ${debtorId}`);

      // Cannot create debt to yourself
      if (creditorId === String(debtorId)) {
        res.status(400).json({
          success: false,
          error: 'Cannot create a debt to yourself'
        });
        return;
      }

      const debt = await createDebt(creditorId, {
        debtorId: Number(debtorId),
        debtType,
        description,
        value,
        context,
        dueDays
      });

      if (!debt) {
        res.status(400).json({
          success: false,
          error: 'Failed to create debt'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          debt,
          message: `Debt created. ${debt.debtorName || 'Player'} now owes you.`
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error creating debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create debt'
      });
    }
  }
);

/**
 * POST /api/debts/:debtId/call
 * Call in a debt (demand fulfillment)
 */
router.post(
  '/:debtId/call',
  validate(debtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const creditorId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] Calling in debt: ${debtId}`);

      const debt = await callInDebt(debtId, creditorId);

      if (!debt) {
        res.status(400).json({
          success: false,
          error: 'Failed to call in debt. You must be the creditor and debt must be outstanding.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          debt,
          message: `Debt called in. ${debt.debtorName || 'Player'} must now fulfill their obligation.`
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error calling in debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to call in debt'
      });
    }
  }
);

/**
 * POST /api/debts/:debtId/fulfill
 * Mark debt as fulfilled
 */
router.post(
  '/:debtId/fulfill',
  validate(debtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const debtorId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] Fulfilling debt: ${debtId}`);

      const result = await fulfillDebt(debtId, debtorId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Failed to fulfill debt. You must be the debtor and debt must be outstanding or called in.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          debtId,
          trustBonus: result.trustBonus,
          message: `Debt fulfilled! Your trust with the creditor increased by ${result.trustBonus}.`
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error fulfilling debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fulfill debt'
      });
    }
  }
);

/**
 * POST /api/debts/:debtId/default
 * Default on a debt
 */
router.post(
  '/:debtId/default',
  validate(defaultDebtSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const debtorId = String(req.player!.id);
      const reason = req.body?.reason;

      console.log(`[DebtEconomyRoutes] Defaulting on debt: ${debtId}`);

      const result = await defaultOnDebt(debtId, debtorId, reason);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Failed to default on debt. You must be the debtor and debt must be outstanding or called in.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          debtId,
          penalty: result.penalty,
          message: `Debt defaulted. Your trust reputation has been severely damaged (-${result.penalty}).`
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error defaulting on debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to default on debt'
      });
    }
  }
);

/**
 * POST /api/debts/:debtId/forgive
 * Forgive a debt
 */
router.post(
  '/:debtId/forgive',
  validate(debtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const creditorId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] Forgiving debt: ${debtId}`);

      const success = await forgiveDebt(debtId, creditorId);

      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to forgive debt. You must be the creditor and debt must be outstanding or called in.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          debtId,
          message: 'Debt forgiven. The debtor has been released from their obligation.'
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error forgiving debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to forgive debt'
      });
    }
  }
);

/**
 * POST /api/debts/:debtId/transfer
 * Transfer debt to another player
 */
router.post(
  '/:debtId/transfer',
  validate(transferDebtSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const fromCreditorId = String(req.player!.id);
      const { toCreditorId, reason } = req.body;

      console.log(`[DebtEconomyRoutes] Transferring debt: ${debtId} to ${toCreditorId}`);

      const debt = await transferDebt(debtId, fromCreditorId, String(toCreditorId), reason);

      if (!debt) {
        res.status(400).json({
          success: false,
          error: 'Failed to transfer debt. You must be the creditor and cannot transfer to the debtor or yourself.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          debt,
          message: `Debt transferred to ${debt.creditorName || 'the new creditor'}.`
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error transferring debt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to transfer debt'
      });
    }
  }
);

// =============================================================================
// DEBT OFFER ROUTES
// =============================================================================

/**
 * POST /api/debts/:debtId/offer
 * Create an offer to sell a debt
 */
router.post(
  '/:debtId/offer',
  validate(createOfferSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { debtId } = req.params;
      const creditorId = String(req.player!.id);
      const { askingPriceType, askingPriceValue, askingPriceDetails, expiresDays } = req.body;

      console.log(`[DebtEconomyRoutes] Creating offer for debt: ${debtId}`);

      const offer = await createDebtOffer(debtId, creditorId, {
        askingPriceType,
        askingPriceValue,
        askingPriceDetails,
        expiresDays
      });

      if (!offer) {
        res.status(400).json({
          success: false,
          error: 'Failed to create offer. You must be the creditor and no open offer can exist.'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          offer,
          message: 'Debt offer created and listed on the marketplace.'
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error creating offer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create offer'
      });
    }
  }
);

/**
 * GET /api/debts/offers/:offerId
 * Get a single debt offer
 */
router.get(
  '/offers/:offerId',
  validate(offerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { offerId } = req.params;

      console.log(`[DebtEconomyRoutes] GET offer: ${offerId}`);

      const offer = await getOfferById(offerId);

      if (!offer) {
        res.status(404).json({
          success: false,
          error: 'Offer not found'
        });
        return;
      }

      res.json({
        success: true,
        data: offer
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error getting offer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get offer'
      });
    }
  }
);

/**
 * POST /api/debts/offers/:offerId/accept
 * Accept a debt offer
 */
router.post(
  '/offers/:offerId/accept',
  validate(offerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { offerId } = req.params;
      const acceptingPlayerId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] Accepting offer: ${offerId}`);

      const result = await acceptOffer(offerId, acceptingPlayerId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.message
        });
        return;
      }

      res.json({
        success: true,
        data: {
          offerId,
          debtId: result.debtId,
          message: result.message
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error accepting offer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to accept offer'
      });
    }
  }
);

/**
 * POST /api/debts/offers/:offerId/withdraw
 * Withdraw a debt offer
 */
router.post(
  '/offers/:offerId/withdraw',
  validate(offerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { offerId } = req.params;
      const offeringPlayerId = String(req.player!.id);

      console.log(`[DebtEconomyRoutes] Withdrawing offer: ${offerId}`);

      const result = await withdrawOffer(offerId, offeringPlayerId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.message
        });
        return;
      }

      res.json({
        success: true,
        data: {
          offerId,
          message: result.message
        }
      });
    } catch (error) {
      console.error('[DebtEconomyRoutes] Error withdrawing offer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to withdraw offer'
      });
    }
  }
);

export default router;
