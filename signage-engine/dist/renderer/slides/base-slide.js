import { loadImage } from '@napi-rs/canvas';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { createAnimationState, updateAnimations, } from '../components/animations.js';
import { formatCurrency as formatCurrencyFn, formatNumber as formatNumberFn, truncateText as truncateTextFn, formatPercent as formatPercentFn, formatDate as formatDateFn, formatDaysRemaining as formatDaysRemainingFn, } from '../components/format.js';
export class BaseSlide {
    config;
    displayConfig;
    logo = null;
    animationState;
    // Font size constants for 4K TV readability (viewed from 10-20 feet)
    // Reference: DESIGN.md "Typography: Font Sizes for 4K"
    FONT_SIZE = {
        HERO: 120, // Giant KPI numbers
        LARGE: 72, // Primary values
        HEADER: 56, // Section headers
        BODY: 48, // Card text, names
        LABEL: 40, // Secondary labels
        MINIMUM: 36, // Absolute minimum - NOTHING smaller
    };
    // Safe area constants per DESIGN.md "Layout & Grid: Screen Zones"
    // Ensures content never clips at edges and leaves room for footer banners
    SAFE_AREA = {
        top: 180, // Header zone height
        bottom: 240, // Footer zone height (for banners, legends)
        left: 140, // Side margin
        right: 140, // Side margin
    };
    // Spacing scale per DESIGN.md "Layout & Grid: Spacing Scale"
    SPACING = {
        xs: 20, // Tight internal padding
        sm: 40, // Standard gaps between elements
        md: 60, // Section separation
        lg: 80, // Major section breaks
        xl: 120, // Header/footer separation
    };
    // Card and container styling constants
    CARD = {
        borderRadius: 16, // Standard card corner radius
        borderRadiusSmall: 12, // Smaller elements
        borderRadiusBadge: 6, // Badges and tags
        padding: 24, // Internal card padding
        paddingLarge: 40, // Large card padding
        shadowBlur: 20, // Standard shadow blur
    };
    // Header and section constants
    HEADER = {
        height: 180, // Standard header height
        logoHeight: 80, // Logo size in header
        titleSize: 96, // Title font size
        timestampSize: 64, // Time display size
    };
    // Animation and timing constants
    ANIMATION = {
        transitionDuration: 500, // Standard transition (ms)
        fadeInDelay: 100, // Stagger delay for items (ms)
        scrollSpeed: 2, // Default scroll pixels/frame
    };
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
    // Draw ambient background effects - DISABLED for cleaner look and better performance
    drawAmbientEffects(_ctx) {
        // Animations disabled for readability and performance
        // Previously: drawAmbientGradient + drawParticles
    }
    // Screen margin constant - use this for consistent spacing
    SCREEN_MARGIN = 140;
    // New minimal header for full-screen slides
    drawMinimalHeader(ctx, title) {
        const headerHeight = 180;
        const padding = this.SCREEN_MARGIN;
        // Subtle gradient header background
        const gradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
        gradient.addColorStop(0, hexToRgba(colors.primary, 0.3));
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.displayConfig.width, headerHeight);
        // Logo - larger for better visibility
        if (this.logo) {
            const logoHeight = 80;
            const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
            ctx.drawImage(this.logo, padding, (headerHeight - logoHeight) / 2, logoWidth, logoHeight);
        }
        // Bold title - larger for readability from distance
        drawText(ctx, title.toUpperCase(), this.displayConfig.width / 2, headerHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 96,
            weight: 700,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
        });
        // Timestamp with accent color - larger
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        drawText(ctx, now, this.displayConfig.width - padding, headerHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 64,
            weight: 600,
            color: colors.primaryLight,
            align: 'right',
            baseline: 'middle',
        });
        // Accent line under header
        ctx.beginPath();
        ctx.moveTo(padding, headerHeight - 2);
        ctx.lineTo(this.displayConfig.width - padding, headerHeight - 2);
        ctx.strokeStyle = hexToRgba(colors.primaryLight, 0.4);
        ctx.lineWidth = 3;
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
        const boxWidth = 480;
        const boxHeight = 80;
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
            size: this.FONT_SIZE.BODY,
            color: colors.black,
            align: 'center',
            baseline: 'middle',
        });
    }
    /**
     * Get the safe content bounds per DESIGN.md "Layout & Grid: Screen Zones"
     * Returns the area where content should be rendered to avoid clipping
     */
    getContentBounds() {
        const x = this.SAFE_AREA.left;
        const y = this.SAFE_AREA.top;
        const width = this.displayConfig.width - this.SAFE_AREA.left - this.SAFE_AREA.right;
        const height = this.displayConfig.height - this.SAFE_AREA.top - this.SAFE_AREA.bottom;
        return {
            x,
            y,
            width,
            height,
            centerX: x + width / 2,
            centerY: y + height / 2,
        };
    }
    /**
     * Check if a rectangle would be clipped by safe area bounds
     * Use this to validate element positioning during development
     */
    isWithinSafeArea(elementX, elementY, elementWidth, elementHeight) {
        const bounds = this.getContentBounds();
        return (elementX >= bounds.x &&
            elementY >= bounds.y &&
            elementX + elementWidth <= bounds.x + bounds.width &&
            elementY + elementHeight <= bounds.y + bounds.height);
    }
    drawConnectionStatus(ctx, data) {
        const { connectionStatus } = data;
        if (connectionStatus.isConnected && !connectionStatus.usingMockData)
            return;
        const boxWidth = 800;
        const boxHeight = 80;
        const x = (this.displayConfig.width - boxWidth) / 2;
        // Position in footer zone per DESIGN.md, not overlapping content
        const y = this.displayConfig.height - this.SAFE_AREA.bottom / 2 - boxHeight / 2;
        // Semi-transparent red background with rounded corners
        ctx.beginPath();
        const radius = 12;
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + boxWidth - radius, y);
        ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
        ctx.lineTo(x + boxWidth, y + boxHeight - radius);
        ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
        ctx.lineTo(x + radius, y + boxHeight);
        ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.fill();
        // White border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Warning icon
        drawText(ctx, '⚠', x + 50, y + boxHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 44,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
        });
        // Error message
        const message = connectionStatus.usingMockData
            ? 'NOT CONNECTED TO DATABASE - SHOWING DEMO DATA'
            : 'DATABASE CONNECTION ERROR';
        drawText(ctx, message, x + boxWidth / 2 + 15, y + boxHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            weight: 600,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
        });
    }
    /**
     * Check if data is stale and draw an indicator if needed.
     * Call this at the end of render() for slides that should show stale data warnings.
     * @param lastUpdated The timestamp when data was last fetched
     * @param thresholdMs How old data can be before it's considered stale (default 60s)
     */
    drawStaleDataWarning(ctx, lastUpdated, thresholdMs = 60000) {
        if (!lastUpdated)
            return;
        const ageMs = Date.now() - lastUpdated.getTime();
        if (ageMs < thresholdMs)
            return;
        // Data is stale, show indicator
        const ageSeconds = Math.floor(ageMs / 1000);
        const ageText = ageSeconds >= 60
            ? `${Math.floor(ageSeconds / 60)}m ago`
            : `${ageSeconds}s ago`;
        const boxWidth = 280;
        const boxHeight = 50;
        const x = this.displayConfig.width - boxWidth - 20;
        const y = 190; // Below header
        // Warning background
        ctx.beginPath();
        ctx.roundRect(x, y, boxWidth, boxHeight, 8);
        ctx.fillStyle = hexToRgba(colors.warning, 0.9);
        ctx.fill();
        // Warning text
        drawText(ctx, `⚠ Data: ${ageText}`, x + boxWidth / 2, y + boxHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 28,
            weight: 600,
            color: colors.black,
            align: 'center',
            baseline: 'middle',
        });
    }
    /**
     * Draw debug overlay with development information.
     * Shows safe area boundaries, data timestamps, and slide info.
     * Only visible when debug mode is enabled in config.
     */
    drawDebugOverlay(ctx, data, slideIndex, slideCount, fps = 0) {
        const padding = 20;
        const lineHeight = 28;
        const fontSize = 22;
        // Debug panel background (bottom-left)
        const panelWidth = 400;
        const panelHeight = 200;
        const panelX = padding;
        const panelY = this.displayConfig.height - panelHeight - padding;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        // Debug info text
        let y = panelY + 30;
        const textX = panelX + 15;
        const debugLines = [
            `🔧 DEBUG MODE`,
            `Slide: ${slideIndex + 1} / ${slideCount}`,
            `FPS: ${fps.toFixed(1)}`,
            `Projects: ${data.projects.lastUpdated?.toLocaleTimeString() || 'N/A'}`,
            `Revenue: ${data.revenue.lastUpdated?.toLocaleTimeString() || 'N/A'}`,
            `Metrics: ${data.dashboardMetrics.lastUpdated?.toLocaleTimeString() || 'N/A'}`,
        ];
        debugLines.forEach((line) => {
            drawText(ctx, line, textX, y, {
                font: 'monospace',
                size: fontSize,
                color: '#00FF00',
            });
            y += lineHeight;
        });
        // Draw safe area boundary (dashed rectangle)
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.SAFE_AREA.left, this.SAFE_AREA.top, this.displayConfig.width - this.SAFE_AREA.left - this.SAFE_AREA.right, this.displayConfig.height - this.SAFE_AREA.top - this.SAFE_AREA.bottom);
        ctx.setLineDash([]);
        // Safe area labels
        drawText(ctx, 'SAFE AREA', this.SAFE_AREA.left + 10, this.SAFE_AREA.top + 25, {
            font: 'monospace',
            size: 18,
            color: 'rgba(255, 0, 255, 0.7)',
        });
    }
    // =====================================================
    // Shared Formatting Utilities
    // Use these instead of defining local formatting methods
    // =====================================================
    /** Format number as currency with K/M suffix ($2K, $1.50M) */
    formatCurrency(value, decimalsForMillions = 2) {
        return formatCurrencyFn(value, decimalsForMillions);
    }
    /** Format number with K/M suffix (2K, 1.5M) */
    formatNumber(value, decimalsForMillions = 1) {
        return formatNumberFn(value, decimalsForMillions);
    }
    /** Truncate text with ellipsis if too long */
    truncateText(text, maxLength) {
        return truncateTextFn(text, maxLength);
    }
    /** Format value as percentage */
    formatPercent(value, decimals = 0) {
        return formatPercentFn(value, decimals);
    }
    /** Format date as short readable string (Jan 15, 2024) */
    formatDate(date) {
        return formatDateFn(date);
    }
    /** Format days remaining/overdue (5 days left, 3 days overdue) */
    formatDaysRemaining(days) {
        return formatDaysRemainingFn(days);
    }
}
//# sourceMappingURL=base-slide.js.map