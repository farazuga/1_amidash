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
        // Get remaining POs from last 7 days (excluding top 3) - show more items
        const top3Ids = new Set(top3.map(po => po.id));
        const recentOthers = recentPOs
            .filter(po => !top3Ids.has(po.id) && isAfter(new Date(po.created_at), sevenDaysAgo))
            .slice(0, 9);
        // Layout calculations - reduced top section to show more content
        const topSectionHeight = (height - headerHeight - padding * 2) * 0.42;
        const bottomSectionY = headerHeight + padding + topSectionHeight + 50;
        const bottomSectionHeight = height - bottomSectionY - padding;
        // Draw "TOP ORDERS" section label - larger
        drawText(ctx, 'LARGEST ORDERS (LAST 10 DAYS)', padding, headerHeight + 30, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 600,
            color: hexToRgba(colors.white, 0.7),
        });
        // Draw top 3 large cards
        const topCardGap = 40;
        const topCardWidth = (width - padding * 2 - topCardGap * 2) / 3;
        const topCardHeight = topSectionHeight - 40;
        top3.forEach((po, index) => {
            const cardX = padding + index * (topCardWidth + topCardGap);
            const cardY = headerHeight + padding + 30;
            this.drawLargePOCard(ctx, po, cardX, cardY, topCardWidth, topCardHeight, index + 1);
        });
        // Draw "RECENT" section label if there are other POs
        if (recentOthers.length > 0) {
            drawText(ctx, 'RECENT ORDERS (LAST 7 DAYS)', padding, bottomSectionY - 20, {
                font: this.displayConfig.fontFamily,
                size: 36,
                weight: 600,
                color: hexToRgba(colors.white, 0.7),
            });
            // Draw remaining POs in a grid - more compact
            const smallCardGap = 20;
            const cols = Math.min(3, recentOthers.length);
            const rows = Math.ceil(recentOthers.length / cols);
            const smallCardWidth = (width - padding * 2 - smallCardGap * (cols - 1)) / cols;
            const smallCardHeight = Math.min(120, (bottomSectionHeight - smallCardGap * (rows - 1)) / rows);
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
        const cardPadding = 30;
        // Card background
        roundRect(ctx, x, y, width, height, 16);
        ctx.fillStyle = hexToRgba(colors.white, 0.1);
        ctx.fill();
        // Rank badge (gold, silver, bronze) - compact
        const rankColors = [colors.amber, '#C0C0C0', '#CD7F32'];
        const rankColor = rankColors[rank - 1] || colors.mauve;
        ctx.beginPath();
        ctx.arc(x + cardPadding + 28, y + cardPadding + 28, 30, 0, Math.PI * 2);
        ctx.fillStyle = rankColor;
        ctx.fill();
        drawText(ctx, `#${rank}`, x + cardPadding + 28, y + cardPadding + 28, {
            font: this.displayConfig.fontFamily,
            size: 30,
            weight: 700,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
        });
        // PO Number
        drawText(ctx, po.po_number, x + cardPadding + 75, y + cardPadding + 28, {
            font: this.displayConfig.fontFamily,
            size: 34,
            weight: 600,
            color: colors.primaryLight,
            baseline: 'middle',
        });
        // Amount - prominent but compact
        const amountStr = `$${po.amount.toLocaleString()}`;
        drawText(ctx, amountStr, x + width / 2, y + height / 2 - 5, {
            font: this.displayConfig.fontFamily,
            size: 72,
            weight: 700,
            color: colors.primaryLight,
            align: 'center',
        });
        // Project name
        drawText(ctx, truncateText(ctx, po.project_name, width - cardPadding * 2, this.displayConfig.fontFamily, 38), x + cardPadding, y + height - cardPadding - 65, {
            font: this.displayConfig.fontFamily,
            size: 38,
            weight: 600,
            color: colors.white,
        });
        // Client name
        drawText(ctx, truncateText(ctx, po.client_name, width - cardPadding * 2, this.displayConfig.fontFamily, 30), x + cardPadding, y + height - cardPadding - 25, {
            font: this.displayConfig.fontFamily,
            size: 30,
            color: hexToRgba(colors.white, 0.7),
        });
        // Time ago
        const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
        drawText(ctx, timeAgo, x + width - cardPadding, y + cardPadding + 28, {
            font: this.displayConfig.fontFamily,
            size: 26,
            color: hexToRgba(colors.white, 0.6),
            align: 'right',
            baseline: 'middle',
        });
    }
    drawSmallPOCard(ctx, po, x, y, width, height) {
        const cardPadding = 20;
        // Card background
        roundRect(ctx, x, y, width, height, 10);
        ctx.fillStyle = hexToRgba(colors.white, 0.08);
        ctx.fill();
        // Left accent bar
        ctx.beginPath();
        ctx.roundRect(x, y, 6, height, [10, 0, 0, 10]);
        ctx.fillStyle = colors.mauve;
        ctx.fill();
        // PO Number badge - compact
        roundRect(ctx, x + cardPadding + 8, y + cardPadding - 2, 150, 36, 6);
        ctx.fillStyle = hexToRgba(colors.mauve, 0.35);
        ctx.fill();
        drawText(ctx, po.po_number, x + cardPadding + 83, y + cardPadding + 16, {
            font: this.displayConfig.fontFamily,
            size: 24,
            weight: 600,
            color: colors.mauve,
            align: 'center',
            baseline: 'middle',
        });
        // Project name - compact
        drawText(ctx, truncateText(ctx, po.project_name, width * 0.50, this.displayConfig.fontFamily, 28), x + cardPadding + 8, y + cardPadding + 52, {
            font: this.displayConfig.fontFamily,
            size: 28,
            weight: 600,
            color: colors.white,
        });
        // Client - compact
        drawText(ctx, truncateText(ctx, po.client_name, width * 0.40, this.displayConfig.fontFamily, 22), x + cardPadding + 8, y + cardPadding + 82, {
            font: this.displayConfig.fontFamily,
            size: 22,
            color: hexToRgba(colors.white, 0.7),
        });
        // Amount on right
        const amountStr = `$${po.amount.toLocaleString()}`;
        drawText(ctx, amountStr, x + width - cardPadding, y + height / 2 + 5, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 700,
            color: colors.primaryLight,
            align: 'right',
            baseline: 'middle',
        });
        // Time ago
        const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
        drawText(ctx, timeAgo, x + width - cardPadding, y + cardPadding + 16, {
            font: this.displayConfig.fontFamily,
            size: 22,
            color: hexToRgba(colors.white, 0.5),
            align: 'right',
            baseline: 'middle',
        });
    }
}
//# sourceMappingURL=po-ticker.js.map