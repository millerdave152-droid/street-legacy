import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// License cost and duration
const LICENSE_COST = 5000;
const LICENSE_DURATION_DAYS = 365;

// GET /api/business-fronts/types - Get available business types
router.get('/types', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info
    const playerResult = await pool.query(
      `SELECT level, influence FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all business types
    const typesResult = await pool.query(
      `SELECT * FROM business_front_types WHERE is_active = true ORDER BY base_setup_cost ASC`
    );

    const types = typesResult.rows.map(t => ({
      id: t.id,
      name: t.name,
      typeCode: t.type_code,
      description: t.description,
      setupCost: t.base_setup_cost,
      monthlyExpenses: t.monthly_expenses,
      baseLaunderingRate: t.base_laundering_rate,
      maxDailyLaundering: t.max_daily_laundering,
      minLegitimacy: t.min_legitimacy,
      requiredPropertyTypes: t.required_property_types,
      employeeSlots: t.employee_slots,
      baseEmployeeCost: t.base_employee_cost,
      taxRate: parseFloat(t.tax_rate),
      auditRiskMultiplier: parseFloat(t.audit_risk_multiplier),
      requiredLevel: t.required_level,
      requiredConnections: t.required_connections,
      icon: t.icon,
      canUnlock: player.level >= t.required_level && player.influence >= t.required_connections,
      meetsLevel: player.level >= t.required_level,
      meetsConnections: player.influence >= t.required_connections
    }));

    res.json({
      success: true,
      data: {
        types,
        playerLevel: player.level,
        playerConnections: player.influence
      }
    });
  } catch (error) {
    console.error('Get business types error:', error);
    res.status(500).json({ success: false, error: 'Failed to get business types' });
  }
});

// GET /api/business-fronts - Get player's business fronts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const businessesResult = await pool.query(
      `SELECT bf.*, bft.name as type_name, bft.type_code, bft.icon as type_icon,
              bft.base_laundering_rate, bft.max_daily_laundering, bft.tax_rate,
              bft.employee_slots, bft.monthly_expenses as base_expenses,
              op.custom_name as property_name, pl.name as property_listing_name,
              d.name as district_name
       FROM business_fronts bf
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       JOIN owned_properties op ON bf.property_id = op.id
       JOIN property_listings pl ON op.listing_id = pl.id
       JOIN districts d ON pl.district_id = d.id
       WHERE bf.owner_id = $1
       ORDER BY bf.created_at DESC`,
      [playerId]
    );

    // Get employee counts
    const employeesResult = await pool.query(
      `SELECT business_id, COUNT(*) as count, AVG(quality) as avg_quality
       FROM business_employees
       WHERE business_id IN (SELECT id FROM business_fronts WHERE owner_id = $1)
       GROUP BY business_id`,
      [playerId]
    );

    const employeeCounts: Record<number, { count: number; avgQuality: number }> = {};
    for (const e of employeesResult.rows) {
      employeeCounts[e.business_id] = {
        count: parseInt(e.count),
        avgQuality: parseFloat(e.avg_quality) || 50
      };
    }

    // Get pending laundering amounts
    const launderingResult = await pool.query(
      `SELECT business_id, SUM(dirty_amount) as pending
       FROM laundering_operations
       WHERE player_id = $1 AND status = 'processing'
       GROUP BY business_id`,
      [playerId]
    );

    const pendingLaundering: Record<number, number> = {};
    for (const l of launderingResult.rows) {
      pendingLaundering[l.business_id] = parseInt(l.pending);
    }

    const businesses = businessesResult.rows.map(b => {
      const empData = employeeCounts[b.id] || { count: 0, avgQuality: 50 };

      return {
        id: b.id,
        name: b.name,
        typeName: b.type_name,
        typeCode: b.type_code,
        typeIcon: b.type_icon,
        propertyId: b.property_id,
        propertyName: b.property_name || b.property_listing_name,
        districtName: b.district_name,
        legitimacyRating: b.legitimacy_rating,
        reputation: b.reputation,
        isOperational: b.is_operational,
        operatingHours: b.operating_hours,
        dailyCustomers: b.daily_customers,
        employeeCount: empData.count,
        employeeSlots: b.employee_slots,
        employeeQuality: Math.round(empData.avgQuality),
        hasLicense: b.has_license,
        licenseExpiresAt: b.license_expires_at,
        dirtyCashStored: b.dirty_cash_stored,
        cleanCashPending: b.clean_cash_pending,
        pendingLaundering: pendingLaundering[b.id] || 0,
        totalLaundered: b.total_laundered,
        baseLaunderingRate: b.base_laundering_rate,
        maxDailyLaundering: b.max_daily_laundering,
        monthlyExpenses: b.base_expenses,
        taxRate: parseFloat(b.tax_rate),
        isUnderInvestigation: b.is_under_investigation,
        auditFlags: b.audit_flags,
        lastAuditDate: b.last_audit_date,
        createdAt: b.created_at
      };
    });

    // Calculate totals
    const totalDirtyCash = businesses.reduce((sum, b) => sum + b.dirtyCashStored, 0);
    const totalPending = businesses.reduce((sum, b) => sum + b.pendingLaundering, 0);
    const totalLaundered = businesses.reduce((sum, b) => sum + b.totalLaundered, 0);

    res.json({
      success: true,
      data: {
        businesses,
        summary: {
          totalBusinesses: businesses.length,
          totalDirtyCashStored: totalDirtyCash,
          totalPendingLaundering: totalPending,
          totalLaundered,
          averageLegitimacy: businesses.length > 0
            ? Math.round(businesses.reduce((sum, b) => sum + b.legitimacyRating, 0) / businesses.length)
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get business fronts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get business fronts' });
  }
});

// POST /api/business-fronts/create - Create a new business front
router.post('/create', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { propertyId, businessTypeId, name } = req.body;

    if (!propertyId || !businessTypeId || !name) {
      res.status(400).json({ success: false, error: 'Property ID, business type, and name required' });
      return;
    }

    // Verify property ownership
    const propertyResult = await pool.query(
      `SELECT op.*, pl.property_type, pl.category, d.name as district_name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       JOIN districts d ON pl.district_id = d.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found or not owned' });
      return;
    }

    const property = propertyResult.rows[0];

    // Check if property already has a business
    const existingResult = await pool.query(
      `SELECT id FROM business_fronts WHERE property_id = $1`,
      [propertyId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'This property already has a business' });
      return;
    }

    // Get business type
    const typeResult = await pool.query(
      `SELECT * FROM business_front_types WHERE id = $1 AND is_active = true`,
      [businessTypeId]
    );

    if (typeResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business type not found' });
      return;
    }

    const businessType = typeResult.rows[0];

    // Check property type compatibility
    if (businessType.required_property_types.length > 0 &&
        !businessType.required_property_types.includes(property.property_type)) {
      res.status(400).json({
        success: false,
        error: `This business requires one of: ${businessType.required_property_types.join(', ')}`
      });
      return;
    }

    // Check player requirements
    const playerResult = await pool.query(
      `SELECT level, influence, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.level < businessType.required_level) {
      res.status(400).json({ success: false, error: `Requires level ${businessType.required_level}` });
      return;
    }

    if (player.influence < businessType.required_connections) {
      res.status(400).json({ success: false, error: `Requires ${businessType.required_connections} influence` });
      return;
    }

    if (player.cash < businessType.base_setup_cost) {
      res.status(400).json({ success: false, error: 'Not enough cash for setup cost' });
      return;
    }

    // Deduct setup cost
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [businessType.base_setup_cost, playerId]
    );

    // Create business
    const businessResult = await pool.query(
      `INSERT INTO business_fronts (owner_id, property_id, business_type_id, name, legitimacy_rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [playerId, propertyId, businessTypeId, name, Math.min(50, businessType.min_legitimacy + 20)]
    );

    const business = businessResult.rows[0];

    // Log transaction
    await pool.query(
      `INSERT INTO currency_transactions (player_id, currency_type, amount, transaction_type, description)
       VALUES ($1, 'cash', $2, 'spend', $3)`,
      [playerId, -businessType.base_setup_cost, `Setup cost for ${name} (${businessType.name})`]
    );

    res.json({
      success: true,
      data: {
        message: `${name} has been established!`,
        business: {
          id: business.id,
          name: business.name,
          typeName: businessType.name,
          propertyName: property.custom_name || property.district_name,
          legitimacyRating: business.legitimacy_rating,
          setupCost: businessType.base_setup_cost
        }
      }
    });
  } catch (error) {
    console.error('Create business error:', error);
    res.status(500).json({ success: false, error: 'Failed to create business' });
  }
});

// GET /api/business-fronts/:id - Get detailed business info
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const businessId = parseInt(req.params.id);

    const businessResult = await pool.query(
      `SELECT bf.*, bft.name as type_name, bft.type_code, bft.icon as type_icon,
              bft.base_laundering_rate, bft.max_daily_laundering, bft.tax_rate,
              bft.employee_slots, bft.monthly_expenses as base_expenses,
              bft.base_employee_cost, bft.audit_risk_multiplier,
              op.custom_name as property_name, pl.name as property_listing_name,
              d.name as district_name
       FROM business_fronts bf
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       JOIN owned_properties op ON bf.property_id = op.id
       JOIN property_listings pl ON op.listing_id = pl.id
       JOIN districts d ON pl.district_id = d.id
       WHERE bf.id = $1 AND bf.owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const b = businessResult.rows[0];

    // Get employees
    const employeesResult = await pool.query(
      `SELECT * FROM business_employees WHERE business_id = $1 ORDER BY hired_at`,
      [businessId]
    );

    // Get recent operations
    const operationsResult = await pool.query(
      `SELECT * FROM business_operations_log WHERE business_id = $1
       ORDER BY occurred_at DESC LIMIT 10`,
      [businessId]
    );

    // Get pending laundering
    const launderingResult = await pool.query(
      `SELECT * FROM laundering_operations WHERE business_id = $1 AND status = 'processing'
       ORDER BY completes_at ASC`,
      [businessId]
    );

    // Get recent reviews
    const reviewsResult = await pool.query(
      `SELECT * FROM business_reviews WHERE business_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [businessId]
    );

    // Get active events
    const eventsResult = await pool.query(
      `SELECT * FROM business_events
       WHERE business_id = $1 AND resolved_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY occurred_at DESC`,
      [businessId]
    );

    // Calculate effective laundering rate
    const employeeBonus = employeesResult.rows.length > 0
      ? employeesResult.rows.reduce((sum, e) => sum + e.quality, 0) / employeesResult.rows.length / 100
      : 0;
    const legitimacyBonus = b.legitimacy_rating / 100;
    const effectiveLaunderingRate = Math.floor(
      b.base_laundering_rate * (1 + employeeBonus * 0.3 + legitimacyBonus * 0.5)
    );

    res.json({
      success: true,
      data: {
        business: {
          id: b.id,
          name: b.name,
          typeName: b.type_name,
          typeCode: b.type_code,
          typeIcon: b.type_icon,
          propertyId: b.property_id,
          propertyName: b.property_name || b.property_listing_name,
          districtName: b.district_name,
          legitimacyRating: b.legitimacy_rating,
          reputation: b.reputation,
          isOperational: b.is_operational,
          operatingHours: b.operating_hours,
          dailyCustomers: b.daily_customers,
          hasLicense: b.has_license,
          licenseExpiresAt: b.license_expires_at,
          dirtyCashStored: b.dirty_cash_stored,
          cleanCashPending: b.clean_cash_pending,
          totalLaundered: b.total_laundered,
          totalLegitimateIncome: b.total_legitimate_income,
          baseLaunderingRate: b.base_laundering_rate,
          effectiveLaunderingRate,
          maxDailyLaundering: b.max_daily_laundering,
          monthlyExpenses: b.base_expenses,
          baseEmployeeCost: b.base_employee_cost,
          taxRate: parseFloat(b.tax_rate),
          auditRiskMultiplier: parseFloat(b.audit_risk_multiplier),
          isUnderInvestigation: b.is_under_investigation,
          auditFlags: b.audit_flags,
          lastAuditDate: b.last_audit_date,
          createdAt: b.created_at
        },
        employees: employeesResult.rows.map(e => ({
          id: e.id,
          name: e.name,
          role: e.role,
          salary: e.salary,
          quality: e.quality,
          loyalty: e.loyalty,
          isLegitimate: e.is_legitimate,
          knowsAboutLaundering: e.knows_about_laundering,
          hiredAt: e.hired_at
        })),
        employeeSlots: b.employee_slots,
        recentOperations: operationsResult.rows.map(o => ({
          id: o.id,
          type: o.operation_type,
          revenue: o.revenue,
          expenses: o.expenses,
          customersServed: o.customers_served,
          occurredAt: o.occurred_at
        })),
        pendingLaundering: launderingResult.rows.map(l => ({
          id: l.id,
          dirtyAmount: l.dirty_amount,
          cleanAmount: l.clean_amount,
          fee: l.fee_amount,
          completesAt: l.completes_at,
          wasFlagged: l.was_flagged
        })),
        reviews: reviewsResult.rows.map(r => ({
          id: r.id,
          rating: r.rating,
          text: r.review_text,
          type: r.reviewer_type,
          createdAt: r.created_at
        })),
        activeEvents: eventsResult.rows.map(e => ({
          id: e.id,
          type: e.event_type,
          title: e.title,
          description: e.description,
          choices: e.choices,
          occurredAt: e.occurred_at,
          expiresAt: e.expires_at
        }))
      }
    });
  } catch (error) {
    console.error('Get business detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to get business details' });
  }
});

// POST /api/business-fronts/:id/operate - Run business operations for the day
router.post('/:id/operate', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const businessId = parseInt(req.params.id);

    const businessResult = await pool.query(
      `SELECT bf.*, bft.type_code, bft.monthly_expenses
       FROM business_fronts bf
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       WHERE bf.id = $1 AND bf.owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const business = businessResult.rows[0];

    // Check if already operated today
    const lastOp = await pool.query(
      `SELECT id FROM business_operations_log
       WHERE business_id = $1 AND occurred_at > NOW() - INTERVAL '20 hours'`,
      [businessId]
    );

    if (lastOp.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Already operated today. Try again later.' });
      return;
    }

    // Calculate daily operation
    const baseCustomers = 20 + Math.floor(business.reputation / 5);
    const customerVariance = Math.floor(Math.random() * 20) - 10;
    const customers = Math.max(5, baseCustomers + customerVariance);

    const revenuePerCustomer = 15 + Math.floor(business.legitimacy_rating / 10);
    const revenue = customers * revenuePerCustomer;
    const dailyExpenses = Math.floor(business.monthly_expenses / 30);
    const profit = revenue - dailyExpenses;

    // Update business
    await pool.query(
      `UPDATE business_fronts
       SET is_operational = true, daily_customers = $1,
           total_legitimate_income = total_legitimate_income + $2,
           legitimacy_rating = LEAST(100, legitimacy_rating + 1),
           last_operation_date = NOW()
       WHERE id = $3`,
      [customers, Math.max(0, profit), businessId]
    );

    // Log operation
    await pool.query(
      `INSERT INTO business_operations_log (business_id, operation_type, revenue, expenses, customers_served)
       VALUES ($1, 'daily_operation', $2, $3, $4)`,
      [businessId, revenue, dailyExpenses, customers]
    );

    // Add to player's cash (legitimate income)
    if (profit > 0) {
      await pool.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [profit, playerId]
      );
    }

    // Random event chance
    let event = null;
    if (Math.random() < 0.1) {
      event = await triggerRandomEvent(businessId, business.type_code, business.legitimacy_rating);
    }

    res.json({
      success: true,
      data: {
        message: `${business.name} operated successfully!`,
        customers,
        revenue,
        expenses: dailyExpenses,
        profit,
        legitimacyGain: 1,
        newLegitimacy: Math.min(100, business.legitimacy_rating + 1),
        event
      }
    });
  } catch (error) {
    console.error('Operate business error:', error);
    res.status(500).json({ success: false, error: 'Failed to operate business' });
  }
});

// POST /api/business-fronts/:id/license - Purchase business license
router.post('/:id/license', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const businessId = parseInt(req.params.id);

    const businessResult = await pool.query(
      `SELECT bf.* FROM business_fronts bf WHERE bf.id = $1 AND bf.owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const business = businessResult.rows[0];

    // Check if license is still valid
    if (business.has_license && business.license_expires_at && new Date(business.license_expires_at) > new Date()) {
      res.status(400).json({ success: false, error: 'License is still valid' });
      return;
    }

    // Check funds
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].cash < LICENSE_COST) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Deduct cost and grant license
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [LICENSE_COST, playerId]
    );

    const expiresAt = new Date(Date.now() + LICENSE_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE business_fronts
       SET has_license = true, license_expires_at = $1,
           legitimacy_rating = LEAST(100, legitimacy_rating + 10)
       WHERE id = $2`,
      [expiresAt, businessId]
    );

    res.json({
      success: true,
      data: {
        message: 'Business license obtained!',
        cost: LICENSE_COST,
        expiresAt,
        legitimacyGain: 10
      }
    });
  } catch (error) {
    console.error('Purchase license error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase license' });
  }
});

// POST /api/business-fronts/:id/hire - Hire an employee
router.post('/:id/hire', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const businessId = parseInt(req.params.id);
    const { role, quality } = req.body;

    if (!role) {
      res.status(400).json({ success: false, error: 'Role required' });
      return;
    }

    const requestedQuality = quality || 50;

    const businessResult = await pool.query(
      `SELECT bf.*, bft.employee_slots, bft.base_employee_cost
       FROM business_fronts bf
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       WHERE bf.id = $1 AND bf.owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const business = businessResult.rows[0];

    // Check employee slots
    const employeeCount = await pool.query(
      `SELECT COUNT(*) FROM business_employees WHERE business_id = $1`,
      [businessId]
    );

    if (parseInt(employeeCount.rows[0].count) >= business.employee_slots) {
      res.status(400).json({ success: false, error: 'No employee slots available' });
      return;
    }

    // Calculate salary based on quality
    const salary = Math.floor(business.base_employee_cost * (0.5 + requestedQuality / 100));

    // Generate random employee
    const names = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Quinn', 'Avery', 'Skyler', 'Drew'];
    const surnames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson'];
    const employeeName = `${names[Math.floor(Math.random() * names.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`;

    // Actual quality varies from requested
    const actualQuality = Math.max(10, Math.min(100, requestedQuality + Math.floor(Math.random() * 20) - 10));

    await pool.query(
      `INSERT INTO business_employees (business_id, name, role, salary, quality, loyalty)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [businessId, employeeName, role, salary, actualQuality, 50]
    );

    // Legitimacy boost for hiring
    await pool.query(
      `UPDATE business_fronts SET legitimacy_rating = LEAST(100, legitimacy_rating + 2),
       employee_count = employee_count + 1 WHERE id = $1`,
      [businessId]
    );

    res.json({
      success: true,
      data: {
        message: `Hired ${employeeName} as ${role}`,
        employee: {
          name: employeeName,
          role,
          salary,
          quality: actualQuality
        },
        legitimacyGain: 2
      }
    });
  } catch (error) {
    console.error('Hire employee error:', error);
    res.status(500).json({ success: false, error: 'Failed to hire employee' });
  }
});

// POST /api/business-fronts/:id/fire/:employeeId - Fire an employee
router.post('/:id/fire/:employeeId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const businessId = parseInt(req.params.id);
    const employeeId = parseInt(req.params.employeeId);

    // Verify ownership
    const businessResult = await pool.query(
      `SELECT id FROM business_fronts WHERE id = $1 AND owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    // Get employee
    const employeeResult = await pool.query(
      `SELECT * FROM business_employees WHERE id = $1 AND business_id = $2`,
      [employeeId, businessId]
    );

    if (employeeResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const employee = employeeResult.rows[0];

    // Check if they know about laundering - risk of reporting
    let riskMessage = null;
    if (employee.knows_about_laundering && employee.loyalty < 70) {
      const reportChance = (100 - employee.loyalty) / 100;
      if (Math.random() < reportChance * 0.3) {
        // They report!
        await pool.query(
          `UPDATE business_fronts SET legitimacy_rating = GREATEST(0, legitimacy_rating - 15),
           audit_flags = audit_flags + 1 WHERE id = $1`,
          [businessId]
        );
        riskMessage = 'The fired employee reported suspicious activity! -15 legitimacy, audit flag added.';
      }
    }

    // Remove employee
    await pool.query(`DELETE FROM business_employees WHERE id = $1`, [employeeId]);

    await pool.query(
      `UPDATE business_fronts SET employee_count = GREATEST(0, employee_count - 1) WHERE id = $1`,
      [businessId]
    );

    res.json({
      success: true,
      data: {
        message: `${employee.name} has been fired`,
        warning: riskMessage
      }
    });
  } catch (error) {
    console.error('Fire employee error:', error);
    res.status(500).json({ success: false, error: 'Failed to fire employee' });
  }
});

// POST /api/business-fronts/:id/event/:eventId/resolve - Resolve a business event
router.post('/:id/event/:eventId/resolve', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const businessId = parseInt(req.params.id);
    const eventId = parseInt(req.params.eventId);
    const { choiceId } = req.body;

    if (!choiceId) {
      res.status(400).json({ success: false, error: 'Choice ID required' });
      return;
    }

    // Verify ownership
    const businessResult = await pool.query(
      `SELECT bf.*, bft.type_code FROM business_fronts bf
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       WHERE bf.id = $1 AND bf.owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const business = businessResult.rows[0];

    // Get event
    const eventResult = await pool.query(
      `SELECT * FROM business_events WHERE id = $1 AND business_id = $2 AND resolved_at IS NULL`,
      [eventId, businessId]
    );

    if (eventResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Event not found or already resolved' });
      return;
    }

    const event = eventResult.rows[0];
    const choices = event.choices as any[];
    const choice = choices.find(c => c.id === choiceId);

    if (!choice) {
      res.status(400).json({ success: false, error: 'Invalid choice' });
      return;
    }

    // Check if player can afford cost
    if (choice.cost > 0) {
      const playerResult = await pool.query(`SELECT cash FROM players WHERE id = $1`, [playerId]);
      if (playerResult.rows[0].cash < choice.cost) {
        res.status(400).json({ success: false, error: 'Not enough cash' });
        return;
      }

      await pool.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [choice.cost, playerId]
      );
    }

    // Determine success
    const success = Math.random() * 100 < choice.success_rate;
    const outcome = success ? choice.outcome_success : choice.outcome_fail;
    const legitimacyChange = success ? choice.legitimacy_change : (choice.legitimacy_change < 0 ? choice.legitimacy_change * 2 : -5);

    // Apply legitimacy change
    await pool.query(
      `UPDATE business_fronts SET legitimacy_rating = GREATEST(0, LEAST(100, legitimacy_rating + $1))
       WHERE id = $2`,
      [legitimacyChange, businessId]
    );

    // Mark event resolved
    await pool.query(
      `UPDATE business_events SET selected_choice = $1, outcome = $2, resolved_at = NOW()
       WHERE id = $3`,
      [choiceId, JSON.stringify({ success, outcome, legitimacyChange }), eventId]
    );

    // Special outcomes
    if (!success && choice.id === 'ignore' && event.event_type === 'irs_letter') {
      // Start investigation
      await pool.query(
        `INSERT INTO investigations (player_id, business_id, investigation_type, trigger_reason, severity)
         VALUES ($1, $2, 'tax_evasion', 'Ignored IRS inquiry', 2)`,
        [playerId, businessId]
      );

      await pool.query(
        `UPDATE business_fronts SET is_under_investigation = true WHERE id = $1`,
        [businessId]
      );
    }

    res.json({
      success: true,
      data: {
        eventTitle: event.title,
        choiceMade: choice.text,
        wasSuccessful: success,
        outcome,
        legitimacyChange,
        cost: choice.cost
      }
    });
  } catch (error) {
    console.error('Resolve event error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve event' });
  }
});

// Helper function to trigger random events
async function triggerRandomEvent(businessId: number, typeCode: string, legitimacy: number): Promise<any | null> {
  try {
    // Get applicable event templates
    const templatesResult = await pool.query(
      `SELECT * FROM business_event_templates
       WHERE is_active = true
       AND ($1 = ANY(applicable_business_types) OR 'all' = ANY(applicable_business_types))
       AND min_legitimacy <= $2 AND max_legitimacy >= $2
       ORDER BY RANDOM() LIMIT 1`,
      [typeCode, legitimacy]
    );

    if (templatesResult.rows.length === 0) return null;

    const template = templatesResult.rows[0];

    // Create event
    const eventResult = await pool.query(
      `INSERT INTO business_events (business_id, event_type, title, description, choices, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [businessId, template.event_type, template.title, template.description, template.choices]
    );

    return {
      id: eventResult.rows[0].id,
      type: template.event_type,
      title: template.title,
      description: template.description,
      choices: template.choices
    };
  } catch (error) {
    console.error('Trigger random event error:', error);
    return null;
  }
}

// Process daily legitimacy decay for inactive businesses (call periodically)
export async function processBusinessDecay(): Promise<void> {
  try {
    // Decrease legitimacy for businesses not operated recently
    await pool.query(
      `UPDATE business_fronts
       SET legitimacy_rating = GREATEST(0, legitimacy_rating - 2)
       WHERE last_operation_date < NOW() - INTERVAL '3 days'
       AND legitimacy_rating > 20`
    );

    // Expire licenses
    await pool.query(
      `UPDATE business_fronts
       SET has_license = false, legitimacy_rating = GREATEST(0, legitimacy_rating - 5)
       WHERE has_license = true AND license_expires_at < NOW()`
    );

    console.log('Business decay processed');
  } catch (error) {
    console.error('Process business decay error:', error);
  }
}

export default router;
