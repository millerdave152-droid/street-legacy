import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Minimum bet amounts
const MIN_BETS = {
  slots: 100,
  blackjack: 500,
  roulette: 100,
  dice: 50
};

// Slot machine symbols and payouts
const SLOT_SYMBOLS = ['7️⃣', '🍒', '🍋', '🔔', '💎', '⭐', '🍀'];
const SLOT_PAYOUTS: Record<string, number> = {
  '7️⃣7️⃣7️⃣': 50,
  '💎💎💎': 25,
  '⭐⭐⭐': 15,
  '🍀🍀🍀': 10,
  '🔔🔔🔔': 8,
  '🍒🍒🍒': 5,
  '🍋🍋🍋': 3,
};

// Roulette numbers
const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// GET /api/casino - Get casino info and player stats
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player cash
    const playerResult = await pool.query(
      `SELECT cash, level FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get casino stats
    const statsResult = await pool.query(
      `SELECT casino_wins, casino_losses, biggest_win, total_wagered
       FROM player_stats WHERE player_id = $1`,
      [playerId]
    );
    const stats = statsResult.rows[0] || {
      casino_wins: 0,
      casino_losses: 0,
      biggest_win: 0,
      total_wagered: 0
    };

    // Get recent games
    const recentResult = await pool.query(
      `SELECT game_type, bet_amount, win_amount, result, created_at
       FROM casino_games WHERE player_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        cash: player.cash,
        level: player.level,
        minBets: MIN_BETS,
        stats: {
          wins: stats.casino_wins,
          losses: stats.casino_losses,
          biggestWin: stats.biggest_win,
          totalWagered: stats.total_wagered,
          netProfit: stats.casino_wins - stats.casino_losses
        },
        recentGames: recentResult.rows.map(g => ({
          gameType: g.game_type,
          betAmount: g.bet_amount,
          winAmount: g.win_amount,
          result: g.result,
          createdAt: g.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Casino error:', error);
    res.status(500).json({ success: false, error: 'Failed to get casino info' });
  }
});

// POST /api/casino/slots - Play slot machine
router.post('/slots', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bet } = req.body;

    if (!bet || bet < MIN_BETS.slots) {
      res.status(400).json({ success: false, error: `Minimum bet is $${MIN_BETS.slots}` });
      return;
    }

    // Check player cash
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );
    if (playerResult.rows[0].cash < bet) {
      res.status(400).json({ success: false, error: 'Insufficient funds' });
      return;
    }

    // Spin the reels
    const reels = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
    ];
    const combo = reels.join('');

    // Check for wins
    let multiplier = 0;
    if (SLOT_PAYOUTS[combo]) {
      multiplier = SLOT_PAYOUTS[combo];
    } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
      multiplier = 1.5; // Two matching
    }

    const winAmount = Math.floor(bet * multiplier);
    const netWin = winAmount - bet;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update player cash
      await client.query(
        `UPDATE players SET cash = cash - $1 + $2 WHERE id = $3`,
        [bet, winAmount, playerId]
      );

      // Log game
      await client.query(
        `INSERT INTO casino_games (player_id, game_type, bet_amount, win_amount, result)
         VALUES ($1, 'slots', $2, $3, $4)`,
        [playerId, bet, winAmount, { reels, multiplier }]
      );

      // Update stats
      await client.query(
        `INSERT INTO player_stats (player_id, casino_wins, casino_losses, biggest_win, total_wagered)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (player_id) DO UPDATE SET
           casino_wins = player_stats.casino_wins + $2,
           casino_losses = player_stats.casino_losses + $3,
           biggest_win = GREATEST(player_stats.biggest_win, $4),
           total_wagered = player_stats.total_wagered + $5`,
        [playerId, winAmount > bet ? winAmount : 0, winAmount < bet ? bet - winAmount : 0, winAmount, bet]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          reels,
          multiplier,
          betAmount: bet,
          winAmount,
          netWin,
          isWin: winAmount > 0,
          isJackpot: multiplier >= 25,
          newCash: playerResult.rows[0].cash - bet + winAmount
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Slots error:', error);
    res.status(500).json({ success: false, error: 'Failed to play slots' });
  }
});

// POST /api/casino/blackjack - Play blackjack
router.post('/blackjack', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bet, action, gameState } = req.body;

    // Check player cash for new game
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );
    const playerCash = playerResult.rows[0].cash;

    // New game
    if (!gameState || action === 'new') {
      if (!bet || bet < MIN_BETS.blackjack) {
        res.status(400).json({ success: false, error: `Minimum bet is $${MIN_BETS.blackjack}` });
        return;
      }
      if (playerCash < bet) {
        res.status(400).json({ success: false, error: 'Insufficient funds' });
        return;
      }

      // Create deck and deal
      const deck = createDeck();
      const playerHand = [drawCard(deck), drawCard(deck)];
      const dealerHand = [drawCard(deck), drawCard(deck)];

      const playerTotal = calculateHandTotal(playerHand);
      const dealerVisible = calculateHandTotal([dealerHand[0]]);

      // Check for blackjack
      if (playerTotal === 21) {
        const winAmount = Math.floor(bet * 2.5);
        await processBlackjackResult(playerId, bet, winAmount, playerCash, { playerHand, dealerHand, outcome: 'blackjack' });

        res.json({
          success: true,
          data: {
            playerHand,
            dealerHand,
            playerTotal: 21,
            dealerTotal: calculateHandTotal(dealerHand),
            outcome: 'blackjack',
            winAmount,
            newCash: playerCash - bet + winAmount
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          gameState: {
            deck,
            playerHand,
            dealerHand: [dealerHand[0], { hidden: true }],
            bet
          },
          playerHand,
          dealerVisible,
          playerTotal,
          canHit: true,
          canStand: true,
          canDouble: playerCash >= bet * 2
        }
      });
      return;
    }

    // Continue game
    const { deck, playerHand, dealerHand, bet: currentBet } = gameState;

    if (action === 'hit') {
      playerHand.push(drawCard(deck));
      const playerTotal = calculateHandTotal(playerHand);

      if (playerTotal > 21) {
        // Bust
        await processBlackjackResult(playerId, currentBet, 0, playerCash, { playerHand, dealerHand, outcome: 'bust' });

        res.json({
          success: true,
          data: {
            playerHand,
            dealerHand,
            playerTotal,
            dealerTotal: calculateHandTotal(dealerHand),
            outcome: 'bust',
            winAmount: 0,
            newCash: playerCash - currentBet
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          gameState: { deck, playerHand, dealerHand, bet: currentBet },
          playerHand,
          dealerVisible: [dealerHand[0]],
          playerTotal,
          canHit: true,
          canStand: true
        }
      });
      return;
    }

    if (action === 'stand' || action === 'double') {
      let finalBet = currentBet;

      if (action === 'double') {
        if (playerCash < currentBet * 2) {
          res.status(400).json({ success: false, error: 'Insufficient funds to double' });
          return;
        }
        finalBet = currentBet * 2;
        playerHand.push(drawCard(deck));
      }

      // Dealer plays
      let dealerTotal = calculateHandTotal(dealerHand);
      while (dealerTotal < 17) {
        dealerHand.push(drawCard(deck));
        dealerTotal = calculateHandTotal(dealerHand);
      }

      const playerTotal = calculateHandTotal(playerHand);

      let outcome: string;
      let winAmount = 0;

      if (playerTotal > 21) {
        outcome = 'bust';
      } else if (dealerTotal > 21) {
        outcome = 'dealer_bust';
        winAmount = finalBet * 2;
      } else if (playerTotal > dealerTotal) {
        outcome = 'win';
        winAmount = finalBet * 2;
      } else if (playerTotal < dealerTotal) {
        outcome = 'lose';
      } else {
        outcome = 'push';
        winAmount = finalBet;
      }

      await processBlackjackResult(playerId, finalBet, winAmount, playerCash, { playerHand, dealerHand, outcome });

      res.json({
        success: true,
        data: {
          playerHand,
          dealerHand,
          playerTotal,
          dealerTotal,
          outcome,
          winAmount,
          newCash: playerCash - finalBet + winAmount
        }
      });
    }
  } catch (error) {
    console.error('Blackjack error:', error);
    res.status(500).json({ success: false, error: 'Failed to play blackjack' });
  }
});

// POST /api/casino/roulette - Play roulette
router.post('/roulette', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bets } = req.body;

    // bets = [{ type: 'number' | 'red' | 'black' | 'odd' | 'even' | 'high' | 'low', value?: number, amount: number }]

    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      res.status(400).json({ success: false, error: 'No bets placed' });
      return;
    }

    const totalBet = bets.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);

    if (totalBet < MIN_BETS.roulette) {
      res.status(400).json({ success: false, error: `Minimum total bet is $${MIN_BETS.roulette}` });
      return;
    }

    // Check player cash
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );
    if (playerResult.rows[0].cash < totalBet) {
      res.status(400).json({ success: false, error: 'Insufficient funds' });
      return;
    }

    // Spin the wheel
    const result = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
    const isRed = RED_NUMBERS.includes(result);
    const isBlack = BLACK_NUMBERS.includes(result);
    const isOdd = result > 0 && result % 2 === 1;
    const isEven = result > 0 && result % 2 === 0;
    const isHigh = result >= 19;
    const isLow = result >= 1 && result <= 18;

    // Calculate winnings
    let totalWin = 0;
    const betResults = bets.map((bet: { type: string; value?: number; amount: number }) => {
      let won = false;
      let payout = 0;

      switch (bet.type) {
        case 'number':
          if (bet.value === result) {
            won = true;
            payout = bet.amount * 36;
          }
          break;
        case 'red':
          if (isRed) {
            won = true;
            payout = bet.amount * 2;
          }
          break;
        case 'black':
          if (isBlack) {
            won = true;
            payout = bet.amount * 2;
          }
          break;
        case 'odd':
          if (isOdd) {
            won = true;
            payout = bet.amount * 2;
          }
          break;
        case 'even':
          if (isEven) {
            won = true;
            payout = bet.amount * 2;
          }
          break;
        case 'high':
          if (isHigh) {
            won = true;
            payout = bet.amount * 2;
          }
          break;
        case 'low':
          if (isLow) {
            won = true;
            payout = bet.amount * 2;
          }
          break;
      }

      totalWin += payout;
      return { ...bet, won, payout };
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE players SET cash = cash - $1 + $2 WHERE id = $3`,
        [totalBet, totalWin, playerId]
      );

      await client.query(
        `INSERT INTO casino_games (player_id, game_type, bet_amount, win_amount, result)
         VALUES ($1, 'roulette', $2, $3, $4)`,
        [playerId, totalBet, totalWin, { number: result, bets: betResults }]
      );

      await client.query(
        `INSERT INTO player_stats (player_id, casino_wins, casino_losses, biggest_win, total_wagered)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (player_id) DO UPDATE SET
           casino_wins = player_stats.casino_wins + $2,
           casino_losses = player_stats.casino_losses + $3,
           biggest_win = GREATEST(player_stats.biggest_win, $4),
           total_wagered = player_stats.total_wagered + $5`,
        [playerId, totalWin > totalBet ? totalWin : 0, totalWin < totalBet ? totalBet - totalWin : 0, totalWin, totalBet]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          result,
          isRed,
          isBlack,
          betResults,
          totalBet,
          totalWin,
          netWin: totalWin - totalBet,
          newCash: playerResult.rows[0].cash - totalBet + totalWin
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Roulette error:', error);
    res.status(500).json({ success: false, error: 'Failed to play roulette' });
  }
});

// POST /api/casino/dice - Play dice game
router.post('/dice', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bet, prediction, target } = req.body;
    // prediction: 'over' | 'under' | 'exact'
    // target: number 2-12

    if (!bet || bet < MIN_BETS.dice) {
      res.status(400).json({ success: false, error: `Minimum bet is $${MIN_BETS.dice}` });
      return;
    }

    if (!prediction || !['over', 'under', 'exact'].includes(prediction)) {
      res.status(400).json({ success: false, error: 'Invalid prediction' });
      return;
    }

    if (!target || target < 2 || target > 12) {
      res.status(400).json({ success: false, error: 'Target must be between 2 and 12' });
      return;
    }

    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );
    if (playerResult.rows[0].cash < bet) {
      res.status(400).json({ success: false, error: 'Insufficient funds' });
      return;
    }

    // Roll dice
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;

    // Calculate odds and payout
    let won = false;
    let multiplier = 0;

    if (prediction === 'exact' && total === target) {
      won = true;
      // Exact match pays based on probability
      const exactOdds: Record<number, number> = {
        2: 36, 3: 18, 4: 12, 5: 9, 6: 7.2, 7: 6,
        8: 7.2, 9: 9, 10: 12, 11: 18, 12: 36
      };
      multiplier = exactOdds[target] || 6;
    } else if (prediction === 'over' && total > target) {
      won = true;
      multiplier = 2;
    } else if (prediction === 'under' && total < target) {
      won = true;
      multiplier = 2;
    }

    const winAmount = won ? Math.floor(bet * multiplier) : 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE players SET cash = cash - $1 + $2 WHERE id = $3`,
        [bet, winAmount, playerId]
      );

      await client.query(
        `INSERT INTO casino_games (player_id, game_type, bet_amount, win_amount, result)
         VALUES ($1, 'dice', $2, $3, $4)`,
        [playerId, bet, winAmount, { die1, die2, total, prediction, target }]
      );

      await client.query(
        `INSERT INTO player_stats (player_id, casino_wins, casino_losses, biggest_win, total_wagered)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (player_id) DO UPDATE SET
           casino_wins = player_stats.casino_wins + $2,
           casino_losses = player_stats.casino_losses + $3,
           biggest_win = GREATEST(player_stats.biggest_win, $4),
           total_wagered = player_stats.total_wagered + $5`,
        [playerId, winAmount > bet ? winAmount : 0, winAmount < bet ? bet - winAmount : 0, winAmount, bet]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          die1,
          die2,
          total,
          prediction,
          target,
          won,
          multiplier,
          betAmount: bet,
          winAmount,
          netWin: winAmount - bet,
          newCash: playerResult.rows[0].cash - bet + winAmount
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Dice error:', error);
    res.status(500).json({ success: false, error: 'Failed to play dice' });
  }
});

// Helper functions
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: { suit: string; value: string }[] = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function drawCard(deck: { suit: string; value: string }[]) {
  return deck.pop()!;
}

function getCardValue(card: { value: string }): number {
  if (card.value === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.value)) return 10;
  return parseInt(card.value);
}

function calculateHandTotal(hand: { suit: string; value: string }[]): number {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
      total += 11;
    } else {
      total += getCardValue(card);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

async function processBlackjackResult(
  playerId: number,
  bet: number,
  winAmount: number,
  currentCash: number,
  result: object
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE players SET cash = cash - $1 + $2 WHERE id = $3`,
      [bet, winAmount, playerId]
    );

    await client.query(
      `INSERT INTO casino_games (player_id, game_type, bet_amount, win_amount, result)
       VALUES ($1, 'blackjack', $2, $3, $4)`,
      [playerId, bet, winAmount, result]
    );

    await client.query(
      `INSERT INTO player_stats (player_id, casino_wins, casino_losses, biggest_win, total_wagered)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id) DO UPDATE SET
         casino_wins = player_stats.casino_wins + $2,
         casino_losses = player_stats.casino_losses + $3,
         biggest_win = GREATEST(player_stats.biggest_win, $4),
         total_wagered = player_stats.total_wagered + $5`,
      [playerId, winAmount > bet ? winAmount : 0, winAmount < bet ? bet - winAmount : 0, winAmount, bet]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default router;
