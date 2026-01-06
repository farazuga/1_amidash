import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawGauge, getGaugeColor } from '../components/gauge.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';

export class HealthDashboardSlide extends BaseSlide {
  private celebrationParticles: CelebrationParticle[] = [];
  private lastHealthy = false;

  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Business Health');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      return;
    }

    const { health } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = 100;
    const contentY = headerHeight + 60;
    const contentHeight = height - contentY - padding;

    // Layout: Two large gauges side by side with diagnosis below
    const gaugeRadius = Math.min(contentHeight * 0.35, (width - padding * 3) / 4);
    const gaugeY = contentY + contentHeight * 0.35;

    // Left gauge: Sales Health
    const leftGaugeX = width * 0.3;
    drawGauge(ctx, health.salesHealth, leftGaugeX, gaugeY, gaugeRadius, {
      title: 'Sales Health',
      subtitle: 'POs vs Goal',
      thresholds: { low: 60, medium: 80 },
      showNeedle: true,
    });

    // Right gauge: Operations Health
    const rightGaugeX = width * 0.7;
    drawGauge(ctx, health.opsHealth, rightGaugeX, gaugeY, gaugeRadius, {
      title: 'Ops Health',
      subtitle: 'Invoice vs PO Ratio',
      thresholds: { low: 60, medium: 80 },
      showNeedle: true,
    });

    // Draw diagnosis section below gauges
    const diagnosisY = gaugeY + gaugeRadius + 80;
    this.drawDiagnosis(ctx, health.diagnosis, health.message, diagnosisY);

    // Draw bottleneck indicators
    const bottleneckY = diagnosisY + 120;
    this.drawBottleneckIndicators(ctx, health.bottlenecks, bottleneckY);

    // Check for celebration trigger (both gauges green)
    const isHealthy = health.salesHealth >= 80 && health.opsHealth >= 80;
    if (isHealthy && !this.lastHealthy) {
      // Trigger celebration
      this.triggerCelebration();
    }
    this.lastHealthy = isHealthy;

    // Draw celebration particles
    this.updateAndDrawCelebration(ctx, deltaTime);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading health data...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawDiagnosis(
    ctx: SKRSContext2D,
    diagnosis: 'healthy' | 'sales' | 'operations' | 'both',
    message: string,
    y: number
  ): void {
    const { width } = this.displayConfig;
    const centerX = width / 2;

    // Diagnosis badge
    const badgeWidth = 500;
    const badgeHeight = 80;
    const badgeX = centerX - badgeWidth / 2;

    let badgeColor: string;
    let statusText: string;
    let statusIcon: string;

    switch (diagnosis) {
      case 'healthy':
        badgeColor = colors.success;
        statusText = 'ALL SYSTEMS HEALTHY';
        statusIcon = '✓';
        break;
      case 'sales':
        badgeColor = colors.warning;
        statusText = 'SALES ATTENTION NEEDED';
        statusIcon = '⚠';
        break;
      case 'operations':
        badgeColor = colors.warning;
        statusText = 'OPS ATTENTION NEEDED';
        statusIcon = '⚠';
        break;
      case 'both':
        badgeColor = colors.error;
        statusText = 'ACTION REQUIRED';
        statusIcon = '⚠';
        break;
    }

    // Draw badge background with glow
    ctx.save();
    ctx.shadowColor = badgeColor;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.roundRect(badgeX, y, badgeWidth, badgeHeight, 16);
    ctx.fillStyle = hexToRgba(badgeColor, 0.3);
    ctx.fill();
    ctx.restore();

    // Badge border
    ctx.beginPath();
    ctx.roundRect(badgeX, y, badgeWidth, badgeHeight, 16);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Status text with icon
    drawText(ctx, `${statusIcon}  ${statusText}`, centerX, y + badgeHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 42,
      weight: 700,
      color: badgeColor,
      align: 'center',
      baseline: 'middle',
      letterSpacing: 3,
    });

    // Message below badge
    drawText(ctx, message, centerX, y + badgeHeight + 30, {
      font: this.displayConfig.fontFamily,
      size: 32,
      color: hexToRgba(colors.white, 0.7),
      align: 'center',
    });
  }

  private drawBottleneckIndicators(
    ctx: SKRSContext2D,
    bottlenecks: { procurement: number; engineering: number },
    y: number
  ): void {
    const { width } = this.displayConfig;
    const centerX = width / 2;

    if (bottlenecks.procurement === 0 && bottlenecks.engineering === 0) {
      return;
    }

    // Container for bottleneck badges
    const totalWidth = 500;
    const badgeWidth = 200;
    const badgeHeight = 60;
    const gap = 40;

    const startX = centerX - totalWidth / 2;

    // Procurement badge
    if (bottlenecks.procurement > 0) {
      const procX = startX;
      ctx.beginPath();
      ctx.roundRect(procX, y, badgeWidth, badgeHeight, 12);
      ctx.fillStyle = hexToRgba(colors.warning, 0.2);
      ctx.fill();
      ctx.strokeStyle = colors.warning;
      ctx.lineWidth = 2;
      ctx.stroke();

      drawText(ctx, `Procurement: ${bottlenecks.procurement}`, procX + badgeWidth / 2, y + badgeHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 28,
        weight: 600,
        color: colors.warning,
        align: 'center',
        baseline: 'middle',
      });
    }

    // Engineering badge
    if (bottlenecks.engineering > 0) {
      const engX = startX + badgeWidth + gap;
      ctx.beginPath();
      ctx.roundRect(engX, y, badgeWidth, badgeHeight, 12);
      ctx.fillStyle = hexToRgba(colors.info, 0.2);
      ctx.fill();
      ctx.strokeStyle = colors.info;
      ctx.lineWidth = 2;
      ctx.stroke();

      drawText(ctx, `Engineering: ${bottlenecks.engineering}`, engX + badgeWidth / 2, y + badgeHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 28,
        weight: 600,
        color: colors.info,
        align: 'center',
        baseline: 'middle',
      });
    }
  }

  private triggerCelebration(): void {
    // Create celebration particles
    const { width, height } = this.displayConfig;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 400;
      const size = 8 + Math.random() * 16;

      this.celebrationParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200, // Upward bias
        size,
        color: [colors.success, colors.primaryLight, colors.white, '#FFD700'][
          Math.floor(Math.random() * 4)
        ],
        life: 1,
        decay: 0.3 + Math.random() * 0.3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  private updateAndDrawCelebration(ctx: SKRSContext2D, deltaTime: number): void {
    const gravity = 400;

    // Update and draw particles
    this.celebrationParticles = this.celebrationParticles.filter((p) => {
      // Update physics
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy += gravity * deltaTime;
      p.life -= p.decay * deltaTime;
      p.rotation += p.rotationSpeed * deltaTime;

      if (p.life <= 0) return false;

      // Draw particle
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.min(1, p.life);

      // Draw confetti piece (rectangle)
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);

      ctx.restore();

      return true;
    });
  }
}

interface CelebrationParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
}
