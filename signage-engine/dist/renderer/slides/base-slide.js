import { loadImage } from '@napi-rs/canvas';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { createAnimationState, updateAnimations, drawParticles, drawAmbientGradient, } from '../components/animations.js';
export class BaseSlide {
    config;
    displayConfig;
    logo = null;
    animationState;
    constructor(config, displayConfig) {
        this.config = config;
        this.displayConfig = displayConfig;
        this.animationState = createAnimationState();
    }
    async loadLogo() {
        if (this.displayConfig.logoPath) {
            try {
                this.logo = await loadImage(this.displayConfig.logoPath);
            }
            catch {
                // Logo loading failed, continue without it
            }
        }
    }
    // Update animations - call at start of render
    updateAnimationState(deltaTime) {
        updateAnimations(this.animationState, deltaTime, this.displayConfig.width, this.displayConfig.height);
    }
    // Draw ambient background effects
    drawAmbientEffects(ctx) {
        drawAmbientGradient(ctx, this.displayConfig.width, this.displayConfig.height, this.animationState.pulsePhase);
        drawParticles(ctx, this.animationState);
    }
    // New minimal header for full-screen slides
    drawMinimalHeader(ctx, title) {
        const headerHeight = 120;
        const padding = 80;
        // Subtle gradient header background
        const gradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
        gradient.addColorStop(0, hexToRgba(colors.primary, 0.3));
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.displayConfig.width, headerHeight);
        // Logo with glow
        if (this.logo) {
            const logoHeight = 50;
            const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
            ctx.drawImage(this.logo, padding, (headerHeight - logoHeight) / 2, logoWidth, logoHeight);
        }
        // Bold title
        drawText(ctx, title.toUpperCase(), this.displayConfig.width / 2, headerHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 72,
            weight: 700,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
            letterSpacing: 8,
        });
        // Timestamp with accent color
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        drawText(ctx, now, this.displayConfig.width - padding, headerHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 48,
            color: colors.primaryLight,
            align: 'right',
            baseline: 'middle',
        });
        // Accent line under header
        ctx.beginPath();
        ctx.moveTo(padding, headerHeight - 2);
        ctx.lineTo(this.displayConfig.width - padding, headerHeight - 2);
        ctx.strokeStyle = hexToRgba(colors.primary, 0.5);
        ctx.lineWidth = 2;
        ctx.stroke();
        return headerHeight;
    }
    // Legacy header for compatibility
    drawHeader(ctx, title) {
        return this.drawMinimalHeader(ctx, title);
    }
    drawStaleIndicator(ctx, isStale, position) {
        if (!isStale)
            return;
        const padding = 20;
        const boxWidth = 200;
        const boxHeight = 40;
        let x, y;
        switch (position) {
            case 'top-left':
                x = padding;
                y = 130;
                break;
            case 'top-right':
                x = this.displayConfig.width - boxWidth - padding;
                y = 130;
                break;
            case 'bottom-left':
                x = padding;
                y = this.displayConfig.height - boxHeight - padding;
                break;
            case 'bottom-right':
            default:
                x = this.displayConfig.width - boxWidth - padding;
                y = this.displayConfig.height - boxHeight - padding;
        }
        ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.fillRect(x, y, boxWidth, boxHeight);
        drawText(ctx, '⚠ Data may be stale', x + boxWidth / 2, y + boxHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 18,
            color: colors.black,
            align: 'center',
            baseline: 'middle',
        });
    }
}
//# sourceMappingURL=base-slide.js.map