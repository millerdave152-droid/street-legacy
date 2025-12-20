/**
 * DistrictStateIndicator - Compact district ecosystem state display
 * Shows status badge with optional expanded metrics view
 */
export class DistrictStateIndicator extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.config = {
      compact: config.compact ?? true,
      showMetrics: config.showMetrics ?? false,
      width: config.width ?? 80,
      height: config.height ?? 24,
      expandedHeight: config.expandedHeight ?? 100,
      districtId: config.districtId ?? null,
      onClick: config.onClick ?? null,
      ...config
    };

    // State data
    this.districtState = null;
    this.isExpanded = false;

    // Status color mapping
    this.statusColors = {
      stable: { bg: 0x4b5563, border: 0x6b7280, text: '#9ca3af', name: 'Stable' },
      volatile: { bg: 0x78350f, border: 0xf59e0b, text: '#fbbf24', name: 'Volatile' },
      warzone: { bg: 0x7f1d1d, border: 0xef4444, text: '#f87171', name: 'Warzone' },
      gentrifying: { bg: 0x14532d, border: 0x22c55e, text: '#4ade80', name: 'Rising' },
      declining: { bg: 0x1f2937, border: 0x374151, text: '#6b7280', name: 'Declining' }
    };

    // Metric configs
    this.metricConfigs = {
      crimeIndex: { label: 'Crime', icon: '🔫', color: 0xef4444, invertColor: true },
      policePresence: { label: 'Police', icon: '👮', color: 0x3b82f6, invertColor: false },
      propertyValues: { label: 'Property', icon: '🏠', color: 0x22c55e, invertColor: false },
      businessHealth: { label: 'Business', icon: '💼', color: 0x8b5cf6, invertColor: false },
      streetActivity: { label: 'Activity', icon: '🌃', color: 0xf59e0b, invertColor: false }
    };

    this.createElements();
    scene.add.existing(this);
  }

  createElements() {
    // Badge background
    this.badgeBg = this.scene.add.rectangle(0, 0, this.config.width, this.config.height, 0x4b5563, 0.9);
    this.badgeBg.setStrokeStyle(2, 0x6b7280, 1);
    this.add(this.badgeBg);

    // Status text
    this.statusText = this.scene.add.text(0, 0, 'Loading...', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#9ca3af',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(this.statusText);

    // Expanded container (initially hidden)
    this.expandedContainer = this.scene.add.container(0, this.config.height / 2 + 5);
    this.expandedContainer.setVisible(false);
    this.add(this.expandedContainer);

    // Create metric bars in expanded view
    this.metricBars = {};
    this.createExpandedMetrics();

    // Make interactive
    this.badgeBg.setInteractive({ useHandCursor: true });
    this.badgeBg.on('pointerdown', () => this.handleClick());
    this.badgeBg.on('pointerover', () => this.handleHover(true));
    this.badgeBg.on('pointerout', () => this.handleHover(false));
  }

  createExpandedMetrics() {
    const metrics = ['crimeIndex', 'policePresence', 'propertyValues', 'businessHealth', 'streetActivity'];
    const barWidth = this.config.width + 40;
    const barHeight = 12;
    const spacing = 16;

    // Background panel for expanded view
    const panelHeight = metrics.length * spacing + 10;
    this.expandedBg = this.scene.add.rectangle(0, panelHeight / 2, barWidth + 20, panelHeight, 0x1e293b, 0.95);
    this.expandedBg.setStrokeStyle(1, 0x334155, 1);
    this.expandedContainer.add(this.expandedBg);

    metrics.forEach((metric, index) => {
      const y = 5 + index * spacing;
      const cfg = this.metricConfigs[metric];

      // Icon
      const icon = this.scene.add.text(-barWidth / 2 + 10, y, cfg.icon, {
        fontSize: '10px'
      }).setOrigin(0, 0.5);
      this.expandedContainer.add(icon);

      // Background bar
      const bgBar = this.scene.add.rectangle(10, y, barWidth - 40, barHeight, 0x0f172a, 1);
      bgBar.setOrigin(0.5, 0.5);
      this.expandedContainer.add(bgBar);

      // Fill bar
      const fillBar = this.scene.add.rectangle(
        10 - (barWidth - 40) / 2,
        y,
        0,
        barHeight - 2,
        cfg.color,
        0.8
      );
      fillBar.setOrigin(0, 0.5);
      this.expandedContainer.add(fillBar);

      // Value text
      const valueText = this.scene.add.text(barWidth / 2 - 5, y, '0', {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#94a3b8'
      }).setOrigin(1, 0.5);
      this.expandedContainer.add(valueText);

      this.metricBars[metric] = { bgBar, fillBar, valueText, barWidth: barWidth - 40 };
    });
  }

  setState(state) {
    if (!state) return;

    this.districtState = state;
    const statusConfig = this.statusColors[state.status] || this.statusColors.stable;

    // Update badge
    this.badgeBg.setFillStyle(statusConfig.bg, 0.9);
    this.badgeBg.setStrokeStyle(2, statusConfig.border, 1);
    this.statusText.setText(statusConfig.name.toUpperCase());
    this.statusText.setColor(statusConfig.text);

    // Update metric bars
    const metrics = ['crimeIndex', 'policePresence', 'propertyValues', 'businessHealth', 'streetActivity'];
    metrics.forEach(metric => {
      const value = state[metric] ?? 50;
      const bar = this.metricBars[metric];
      if (bar) {
        const targetWidth = (value / 100) * bar.barWidth;
        bar.fillBar.width = targetWidth;
        bar.valueText.setText(Math.round(value).toString());
      }
    });

    // Add pulse animation for volatile/warzone
    if (state.status === 'warzone' || state.status === 'volatile') {
      this.startPulse();
    } else {
      this.stopPulse();
    }
  }

  handleClick() {
    if (this.config.onClick) {
      this.config.onClick(this.districtState, this.config.districtId);
    } else {
      this.toggleExpanded();
    }
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      this.expandedContainer.setVisible(true);
      this.expandedContainer.setAlpha(0);
      this.scene.tweens.add({
        targets: this.expandedContainer,
        alpha: 1,
        duration: 150,
        ease: 'Power2'
      });
    } else {
      this.scene.tweens.add({
        targets: this.expandedContainer,
        alpha: 0,
        duration: 100,
        ease: 'Power2',
        onComplete: () => this.expandedContainer.setVisible(false)
      });
    }
  }

  handleHover(isOver) {
    const scale = isOver ? 1.05 : 1;
    this.scene.tweens.add({
      targets: this.badgeBg,
      scaleX: scale,
      scaleY: scale,
      duration: 100,
      ease: 'Power2'
    });
  }

  startPulse() {
    if (this.pulseTween) return;

    this.pulseTween = this.scene.tweens.add({
      targets: this.badgeBg,
      alpha: { from: 0.9, to: 0.6 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  stopPulse() {
    if (this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = null;
      this.badgeBg.setAlpha(0.9);
    }
  }

  setCompact(compact) {
    this.config.compact = compact;
    if (compact && this.isExpanded) {
      this.toggleExpanded();
    }
  }

  destroy() {
    this.stopPulse();
    super.destroy();
  }
}

export default DistrictStateIndicator;
