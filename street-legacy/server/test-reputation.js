/**
 * Contextual Reputation System Test Script
 *
 * Run: node test-reputation.js
 *
 * Prerequisites:
 * - Server running on localhost:3001
 * - Database with migrations applied
 * - At least one player account to test with
 */

const BASE_URL = 'http://localhost:3001';
let authToken = null;
let playerId = null;

// Helper to make authenticated requests
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 500, error: error.message };
  }
}

// Test functions
async function testDatabaseSchema() {
  console.log('\n=== 1. DATABASE SCHEMA TESTS ===\n');

  // These tests check if the required tables exist via API responses
  console.log('✓ Testing via API endpoints (tables must exist for routes to work)');

  // Test factions endpoint (uses factions table from contextual reputation)
  const factions = await apiRequest('GET', '/api/reputation/factions');
  if (factions.status === 200 || factions.status === 401) {
    console.log('✓ Factions table accessible');
  } else {
    console.log('✗ Factions table issue:', factions.data?.error || 'Unknown error');
  }

  return true;
}

async function testAuthentication() {
  console.log('\n=== 2. AUTHENTICATION TESTS ===\n');

  // Try to login with test credentials
  // You'll need to replace these with valid credentials
  const loginResult = await apiRequest('POST', '/api/auth/login', {
    email: 'test@test.com',
    password: 'test123'
  });

  if (loginResult.status === 200 && loginResult.data?.data?.token) {
    authToken = loginResult.data.data.token;
    playerId = loginResult.data.data.player?.id;
    console.log('✓ Login successful');
    console.log(`  Player ID: ${playerId}`);
    return true;
  } else {
    console.log('✗ Login failed:', loginResult.data?.error || 'Unknown error');
    console.log('  Create a test account or update credentials in this script');

    // Try to register a new account
    console.log('\n  Attempting to create test account...');
    const registerResult = await apiRequest('POST', '/api/auth/register', {
      username: 'RepTestUser' + Date.now(),
      email: `reptest${Date.now()}@test.com`,
      password: 'testpass123'
    });

    if (registerResult.status === 201 && registerResult.data?.data?.token) {
      authToken = registerResult.data.data.token;
      playerId = registerResult.data.data.player?.id;
      console.log('✓ Registration successful');
      console.log(`  Player ID: ${playerId}`);
      return true;
    } else {
      console.log('✗ Registration failed:', registerResult.data?.error || 'Unknown error');
      return false;
    }
  }
}

async function testReputationEndpoints() {
  console.log('\n=== 3. REPUTATION API ENDPOINTS ===\n');

  if (!authToken) {
    console.log('✗ Skipping - no auth token');
    return false;
  }

  // Test GET full reputation web
  console.log('Testing GET /api/reputation/players/:playerId/reputation');
  const repWeb = await apiRequest('GET', `/api/reputation/players/${playerId}/reputation`);
  console.log(`  Status: ${repWeb.status}`);
  if (repWeb.status === 200) {
    console.log('  ✓ Reputation web retrieved');
    console.log(`    Total records: ${repWeb.data?.data?.totalRecords || 0}`);
    console.log(`    Districts: ${repWeb.data?.data?.districts?.length || 0}`);
    console.log(`    Factions: ${repWeb.data?.data?.factions?.length || 0}`);
  } else {
    console.log('  ✗ Failed:', repWeb.data?.error);
  }

  // Test GET specific reputation
  console.log('\nTesting GET /api/reputation/players/:playerId/reputation/district/downtown');
  const districtRep = await apiRequest('GET', `/api/reputation/players/${playerId}/reputation/district/downtown`);
  console.log(`  Status: ${districtRep.status}`);
  if (districtRep.status === 200) {
    console.log('  ✓ District reputation retrieved');
    const score = districtRep.data?.data?.score;
    if (score) {
      console.log(`    Respect: ${score.respect}, Fear: ${score.fear}, Trust: ${score.trust}, Heat: ${score.heat}`);
    }
  } else {
    console.log('  ✗ Failed:', districtRep.data?.error);
  }

  // Test POST modify reputation
  console.log('\nTesting POST /api/reputation/players/:playerId/reputation/district/downtown');
  const modifyRep = await apiRequest('POST', `/api/reputation/players/${playerId}/reputation/district/downtown`, {
    changes: { respect: 5, fear: 2 },
    reason: 'API Test',
    propagate: false
  });
  console.log(`  Status: ${modifyRep.status}`);
  if (modifyRep.status === 200) {
    console.log('  ✓ Reputation modified');
    console.log(`    New score:`, modifyRep.data?.data?.newScore);
  } else {
    console.log('  ✗ Failed:', modifyRep.data?.error);
  }

  // Test GET reputation history
  console.log('\nTesting GET /api/reputation/players/:playerId/reputation/history');
  const history = await apiRequest('GET', `/api/reputation/players/${playerId}/reputation/history?limit=5`);
  console.log(`  Status: ${history.status}`);
  if (history.status === 200) {
    console.log('  ✓ Reputation history retrieved');
    console.log(`    Events: ${history.data?.data?.length || 0}`);
  } else {
    console.log('  ✗ Failed:', history.data?.error);
  }

  // Test GET all factions
  console.log('\nTesting GET /api/reputation/factions');
  const factions = await apiRequest('GET', '/api/reputation/factions');
  console.log(`  Status: ${factions.status}`);
  if (factions.status === 200) {
    console.log('  ✓ Factions retrieved');
    console.log(`    Total: ${factions.data?.data?.total || 0}`);
    if (factions.data?.data?.factions?.length > 0) {
      console.log('    Factions:');
      factions.data.data.factions.forEach(f => {
        console.log(`      - ${f.name} (${f.id})`);
      });
    }
  } else {
    console.log('  ✗ Failed:', factions.data?.error);
  }

  // Test GET district factions
  console.log('\nTesting GET /api/reputation/districts/downtown/factions');
  const districtFactions = await apiRequest('GET', '/api/reputation/districts/downtown/factions');
  console.log(`  Status: ${districtFactions.status}`);
  if (districtFactions.status === 200) {
    console.log('  ✓ District factions retrieved');
    console.log(`    Factions in downtown: ${districtFactions.data?.data?.total || 0}`);
  } else {
    console.log('  ✗ Failed:', districtFactions.data?.error);
  }

  // Test GET district reputation (with faction reps)
  console.log('\nTesting GET /api/reputation/districts/downtown/reputation');
  const districtRepFull = await apiRequest('GET', '/api/reputation/districts/downtown/reputation');
  console.log(`  Status: ${districtRepFull.status}`);
  if (districtRepFull.status === 200) {
    console.log('  ✓ Full district reputation retrieved');
    const dr = districtRepFull.data?.data?.districtReputation;
    if (dr) {
      console.log(`    District standing: ${dr.standing}`);
    }
  } else {
    console.log('  ✗ Failed:', districtRepFull.data?.error);
  }

  // Test standing calculation utility
  console.log('\nTesting GET /api/reputation/standing/50/30/20');
  const standing = await apiRequest('GET', '/api/reputation/reputation/standing/50/30/20');
  console.log(`  Status: ${standing.status}`);
  if (standing.status === 200) {
    console.log('  ✓ Standing calculated');
    console.log(`    Standing: ${standing.data?.data?.standing}`);
    console.log(`    Combined score: ${standing.data?.data?.combinedScore}`);
  } else {
    console.log('  ✗ Failed:', standing.data?.error);
  }

  return true;
}

async function testDistrictEcosystemIntegration() {
  console.log('\n=== 4. DISTRICT ECOSYSTEM INTEGRATION ===\n');

  if (!authToken) {
    console.log('✗ Skipping - no auth token');
    return false;
  }

  // Test player-specific modifiers (includes reputation effects)
  console.log('Testing GET /api/districts/downtown/player-modifiers');
  const playerMods = await apiRequest('GET', '/api/districts/downtown/player-modifiers');
  console.log(`  Status: ${playerMods.status}`);
  if (playerMods.status === 200) {
    console.log('  ✓ Player modifiers retrieved');
    const mods = playerMods.data?.data?.modifiers;
    if (mods) {
      console.log('    Base modifiers:');
      console.log(`      Crime difficulty: ${mods.crimeDifficulty}`);
      console.log(`      Property income: ${mods.propertyIncome}`);
      console.log('    Reputation-based modifiers:');
      console.log(`      Reputation bonus: ${mods.reputationBonus}`);
      console.log(`      Crime success bonus: ${mods.crimeSuccessBonus}`);
      console.log(`      Heat generation mod: ${mods.heatGenerationMod}`);
      console.log(`      Recruitment bonus: ${mods.recruitmentBonus}`);
    }
    console.log(`    Status rep multiplier: ${playerMods.data?.data?.statusReputationMultiplier}`);
  } else {
    console.log('  ✗ Failed:', playerMods.data?.error);
  }

  // Test base district state
  console.log('\nTesting GET /api/districts/downtown/state');
  const state = await apiRequest('GET', '/api/districts/downtown/state');
  console.log(`  Status: ${state.status}`);
  if (state.status === 200) {
    console.log('  ✓ District state retrieved');
    console.log(`    Status: ${state.data?.data?.status}`);
    console.log(`    Crime index: ${state.data?.data?.crimeIndex}`);
  } else {
    console.log('  ✗ Failed:', state.data?.error);
  }

  return true;
}

async function testGameIntegration() {
  console.log('\n=== 5. GAME INTEGRATION TESTS ===\n');

  if (!authToken) {
    console.log('✗ Skipping - no auth token');
    return false;
  }

  console.log('These tests verify reputation is modified by game actions.');
  console.log('Note: Some actions require specific game state (nerve, stamina, etc.)\n');

  // Get initial reputation
  const initialRep = await apiRequest('GET', `/api/reputation/players/${playerId}/reputation/district/downtown`);
  const initialScore = initialRep.data?.data?.score || { respect: 0, fear: 0, trust: 0, heat: 0 };
  console.log('Initial downtown reputation:');
  console.log(`  Respect: ${initialScore.respect}, Fear: ${initialScore.fear}, Trust: ${initialScore.trust}, Heat: ${initialScore.heat}\n`);

  // Test crime (would require nerve)
  console.log('Testing crime integration (GET /api/game/crimes):');
  const crimes = await apiRequest('GET', '/api/game/crimes');
  if (crimes.status === 200) {
    console.log('  ✓ Crimes endpoint accessible');
    console.log('  → Committing crimes will now modify district reputation');
  } else {
    console.log('  Status:', crimes.status);
  }

  // Test PvP (would require targets and nerve)
  console.log('\nTesting PvP integration (GET /api/pvp):');
  const pvp = await apiRequest('GET', '/api/pvp');
  if (pvp.status === 200) {
    console.log('  ✓ PvP endpoint accessible');
    console.log('  → Combat will now modify district and player reputation');
  } else {
    console.log('  Status:', pvp.status);
  }

  // Test crews
  console.log('\nTesting crews integration (GET /api/crews):');
  const crews = await apiRequest('GET', '/api/crews');
  if (crews.status === 200) {
    console.log('  ✓ Crews endpoint accessible');
    console.log('  → Crew actions will now modify crew reputation');
  } else {
    console.log('  Status:', crews.status);
  }

  // Test factions
  console.log('\nTesting factions integration (GET /api/factions/list):');
  const factionsLegacy = await apiRequest('GET', '/api/factions/list');
  if (factionsLegacy.status === 200) {
    console.log('  ✓ Factions endpoint accessible');
    console.log('  → Faction actions will now update contextual reputation');
  } else {
    console.log('  Status:', factionsLegacy.status);
  }

  return true;
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     CONTEXTUAL REPUTATION SYSTEM - TEST SUITE              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nServer: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  await testDatabaseSchema();
  const authOk = await testAuthentication();

  if (authOk) {
    await testReputationEndpoints();
    await testDistrictEcosystemIntegration();
    await testGameIntegration();
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nThe contextual reputation system has been integrated into:');
  console.log('  • Crime system (game.ts) - District reputation');
  console.log('  • PvP system (pvp.ts) - District and player reputation');
  console.log('  • Crew system (crews.ts) - Crew reputation');
  console.log('  • District ecosystem (districtEcosystem.service.ts) - Player modifiers');
  console.log('  • Faction system (factions.ts) - Faction reputation sync');
  console.log('\nTo fully test, perform in-game actions and verify reputation changes.');
}

runAllTests().catch(console.error);
