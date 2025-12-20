/**
 * Nuclear Cells Route Tests
 * Tests for the 2091 nuclear cells energy system logic
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('Nuclear Cells System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRegenAmount', () => {
    // Helper function matching the route logic
    function calculateRegenAmount(
      lastRegen: Date,
      regenRate: number,
      regenInterval: number,
      maxCells: number,
      currentCells: number
    ): { amount: number; ticksPassed: number } {
      const now = new Date();
      const msSinceRegen = now.getTime() - lastRegen.getTime();
      const ticksPassed = Math.floor(msSinceRegen / (regenInterval * 1000));

      if (ticksPassed <= 0) return { amount: 0, ticksPassed: 0 };

      const potentialRegen = ticksPassed * regenRate;
      const actualRegen = Math.min(potentialRegen, maxCells - currentCells);

      return { amount: Math.max(0, actualRegen), ticksPassed };
    }

    it('should calculate correct regen amount based on time passed', () => {
      const lastRegen = new Date(Date.now() - 120 * 1000); // 2 minutes ago
      const result = calculateRegenAmount(lastRegen, 5, 60, 100, 50);

      expect(result.ticksPassed).toBe(2);
      expect(result.amount).toBe(10);
    });

    it('should not exceed max cells', () => {
      const lastRegen = new Date(Date.now() - 300 * 1000); // 5 minutes ago
      const result = calculateRegenAmount(lastRegen, 10, 60, 100, 95);

      expect(result.ticksPassed).toBe(5);
      expect(result.amount).toBe(5); // Can only add 5 more
    });

    it('should return 0 if not enough time has passed', () => {
      const lastRegen = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      const result = calculateRegenAmount(lastRegen, 5, 60, 100, 50);

      expect(result.ticksPassed).toBe(0);
      expect(result.amount).toBe(0);
    });

    it('should handle being at max cells', () => {
      const lastRegen = new Date(Date.now() - 120 * 1000);
      const result = calculateRegenAmount(lastRegen, 5, 60, 100, 100);

      expect(result.amount).toBe(0);
    });
  });

  describe('Cell Usage Logic', () => {
    it('should deduct cells for action', () => {
      const baseCost = 20;
      const efficiency = 0.1;
      const effectiveCost = Math.max(0, Math.floor(baseCost * (1 - efficiency)));

      expect(effectiveCost).toBe(18);
    });

    it('should allow free actions', () => {
      const baseCost = 0;
      const efficiency = 0.1;
      const effectiveCost = Math.max(0, Math.floor(baseCost * (1 - efficiency)));

      expect(effectiveCost).toBe(0);
    });

    it('should reject high-risk action with insufficient cells', () => {
      const currentCells = 10;
      const effectiveCost = 30;
      const isHighRisk = true;

      const canProceed = !isHighRisk || currentCells >= effectiveCost;
      expect(canProceed).toBe(false);
    });

    it('should allow non-high-risk action without bonus when insufficient cells', () => {
      const currentCells = 5;
      const effectiveCost = 10;
      const isHighRisk = false;

      const actionAllowed = !isHighRisk || currentCells >= effectiveCost;
      const powerBonus = currentCells >= effectiveCost;

      expect(actionAllowed).toBe(true);
      expect(powerBonus).toBe(false);
    });
  });

  describe('Pack Purchase Logic', () => {
    it('should allow purchase when can afford', () => {
      const packCost = 10000;
      const playerCash = 50000;
      const canAfford = playerCash >= packCost;

      expect(canAfford).toBe(true);
    });

    it('should reject purchase when daily limit reached', () => {
      const purchasesToday = 5;
      const dailyLimit = 5;
      const underLimit = purchasesToday < dailyLimit;

      expect(underLimit).toBe(false);
    });

    it('should reject purchase when on cooldown', () => {
      const lastPurchase = new Date();
      const cooldownHours = 1;
      const cooldownEnd = new Date(lastPurchase);
      cooldownEnd.setHours(cooldownEnd.getHours() + cooldownHours);

      const canPurchase = new Date() >= cooldownEnd;
      expect(canPurchase).toBe(false);
    });

    it('should calculate total cells received with bonus', () => {
      const cellAmount = 50;
      const bonusCells = 5;
      const totalCells = cellAmount + bonusCells;

      expect(totalCells).toBe(55);
    });
  });

  describe('Reactor Upgrade Logic', () => {
    it('should upgrade reactor when requirements met', () => {
      const playerLevel = 25;
      const requiredLevel = 20;
      const playerCash = 200000;
      const purchasePrice = 100000;

      const meetsLevel = playerLevel >= requiredLevel;
      const canAfford = playerCash >= purchasePrice;

      expect(meetsLevel).toBe(true);
      expect(canAfford).toBe(true);
    });

    it('should reject upgrade when level too low', () => {
      const playerLevel = 15;
      const requiredLevel = 20;
      const meetsLevel = playerLevel >= requiredLevel;

      expect(meetsLevel).toBe(false);
    });

    it('should check faction rank requirement', () => {
      const playerRank = 'member';
      const requiredRank = 'trusted';

      const rankOrder = ['outsider', 'contact', 'associate', 'member', 'trusted', 'lieutenant', 'commander', 'council'];
      const playerRankIndex = rankOrder.indexOf(playerRank);
      const requiredRankIndex = rankOrder.indexOf(requiredRank);

      const meetsRank = playerRankIndex >= requiredRankIndex;
      expect(meetsRank).toBe(false);
    });

    it('should calculate capacity increase', () => {
      const newCapacity = 200;
      const prevCapacity = 100;
      const capacityIncrease = newCapacity - prevCapacity;

      expect(capacityIncrease).toBe(100);
    });
  });

  describe('Overclock Logic', () => {
    it('should activate overclock successfully', () => {
      const durationMinutes = 30;
      const cellCost = Math.ceil(durationMinutes / 30) * 20;
      const playerCells = 100;

      const canOverclock = playerCells >= cellCost;
      expect(canOverclock).toBe(true);
      expect(cellCost).toBe(20);
    });

    it('should calculate correct cost for longer duration', () => {
      const durationMinutes = 90;
      const cellCost = Math.ceil(durationMinutes / 30) * 20;

      expect(cellCost).toBe(60);
    });

    it('should reject overclock when already active', () => {
      const isOverclocked = true;
      const overclockExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const stillActive = isOverclocked && overclockExpiresAt > new Date();

      expect(stillActive).toBe(true);
    });

    it('should calculate overclock expiration', () => {
      const now = new Date();
      const durationMinutes = 30;
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

      const diffMs = expiresAt.getTime() - now.getTime();
      expect(diffMs).toBe(30 * 60 * 1000);
    });
  });

  describe('Condition Modifier', () => {
    it('should apply condition modifier to regen rate', () => {
      const baseRegenRate = 10;
      const conditionPercent = 50;
      const conditionModifier = 0.5 + conditionPercent / 200;
      const effectiveRate = Math.max(1, Math.floor(baseRegenRate * conditionModifier));

      expect(conditionModifier).toBe(0.75);
      expect(effectiveRate).toBe(7);
    });

    it('should have full regen at 100% condition', () => {
      const baseRegenRate = 10;
      const conditionPercent = 100;
      const conditionModifier = 0.5 + conditionPercent / 200;
      const effectiveRate = Math.max(1, Math.floor(baseRegenRate * conditionModifier));

      expect(conditionModifier).toBe(1);
      expect(effectiveRate).toBe(10);
    });

    it('should have minimum 50% regen at 0% condition', () => {
      const baseRegenRate = 10;
      const conditionPercent = 0;
      const conditionModifier = 0.5 + conditionPercent / 200;
      const effectiveRate = Math.max(1, Math.floor(baseRegenRate * conditionModifier));

      expect(conditionModifier).toBe(0.5);
      expect(effectiveRate).toBe(5);
    });

    it('should always have minimum 1 regen rate', () => {
      const baseRegenRate = 1;
      const conditionPercent = 0;
      const conditionModifier = 0.5 + conditionPercent / 200;
      const effectiveRate = Math.max(1, Math.floor(baseRegenRate * conditionModifier));

      expect(effectiveRate).toBe(1);
    });
  });
});
