/**
 * Life Chapters Service
 * Character aging with distinct life phases affecting gameplay
 */

import pool from '../db/connection.js';
import {
  LifeChapter,
  LifeChapterConfig,
  LifeChapterConfigRow,
  ChapterTransition,
  ChapterTransitionRow,
  TransitionTrigger,
  PlayerLifeState,
  PlayerLifeStateRow,
  GameTimeConfig,
  GameTimeConfigRow,
  ChapterModifiers,
  CHAPTER_AGE_THRESHOLDS,
  CHAPTER_ORDER,
  FEATURE_REQUIREMENTS,
  DEFAULT_GAME_TIME_CONFIG,
  STARTING_AGE,
  rowToChapterConfig,
  rowToChapterTransition,
  rowToGameTimeConfig
} from '../types/lifeChapters.types.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map database row to LifeChapterConfig
 */
function mapRowToChapterConfig(row: LifeChapterConfigRow): LifeChapterConfig {
  return rowToChapterConfig(row);
}

/**
 * Map database row to ChapterTransition
 */
function mapRowToTransition(row: ChapterTransitionRow): ChapterTransition {
  return rowToChapterTransition(row);
}

/**
 * Determine which chapter a player should be in based on age
 */
function getChapterForAge(age: number): LifeChapter {
  for (const chapter of CHAPTER_ORDER) {
    const threshold = CHAPTER_AGE_THRESHOLDS[chapter];
    if (age >= threshold.start && (threshold.end === null || age <= threshold.end)) {
      return chapter;
    }
  }
  return 'legacy'; // Default to legacy for very old ages
}

// =============================================================================
// GAME TIME FUNCTIONS
// =============================================================================

/**
 * Get game time configuration
 */
export async function getGameTimeConfig(): Promise<GameTimeConfig> {
  console.log(`[LifeChapters] Getting game time config`);

  try {
    const result = await pool.query(
      `SELECT * FROM game_time_config WHERE id = 'default'`
    );

    if (result.rows.length === 0) {
      // Return default config if not found
      return {
        id: 'default',
        realDaysPerGameYear: DEFAULT_GAME_TIME_CONFIG.realDaysPerGameYear,
        currentGameDate: new Date(),
        timeMultiplier: DEFAULT_GAME_TIME_CONFIG.timeMultiplier,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return rowToGameTimeConfig(result.rows[0] as GameTimeConfigRow);
  } catch (error) {
    console.error(`[LifeChapters] Error getting game time config:`, error);
    // Return default on error
    return {
      id: 'default',
      realDaysPerGameYear: DEFAULT_GAME_TIME_CONFIG.realDaysPerGameYear,
      currentGameDate: new Date(),
      timeMultiplier: DEFAULT_GAME_TIME_CONFIG.timeMultiplier,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

/**
 * Calculate a player's current age in game years
 */
export async function calculatePlayerAge(playerId: string): Promise<number> {
  console.log(`[LifeChapters] Calculating age for player: ${playerId}`);

  try {
    // Get player birth date
    const playerResult = await pool.query(
      `SELECT birth_date FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      console.log(`[LifeChapters] Player not found: ${playerId}`);
      return STARTING_AGE;
    }

    const birthDate = new Date(playerResult.rows[0].birth_date);

    // Get game time config
    const timeConfig = await getGameTimeConfig();

    // Calculate real days passed since birth
    const now = new Date();
    const realDaysPassed = (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24);

    // Calculate game age
    const gameAge = STARTING_AGE + Math.floor(realDaysPassed / timeConfig.realDaysPerGameYear);

    console.log(`[LifeChapters] Player ${playerId} age: ${gameAge} (birth: ${birthDate.toISOString()})`);
    return gameAge;
  } catch (error) {
    console.error(`[LifeChapters] Error calculating player age:`, error);
    return STARTING_AGE;
  }
}

// =============================================================================
// CHAPTER CONFIGURATION
// =============================================================================

/**
 * Get configuration for a specific chapter
 */
export async function getChapterConfig(chapter: LifeChapter): Promise<LifeChapterConfig | null> {
  console.log(`[LifeChapters] Getting config for chapter: ${chapter}`);

  try {
    const result = await pool.query(
      `SELECT * FROM life_chapters_config WHERE id = $1`,
      [chapter]
    );

    if (result.rows.length === 0) {
      console.log(`[LifeChapters] Chapter config not found: ${chapter}`);
      return null;
    }

    return mapRowToChapterConfig(result.rows[0] as LifeChapterConfigRow);
  } catch (error) {
    console.error(`[LifeChapters] Error getting chapter config:`, error);
    return null;
  }
}

/**
 * Get all chapter configurations
 */
export async function getAllChapterConfigs(): Promise<LifeChapterConfig[]> {
  console.log(`[LifeChapters] Getting all chapter configs`);

  try {
    const result = await pool.query(
      `SELECT * FROM life_chapters_config ORDER BY age_range_start ASC`
    );

    return result.rows.map(row => mapRowToChapterConfig(row as LifeChapterConfigRow));
  } catch (error) {
    console.error(`[LifeChapters] Error getting all chapter configs:`, error);
    return [];
  }
}

// =============================================================================
// PLAYER LIFE STATE
// =============================================================================

/**
 * Get complete life state for a player
 */
export async function getPlayerLifeState(playerId: string): Promise<PlayerLifeState | null> {
  console.log(`[LifeChapters] Getting life state for player: ${playerId}`);

  try {
    // Get player data
    const playerResult = await pool.query(
      `SELECT
         p.id as player_id,
         p.username,
         p.birth_date,
         p.game_age,
         p.current_chapter,
         p.chapter_started_at,
         p.total_days_played,
         p.max_energy,
         EXTRACT(DAYS FROM (NOW() - p.chapter_started_at)) as days_in_chapter
       FROM players p
       WHERE p.id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      console.log(`[LifeChapters] Player not found: ${playerId}`);
      return null;
    }

    const playerRow = playerResult.rows[0];

    // Calculate current age
    const currentAge = await calculatePlayerAge(playerId);

    // Get chapter config
    const chapterConfig = await getChapterConfig(playerRow.current_chapter);
    if (!chapterConfig) {
      console.log(`[LifeChapters] Chapter config not found for: ${playerRow.current_chapter}`);
      return null;
    }

    // Calculate years until next chapter
    let yearsUntilNextChapter: number | null = null;
    const ageThreshold = CHAPTER_AGE_THRESHOLDS[playerRow.current_chapter as LifeChapter];
    if (ageThreshold.end !== null) {
      yearsUntilNextChapter = Math.max(0, ageThreshold.end - currentAge + 1);
    }

    return {
      playerId: playerRow.player_id,
      username: playerRow.username,
      birthDate: new Date(playerRow.birth_date),
      currentAge,
      currentChapter: playerRow.current_chapter,
      chapterStartedAt: new Date(playerRow.chapter_started_at),
      daysInChapter: parseInt(playerRow.days_in_chapter, 10) || 0,
      yearsUntilNextChapter,
      chapterConfig,
      totalDaysPlayed: playerRow.total_days_played || 0,
      energyMax: playerRow.max_energy || chapterConfig.energyMax
    };
  } catch (error) {
    console.error(`[LifeChapters] Error getting player life state:`, error);
    return null;
  }
}

// =============================================================================
// CHAPTER TRANSITIONS
// =============================================================================

/**
 * Transition a player to a new chapter
 */
export async function transitionChapter(
  playerId: string,
  newChapter: LifeChapter,
  triggeredBy: TransitionTrigger,
  metadata: Record<string, unknown> = {}
): Promise<ChapterTransition | null> {
  console.log(`[LifeChapters] Transitioning player ${playerId} to ${newChapter} (triggered by: ${triggeredBy})`);

  try {
    // Get current player state
    const playerResult = await pool.query(
      `SELECT current_chapter, game_age, level, cash, energy
       FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      console.log(`[LifeChapters] Player not found: ${playerId}`);
      return null;
    }

    const player = playerResult.rows[0];
    const currentAge = await calculatePlayerAge(playerId);

    // Get new chapter config
    const newChapterConfig = await getChapterConfig(newChapter);
    if (!newChapterConfig) {
      console.log(`[LifeChapters] New chapter config not found: ${newChapter}`);
      return null;
    }

    // Build previous stats
    const previousStats = {
      level: player.level,
      cash: player.cash,
      energy: player.energy,
      chapter: player.current_chapter
    };

    // Insert transition record
    const transitionResult = await pool.query(
      `INSERT INTO chapter_transitions (
         player_id, from_chapter, to_chapter, triggered_by,
         player_age_at_transition, previous_stats, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        playerId,
        player.current_chapter,
        newChapter,
        triggeredBy,
        currentAge,
        previousStats,
        { ...metadata, timestamp: new Date().toISOString() }
      ]
    );

    // Update player
    await pool.query(
      `UPDATE players
       SET current_chapter = $2,
           chapter_started_at = NOW(),
           game_age = $3,
           max_energy = $4
       WHERE id = $1`,
      [playerId, newChapter, currentAge, newChapterConfig.energyMax]
    );

    console.log(`[LifeChapters] Successfully transitioned player ${playerId} from ${player.current_chapter} to ${newChapter}`);

    return mapRowToTransition(transitionResult.rows[0] as ChapterTransitionRow);
  } catch (error) {
    console.error(`[LifeChapters] Error transitioning chapter:`, error);
    return null;
  }
}

/**
 * Check if a player should transition to a new chapter based on age
 */
export async function checkChapterTransition(playerId: string): Promise<ChapterTransition | null> {
  console.log(`[LifeChapters] Checking transition for player: ${playerId}`);

  try {
    // Get current player chapter
    const playerResult = await pool.query(
      `SELECT current_chapter FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      console.log(`[LifeChapters] Player not found: ${playerId}`);
      return null;
    }

    const currentChapter = playerResult.rows[0].current_chapter as LifeChapter;

    // Calculate current age
    const currentAge = await calculatePlayerAge(playerId);

    // Update cached age
    await pool.query(
      `UPDATE players SET game_age = $2 WHERE id = $1`,
      [playerId, currentAge]
    );

    // Determine what chapter they should be in
    const correctChapter = getChapterForAge(currentAge);

    // Check if transition needed
    if (correctChapter !== currentChapter) {
      console.log(`[LifeChapters] Player ${playerId} needs transition: ${currentChapter} -> ${correctChapter}`);
      return await transitionChapter(playerId, correctChapter, 'age');
    }

    console.log(`[LifeChapters] No transition needed for player ${playerId} (age ${currentAge}, chapter ${currentChapter})`);
    return null;
  } catch (error) {
    console.error(`[LifeChapters] Error checking chapter transition:`, error);
    return null;
  }
}

/**
 * Manually transition a player to a new chapter (admin/special events)
 */
export async function manualTransition(
  playerId: string,
  newChapter: LifeChapter,
  reason?: string
): Promise<ChapterTransition | null> {
  console.log(`[LifeChapters] Manual transition for player ${playerId} to ${newChapter}`);

  try {
    // Validate player exists
    const playerResult = await pool.query(
      `SELECT current_chapter FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      console.log(`[LifeChapters] Player not found: ${playerId}`);
      return null;
    }

    const currentChapter = playerResult.rows[0].current_chapter;

    // Don't transition if already in target chapter
    if (currentChapter === newChapter) {
      console.log(`[LifeChapters] Player already in chapter ${newChapter}`);
      return null;
    }

    return await transitionChapter(playerId, newChapter, 'manual', { reason });
  } catch (error) {
    console.error(`[LifeChapters] Error in manual transition:`, error);
    return null;
  }
}

// =============================================================================
// MODIFIERS AND FEATURES
// =============================================================================

/**
 * Get chapter modifiers for a player
 */
export async function getChapterModifiers(playerId: string): Promise<ChapterModifiers> {
  console.log(`[LifeChapters] Getting modifiers for player: ${playerId}`);

  try {
    // Get current chapter
    const playerResult = await pool.query(
      `SELECT current_chapter FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return {};
    }

    const currentChapter = playerResult.rows[0].current_chapter as LifeChapter;

    // Get chapter config
    const config = await getChapterConfig(currentChapter);
    if (!config) {
      return {};
    }

    return config.modifiers;
  } catch (error) {
    console.error(`[LifeChapters] Error getting chapter modifiers:`, error);
    return {};
  }
}

/**
 * Apply a chapter modifier to a base value
 */
export async function applyChapterModifier(
  playerId: string,
  modifierName: string,
  baseValue: number
): Promise<number> {
  const modifiers = await getChapterModifiers(playerId);
  const modifier = modifiers[modifierName];

  if (modifier === undefined) {
    return baseValue;
  }

  // Bonuses add, penalties subtract
  if (modifierName.toLowerCase().includes('bonus')) {
    return baseValue * (1 + modifier);
  } else if (modifierName.toLowerCase().includes('penalty')) {
    return baseValue * (1 - modifier);
  }

  return baseValue * (1 + modifier);
}

/**
 * Check if a player can use a specific feature
 */
export async function canUseFeature(playerId: string, feature: string): Promise<boolean> {
  console.log(`[LifeChapters] Checking feature ${feature} for player: ${playerId}`);

  try {
    // Get current chapter
    const playerResult = await pool.query(
      `SELECT current_chapter FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return false;
    }

    const currentChapter = playerResult.rows[0].current_chapter as LifeChapter;

    // Check feature requirements
    const allowedChapters = FEATURE_REQUIREMENTS[feature];

    if (!allowedChapters) {
      // Unknown features default to allowed
      return true;
    }

    return allowedChapters.includes(currentChapter);
  } catch (error) {
    console.error(`[LifeChapters] Error checking feature availability:`, error);
    return false;
  }
}

/**
 * Get all unlocked features for a player
 */
export async function getUnlockedFeatures(playerId: string): Promise<string[]> {
  console.log(`[LifeChapters] Getting unlocked features for player: ${playerId}`);

  try {
    // Get current chapter
    const playerResult = await pool.query(
      `SELECT current_chapter FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return [];
    }

    const currentChapter = playerResult.rows[0].current_chapter as LifeChapter;

    // Get chapter config
    const config = await getChapterConfig(currentChapter);
    if (!config) {
      return [];
    }

    return config.unlockedFeatures;
  } catch (error) {
    console.error(`[LifeChapters] Error getting unlocked features:`, error);
    return [];
  }
}

/**
 * Get all locked features for a player
 */
export async function getLockedFeatures(playerId: string): Promise<string[]> {
  console.log(`[LifeChapters] Getting locked features for player: ${playerId}`);

  try {
    // Get current chapter
    const playerResult = await pool.query(
      `SELECT current_chapter FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return [];
    }

    const currentChapter = playerResult.rows[0].current_chapter as LifeChapter;

    // Get chapter config
    const config = await getChapterConfig(currentChapter);
    if (!config) {
      return [];
    }

    return config.lockedFeatures;
  } catch (error) {
    console.error(`[LifeChapters] Error getting locked features:`, error);
    return [];
  }
}

// =============================================================================
// HISTORY AND BATCH PROCESSING
// =============================================================================

/**
 * Get chapter transition history for a player
 */
export async function getChapterHistory(playerId: string): Promise<ChapterTransition[]> {
  console.log(`[LifeChapters] Getting chapter history for player: ${playerId}`);

  try {
    const result = await pool.query(
      `SELECT ct.*,
              lc_from.display_name as from_chapter_name,
              lc_to.display_name as to_chapter_name
       FROM chapter_transitions ct
       LEFT JOIN life_chapters_config lc_from ON lc_from.id = ct.from_chapter
       JOIN life_chapters_config lc_to ON lc_to.id = ct.to_chapter
       WHERE ct.player_id = $1
       ORDER BY ct.transitioned_at ASC`,
      [playerId]
    );

    return result.rows.map(row => mapRowToTransition(row as ChapterTransitionRow));
  } catch (error) {
    console.error(`[LifeChapters] Error getting chapter history:`, error);
    return [];
  }
}

/**
 * Process chapter transitions for all active players (scheduled job)
 */
export async function processAllChapterTransitions(): Promise<number> {
  console.log(`[LifeChapters] Processing chapter transitions for all players`);

  try {
    // Get all active players
    const playersResult = await pool.query(
      `SELECT id FROM players WHERE is_active = true`
    );

    let transitionCount = 0;

    for (const player of playersResult.rows) {
      const transition = await checkChapterTransition(String(player.id));
      if (transition) {
        transitionCount++;
      }
    }

    console.log(`[LifeChapters] Processed ${playersResult.rows.length} players, ${transitionCount} transitions made`);
    return transitionCount;
  } catch (error) {
    console.error(`[LifeChapters] Error processing all chapter transitions:`, error);
    return 0;
  }
}

/**
 * Update all player ages (scheduled job)
 */
export async function updateAllPlayerAges(): Promise<number> {
  console.log(`[LifeChapters] Updating all player ages`);

  try {
    const playersResult = await pool.query(
      `SELECT id FROM players WHERE is_active = true`
    );

    let updatedCount = 0;

    for (const player of playersResult.rows) {
      const age = await calculatePlayerAge(String(player.id));

      await pool.query(
        `UPDATE players
         SET game_age = $2,
             total_days_played = total_days_played + 1
         WHERE id = $1`,
        [player.id, age]
      );

      // Check for transitions
      await checkChapterTransition(String(player.id));

      updatedCount++;
    }

    console.log(`[LifeChapters] Updated ages for ${updatedCount} players`);
    return updatedCount;
  } catch (error) {
    console.error(`[LifeChapters] Error updating all player ages:`, error);
    return 0;
  }
}

/**
 * Get statistics about chapter distribution
 */
export async function getChapterStatistics(): Promise<Record<LifeChapter, number>> {
  console.log(`[LifeChapters] Getting chapter statistics`);

  try {
    const result = await pool.query(
      `SELECT current_chapter, COUNT(*) as count
       FROM players
       WHERE is_active = true
       GROUP BY current_chapter`
    );

    const stats: Record<string, number> = {
      come_up: 0,
      player: 0,
      boss: 0,
      legacy: 0
    };

    for (const row of result.rows) {
      stats[row.current_chapter] = parseInt(row.count, 10);
    }

    return stats as Record<LifeChapter, number>;
  } catch (error) {
    console.error(`[LifeChapters] Error getting chapter statistics:`, error);
    return { come_up: 0, player: 0, boss: 0, legacy: 0 };
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  // Game time
  getGameTimeConfig,
  calculatePlayerAge,

  // Chapter configuration
  getChapterConfig,
  getAllChapterConfigs,

  // Player life state
  getPlayerLifeState,

  // Transitions
  checkChapterTransition,
  transitionChapter,
  manualTransition,

  // Modifiers and features
  getChapterModifiers,
  applyChapterModifier,
  canUseFeature,
  getUnlockedFeatures,
  getLockedFeatures,

  // History and batch
  getChapterHistory,
  processAllChapterTransitions,
  updateAllPlayerAges,
  getChapterStatistics
};
