import { colors, hexToRgba } from './colors.js';
// Create initial animation state
export function createAnimationState() {
    return {
        particles: [],
        countingNumbers: new Map(),
        time: 0,
        pulsePhase: 0,
    };
}
// Update animation state each frame
export function updateAnimations(state, deltaTime, width, height) {
    state.time += deltaTime;
    state.pulsePhase = (state.pulsePhase + deltaTime * 0.002) % (Math.PI * 2);
    // Update particles
    state.particles = state.particles.filter(p => {
        p.x += p.vx * deltaTime * 0.001;
        p.y += p.vy * deltaTime * 0.001;
        p.life -= deltaTime;
        p.alpha = Math.max(0, (p.life / p.maxLife) * 0.6);
        return p.life > 0;
    });
    // Spawn new particles occasionally
    if (state.particles.length < 50 && Math.random() < 0.1) {
        state.particles.push(createParticle(width, height));
    }
}
function createParticle(width, height) {
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    switch (edge) {
        case 0: // Top
            x = Math.random() * width;
            y = -10;
            vx = (Math.random() - 0.5) * 20;
            vy = Math.random() * 30 + 10;
            break;
        case 1: // Right
            x = width + 10;
            y = Math.random() * height;
            vx = -(Math.random() * 30 + 10);
            vy = (Math.random() - 0.5) * 20;
            break;
        case 2: // Bottom
            x = Math.random() * width;
            y = height + 10;
            vx = (Math.random() - 0.5) * 20;
            vy = -(Math.random() * 30 + 10);
            break;
        default: // Left
            x = -10;
            y = Math.random() * height;
            vx = Math.random() * 30 + 10;
            vy = (Math.random() - 0.5) * 20;
    }
    // Use brand palette colors for particles
    const brandColors = [
        colors.primary, // Main Dark Green
        colors.primaryLight, // Main Light Green
        colors.mauve, // Mauve accent
        colors.coral, // Coral accent
        colors.amber, // Amber accent
    ];
    const randomColor = brandColors[Math.floor(Math.random() * brandColors.length)];
    return {
        x, y, vx, vy,
        size: Math.random() * 4 + 2,
        alpha: 0.5,
        color: randomColor,
        life: Math.random() * 15000 + 10000,
        maxLife: 20000,
    };
}
// Draw ambient particle effects
export function drawParticles(ctx, state) {
    state.particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(p.color, p.alpha);
        ctx.fill();
    });
}
// Draw subtle gradient overlay for depth
export function drawAmbientGradient(ctx, width, height, phase) {
    // Radial glow from corners
    const glowIntensity = 0.03 + Math.sin(phase) * 0.01;
    // Top-left teal glow
    const gradient1 = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.6);
    gradient1.addColorStop(0, hexToRgba(colors.primary, glowIntensity * 1.5));
    gradient1.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient1;
    ctx.fillRect(0, 0, width, height);
    // Bottom-right accent glow
    const gradient2 = ctx.createRadialGradient(width, height, 0, width, height, width * 0.5);
    gradient2.addColorStop(0, hexToRgba(colors.accent, glowIntensity));
    gradient2.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient2;
    ctx.fillRect(0, 0, width, height);
}
// Get animated counting number value
export function getAnimatedNumber(state, key, targetValue, duration = 1500) {
    const existing = state.countingNumbers.get(key);
    if (!existing || existing.target !== targetValue) {
        state.countingNumbers.set(key, {
            current: existing?.current ?? 0,
            target: targetValue,
            startTime: state.time,
            duration,
        });
    }
    const counter = state.countingNumbers.get(key);
    const elapsed = state.time - counter.startTime;
    const progress = Math.min(1, elapsed / counter.duration);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    return Math.round(counter.current + (counter.target - counter.current) * eased);
}
// Draw pulsing glow behind an element - DISABLED for cleaner look
export function drawPulsingGlow(_ctx, _x, _y, _width, _height, _phase, _color = colors.primary) {
    // Glow effects disabled for better readability
}
// Draw progress bar - simplified without animations for better performance
export function drawAnimatedProgressBar(ctx, x, y, width, height, progress, _phase, options = {}) {
    const { backgroundColor = 'rgba(255, 255, 255, 0.15)', fillColor = colors.primary, rounded = true, } = options;
    const radius = rounded ? height / 2 : 0;
    // Background track
    ctx.beginPath();
    if (rounded) {
        ctx.roundRect(x, y, width, height, radius);
    }
    else {
        ctx.rect(x, y, width, height);
    }
    ctx.fillStyle = backgroundColor;
    ctx.fill();
    // Filled portion - simple solid fill, no shimmer or glow
    const fillWidth = width * Math.min(1, progress);
    if (fillWidth > 0) {
        ctx.beginPath();
        if (rounded) {
            ctx.roundRect(x, y, fillWidth, height, radius);
        }
        else {
            ctx.rect(x, y, fillWidth, height);
        }
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
}
// Format large numbers with K/M suffixes
export function formatLargeNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
}
// Format currency
export function formatCurrency(amount, animated = false) {
    if (animated) {
        return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}
//# sourceMappingURL=animations.js.map