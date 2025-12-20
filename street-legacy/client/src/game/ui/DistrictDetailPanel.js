/**
 * DistrictDetailPanel - Full district ecosystem detail view
 * Shows all metrics, modifiers, and recent events
 */
export class DistrictDetailPanel extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.config = {
      width: config.width ?? 320,
      height: config.height ?? 400,
      districtId: config.districtId ?? null,
      districtName: config.districtName ?? 'Unknown District',
      onClose: config.onClose ?? null,
      ...config
    };

    // State
    this.districtState = null;
    this.modifiers = null;
    this.events = [];

    // Status colors
    this.statusColors = {
      stable: { bg: 0x4b5563, border: 0x6b7280, text: '#9ca3af', desc: 'Normal conditions' },
      volatile: { bg: 0x78350f, border: 0xf59e0b, text: '#fbbf24', desc: 'Increased crime activity' },
      warzone: { bg: 0x7f1d1d, border: 0xef4444, text: '#f87171', desc: 'Dangerous, high rewards' },
      gentrifying: { bg: 0x14532d, border: 0x22c55e, text: '#4ade80', desc: 'Property values rising' },
      declining: { bg: 0x1f2937, border: 0x374151, text: '#6b7280', desc: 'Economic downturn' }
    };

    // Metric configs
    this.metricConfigs = {
      crimeIndex: { label: 'Crime Index', icon: '🔫', color: 0xef4444, desc: 'Criminal activity level' },
      policePresence: { label: 'Police Presence', icon: '👮', color: 0x3b82f6, desc: 'Law enforcement activity' },
      propertyValues: { label: 'Property Values', icon: '🏠', color: 0x22c55e, desc: 'Real estate market health' },
      businessHealth: { label: 'Business Health', icon: '💼', color: 0x8b5cf6, desc: 'Local economy strength' },
      streetActivity: { label: 'Street Activity', icon: '🌃', color: 0xf59e0b, desc: 'Underground activity' }
    };

    this.createElements();
    scene.add.existing(this);
  }

  createElements() {
    const { width, height } = this.config;

    // Main panel background
    this.panelBg = this.scene.add.rectangle(0, 0, width, height, 0x0f172a, 0.98);
    this.panelBg.setStrokeStyle(2, 0x334155, 1);
    this.add(this.panelBg);

    // Header
    this.createHeader();

    // Status section
    this.createStatusSection();

    // Metrics section
    this.createMetricsSection();

    // Modifiers section
    this.createModifiersSection();

    // Events section
    this.createEventsSection();

    // Close button
    this.createCloseButton();

    // Initially hidden
    this.setVisible(false);
  }

  createHeader() {
    const { width } = this.config;
    const y = -this.config.height / 2 + 25;

    // Header bar
    const headerBar = this.scene.add.rectangle(0, y, width - 4, 40, 0x1e293b, 1);
    this.add(headerBar);

    // District name
    this.titleText = this.scene.add.text(0, y, this.config.districtName.toUpperCase(), {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(this.titleText);

    // Accent line
    const accent = this.scene.add.rectangle(0, y + 22, width - 20, 2, 0x3b82f6, 1);
    this.add(accent);
  }

  createStatusSection() {
    const { width } = this.config;
    const startY = -this.config.height / 2 + 70;

    // Status badge
    this.statusBadge = this.scene.add.rectangle(-width / 2 + 50, startY, 80, 24, 0x4b5563, 0.9);
    this.statusBadge.setStrokeStyle(2, 0x6b7280, 1);
    this.add(this.statusBadge);

    this.statusText = this.scene.add.text(-width / 2 + 50, startY, 'STABLE', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#9ca3af',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(this.statusText);

    // Status description
    this.statusDesc = this.scene.add.text(10, startY, 'Normal conditions', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#64748b'
    }).setOrigin(0, 0.5);
    this.add(this.statusDesc);
  }

  createMetricsSection() {
    const { width } = this.config;
    const startY = -this.config.height / 2 + 105;
    const barWidth = width - 60;
    const barHeight = 14;
    const spacing = 28;

    // Section label
    const sectionLabel = this.scene.add.text(-width / 2 + 15, startY - 5, 'DISTRICT METRICS', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#475569',
      fontStyle: 'bold'
    });
    this.add(sectionLabel);

    this.metricBars = {};
    const metrics = ['crimeIndex', 'policePresence', 'propertyValues', 'businessHealth', 'streetActivity'];

    metrics.forEach((metric, index) => {
      const y = startY + 15 + index * spacing;
      const cfg = this.metricConfigs[metric];

      // Label with icon
      const label = this.scene.add.text(-width / 2 + 15, y - 6, `${cfg.icon} ${cfg.label}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#94a3b8'
      });
      this.add(label);

      // Background bar
      const bgBar = this.scene.add.rectangle(0, y + 6, barWidth, barHeight, 0x1e293b, 1);
      bgBar.setStrokeStyle(1, 0x334155, 0.5);
      this.add(bgBar);

      // Fill bar
      const fillBar = this.scene.add.rectangle(
        -barWidth / 2,
        y + 6,
        0,
        barHeight - 2,
        cfg.color,
        0.8
      );
      fillBar.setOrigin(0, 0.5);
      this.add(fillBar);

      // Value text
      const valueText = this.scene.add.text(width / 2 - 20, y - 6, '50', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#f8fafc',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      this.add(valueText);

      this.metricBars[metric] = { bgBar, fillBar, valueText, barWidth };
    });
  }

  createModifiersSection() {
    const { width } = this.config;
    const startY = -this.config.height / 2 + 260;

    // Section label
    const sectionLabel = this.scene.add.text(-width / 2 + 15, startY, 'ACTIVE MODIFIERS', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#475569',
      fontStyle: 'bold'
    });
    this.add(sectionLabel);

    // Modifiers container
    this.modifiersContainer = this.scene.add.container(0, startY + 20);
    this.add(this.modifiersContainer);
  }

  createEventsSection() {
    const { width } = this.config;
    const startY = -this.config.height / 2 + 320;

    // Section label
    const sectionLabel = this.scene.add.text(-width / 2 + 15, startY, 'RECENT EVENTS', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#475569',
      fontStyle: 'bold'
    });
    this.add(sectionLabel);

    // Events container
    this.eventsContainer = this.scene.add.container(0, startY + 15);
    this.add(this.eventsContainer);
  }

  createCloseButton() {
    const { width, height } = this.config;
    const x = width / 2 - 20;
    const y = -height / 2 + 25;

    const closeBtn = this.scene.add.text(x, y, '✕', {
      fontSize: '18px',
      color: '#64748b'
    }).setOrigin(0.5);

    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#f8fafc'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#64748b'));
    closeBtn.on('pointerdown', () => this.hide());

    this.add(closeBtn);
  }

  setState(state, modifiers = null) {
    if (!state) return;

    this.districtState = state;
    this.modifiers = modifiers;

    // Update status
    const statusConfig = this.statusColors[state.status] || this.statusColors.stable;
    this.statusBadge.setFillStyle(statusConfig.bg, 0.9);
    this.statusBadge.setStrokeStyle(2, statusConfig.border, 1);
    this.statusText.setText(state.status.toUpperCase());
    this.statusText.setColor(statusConfig.text);
    this.statusDesc.setText(statusConfig.desc);

    // Update metrics with animation
    const metrics = ['crimeIndex', 'policePresence', 'propertyValues', 'businessHealth', 'streetActivity'];
    metrics.forEach(metric => {
      const value = state[metric] ?? 50;
      const bar = this.metricBars[metric];
      if (bar) {
        const targetWidth = (value / 100) * bar.barWidth;

        this.scene.tweens.add({
          targets: bar.fillBar,
          width: targetWidth,
          duration: 500,
          ease: 'Power2'
        });

        bar.valueText.setText(Math.round(value).toString());
      }
    });

    // Update modifiers
    this.updateModifiers(modifiers);
  }

  updateModifiers(modifiers) {
    // Clear existing
    this.modifiersContainer.removeAll(true);

    if (!modifiers) {
      const noMods = this.scene.add.text(0, 0, 'No active modifiers', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#475569'
      }).setOrigin(0.5, 0);
      this.modifiersContainer.add(noMods);
      return;
    }

    const { width } = this.config;
    const modList = [
      { key: 'crimeDifficulty', label: 'Crime Difficulty', format: v => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%` },
      { key: 'crimePayoutBonus', label: 'Crime Payout', format: v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%` },
      { key: 'policeAlertChance', label: 'Police Alert', format: v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%` },
      { key: 'propertyIncomeMultiplier', label: 'Property Income', format: v => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%` },
      { key: 'pvpDamageMultiplier', label: 'PvP Damage', format: v => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%` }
    ];

    let yOffset = 0;
    modList.forEach(mod => {
      const value = modifiers[mod.key];
      if (value === undefined || value === null) return;

      const isPositive = mod.key === 'crimePayoutBonus' || mod.key === 'propertyIncomeMultiplier'
        ? value > 0 || value > 1
        : value < 1 || value < 0;

      const color = isPositive ? '#4ade80' : '#f87171';
      const bgColor = isPositive ? 0x14532d : 0x7f1d1d;

      // Modifier chip
      const chipBg = this.scene.add.rectangle(-width / 2 + 100, yOffset, 180, 18, bgColor, 0.5);
      chipBg.setStrokeStyle(1, isPositive ? 0x22c55e : 0xef4444, 0.3);
      this.modifiersContainer.add(chipBg);

      const text = this.scene.add.text(-width / 2 + 100, yOffset, `${mod.label}: ${mod.format(value)}`, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: color
      }).setOrigin(0.5);
      this.modifiersContainer.add(text);

      yOffset += 22;
    });
  }

  setEvents(events) {
    this.events = events || [];

    // Clear existing
    this.eventsContainer.removeAll(true);

    if (this.events.length === 0) {
      const noEvents = this.scene.add.text(0, 0, 'No recent events', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#475569'
      }).setOrigin(0.5, 0);
      this.eventsContainer.add(noEvents);
      return;
    }

    const { width } = this.config;
    const eventIcons = {
      crime_committed: '🔫',
      crime_failed: '❌',
      player_arrested: '🚔',
      property_bought: '🏠',
      property_sold: '💰',
      player_attacked: '⚔️',
      crew_battle: '👊',
      territory_claimed: '🚩',
      police_raid: '🚨'
    };

    // Show last 5 events
    const recentEvents = this.events.slice(0, 5);
    let yOffset = 0;

    recentEvents.forEach(event => {
      const icon = eventIcons[event.eventType] || '📌';
      const timeAgo = this.getTimeAgo(event.createdAt);

      const eventText = this.scene.add.text(-width / 2 + 20, yOffset, `${icon} ${event.eventType.replace(/_/g, ' ')}`, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#94a3b8'
      });
      this.eventsContainer.add(eventText);

      const timeText = this.scene.add.text(width / 2 - 20, yOffset, timeAgo, {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: '#475569'
      }).setOrigin(1, 0);
      this.eventsContainer.add(timeText);

      yOffset += 14;
    });
  }

  getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  show(districtName = null) {
    if (districtName) {
      this.config.districtName = districtName;
      this.titleText.setText(districtName.toUpperCase());
    }

    this.setVisible(true);
    this.setAlpha(0);
    this.setScale(0.9);

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  hide() {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false);
        if (this.config.onClose) {
          this.config.onClose();
        }
      }
    });
  }

  destroy() {
    super.destroy();
  }
}

export default DistrictDetailPanel;
