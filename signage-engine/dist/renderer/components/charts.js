export function drawBarChart(ctx, data, x, y, width, height, options = {}) {
    const { barGap = 10, labelColor = '#ffffff', fontSize = 36, showLabels = true, maxValue = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue || 0))), } = options;
    const barWidth = (width - barGap * (data.length - 1)) / data.length;
    const chartHeight = showLabels ? height - fontSize - 10 : height;
    data.forEach((item, index) => {
        const barX = x + index * (barWidth + barGap);
        const barHeight = (item.value / maxValue) * chartHeight;
        const barY = y + chartHeight - barHeight;
        // Draw secondary bar (goal) behind primary
        if (item.secondaryValue !== undefined) {
            const secondaryHeight = (item.secondaryValue / maxValue) * chartHeight;
            const secondaryY = y + chartHeight - secondaryHeight;
            ctx.fillStyle = item.secondaryColor || 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(barX, secondaryY, barWidth, secondaryHeight);
        }
        // Draw primary bar
        ctx.fillStyle = item.color || '#3b82f6';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        // Draw label - positioned below the bar with proper spacing
        if (showLabels) {
            ctx.fillStyle = labelColor;
            ctx.font = `${fontSize}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(item.label, barX + barWidth / 2, y + chartHeight + 15);
        }
    });
}
export function drawProgressBar(ctx, value, max, x, y, width, height, options = {}) {
    const { backgroundColor = 'rgba(255, 255, 255, 0.2)', fillColor = '#10b981', borderRadius = 4, } = options;
    const progress = Math.min(value / max, 1);
    const fillWidth = width * progress;
    // Background
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fillStyle = backgroundColor;
    ctx.fill();
    // Fill
    if (fillWidth > 0) {
        roundRect(ctx, x, y, fillWidth, height, borderRadius);
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
}
export function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}
export function drawKPICard(ctx, title, value, subtitle, x, y, width, height, options = {}) {
    const { backgroundColor = 'rgba(255, 255, 255, 0.1)', titleColor = 'rgba(255, 255, 255, 0.7)', valueColor = '#ffffff', subtitleColor = 'rgba(255, 255, 255, 0.5)', borderRadius = 12, } = options;
    // Card background
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fillStyle = backgroundColor;
    ctx.fill();
    const padding = 24;
    // Title
    ctx.fillStyle = titleColor;
    ctx.font = '40px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + padding, y + padding + 40);
    // Value
    ctx.fillStyle = valueColor;
    ctx.font = 'bold 64px Inter';
    ctx.fillText(value, x + padding, y + padding + 110);
    // Subtitle
    ctx.fillStyle = subtitleColor;
    ctx.font = '36px Inter';
    ctx.fillText(subtitle, x + padding, y + padding + 160);
}
//# sourceMappingURL=charts.js.map