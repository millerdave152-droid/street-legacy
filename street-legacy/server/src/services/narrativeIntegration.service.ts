/**
 * Narrative Integration Service
 *
 * Central integration point connecting gameplay events to narrative systems.
 * Other services call these functions to trigger narrative updates.
 */

import { pool } from '../db/index.js';
import { logDistrictEvent } from './districtEcosystem.service.js';
import { modifyReputation } from './reputationWeb.service.js';
import { createWitnessedEvent } from './witness.service.js';
import { emitNarrativeEvent } from '../websocket/narrativeEvents.js';

// =============================================================================
// TYPES
// =============================================================================

interface CrimeEventData {
  playerId: string;
  districtId: string;
  crimeType: string;
  earnings: number;
  severity: number;
  targetType?: string;
  weaponUsed?: boolean;
}

interface AttackEventData {
  attackerId: string;
  victimId: string;
  districtId: string;
  damage: number;
  won: boolean;
  attackType?: string;
}

interface PropertyEventData {
  playerId: string;
  districtId: string;
  propertyId: string;
  propertyName: string;
  price: number;
  propertyType?: string;
}

interface CrewBattleData {
  winningCrewId: string;
  losingCrewId: string;
  districtId: string;
  casualties: number;
  territoryTaken?: boolean;
}

interface BusinessEventData {
  playerId: string;
  districtId: string;
  businessType: string;
  businessId?: string;
  reason?: string;
}

interface HeistEventData {
  crewId: string;
  districtId: string;
  take: number;
  success: boolean;
  heistType: string;
  participantIds: string[];
  targetName?: string;
}

interface DebtEventData {
  creditorId: string;
  debtorId: string;
  amount: number;
  debtType: string;
  action: 'created' | 'called_in' | 'fulfilled' | 'defaulted' | 'forgiven' | 'transferred';
  newCreditorId?: string;
}

interface SuccessionEventData {
  playerId: string;
  heirId?: string;
  dynastyId: string;
  endingType: string;
  generation: number;
  legacyScore: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getPlayerName(playerId: string): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT username FROM players WHERE id = $1',
      [playerId]
    );
    return result.rows[0]?.username || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function getCrewName(crewId: string): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT name FROM crews WHERE id = $1',
      [crewId]
    );
    return result.rows[0]?.name || 'Unknown Crew';
  } catch {
    return 'Unknown Crew';
  }
}

async function getDistrictName(districtId: string): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT name FROM districts WHERE id = $1',
      [districtId]
    );
    return result.rows[0]?.name || 'Unknown District';
  } catch {
    return 'Unknown District';
  }
}

async function checkIsFirstMajorCrime(playerId: string, districtId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM world_events
       WHERE caused_by_player_id = $1
       AND district_id = $2
       AND event_type IN ('crime_spree', 'major_heist', 'territory_takeover')`,
      [playerId, districtId]
    );
    return parseInt(result.rows[0].count) === 0;
  } catch {
    return false;
  }
}

async function generateNewsArticle(
  category: string,
  headline: string,
  content: string,
  districtId: string | null,
  playerId: string | null,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const isBreaking = metadata.severity >= 8 || metadata.isBreaking;

    await pool.query(
      `INSERT INTO street_news
       (category, headline, content, district_id, related_player_id, is_breaking, metadata, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '24 hours')`,
      [category, headline, content, districtId, playerId, isBreaking, JSON.stringify(metadata)]
    );

    // Emit WebSocket event for breaking news
    if (isBreaking) {
      emitNarrativeEvent('news_breaking', {
        headline,
        category,
        districtId,
        playerId
      });
    }
  } catch (error) {
    console.error('Failed to generate news article:', error);
  }
}

async function recordLandmarkEvent(
  districtId: string,
  playerId: string,
  eventType: string,
  title: string,
  description: string,
  monumentName?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO world_events
       (event_type, district_id, caused_by_player_id, title, description, significance, is_landmark, monument_name, monument_description)
       VALUES ($1, $2, $3, $4, $5, 10, true, $6, $7)`,
      [
        eventType,
        districtId,
        playerId,
        title,
        description,
        monumentName || `${title} Memorial`,
        `Commemorating the historic event: ${title}`
      ]
    );
  } catch (error) {
    console.error('Failed to record landmark event:', error);
  }
}

async function updateLifeChapterProgress(playerId: string, eventType: string): Promise<void> {
  try {
    // Get current life state
    const result = await pool.query(
      'SELECT * FROM player_life_state WHERE player_id = $1',
      [playerId]
    );

    if (result.rows.length === 0) return;

    const lifeState = result.rows[0];
    const currentFeatures = lifeState.unlocked_features || [];

    // Determine if this event unlocks new features based on chapter
    const chapterFeatures: Record<string, string[]> = {
      young_hustler: ['petty_crime', 'basic_jobs'],
      rising_player: ['crew_formation', 'territory_control', 'debt_creation'],
      established_boss: ['major_heists', 'business_empire', 'debt_trading'],
      aging_legend: ['succession_planning', 'mentor_role', 'legacy_building'],
      final_days: ['dynasty_completion', 'final_score']
    };

    const availableFeatures = chapterFeatures[lifeState.current_chapter] || [];
    const featureMap: Record<string, string> = {
      'crime_committed': 'petty_crime',
      'heist_executed': 'major_heists',
      'crew_battle_won': 'territory_control',
      'business_opened': 'business_empire',
      'debt_created': 'debt_creation',
      'debt_traded': 'debt_trading',
      'heir_named': 'succession_planning'
    };

    const featureToUnlock = featureMap[eventType];
    if (featureToUnlock && availableFeatures.includes(featureToUnlock) && !currentFeatures.includes(featureToUnlock)) {
      await pool.query(
        `UPDATE player_life_state
         SET unlocked_features = array_append(unlocked_features, $1),
             updated_at = NOW()
         WHERE player_id = $2`,
        [featureToUnlock, playerId]
      );
    }
  } catch (error) {
    console.error('Failed to update life chapter progress:', error);
  }
}

// =============================================================================
// CRIME INTEGRATION
// =============================================================================

export async function onCrimeCommitted(data: CrimeEventData): Promise<void> {
  const { playerId, districtId, crimeType, earnings, severity } = data;

  try {
    const playerName = await getPlayerName(playerId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'crime_committed',
      districtId,
      playerId,
      severity: Math.min(severity, 10),
      metadata: { crimeType, earnings, playerName, districtName }
    });

    // 2. Modify reputation based on crime type and success
    const reputationChange = Math.floor(severity * 0.5) + (earnings > 10000 ? 2 : 0);
    await modifyReputation(playerId, 'district', districtId, { respect: reputationChange, fear: Math.floor(reputationChange * 0.5) }, 'crime_success');

    // 3. Create witnessed event if severe enough
    if (severity >= 5) {
      await createWitnessedEvent({
        eventType: 'crime_committed',
        actorPlayerId: playerId,
        districtId,
        description: `${playerName} pulled off a ${crimeType}, making away with $${earnings.toLocaleString()}`,
        severity,
        metadata: { crimeType, earnings }
      });
    }

    // 4. Generate news if very severe
    if (severity >= 7) {
      const headlines = [
        `CRIME WAVE: ${crimeType.toUpperCase()} Rocks ${districtName}`,
        `Brazen ${crimeType} Leaves ${districtName} Residents Shaken`,
        `Police Baffled by Daring ${crimeType} in ${districtName}`,
        `$${earnings.toLocaleString()} ${crimeType.charAt(0).toUpperCase() + crimeType.slice(1)} Shocks ${districtName}`
      ];

      await generateNewsArticle(
        'crime',
        headlines[Math.floor(Math.random() * headlines.length)],
        `A brazen ${crimeType} occurred in ${districtName} today, with perpetrators making off with an estimated $${earnings.toLocaleString()}. ` +
        `Local authorities are investigating but have yet to make any arrests. Witnesses describe the suspect as "professional" and "calculated."`,
        districtId,
        playerId,
        { severity, crimeType, earnings, isBreaking: severity >= 9 }
      );
    }

    // 5. Check for landmark event (first major crime in district)
    if (severity >= 8) {
      const isFirst = await checkIsFirstMajorCrime(playerId, districtId);
      if (isFirst) {
        await recordLandmarkEvent(
          districtId,
          playerId,
          'crime_spree',
          `${playerName}'s ${crimeType} Spree`,
          `${playerName} became notorious in ${districtName} with a daring ${crimeType} that netted $${earnings.toLocaleString()}`
        );
      }
    }

    // 6. Update life chapter progress
    await updateLifeChapterProgress(playerId, 'crime_committed');

  } catch (error) {
    console.error('onCrimeCommitted integration error:', error);
  }
}

// =============================================================================
// PVP INTEGRATION
// =============================================================================

export async function onPlayerAttacked(data: AttackEventData): Promise<void> {
  const { attackerId, victimId, districtId, damage, won, attackType = 'assault' } = data;

  try {
    const attackerName = await getPlayerName(attackerId);
    const victimName = await getPlayerName(victimId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'player_attacked',
      districtId,
      playerId: attackerId,
      targetPlayerId: victimId,
      severity: won ? 6 : 4,
      metadata: { attackType, damage, won, attackerName, victimName, districtName }
    });

    // 2. Modify reputations
    if (won) {
      await modifyReputation(attackerId, 'district', districtId, { respect: 3, fear: 2 }, 'pvp_victory');
      await modifyReputation(victimId, 'district', districtId, { respect: -2, fear: -1 }, 'pvp_defeat');
    } else {
      await modifyReputation(victimId, 'district', districtId, { respect: 2, fear: 1 }, 'defended_attack');
    }

    // 3. Create witnessed event
    await createWitnessedEvent({
      eventType: 'player_attack',
      actorPlayerId: attackerId,
      targetPlayerId: victimId,
      districtId,
      description: `${attackerName} ${attackType}ed ${victimName}${won ? ', leaving them battered' : ' but was fought off'}`,
      severity: won ? 7 : 5,
      metadata: { attackType, damage, won }
    });

    // 4. Generate news for significant attacks
    if (damage >= 50 || won) {
      const headline = won
        ? `Street Violence: ${attackerName} Hospitalizes Rival in ${districtName}`
        : `Failed Hit: ${attackerName}'s Attack on ${victimName} Backfires`;

      await generateNewsArticle(
        'crime',
        headline,
        `Violence erupted in ${districtName} when ${attackerName} confronted ${victimName} in what witnesses describe as a brutal ${attackType}. ` +
        `${won ? `The victim was left severely injured.` : `The attacker was reportedly repelled.`} ` +
        `Police are investigating but expect no cooperation from either party.`,
        districtId,
        attackerId,
        { damage, won, severity: won ? 7 : 5 }
      );
    }

    // 5. Emit WebSocket for victim
    emitNarrativeEvent('reputation_shift', {
      playerId: victimId,
      districtId,
      change: won ? -2 : 2,
      reason: won ? 'Defeated in attack' : 'Defended against attack'
    });

  } catch (error) {
    console.error('onPlayerAttacked integration error:', error);
  }
}

// =============================================================================
// PROPERTY INTEGRATION
// =============================================================================

export async function onPropertyPurchased(data: PropertyEventData): Promise<void> {
  const { playerId, districtId, propertyId, propertyName, price, propertyType = 'property' } = data;

  try {
    const playerName = await getPlayerName(playerId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'property_bought',
      districtId,
      playerId,
      severity: price >= 100000 ? 7 : price >= 50000 ? 5 : 3,
      metadata: { propertyId, propertyName, price, propertyType, playerName, districtName }
    });

    // 2. Modify reputation (property owners gain respect)
    const reputationGain = Math.min(5, Math.floor(price / 25000) + 1);
    await modifyReputation(playerId, 'district', districtId, { respect: reputationGain, trust: Math.floor(reputationGain * 0.5) }, 'property_acquisition');

    // 3. Generate news for major purchases
    if (price >= 75000) {
      await generateNewsArticle(
        'economy',
        `Real Estate Shake-Up: ${propertyName} Changes Hands for $${price.toLocaleString()}`,
        `In a significant ${districtName} real estate deal, ${propertyName} has been purchased for $${price.toLocaleString()}. ` +
        `Industry insiders suggest this could signal shifting power dynamics in the area. ` +
        `The new owner's intentions for the property remain unclear.`,
        districtId,
        playerId,
        { propertyId, price, propertyType }
      );
    }

    // 4. Check for property empire landmark
    const propertiesOwned = await pool.query(
      `SELECT COUNT(*) as count FROM player_properties WHERE player_id = $1 AND district_id = $2`,
      [playerId, districtId]
    );

    if (parseInt(propertiesOwned.rows[0].count) >= 5) {
      await recordLandmarkEvent(
        districtId,
        playerId,
        'property_empire',
        `${playerName}'s Property Empire`,
        `${playerName} established a property empire in ${districtName}, controlling multiple key locations`
      );
    }

  } catch (error) {
    console.error('onPropertyPurchased integration error:', error);
  }
}

// =============================================================================
// CREW BATTLE INTEGRATION
// =============================================================================

export async function onCrewBattle(data: CrewBattleData): Promise<void> {
  const { winningCrewId, losingCrewId, districtId, casualties, territoryTaken = false } = data;

  try {
    const winningCrewName = await getCrewName(winningCrewId);
    const losingCrewName = await getCrewName(losingCrewId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'crew_battle',
      districtId,
      crewId: winningCrewId,
      severity: territoryTaken ? 9 : casualties > 3 ? 8 : 6,
      metadata: { winningCrewName, losingCrewName, losingCrewId, casualties, territoryTaken, districtName }
    });

    // 2. Get crew leaders and modify their reputations
    const winningLeader = await pool.query(
      'SELECT leader_id FROM crews WHERE id = $1',
      [winningCrewId]
    );
    const losingLeader = await pool.query(
      'SELECT leader_id FROM crews WHERE id = $1',
      [losingCrewId]
    );

    if (winningLeader.rows[0]?.leader_id) {
      await modifyReputation(winningLeader.rows[0].leader_id, 'district', districtId, { respect: 5, fear: 4 }, 'crew_battle_victory');
      await updateLifeChapterProgress(winningLeader.rows[0].leader_id, 'crew_battle_won');
    }
    if (losingLeader.rows[0]?.leader_id) {
      await modifyReputation(losingLeader.rows[0].leader_id, 'district', districtId, { respect: -3, fear: -2 }, 'crew_battle_defeat');
    }

    // 3. Create witnessed event
    await createWitnessedEvent({
      eventType: 'crew_battle',
      districtId,
      description: `${winningCrewName} and ${losingCrewName} clashed violently${casualties > 0 ? `, leaving ${casualties} casualties` : ''}`,
      severity: Math.min(10, 6 + casualties),
      metadata: { winningCrewId, losingCrewId, casualties, territoryTaken }
    });

    // 4. Generate news
    const headline = territoryTaken
      ? `GANG WAR: ${winningCrewName} Seizes ${districtName} Territory from ${losingCrewName}`
      : `Street Battle: ${winningCrewName} Clashes with ${losingCrewName} in ${districtName}`;

    await generateNewsArticle(
      'territory',
      headline,
      `Violence erupted in ${districtName} as ${winningCrewName} and ${losingCrewName} engaged in open warfare. ` +
      `${casualties > 0 ? `The conflict resulted in ${casualties} reported casualties. ` : ''}` +
      `${territoryTaken ? `${winningCrewName} has reportedly taken control of key territory. ` : ''}` +
      `Police presence has increased but sources say authorities are "overwhelmed."`,
      districtId,
      null,
      { casualties, territoryTaken, severity: territoryTaken ? 9 : 7, isBreaking: territoryTaken }
    );

    // 5. Record landmark for territory takeover
    if (territoryTaken) {
      await recordLandmarkEvent(
        districtId,
        winningLeader.rows[0]?.leader_id,
        'territory_takeover',
        `${winningCrewName}'s ${districtName} Conquest`,
        `${winningCrewName} violently seized control of territory from ${losingCrewName} in a battle that left ${casualties} casualties`,
        `${winningCrewName} Victory Monument`
      );
    }

    // 6. Emit district status change
    if (territoryTaken) {
      emitNarrativeEvent('district_status_change', {
        districtId,
        change: 'territory_control',
        newController: winningCrewId,
        previousController: losingCrewId
      });
    }

  } catch (error) {
    console.error('onCrewBattle integration error:', error);
  }
}

// =============================================================================
// BUSINESS INTEGRATION
// =============================================================================

export async function onBusinessOpened(data: BusinessEventData): Promise<void> {
  const { playerId, districtId, businessType, businessId } = data;

  try {
    const playerName = await getPlayerName(playerId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'business_opened',
      districtId,
      playerId,
      severity: 5,
      metadata: { businessType, businessId, playerName, districtName }
    });

    // 2. Modify reputation
    await modifyReputation(playerId, 'district', districtId, { respect: 2, trust: 1 }, 'legitimate_business');

    // 3. Update life chapter progress
    await updateLifeChapterProgress(playerId, 'business_opened');

    // 4. Generate news for certain business types
    const noteworthyBusinesses = ['casino', 'nightclub', 'restaurant', 'hotel'];
    if (noteworthyBusinesses.includes(businessType.toLowerCase())) {
      await generateNewsArticle(
        'economy',
        `New ${businessType.charAt(0).toUpperCase() + businessType.slice(1)} Opens in ${districtName}`,
        `A new ${businessType} has opened its doors in ${districtName}, adding to the area's growing commercial scene. ` +
        `The establishment is expected to bring jobs and economic activity to the neighborhood. ` +
        `Local business owners have mixed reactions to the new competition.`,
        districtId,
        playerId,
        { businessType, businessId }
      );
    }

  } catch (error) {
    console.error('onBusinessOpened integration error:', error);
  }
}

export async function onBusinessClosed(data: BusinessEventData): Promise<void> {
  const { playerId, districtId, businessType, businessId, reason = 'unknown' } = data;

  try {
    const playerName = await getPlayerName(playerId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'business_closed',
      districtId,
      playerId,
      severity: reason === 'raided' ? 7 : reason === 'bankruptcy' ? 5 : 3,
      metadata: { businessType, businessId, reason, playerName, districtName }
    });

    // 2. Generate news for dramatic closures
    if (reason === 'raided' || reason === 'destroyed') {
      await generateNewsArticle(
        'crime',
        reason === 'raided'
          ? `RAID: Police Shut Down ${districtName} ${businessType}`
          : `DESTRUCTION: ${businessType} Destroyed in ${districtName}`,
        reason === 'raided'
          ? `Law enforcement conducted a raid on a ${businessType} in ${districtName}, resulting in its immediate closure. ` +
            `Sources suggest illegal activities were being conducted on the premises. Multiple arrests are expected.`
          : `A ${businessType} in ${districtName} was destroyed under mysterious circumstances. ` +
            `Investigators have not ruled out arson or rival involvement. No casualties have been reported.`,
        districtId,
        playerId,
        { businessType, reason, severity: 7, isBreaking: reason === 'raided' }
      );

      // Create witnessed event for dramatic closures
      await createWitnessedEvent({
        eventType: 'business_closure',
        actorPlayerId: playerId,
        districtId,
        description: `${playerName}'s ${businessType} was ${reason === 'raided' ? 'raided by police' : 'destroyed'}`,
        severity: 7,
        metadata: { businessType, reason }
      });
    }

  } catch (error) {
    console.error('onBusinessClosed integration error:', error);
  }
}

// =============================================================================
// HEIST INTEGRATION
// =============================================================================

export async function onHeistExecuted(data: HeistEventData): Promise<void> {
  const { crewId, districtId, take, success, heistType, participantIds, targetName = 'undisclosed target' } = data;

  try {
    const crewName = await getCrewName(crewId);
    const districtName = await getDistrictName(districtId);

    // 1. Log district event
    await logDistrictEvent({
      eventType: 'heist_executed',
      districtId,
      crewId,
      severity: success ? (take >= 100000 ? 10 : 8) : 5,
      metadata: { crewName, heistType, take, success, targetName, districtName }
    });

    // 2. Modify reputation for all participants
    for (const participantId of participantIds) {
      const repChange = success ? Math.min(10, Math.floor(take / 20000) + 3) : -2;
      const fearChange = success ? Math.floor(repChange * 0.7) : -1;
      await modifyReputation(participantId, 'district', districtId, { respect: repChange, fear: fearChange }, success ? 'heist_success' : 'heist_failure');

      if (success) {
        await updateLifeChapterProgress(participantId, 'heist_executed');
      }
    }

    // 3. Create witnessed event
    await createWitnessedEvent({
      eventType: 'heist_executed',
      districtId,
      description: success
        ? `${crewName} executed a flawless ${heistType}, scoring $${take.toLocaleString()} from ${targetName}`
        : `${crewName}'s ${heistType} on ${targetName} ended in disaster`,
      severity: success ? Math.min(10, 7 + Math.floor(take / 50000)) : 6,
      metadata: { crewId, heistType, take, success }
    });

    // 4. Generate news
    if (success || take >= 50000) {
      const successHeadlines = [
        `HEIST OF THE YEAR: ${targetName} Hit for $${take.toLocaleString()}`,
        `Master Criminals Strike ${targetName} in Daring ${heistType}`,
        `${districtName} Heist: $${take.toLocaleString()} Vanishes Without a Trace`
      ];

      const failHeadlines = [
        `BOTCHED JOB: ${heistType} Goes Wrong at ${targetName}`,
        `Failed Heist Attempt Leaves ${targetName} on High Alert`,
        `Amateur Hour: Bungled ${heistType} in ${districtName}`
      ];

      const headlines = success ? successHeadlines : failHeadlines;

      await generateNewsArticle(
        'crime',
        headlines[Math.floor(Math.random() * headlines.length)],
        success
          ? `In what authorities are calling one of the most sophisticated crimes in recent memory, ` +
            `${targetName} was hit for an estimated $${take.toLocaleString()} in a ${heistType}. ` +
            `The perpetrators left no trace and police have no leads. Security experts are baffled.`
          : `An attempted ${heistType} at ${targetName} was foiled when ${['alarms triggered', 'security responded', 'an accomplice panicked'][Math.floor(Math.random() * 3)]}. ` +
            `The suspects fled empty-handed. Police are reviewing security footage.`,
        districtId,
        null,
        { heistType, take, success, severity: success ? 9 : 6, isBreaking: success && take >= 100000 }
      );
    }

    // 5. Record landmark for massive heists
    if (success && take >= 250000) {
      await recordLandmarkEvent(
        districtId,
        participantIds[0], // Credit lead participant
        'major_heist',
        `The Great ${targetName} Heist`,
        `${crewName} executed one of the biggest heists in history, stealing $${take.toLocaleString()} from ${targetName} in a ${heistType}`,
        `${targetName} Heist Memorial`
      );
    }

  } catch (error) {
    console.error('onHeistExecuted integration error:', error);
  }
}

// =============================================================================
// DEBT INTEGRATION
// =============================================================================

export async function onDebtAction(data: DebtEventData): Promise<void> {
  const { creditorId, debtorId, amount, debtType, action, newCreditorId } = data;

  try {
    const creditorName = await getPlayerName(creditorId);
    const debtorName = await getPlayerName(debtorId);

    // Get debtor's current district for events
    const debtorLocation = await pool.query(
      'SELECT current_district_id FROM players WHERE id = $1',
      [debtorId]
    );
    const districtId = debtorLocation.rows[0]?.current_district_id;

    // 1. Handle different debt actions
    switch (action) {
      case 'created':
        // Log event to world_events table (debt events don't fit district ecosystem)
        if (districtId) {
          await pool.query(
            `INSERT INTO world_events (event_type, district_id, caused_by_player_id, title, description, significance, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              'debt_created',
              districtId,
              creditorId,
              'Debt Extended',
              `${creditorName} extended a ${debtType} worth $${amount.toLocaleString()} to ${debtorName}`,
              amount >= 50000 ? 6 : 4,
              JSON.stringify({ debtType, amount, debtorId, debtorName })
            ]
          );
        }

        // Reputation effects
        if (districtId) {
          await modifyReputation(creditorId, 'district', districtId, { trust: 1 }, 'debt_extended');
        }

        await updateLifeChapterProgress(creditorId, 'debt_created');
        break;

      case 'called_in':
        // Emit WebSocket notification to debtor
        emitNarrativeEvent('debt_called_in', {
          creditorId,
          creditorName,
          debtorId,
          amount,
          debtType
        });

        // News for large debts being called
        if (amount >= 25000) {
          await generateNewsArticle(
            'economy',
            `Debt Collector Cometh: $${amount.toLocaleString()} ${debtType} Called In`,
            `Word on the street is that a significant ${debtType} has been called in. ` +
            `The debtor reportedly owes $${amount.toLocaleString()} and has limited time to pay up. ` +
            `Failure to comply could have "severe consequences," sources say.`,
            districtId,
            null,
            { amount, debtType }
          );
        }
        break;

      case 'fulfilled':
        if (districtId) {
          await modifyReputation(debtorId, 'district', districtId, { trust: 2, respect: 1 }, 'debt_honored');
        }
        break;

      case 'defaulted':
        // Major reputation hit for defaulting
        if (districtId) {
          await modifyReputation(debtorId, 'district', districtId, { trust: -5, respect: -3 }, 'debt_defaulted');
        }

        // News about default
        if (amount >= 10000) {
          await generateNewsArticle(
            'economy',
            `DEADBEAT: $${amount.toLocaleString()} Debt Goes Unpaid`,
            `A $${amount.toLocaleString()} ${debtType} has gone into default after the debtor failed to pay. ` +
            `The creditor is said to be "exploring options" for collection. ` +
            `This marks another entry in the growing list of street debts gone bad.`,
            districtId,
            null,
            { amount, debtType, severity: 6 }
          );
        }
        break;

      case 'transferred':
        if (newCreditorId) {
          const newCreditorName = await getPlayerName(newCreditorId);

          emitNarrativeEvent('debt_transferred', {
            originalCreditorId: creditorId,
            newCreditorId,
            newCreditorName,
            debtorId,
            amount,
            debtType
          });

          await updateLifeChapterProgress(creditorId, 'debt_traded');
        }
        break;

      case 'forgiven':
        if (districtId) {
          await modifyReputation(creditorId, 'district', districtId, { respect: 3, trust: 2 }, 'debt_forgiven');
        }
        break;
    }

  } catch (error) {
    console.error('onDebtAction integration error:', error);
  }
}

// =============================================================================
// SUCCESSION INTEGRATION
// =============================================================================

export async function onSuccessionTriggered(data: SuccessionEventData): Promise<void> {
  const { playerId, heirId, dynastyId, endingType, generation, legacyScore } = data;

  try {
    const playerName = await getPlayerName(playerId);
    const heirName = heirId ? await getPlayerName(heirId) : null;

    // Get player's main district
    const playerLocation = await pool.query(
      'SELECT current_district_id FROM players WHERE id = $1',
      [playerId]
    );
    const districtId = playerLocation.rows[0]?.current_district_id;

    // 1. Log to world_events table (succession events are world-level, not district events)
    if (districtId) {
      await pool.query(
        `INSERT INTO world_events (event_type, district_id, caused_by_player_id, title, description, significance, is_landmark, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'succession_triggered',
          districtId,
          playerId,
          `${playerName}'s ${endingType === 'death' ? 'Passing' : 'Succession'}`,
          `${playerName} ${endingType === 'death' ? 'has passed away' : 'stepped down'}${heirName ? `, succeeded by ${heirName}` : ''}`,
          8,
          generation >= 2,
          JSON.stringify({ endingType, generation, legacyScore, heirId, heirName })
        ]
      );
    }

    // 2. Generate news
    const endingDescriptions: Record<string, string> = {
      death: `has passed away after a life in the streets`,
      retirement: `has announced their retirement from the game`,
      imprisonment: `has been sentenced to a lengthy prison term`,
      exile: `has fled the city, never to return`,
      betrayal: `was eliminated by their own crew`
    };

    const headline = heirName
      ? `END OF AN ERA: ${playerName} ${endingType === 'death' ? 'Dead' : 'Out'}, ${heirName} Takes Over`
      : `DYNASTY ENDS: ${playerName} ${endingType.charAt(0).toUpperCase() + endingType.slice(1)}`;

    await generateNewsArticle(
      'player',
      headline,
      `${playerName}, a Generation ${generation} figure with a legacy score of ${legacyScore}, ` +
      `${endingDescriptions[endingType] || 'has left the scene'}. ` +
      `${heirName
        ? `Their heir, ${heirName}, will inherit their empire and continue the dynasty. `
        : `With no heir to continue their legacy, their empire will be divided among rivals. `}` +
      `The streets will remember ${playerName}'s name.`,
      districtId,
      playerId,
      { endingType, generation, legacyScore, heirId, isBreaking: true, severity: 9 }
    );

    // 3. Emit WebSocket notification
    emitNarrativeEvent('succession_triggered', {
      playerId,
      playerName,
      heirId,
      heirName,
      endingType,
      generation,
      legacyScore
    });

    // 4. Record landmark for high legacy scores
    if (legacyScore >= 1000) {
      await recordLandmarkEvent(
        districtId,
        playerId,
        'dynasty_landmark',
        `The ${playerName} Legacy`,
        `${playerName} achieved legendary status over ${generation} generation(s) with a legacy score of ${legacyScore}`,
        `${playerName} Memorial`
      );

      emitNarrativeEvent('legacy_milestone', {
        playerId,
        playerName,
        milestone: 'legendary_status',
        legacyScore,
        generation
      });
    }

    // 5. Record dynasty achievement
    if (generation >= 3) {
      await pool.query(
        `INSERT INTO dynasty_achievements (dynasty_id, achievement_type, achievement_name, achieved_at, metadata)
         VALUES ($1, 'multi_generation', $2, NOW(), $3)
         ON CONFLICT DO NOTHING`,
        [
          dynastyId,
          `${generation} Generation Dynasty`,
          JSON.stringify({ playerId, generation, legacyScore })
        ]
      );
    }

  } catch (error) {
    console.error('onSuccessionTriggered integration error:', error);
  }
}

// =============================================================================
// CHAPTER TRANSITION INTEGRATION
// =============================================================================

export async function onChapterTransition(
  playerId: string,
  fromChapter: string,
  toChapter: string,
  age: number
): Promise<void> {
  try {
    const playerName = await getPlayerName(playerId);

    // Get player's district
    const playerLocation = await pool.query(
      'SELECT current_district_id FROM players WHERE id = $1',
      [playerId]
    );
    const districtId = playerLocation.rows[0]?.current_district_id;

    // Emit WebSocket event
    emitNarrativeEvent('chapter_transition', {
      playerId,
      playerName,
      fromChapter,
      toChapter,
      age
    });

    // Log event for significant transitions
    const significantChapters = ['established_boss', 'aging_legend', 'final_days'];
    if (significantChapters.includes(toChapter) && districtId) {
      const chapterTitles: Record<string, string> = {
        established_boss: `${playerName} Becomes a Boss`,
        aging_legend: `${playerName} Enters Legend Status`,
        final_days: `${playerName}'s Final Chapter Begins`
      };

      // Log to world_events table (chapter transitions are world-level)
      await pool.query(
        `INSERT INTO world_events (event_type, district_id, caused_by_player_id, title, description, significance, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'chapter_transition',
          districtId,
          playerId,
          chapterTitles[toChapter] || 'Life Chapter Change',
          `${playerName} entered a new life chapter`,
          toChapter === 'final_days' ? 7 : 5,
          JSON.stringify({ fromChapter, toChapter, age })
        ]
      );

      // Generate news for becoming a boss or legend
      if (toChapter === 'established_boss' || toChapter === 'aging_legend') {
        await generateNewsArticle(
          'player',
          toChapter === 'established_boss'
            ? `Rising Star: ${playerName} Solidifies Power at Age ${age}`
            : `Living Legend: ${playerName} Achieves Legendary Status`,
          toChapter === 'established_boss'
            ? `${playerName} has cemented their position as a true boss in the criminal underworld. ` +
              `At age ${age}, they've built an empire that commands respect across the city.`
            : `At ${age} years old, ${playerName} has achieved what few ever manage: legendary status. ` +
              `Their influence and legacy will be felt for generations to come.`,
          districtId,
          playerId,
          { fromChapter, toChapter, age }
        );
      }
    }

  } catch (error) {
    console.error('onChapterTransition integration error:', error);
  }
}

// =============================================================================
// WITNESS OPPORTUNITY BROADCAST
// =============================================================================

export async function broadcastWitnessOpportunity(
  eventId: string,
  districtId: string,
  eventType: string,
  description: string,
  expiresAt: Date
): Promise<void> {
  try {
    // Get players in the district who could witness
    const potentialWitnesses = await pool.query(
      `SELECT id, username FROM players
       WHERE current_district_id = $1
       AND last_active > NOW() - INTERVAL '5 minutes'`,
      [districtId]
    );

    for (const witness of potentialWitnesses.rows) {
      emitNarrativeEvent('witness_opportunity', {
        playerId: witness.id,
        eventId,
        eventType,
        description,
        districtId,
        expiresAt: expiresAt.toISOString()
      });
    }

  } catch (error) {
    console.error('broadcastWitnessOpportunity error:', error);
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
  getPlayerName,
  getCrewName,
  getDistrictName,
  generateNewsArticle,
  recordLandmarkEvent,
  updateLifeChapterProgress
};
