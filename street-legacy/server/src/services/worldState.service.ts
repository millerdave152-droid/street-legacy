/**
 * World State Broadcasting Service
 *
 * Manages real-time broadcasts of world state changes to connected clients.
 * Handles district heat updates, market prices, and active world events.
 */

import pool from '../db/connection.js';
import { broadcast, sendToDistrict } from '../websocket/index.js';
import {
  WorldDistrictHeatUpdateEvent,
  WorldMarketPricesEvent,
  WorldEventStartedEvent,
  WorldEventEndedEvent,
  WorldNewsEvent,
  DistrictHeatChangedEvent,
} from '../websocket/events.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DistrictHeatData {
  id: number;
  name: string;
  heat: number;
  previousHeat?: number;
}

export interface MarketGood {
  id: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  previousBuyPrice?: number;
}

export interface WorldEvent {
  id: string;
  type: string;
  districtId?: number;
  districtName?: string;
  duration: number;
  description: string;
  startedAt: Date;
  endsAt: Date;
}

// ============================================================================
// WORLD STATE SERVICE
// ============================================================================

class WorldStateService {
  private lastHeatBroadcast: Date | null = null;
  private lastMarketBroadcast: Date | null = null;
  private cachedDistrictHeat: Map<number, number> = new Map();
  private activeEvents: Map<string, WorldEvent> = new Map();

  /**
   * Broadcast current district heat levels to all clients
   * Should be called periodically (e.g., every 5 minutes)
   */
  async broadcastDistrictHeat(): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT id, name, COALESCE(heat, 0) as heat
         FROM districts
         ORDER BY id`
      );

      const districts: Array<{
        id: number;
        name: string;
        heat: number;
        trend: 'rising' | 'falling' | 'stable';
      }> = result.rows.map(row => {
        const previousHeat = this.cachedDistrictHeat.get(row.id) || row.heat;
        const trend = row.heat > previousHeat ? 'rising' :
                      row.heat < previousHeat ? 'falling' : 'stable';

        // Update cache
        this.cachedDistrictHeat.set(row.id, row.heat);

        return {
          id: row.id,
          name: row.name,
          heat: row.heat,
          trend
        };
      });

      const event: WorldDistrictHeatUpdateEvent = {
        type: 'world:district_heat_update',
        timestamp: Date.now(),
        districts
      };

      broadcast(event);
      this.lastHeatBroadcast = new Date();
      console.log(`[WorldState] Broadcast district heat update to all clients`);
    } catch (error) {
      console.error('[WorldState] Failed to broadcast district heat:', error);
    }
  }

  /**
   * Broadcast market prices to all clients
   * Should be called periodically (e.g., every 15 minutes)
   */
  async broadcastMarketPrices(): Promise<void> {
    try {
      // Query market goods if table exists
      const result = await pool.query(
        `SELECT id, name, buy_price, sell_price, previous_buy_price
         FROM market_goods
         WHERE active = true
         ORDER BY name`
      ).catch(() => ({ rows: [] })); // Graceful fallback if table doesn't exist

      if (result.rows.length === 0) {
        // No market data available
        return;
      }

      const goods: Array<{
        id: string;
        name: string;
        buyPrice: number;
        sellPrice: number;
        trend: 'up' | 'down' | 'stable';
      }> = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        buyPrice: row.buy_price,
        sellPrice: row.sell_price,
        trend: row.buy_price > (row.previous_buy_price || row.buy_price) ? 'up' :
               row.buy_price < (row.previous_buy_price || row.buy_price) ? 'down' : 'stable'
      }));

      const event: WorldMarketPricesEvent = {
        type: 'world:market_prices',
        timestamp: Date.now(),
        goods
      };

      broadcast(event);
      this.lastMarketBroadcast = new Date();
      console.log(`[WorldState] Broadcast market prices to all clients`);
    } catch (error) {
      console.error('[WorldState] Failed to broadcast market prices:', error);
    }
  }

  /**
   * Broadcast active world events to all clients
   */
  async broadcastActiveEvents(): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT e.id, e.event_type, e.district_id, d.name as district_name,
                e.duration_minutes, e.description, e.started_at, e.ends_at
         FROM world_events e
         LEFT JOIN districts d ON e.district_id = d.id
         WHERE e.active = true AND e.ends_at > NOW()
         ORDER BY e.started_at DESC`
      ).catch(() => ({ rows: [] })); // Graceful fallback

      for (const row of result.rows) {
        const eventId = String(row.id);

        if (!this.activeEvents.has(eventId)) {
          // New event - broadcast start
          const event: WorldEventStartedEvent = {
            type: 'world:event_started',
            timestamp: Date.now(),
            eventId,
            eventType: row.event_type,
            districtId: row.district_id || undefined,
            districtName: row.district_name || undefined,
            duration: row.duration_minutes * 60 * 1000,
            description: row.description
          };

          broadcast(event);
          this.activeEvents.set(eventId, {
            id: eventId,
            type: row.event_type,
            districtId: row.district_id,
            districtName: row.district_name,
            duration: row.duration_minutes * 60 * 1000,
            description: row.description,
            startedAt: new Date(row.started_at),
            endsAt: new Date(row.ends_at)
          });
        }
      }

      // Check for ended events
      const activeIds = new Set(result.rows.map(r => String(r.id)));
      for (const [eventId, event] of this.activeEvents) {
        if (!activeIds.has(eventId)) {
          // Event ended
          const endedEvent: WorldEventEndedEvent = {
            type: 'world:event_ended',
            timestamp: Date.now(),
            eventId
          };
          broadcast(endedEvent);
          this.activeEvents.delete(eventId);
        }
      }
    } catch (error) {
      console.error('[WorldState] Failed to broadcast active events:', error);
    }
  }

  /**
   * Called when a player action changes district heat
   * Broadcasts heat change to players in that district
   */
  async onDistrictHeatChange(
    districtId: number,
    newHeat: number,
    delta: number,
    cause: 'criminal_activity' | 'police_raid' | 'time_decay' = 'criminal_activity'
  ): Promise<void> {
    try {
      const event: DistrictHeatChangedEvent = {
        type: 'district:heat_changed',
        timestamp: Date.now(),
        heat: newHeat,
        delta,
        cause
      };

      sendToDistrict(districtId, event);

      // Update cache
      this.cachedDistrictHeat.set(districtId, newHeat);

      console.log(`[WorldState] District ${districtId} heat changed by ${delta} (${cause})`);
    } catch (error) {
      console.error('[WorldState] Failed to broadcast heat change:', error);
    }
  }

  /**
   * Broadcast breaking news to all clients
   */
  broadcastNews(
    headline: string,
    category: 'crime' | 'economy' | 'politics' | 'social',
    significance: number,
    districtId?: number
  ): void {
    const event: WorldNewsEvent = {
      type: 'world:news',
      timestamp: Date.now(),
      headline,
      category,
      significance,
      districtId
    };

    broadcast(event);
    console.log(`[WorldState] Breaking news: ${headline}`);
  }

  /**
   * Start a new world event
   */
  async startWorldEvent(
    eventType: string,
    description: string,
    durationMinutes: number,
    districtId?: number
  ): Promise<string | null> {
    try {
      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      const result = await pool.query(
        `INSERT INTO world_events (event_type, district_id, duration_minutes, description, ends_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [eventType, districtId || null, durationMinutes, description, endsAt]
      );

      const eventId = String(result.rows[0].id);

      // Get district name if applicable
      let districtName: string | undefined;
      if (districtId) {
        const districtResult = await pool.query(
          `SELECT name FROM districts WHERE id = $1`,
          [districtId]
        );
        districtName = districtResult.rows[0]?.name;
      }

      // Broadcast event start
      const event: WorldEventStartedEvent = {
        type: 'world:event_started',
        timestamp: Date.now(),
        eventId,
        eventType,
        districtId,
        districtName,
        duration: durationMinutes * 60 * 1000,
        description
      };

      broadcast(event);

      // Track locally
      this.activeEvents.set(eventId, {
        id: eventId,
        type: eventType,
        districtId,
        districtName,
        duration: durationMinutes * 60 * 1000,
        description,
        startedAt: new Date(),
        endsAt
      });

      console.log(`[WorldState] World event started: ${eventType}`);
      return eventId;
    } catch (error) {
      console.error('[WorldState] Failed to start world event:', error);
      return null;
    }
  }

  /**
   * End a world event
   */
  async endWorldEvent(eventId: string, results?: { participants: number; rewards?: string }): Promise<void> {
    try {
      await pool.query(
        `UPDATE world_events SET active = false WHERE id = $1`,
        [eventId]
      );

      const event: WorldEventEndedEvent = {
        type: 'world:event_ended',
        timestamp: Date.now(),
        eventId,
        results
      };

      broadcast(event);
      this.activeEvents.delete(eventId);
      console.log(`[WorldState] World event ended: ${eventId}`);
    } catch (error) {
      console.error('[WorldState] Failed to end world event:', error);
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): {
    lastHeatBroadcast: Date | null;
    lastMarketBroadcast: Date | null;
    activeEventsCount: number;
    cachedDistrictsCount: number;
  } {
    return {
      lastHeatBroadcast: this.lastHeatBroadcast,
      lastMarketBroadcast: this.lastMarketBroadcast,
      activeEventsCount: this.activeEvents.size,
      cachedDistrictsCount: this.cachedDistrictHeat.size
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const worldState = new WorldStateService();
