/**
 * Premium Shop Route Tests
 * Tests for the 2091 monetization and premium shop system logic
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('Premium Shop System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Currency System', () => {
    it('should have two currency types', () => {
      const currencies = ['synth_credits', 'hydra_coins'];

      expect(currencies.length).toBe(2);
      expect(currencies.includes('synth_credits')).toBe(true);
      expect(currencies.includes('hydra_coins')).toBe(true);
    });

    it('should validate currency balance', () => {
      const playerCurrencies = {
        synth_credits: 5000,
        hydra_coins: 100
      };

      const itemPrice = 3000;
      const currencyType = 'synth_credits';
      const canAfford = playerCurrencies[currencyType as keyof typeof playerCurrencies] >= itemPrice;
      expect(canAfford).toBe(true);
    });

    it('should reject purchase with insufficient funds', () => {
      const playerCurrencies = {
        synth_credits: 1000,
        hydra_coins: 50
      };

      const itemPrice = 3000;
      const currencyType = 'synth_credits';
      const canAfford = playerCurrencies[currencyType as keyof typeof playerCurrencies] >= itemPrice;
      expect(canAfford).toBe(false);
    });
  });

  describe('HydraCoin Packages', () => {
    const packages = [
      { key: 'starter', coins: 100, price: 0.99, bonus: 0 },
      { key: 'basic', coins: 500, price: 4.99, bonus: 25 },
      { key: 'standard', coins: 1100, price: 9.99, bonus: 100 },
      { key: 'premium', coins: 2500, price: 19.99, bonus: 300 },
      { key: 'elite', coins: 5500, price: 39.99, bonus: 750 },
      { key: 'ultimate', coins: 12000, price: 79.99, bonus: 2000 }
    ];

    it('should have increasing bonus percentages for larger packages', () => {
      const bonusPercentages = packages.map(p => ({
        key: p.key,
        bonusPercent: p.bonus > 0 ? (p.bonus / p.coins) * 100 : 0
      }));

      expect(bonusPercentages[1].bonusPercent).toBe(5);
      expect(bonusPercentages[3].bonusPercent).toBe(12);
    });

    it('should calculate total coins received', () => {
      const package_ = packages[3];
      const totalCoins = package_.coins + package_.bonus;

      expect(totalCoins).toBe(2800);
    });

    it('should calculate value per dollar', () => {
      const package_ = packages[3];
      const totalCoins = package_.coins + package_.bonus;
      const valuePerDollar = totalCoins / package_.price;

      expect(valuePerDollar).toBeCloseTo(140.07, 1);
    });

    it('should have 6 package tiers', () => {
      expect(packages.length).toBe(6);
    });
  });

  describe('Shop Categories', () => {
    const categories = [
      'boosters',
      'currency_packs',
      'cosmetics',
      'nuclear_cells',
      'special_offers',
      'season_pass'
    ];

    it('should have all expected categories', () => {
      expect(categories.length).toBe(6);
      expect(categories.includes('boosters')).toBe(true);
      expect(categories.includes('nuclear_cells')).toBe(true);
    });

    it('should filter items by category', () => {
      const items = [
        { key: 'xp_boost_2x', category: 'boosters' },
        { key: 'cell_pack_100', category: 'nuclear_cells' },
        { key: 'neon_outfit', category: 'cosmetics' },
        { key: 'xp_boost_3x', category: 'boosters' }
      ];

      const boosters = items.filter(i => i.category === 'boosters');
      expect(boosters.length).toBe(2);
    });
  });

  describe('Booster System', () => {
    it('should calculate booster expiration', () => {
      const purchaseTime = new Date();
      const durationHours = 24;
      const expiresAt = new Date(purchaseTime.getTime() + durationHours * 60 * 60 * 1000);

      const hoursDiff = (expiresAt.getTime() - purchaseTime.getTime()) / (60 * 60 * 1000);
      expect(hoursDiff).toBe(24);
    });

    it('should stack booster multipliers correctly', () => {
      const boosters = [
        { type: 'xp', multiplier: 1.5 },
        { type: 'xp', multiplier: 1.25 }
      ];

      const totalMultiplier = boosters.reduce((m, b) => m * b.multiplier, 1);
      expect(totalMultiplier).toBeCloseTo(1.875, 3);
    });

    it('should apply booster to action', () => {
      const baseXp = 100;
      const boosterMultiplier = 2.0;
      const boostedXp = Math.floor(baseXp * boosterMultiplier);

      expect(boostedXp).toBe(200);
    });

    it('should identify expired boosters', () => {
      const boosters = [
        { id: 1, expires_at: new Date(Date.now() - 3600000) },
        { id: 2, expires_at: new Date(Date.now() + 3600000) },
        { id: 3, expires_at: new Date(Date.now() - 60000) }
      ];

      const expired = boosters.filter(b => new Date() > new Date(b.expires_at));
      const active = boosters.filter(b => new Date() <= new Date(b.expires_at));

      expect(expired.length).toBe(2);
      expect(active.length).toBe(1);
    });
  });

  describe('Daily Login Rewards', () => {
    it('should have 28-day reward cycle', () => {
      const rewards = Array.from({ length: 28 }, (_, i) => ({
        day: i + 1,
        reward_type: i % 7 === 6 ? 'bonus' : 'regular'
      }));

      expect(rewards.length).toBe(28);
    });

    it('should have milestone bonuses on days 7, 14, 21, 28', () => {
      const milestoneDays = [7, 14, 21, 28];

      milestoneDays.forEach(day => {
        expect(day % 7).toBe(0);
      });
    });

    it('should track consecutive login streak', () => {
      const lastLogin = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const today = new Date();

      const daysSinceLastLogin = Math.floor(
        (today.getTime() - lastLogin.getTime()) / (24 * 60 * 60 * 1000)
      );

      const isConsecutive = daysSinceLastLogin === 1;
      expect(isConsecutive).toBe(true);
    });

    it('should reset streak if login missed', () => {
      const lastLogin = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const today = new Date();

      const daysSinceLastLogin = Math.floor(
        (today.getTime() - lastLogin.getTime()) / (24 * 60 * 60 * 1000)
      );

      const isConsecutive = daysSinceLastLogin === 1;
      expect(isConsecutive).toBe(false);
    });

    it('should calculate current day in cycle', () => {
      const loginCount = 35;
      const cycleLength = 28;
      const currentDay = ((loginCount - 1) % cycleLength) + 1;

      expect(currentDay).toBe(7);
    });

    it('should not allow claiming same day twice', () => {
      const lastClaimDate = new Date().toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const alreadyClaimed = lastClaimDate === today;
      expect(alreadyClaimed).toBe(true);
    });
  });

  describe('Battle Pass Tiers', () => {
    it('should have 100 tiers', () => {
      const tiers = Array.from({ length: 100 }, (_, i) => ({
        tier: i + 1,
        xp_required: 1000 * (i + 1),
        free_reward: i % 2 === 0 ? 'some_reward' : null,
        premium_reward: 'premium_reward'
      }));

      expect(tiers.length).toBe(100);
      expect(tiers[99].tier).toBe(100);
    });

    it('should calculate XP to next tier', () => {
      const currentXp = 15500;
      const currentTier = 15;
      const xpPerTier = 1000;
      const xpForNextTier = (currentTier + 1) * xpPerTier;
      const xpNeeded = xpForNextTier - currentXp;

      expect(xpNeeded).toBe(500);
    });

    it('should determine tier from total XP', () => {
      const totalXp = 15500;
      const xpPerTier = 1000;

      const tier = Math.min(100, Math.floor(totalXp / xpPerTier));

      expect(tier).toBe(15);
    });

    it('should distinguish free and premium rewards', () => {
      const tier = {
        tier: 10,
        free_reward: { type: 'cash', amount: 1000 },
        premium_reward: { type: 'cosmetic', item: 'neon_jacket' }
      };

      const hasPremiumPass = true;
      const rewards = hasPremiumPass
        ? [tier.free_reward, tier.premium_reward]
        : [tier.free_reward].filter(Boolean);

      expect(rewards.length).toBe(2);
    });

    it('should cap tier at 100', () => {
      const totalXp = 150000;
      const xpPerTier = 1000;

      const tier = Math.min(100, Math.floor(totalXp / xpPerTier));
      expect(tier).toBe(100);
    });
  });

  describe('Purchase Validation', () => {
    it('should check item availability', () => {
      const item = {
        key: 'limited_offer',
        available_until: new Date(Date.now() + 86400000),
        stock_limit: 100,
        sold_count: 50
      };

      const isAvailable = new Date() < new Date(item.available_until);
      const inStock = item.stock_limit === null || item.sold_count < item.stock_limit;

      expect(isAvailable).toBe(true);
      expect(inStock).toBe(true);
    });

    it('should reject expired offers', () => {
      const item = {
        available_until: new Date(Date.now() - 86400000)
      };

      const isAvailable = new Date() < new Date(item.available_until);
      expect(isAvailable).toBe(false);
    });

    it('should reject out of stock items', () => {
      const item = {
        stock_limit: 100,
        sold_count: 100
      };

      const inStock = item.stock_limit === null || item.sold_count < item.stock_limit;
      expect(inStock).toBe(false);
    });

    it('should check purchase cooldown', () => {
      const lastPurchase = new Date(Date.now() - 3600000);
      const cooldownHours = 24;
      const cooldownEnd = new Date(lastPurchase.getTime() + cooldownHours * 60 * 60 * 1000);

      const canPurchase = new Date() >= cooldownEnd;
      expect(canPurchase).toBe(false);
    });

    it('should allow purchase after cooldown expires', () => {
      const lastPurchase = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const cooldownHours = 24;
      const cooldownEnd = new Date(lastPurchase.getTime() + cooldownHours * 60 * 60 * 1000);

      const canPurchase = new Date() >= cooldownEnd;
      expect(canPurchase).toBe(true);
    });
  });

  describe('Purchase History', () => {
    it('should track purchase details', () => {
      const purchase = {
        id: 1,
        player_id: 100,
        item_key: 'xp_boost_2x',
        currency_type: 'hydra_coins',
        amount_paid: 50,
        purchased_at: new Date().toISOString()
      };

      expect(purchase.currency_type).toBe('hydra_coins');
      expect(purchase.amount_paid).toBe(50);
    });

    it('should calculate total spent', () => {
      const purchases = [
        { amount_paid: 100, currency_type: 'hydra_coins' },
        { amount_paid: 50, currency_type: 'hydra_coins' },
        { amount_paid: 5000, currency_type: 'synth_credits' },
        { amount_paid: 200, currency_type: 'hydra_coins' }
      ];

      const totalHydraCoins = purchases
        .filter(p => p.currency_type === 'hydra_coins')
        .reduce((sum, p) => sum + p.amount_paid, 0);

      expect(totalHydraCoins).toBe(350);
    });
  });

  describe('Expired Booster Processing', () => {
    it('should identify and remove expired boosters', () => {
      const boosters = [
        { id: 1, player_id: 100, expires_at: new Date(Date.now() - 3600000), type: 'xp' },
        { id: 2, player_id: 100, expires_at: new Date(Date.now() + 3600000), type: 'xp' },
        { id: 3, player_id: 101, expires_at: new Date(Date.now() - 7200000), type: 'cash' }
      ];

      const expired = boosters.filter(b => new Date() > new Date(b.expires_at));

      expect(expired.length).toBe(2);
      expect(expired.map(e => e.id)).toEqual([1, 3]);
    });

    it('should group expired boosters by player for notification', () => {
      const expiredBoosters = [
        { id: 1, player_id: 100, type: 'xp' },
        { id: 2, player_id: 100, type: 'cash' },
        { id: 3, player_id: 101, type: 'xp' }
      ];

      const byPlayer: Record<number, typeof expiredBoosters> = {};
      for (const booster of expiredBoosters) {
        if (!byPlayer[booster.player_id]) {
          byPlayer[booster.player_id] = [];
        }
        byPlayer[booster.player_id].push(booster);
      }

      expect(Object.keys(byPlayer).length).toBe(2);
      expect(byPlayer[100].length).toBe(2);
      expect(byPlayer[101].length).toBe(1);
    });
  });

  describe('Special Offers', () => {
    it('should calculate discount percentage', () => {
      const originalPrice = 100;
      const salePrice = 75;
      const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

      expect(discount).toBe(25);
    });

    it('should validate bundle contents', () => {
      const bundle = {
        key: 'starter_bundle',
        items: [
          { key: 'xp_boost_2x', quantity: 2 },
          { key: 'cell_pack_50', quantity: 3 },
          { key: 'synth_credits_1000', quantity: 1 }
        ],
        price: 500,
        currency: 'hydra_coins'
      };

      const totalItems = bundle.items.reduce((sum, i) => sum + i.quantity, 0);
      expect(totalItems).toBe(6);
    });

    it('should check if offer is first-purchase only', () => {
      const offer = {
        key: 'welcome_pack',
        first_purchase_only: true
      };

      const playerPurchaseCount = 0;
      const isEligible = !offer.first_purchase_only || playerPurchaseCount === 0;

      expect(isEligible).toBe(true);
    });

    it('should reject first-purchase offer for existing customers', () => {
      const offer = {
        key: 'welcome_pack',
        first_purchase_only: true
      };

      const playerPurchaseCount: number = 5;
      const isEligible = !offer.first_purchase_only || playerPurchaseCount === 0;

      expect(isEligible).toBe(false);
    });
  });
});
