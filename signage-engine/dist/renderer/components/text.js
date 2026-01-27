export function drawText(ctx, text, x, y, style = {}) {
    const { font = 'Inter', size = 24, weight = 400, color = '#ffffff', align = 'left', baseline = 'top', maxWidth, letterSpacing = 0, } = style;
    // Build font string with weight
    // @napi-rs/canvas requires proper CSS font shorthand format
    // Convert numeric weights to CSS keywords for better compatibility
    let fontWeight;
    if (typeof weight === 'number') {
        if (weight >= 700) {
            fontWeight = 'bold';
        }
        else if (weight >= 600) {
            fontWeight = '600';
        }
        else {
            fontWeight = 'normal';
        }
    }
    else {
        fontWeight = weight;
    }
    // Use font with fallback to system fonts
    ctx.font = `${fontWeight} ${size}px ${font}, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    // Handle letter spacing by drawing each character
    if (letterSpacing > 0) {
        drawTextWithSpacing(ctx, text, x, y, letterSpacing, align);
    }
    else if (maxWidth) {
        ctx.fillText(text, x, y, maxWidth);
    }
    else {
        ctx.fillText(text, x, y);
    }
}
// Draw text with custom letter spacing
function drawTextWithSpacing(ctx, text, x, y, spacing, align) {
    const chars = text.split('');
    let totalWidth = 0;
    // Calculate total width
    chars.forEach(char => {
        totalWidth += ctx.measureText(char).width + spacing;
    });
    totalWidth -= spacing; // Remove trailing spacing
    // Adjust starting position based on alignment
    let currentX = x;
    if (align === 'center') {
        currentX = x - totalWidth / 2;
    }
    else if (align === 'right' || align === 'end') {
        currentX = x - totalWidth;
    }
    // Draw each character
    chars.forEach(char => {
        ctx.fillText(char, currentX, y);
        currentX += ctx.measureText(char).width + spacing;
    });
}
export function drawTextWrapped(ctx, text, x, y, maxWidth, lineHeight, style = {}) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const { font = 'Inter', size = 24, color = '#ffffff' } = style;
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = style.align || 'left';
    ctx.textBaseline = style.baseline || 'top';
    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), x, currentY);
            line = word + ' ';
            currentY += lineHeight;
        }
        else {
            line = testLine;
        }
    }
    if (line.trim()) {
        ctx.fillText(line.trim(), x, currentY);
        currentY += lineHeight;
    }
    return currentY;
}
export function measureText(ctx, text, font, size) {
    ctx.font = `${size}px ${font}`;
    return ctx.measureText(text).width;
}
export function truncateText(ctx, text, maxWidth, font, size) {
    ctx.font = `${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}
//# sourceMappingURL=text.js.map