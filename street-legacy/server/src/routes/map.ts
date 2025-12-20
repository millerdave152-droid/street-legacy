import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All map routes require auth
router.use(authMiddleware);

// Toronto district boundaries (simplified polygons)
const TORONTO_DISTRICTS: Record<string, { coordinates: [number, number][]; centerLat: number; centerLng: number; color: string }> = {
  'Downtown Core': {
    coordinates: [
      [43.6426, -79.4002], [43.6426, -79.3662], [43.6626, -79.3662],
      [43.6626, -79.3862], [43.6726, -79.3862], [43.6726, -79.4002]
    ],
    centerLat: 43.6532,
    centerLng: -79.3832,
    color: '#ef4444'
  },
  'Kensington Market': {
    coordinates: [
      [43.6526, -79.4062], [43.6526, -79.3962], [43.6626, -79.3962],
      [43.6626, -79.4062]
    ],
    centerLat: 43.6576,
    centerLng: -79.4012,
    color: '#f97316'
  },
  'Scarborough': {
    coordinates: [
      [43.7300, -79.2500], [43.7300, -79.1800], [43.7800, -79.1800],
      [43.7800, -79.2000], [43.8000, -79.2000], [43.8000, -79.2500]
    ],
    centerLat: 43.7731,
    centerLng: -79.2577,
    color: '#22c55e'
  },
  'York': {
    coordinates: [
      [43.6800, -79.4800], [43.6800, -79.4200], [43.7200, -79.4200],
      [43.7200, -79.4800]
    ],
    centerLat: 43.7000,
    centerLng: -79.4500,
    color: '#a855f7'
  },
  'Etobicoke': {
    coordinates: [
      [43.6200, -79.5800], [43.6200, -79.4800], [43.7000, -79.4800],
      [43.7000, -79.5200], [43.7400, -79.5200], [43.7400, -79.5800]
    ],
    centerLat: 43.6205,
    centerLng: -79.5132,
    color: '#3b82f6'
  },
  'North York': {
    coordinates: [
      [43.7200, -79.4500], [43.7200, -79.3500], [43.7800, -79.3500],
      [43.7800, -79.4500]
    ],
    centerLat: 43.7615,
    centerLng: -79.4111,
    color: '#eab308'
  },
  'East York': {
    coordinates: [
      [43.6800, -79.3300], [43.6800, -79.2900], [43.7200, -79.2900],
      [43.7200, -79.3300]
    ],
    centerLat: 43.6910,
    centerLng: -79.3280,
    color: '#0ea5e9'
  },
  'Parkdale': {
    coordinates: [
      [43.6326, -79.4462], [43.6326, -79.4162], [43.6526, -79.4162],
      [43.6526, -79.4462]
    ],
    centerLat: 43.6390,
    centerLng: -79.4395,
    color: '#ec4899'
  }
};

// Sample Toronto locations (POIs)
const TORONTO_LOCATIONS = [
  // Downtown Core
  { name: 'Union Station', type: 'safe_house', lat: 43.6453, lng: -79.3806, district: 'Downtown Core', description: 'Major transit hub - good for quick getaways', minLevel: 1 },
  { name: 'CN Tower', type: 'crime', lat: 43.6426, lng: -79.3871, district: 'Downtown Core', description: 'Tourist pickpocket paradise', minLevel: 3 },
  { name: 'Eaton Centre', type: 'shop', lat: 43.6544, lng: -79.3807, district: 'Downtown Core', description: 'Major shopping mall - good for shoplifting', minLevel: 1 },
  { name: 'Bay Street Bank', type: 'bank', lat: 43.6489, lng: -79.3797, district: 'Downtown Core', description: 'High security financial district bank', minLevel: 12 },
  { name: 'St. Michael\'s Hospital', type: 'hospital', lat: 43.6536, lng: -79.3775, district: 'Downtown Core', description: 'Emergency medical care', minLevel: 1 },
  { name: 'Fallsview Casino Downtown', type: 'casino', lat: 43.6511, lng: -79.3831, district: 'Downtown Core', description: 'Underground gambling den', minLevel: 5 },

  // Kensington Market
  { name: 'Augusta Avenue', type: 'crime', lat: 43.6545, lng: -79.4012, district: 'Kensington Market', description: 'Street dealer corner', minLevel: 2 },
  { name: 'Vintage Shop', type: 'shop', lat: 43.6560, lng: -79.4020, district: 'Kensington Market', description: 'Fence for stolen goods', minLevel: 3 },
  { name: 'Bellevue Square Safe House', type: 'safe_house', lat: 43.6555, lng: -79.3995, district: 'Kensington Market', description: 'Hidden apartment above a store', minLevel: 2 },
  { name: 'Market Alley', type: 'crime', lat: 43.6570, lng: -79.4030, district: 'Kensington Market', description: 'Mugging spot', minLevel: 4 },

  // Scarborough
  { name: 'Scarborough Town Centre', type: 'shop', lat: 43.7752, lng: -79.2578, district: 'Scarborough', description: 'Large mall with many targets', minLevel: 1 },
  { name: 'Malvern Safe House', type: 'safe_house', lat: 43.8060, lng: -79.2170, district: 'Scarborough', description: 'Quiet suburban hideout', minLevel: 1 },
  { name: 'Rouge Park Meeting Spot', type: 'gang_hq', lat: 43.8120, lng: -79.1680, district: 'Scarborough', description: 'Gang territory', minLevel: 5 },
  { name: 'Kingston Road Strip', type: 'crime', lat: 43.7420, lng: -79.2350, district: 'Scarborough', description: 'Car theft hotspot', minLevel: 5 },
  { name: 'Scarborough General', type: 'hospital', lat: 43.7690, lng: -79.2530, district: 'Scarborough', description: 'Local hospital', minLevel: 1 },

  // York
  { name: 'Jane and Finch', type: 'gang_hq', lat: 43.7650, lng: -79.5150, district: 'York', description: 'Major gang territory', minLevel: 6 },
  { name: 'Yorkdale Mall', type: 'shop', lat: 43.7254, lng: -79.4522, district: 'York', description: 'Upscale shopping - high value targets', minLevel: 4 },
  { name: 'Downsview Park Stash', type: 'safe_house', lat: 43.7420, lng: -79.4780, district: 'York', description: 'Secret stash location', minLevel: 3 },
  { name: 'Keele Street Corner', type: 'crime', lat: 43.7100, lng: -79.4600, district: 'York', description: 'Drug dealing spot', minLevel: 4 },

  // Etobicoke
  { name: 'Woodbine Racetrack', type: 'casino', lat: 43.7170, lng: -79.6030, district: 'Etobicoke', description: 'Legal gambling with back room games', minLevel: 5 },
  { name: 'Sherway Gardens', type: 'shop', lat: 43.6120, lng: -79.5570, district: 'Etobicoke', description: 'Upscale mall', minLevel: 3 },
  { name: 'Lakeshore Industrial', type: 'crime', lat: 43.6050, lng: -79.5200, district: 'Etobicoke', description: 'Warehouse heist location', minLevel: 8 },
  { name: 'Etobicoke Creek Safe House', type: 'safe_house', lat: 43.6300, lng: -79.5400, district: 'Etobicoke', description: 'Secluded hideout', minLevel: 2 },
  { name: 'Rexdale Crew HQ', type: 'gang_hq', lat: 43.7350, lng: -79.5800, district: 'Etobicoke', description: 'Local gang headquarters', minLevel: 6 },

  // North York
  { name: 'Yonge and Sheppard', type: 'crime', lat: 43.7615, lng: -79.4111, district: 'North York', description: 'Busy intersection for pickpockets', minLevel: 2 },
  { name: 'Fairview Mall', type: 'shop', lat: 43.7780, lng: -79.3460, district: 'North York', description: 'Large shopping center', minLevel: 2 },
  { name: 'North York Centre Safe House', type: 'safe_house', lat: 43.7680, lng: -79.4130, district: 'North York', description: 'Condo hideout', minLevel: 4 },
  { name: 'TD Bank North York', type: 'bank', lat: 43.7620, lng: -79.4100, district: 'North York', description: 'Branch bank - medium security', minLevel: 8 },
  { name: 'Sunnybrook Hospital', type: 'hospital', lat: 43.7232, lng: -79.3760, district: 'North York', description: 'Major hospital', minLevel: 1 },

  // East York
  { name: 'Danforth Avenue', type: 'crime', lat: 43.6840, lng: -79.3270, district: 'East York', description: 'Restaurant row - easy marks', minLevel: 2 },
  { name: 'Pape Village Shop', type: 'shop', lat: 43.6870, lng: -79.3370, district: 'East York', description: 'Local pawn shop', minLevel: 1 },
  { name: 'Leaside Safe House', type: 'safe_house', lat: 43.7050, lng: -79.3650, district: 'East York', description: 'Quiet residential hideout', minLevel: 2 },
  { name: 'East York Civic Centre', type: 'police', lat: 43.6910, lng: -79.3280, district: 'East York', description: 'Local police station - avoid!', minLevel: 1 },

  // Parkdale
  { name: 'Queen West Strip', type: 'crime', lat: 43.6410, lng: -79.4300, district: 'Parkdale', description: 'Street crime area', minLevel: 2 },
  { name: 'Parkdale Pawn', type: 'shop', lat: 43.6380, lng: -79.4420, district: 'Parkdale', description: 'Fence for stolen electronics', minLevel: 2 },
  { name: 'Roncesvalles Safe House', type: 'safe_house', lat: 43.6440, lng: -79.4480, district: 'Parkdale', description: 'Above a Polish restaurant', minLevel: 1 },
  { name: 'Lake Shore Crew', type: 'gang_hq', lat: 43.6350, lng: -79.4350, district: 'Parkdale', description: 'Local street gang', minLevel: 4 },

  // Additional locations to reach 50+
  { name: 'St. Lawrence Market', type: 'crime', lat: 43.6487, lng: -79.3715, district: 'Downtown Core', description: 'Weekend pickpocket spot', minLevel: 1 },
  { name: 'Rogers Centre', type: 'crime', lat: 43.6414, lng: -79.3894, district: 'Downtown Core', description: 'Game day theft opportunities', minLevel: 3 },
  { name: 'Chinatown', type: 'shop', lat: 43.6520, lng: -79.3980, district: 'Downtown Core', description: 'Underground goods market', minLevel: 2 },
  { name: 'Distillery District', type: 'crime', lat: 43.6503, lng: -79.3596, district: 'Downtown Core', description: 'Tourist trap', minLevel: 2 },
  { name: 'Harbourfront', type: 'safe_house', lat: 43.6385, lng: -79.3817, district: 'Downtown Core', description: 'Waterfront hideout', minLevel: 3 },
  { name: 'BMO Field Area', type: 'crime', lat: 43.6332, lng: -79.4186, district: 'Parkdale', description: 'Event day opportunities', minLevel: 2 },
  { name: 'High Park', type: 'safe_house', lat: 43.6465, lng: -79.4637, district: 'Parkdale', description: 'Park bench meetings', minLevel: 1 },
  { name: 'Bloor West Village', type: 'shop', lat: 43.6500, lng: -79.4780, district: 'York', description: 'Upscale shops to hit', minLevel: 3 },
  { name: 'Humber Bay', type: 'crime', lat: 43.6160, lng: -79.4780, district: 'Etobicoke', description: 'Condo break-ins', minLevel: 5 },
  { name: 'Pearson Airport Area', type: 'crime', lat: 43.6777, lng: -79.6248, district: 'Etobicoke', description: 'Cargo theft zone', minLevel: 10 },
  { name: 'Finch Station', type: 'crime', lat: 43.7807, lng: -79.4149, district: 'North York', description: 'Transit crime spot', minLevel: 2 },
  { name: 'Don Mills Centre', type: 'shop', lat: 43.7430, lng: -79.3490, district: 'North York', description: 'Shopping plaza', minLevel: 2 },
  { name: 'Agincourt', type: 'safe_house', lat: 43.7880, lng: -79.2810, district: 'Scarborough', description: 'Suburban safe house', minLevel: 2 },
  { name: 'Morningside Park', type: 'gang_hq', lat: 43.7850, lng: -79.1950, district: 'Scarborough', description: 'Outdoor meeting spot', minLevel: 4 },
];

// GET /api/map/districts - Get all districts with boundaries
router.get('/districts', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, city, difficulty, police_presence, wealth FROM districts ORDER BY name`
    );

    const districts = result.rows.map(d => {
      const geoData = TORONTO_DISTRICTS[d.name] || {
        coordinates: [[43.65, -79.38], [43.65, -79.37], [43.66, -79.37], [43.66, -79.38]],
        centerLat: 43.6532,
        centerLng: -79.3832,
        color: '#6b7280'
      };

      return {
        id: d.id,
        name: d.name,
        difficulty: d.difficulty,
        policePresence: d.police_presence,
        wealth: d.wealth,
        coordinates: geoData.coordinates,
        centerLat: geoData.centerLat,
        centerLng: geoData.centerLng,
        color: geoData.color
      };
    });

    res.json({ success: true, data: { districts } });
  } catch (error) {
    console.error('Map districts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch districts' });
  }
});

// GET /api/map/locations - Get all locations/POIs
router.get('/locations', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const playerResult = await pool.query('SELECT level FROM players WHERE id = $1', [playerId]);
    const playerLevel = playerResult.rows[0]?.level || 1;

    // Get district IDs
    const districtResult = await pool.query('SELECT id, name FROM districts');
    const districtMap: Record<string, number> = {};
    districtResult.rows.forEach(d => districtMap[d.name] = d.id);

    const locations = TORONTO_LOCATIONS.map((loc, idx) => ({
      id: idx + 1,
      name: loc.name,
      type: loc.type,
      lat: loc.lat,
      lng: loc.lng,
      districtId: districtMap[loc.district] || 1,
      districtName: loc.district,
      description: loc.description,
      minLevel: loc.minLevel,
      isActive: playerLevel >= loc.minLevel
    }));

    res.json({ success: true, data: { locations } });
  } catch (error) {
    console.error('Map locations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch locations' });
  }
});

// GET /api/map/player-location - Get player's current location
router.get('/player-location', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT p.current_district, p.location_lat, p.location_lng, p.last_move_at,
              d.name as district_name
       FROM players p
       LEFT JOIN districts d ON p.current_district = d.id
       WHERE p.id = $1`,
      [playerId]
    );

    const player = result.rows[0];
    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    // Default to district center if no specific location
    const districtGeo = TORONTO_DISTRICTS[player.district_name] || TORONTO_DISTRICTS['Downtown Core'];

    const location = {
      lat: player.location_lat || districtGeo.centerLat,
      lng: player.location_lng || districtGeo.centerLng,
      districtId: player.current_district,
      districtName: player.district_name || 'Downtown Core',
      lastMoveAt: player.last_move_at
    };

    res.json({ success: true, data: { location } });
  } catch (error) {
    console.error('Player location error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch player location' });
  }
});

// POST /api/map/travel - Travel to a location
router.post('/travel', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { locationId } = req.body;

    // Get player's current location
    const playerResult = await pool.query(
      `SELECT level, location_lat, location_lng, current_district, last_move_at, stamina, is_master
       FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Find the target location
    const location = TORONTO_LOCATIONS[locationId - 1];
    if (!location) {
      res.status(400).json({ success: false, error: 'Invalid location' });
      return;
    }

    // Check level requirement
    if (player.level < location.minLevel && !player.is_master) {
      res.status(400).json({ success: false, error: `Requires level ${location.minLevel}` });
      return;
    }

    // Calculate travel time (1 minute per km)
    const currentLat = player.location_lat || 43.6532;
    const currentLng = player.location_lng || -79.3832;
    const distance = calculateDistance(currentLat, currentLng, location.lat, location.lng);
    const travelMinutes = Math.ceil(distance);
    const staminaCost = Math.ceil(distance * 2); // 2 stamina per km

    // Check stamina (master accounts bypass)
    if (player.stamina < staminaCost && !player.is_master) {
      res.status(400).json({ success: false, error: `Not enough stamina. Need ${staminaCost}, have ${player.stamina}` });
      return;
    }

    // Get district ID for the new location
    const districtResult = await pool.query('SELECT id FROM districts WHERE name = $1', [location.district]);
    const newDistrictId = districtResult.rows[0]?.id || player.current_district;

    // Update player location
    const newStamina = player.is_master ? player.stamina : player.stamina - staminaCost;
    await pool.query(
      `UPDATE players SET
       location_lat = $1, location_lng = $2, current_district = $3,
       last_move_at = NOW(), stamina = $4
       WHERE id = $5`,
      [location.lat, location.lng, newDistrictId, newStamina, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Traveled to ${location.name} (${travelMinutes} min, ${staminaCost} stamina)`,
        newLocation: {
          lat: location.lat,
          lng: location.lng,
          districtId: newDistrictId,
          districtName: location.district,
          lastMoveAt: new Date().toISOString()
        },
        staminaUsed: staminaCost,
        travelTime: travelMinutes
      }
    });
  } catch (error) {
    console.error('Travel error:', error);
    res.status(500).json({ success: false, error: 'Failed to travel' });
  }
});

// Helper function to calculate distance between two points (in km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router;
