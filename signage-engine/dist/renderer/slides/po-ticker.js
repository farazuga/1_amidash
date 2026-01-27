import { BaseSlide } from './base-slide.js';
import { drawText, truncateText } from '../components/text.js';
import { roundRect, colors, hexToRgba } from '../components/index.js';
import { formatDistanceToNow, subDays, isAfter } from 'date-fns';
export class POTickerSlide extends BaseSlide {
    render(ctx, data, _deltaTime) {
        // Update animations
        this.updateAnimationState(_deltaTime);
        this.drawAmbientEffects(ctx);
        const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Recent Purchase Orders');
        const { width, height } = this.displayConfig;
        const padding = this.SCREEN_MARGIN;
        // Filter POs from last 10 days
        const tenDaysAgo = subDays(new Date(), 10);
        const sevenDaysAgo = subDays(new Date(), 7);
        const recentPOs = data.pos.data.filter(po => isAfter(new Date(po.created_at), tenDaysAgo));
        if (recentPOs.length === 0) {
            drawText(ctx, 'No recent purchase orders', width / 2, height / 2, {
                font: this.displayConfig.fontFamily,
                size: 64,
                color: hexToRgba(colors.white, 0.5),
                align: 'center',
            });
            return;
        }
        // Sort by amount to get top 3 largest
        const sortedByAmount = [...recentPOs].sort((a, b) => b.amount - a.amount);
        const top3 = sortedByAmount.slice(0, 3);
        // Get remaining POs from last 7 days (excluding top 3)
        const top3Ids = new Set(top3.map(po => po.id));
        const recentOthers = recentPOs
            .filter(po => !top3Ids.has(po.id) && isAfter(new Date(po.created_at), sevenDaysAgo))
            .slice(0, 6);
        // Use safe area bounds per DESIGN.md
        const bounds = this.getContentBounds();
        // Determine layout based on whether we have additional POs
        const hasRecentOthers = recentOthers.length > 0;
        // Calculate card dimensions - larger cards when no bottom section needed
        const topCardGap = 40;
        const topCardWidth = (width - padding * 2 - topCardGap * 2) / 3;
        // If no recent others, use more vertical space and center the cards
        const topCardHeight = hasRecentOthers
            ? bounds.height * 0.55 - 40
            : bounds.height * 0.7; // Taller cards when no bottom section
        // Calculate vertical position - center when no bottom section
        const labelHeight = 50;
        const totalTopHeight = labelHeight + topCardHeight;
        const verticalOffset = hasRecentOthers
            ? 0
            : (bounds.height - totalTopHeight) / 2;
        const topSectionY = bounds.y + verticalOffset;
        // Draw "TOP ORDERS" section label - larger
        drawText(ctx, 'LARGEST ORDERS (LAST 10 DAYS)', padding, topSectionY, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            weight: 600,
            color: hexToRgba(colors.white, 0.7),
        });
        // Draw top 3 large cards
        top3.forEach((po, index) => {
            const cardX = padding + index * (topCardWidth + topCardGap);
            const cardY = topSectionY + labelHeight;
            this.drawLargePOCard(ctx, po, cardX, cardY, topCardWidth, topCardHeight, index + 1);
        });
        // Calculate bottom section position
        const bottomSectionY = topSectionY + labelHeight + topCardHeight + this.SPACING.md;
        const bottomSectionHeight = bounds.y + bounds.height - bottomSectionY;
        // Draw "RECENT" section label if there are other POs
        if (recentOthers.length > 0) {
            drawText(ctx, 'RECENT ORDERS (LAST 7 DAYS)', padding, bottomSectionY - 20, {
                font: this.displayConfig.fontFamily,
                size: 36,
                weight: 600,
                color: hexToRgba(colors.white, 0.7),
            });
            // Draw remaining POs in a grid
            const smallCardGap = 24;
            const cols = Math.min(3, recentOthers.length);
            const rows = Math.ceil(recentOthers.length / cols);
            const smallCardWidth = (width - padding * 2 - smallCardGap * (cols - 1)) / cols;
            const smallCardHeight = Math.min(140, (bottomSectionHeight - smallCardGap * (rows - 1)) / rows);
            recentOthers.forEach((po, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const cardX = padding + col * (smallCardWidth + smallCardGap);
                const cardY = bottomSectionY + row * (smallCardHeight + smallCardGap);
                this.drawSmallPOCard(ctx, po, cardX, cardY, smallCardWidth, smallCardHeight);
            });
        }
    }
    drawLargePOCard(ctx, po, x, y, width, height, rank) {
        const cardPadding = 40;
        // Card background
        roundRect(ctx, x, y, width, height, 16);
        ctx.fillStyle = hexToRgba(colors.white, 0.1);
        ctx.fill();
        // Rank badge (gold, silver, bronze) - larger
        const rankColors = [colors.amber, '#C0C0C0', '#CD7F32'];
        const rankColor = rankColors[rank - 1] || colors.mauve;
        ctx.beginPath();
        ctx.arc(x + cardPadding + 35, y + cardPadding + 35, 38, 0, Math.PI * 2);
        ctx.fillStyle = rankColor;
        ctx.fill();
        drawText(ctx, `#${rank}`, x + cardPadding + 35, y + cardPadding + 35, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 700,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
        });
        // PO Number - larger
        drawText(ctx, po.po_number, x + cardPadding + 95, y + cardPadding + 35, {
            font: this.displayConfig.fontFamily,
            size: 40,
            weight: 600,
            color: colors.primaryLight,
            baseline: 'middle',
        });
        // Amount - LARGER
        const amountStr = `$${po.amount.toLocaleString()}`;
        drawText(ctx, amountStr, x + width / 2, y + height / 2 - 10, {
            font: this.displayConfig.fontFamily,
            size: 88,
            weight: 700,
            color: colors.primaryLight,
            align: 'center',
        });
        // Project name - larger
        drawText(ctx, truncateText(ctx, po.project_name, width - cardPadding * 2, this.displayConfig.fontFamily, 44), x + cardPadding, y + height - cardPadding - 85, {
            font: this.displayConfig.fontFamily,
            size: 44,
            weight: 600,
            color: colors.white,
        });
        // Client name - larger
        drawText(ctx, truncateText(ctx, po.client_name, width - cardPadding * 2, this.displayConfig.fontFamily, 36), x + cardPadding, y + height - cardPadding - 35, {
            font: this.displayConfig.fontFamily,
            size: 36,
            color: hexToRgba(colors.white, 0.7),
        });
        // Time ago - larger
        const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
        drawText(ctx, timeAgo, x + width - cardPadding, y + cardPadding + 35, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.6),
            align: 'right',
            baseline: 'middle',
        });
    }
    drawSmallPOCard(ctx, po, x, y, width, height) {
        const cardPadding = 28;
        // Card background
        roundRect(ctx, x, y, width, height, 12);
        ctx.fillStyle = hexToRgba(colors.white, 0.08);
        ctx.fill();
        // Left accent bar
        ctx.beginPath();
        ctx.roundRect(x, y, 8, height, [12, 0, 0, 12]);
        ctx.fillStyle = colors.mauve;
        ctx.fill();
        // PO Number badge - larger
        roundRect(ctx, x + cardPadding + 10, y + cardPadding, 200, 50, 8);
        ctx.fillStyle = hexToRgba(colors.mauve, 0.35);
        ctx.fill();
        drawText(ctx, po.po_number, x + cardPadding + 110, y + cardPadding + 25, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            weight: 600,
            color: colors.mauve,
            align: 'center',
            baseline: 'middle',
        });
        // Project name - larger
        drawText(ctx, truncateText(ctx, po.project_name, width * 0.55, this.displayConfig.fontFamily, 36), x + cardPadding + 10, y + cardPadding + 75, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 600,
            color: colors.white,
        });
        // Client - larger
        drawText(ctx, truncateText(ctx, po.client_name, width * 0.45, this.displayConfig.fontFamily, this.FONT_SIZE.MINIMUM), x + cardPadding + 10, y + cardPadding + 120, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.7),
        });
        // Amount on right - larger
        const amountStr = `$${po.amount.toLocaleString()}`;
        drawText(ctx, amountStr, x + width - cardPadding, y + height / 2, {
            font: this.displayConfig.fontFamily,
            size: 44,
            weight: 700,
            color: colors.primaryLight,
            align: 'right',
            baseline: 'middle',
        });
        // Time ago - larger
        const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
        drawText(ctx, timeAgo, x + width - cardPadding, y + cardPadding + 25, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.5),
            align: 'right',
            baseline: 'middle',
        });
    }
}
//# sourceMappingURL=po-ticker.js.map