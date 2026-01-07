import { ActiveProjectsSlide } from './slides/active-projects.js';
import { ProjectMetricsSlide } from './slides/project-metrics.js';
import { POTickerSlide } from './slides/po-ticker.js';
import { RevenueDashboardSlide } from './slides/revenue-dashboard.js';
import { TeamScheduleSlide } from './slides/team-schedule.js';
// New slides
import { UpcomingProjectsSlide } from './slides/upcoming-projects.js';
import { InProgressSlide } from './slides/in-progress.js';
import { MonthlyScorecardSlide } from './slides/monthly-scorecard.js';
import { BottleneckAlertSlide } from './slides/bottleneck-alert.js';
import { RecentWinsSlide } from './slides/recent-wins.js';
import { logger } from '../utils/logger.js';
export class SlideManager {
    slides = [];
    currentSlideIndex = 0;
    slideStartTime = 0;
    transitionProgress = 0;
    isTransitioning = false;
    displayConfig;
    transitionConfig;
    lastFrameTime = 0;
    constructor(slideConfigs, displayConfig, transitionConfig) {
        this.displayConfig = displayConfig;
        this.transitionConfig = transitionConfig;
        // Create slide instances for enabled slides
        slideConfigs
            .filter((config) => config.enabled)
            .forEach((config) => {
            const slide = this.createSlide(config);
            if (slide) {
                this.slides.push(slide);
            }
        });
        logger.info({ slideCount: this.slides.length }, 'Slide manager initialized');
    }
    createSlide(config) {
        switch (config.type) {
            case 'active-projects':
            case 'project-list':
                return new ActiveProjectsSlide(config, this.displayConfig);
            case 'project-metrics':
                return new ProjectMetricsSlide(config, this.displayConfig);
            case 'po-ticker':
                return new POTickerSlide(config, this.displayConfig);
            case 'revenue-dashboard':
                return new RevenueDashboardSlide(config, this.displayConfig);
            case 'team-schedule':
                return new TeamScheduleSlide(config, this.displayConfig);
            // New slides
            case 'upcoming-projects':
                return new UpcomingProjectsSlide(config, this.displayConfig);
            case 'in-progress':
                return new InProgressSlide(config, this.displayConfig);
            case 'monthly-scorecard':
                return new MonthlyScorecardSlide(config, this.displayConfig);
            case 'bottleneck-alert':
                return new BottleneckAlertSlide(config, this.displayConfig);
            case 'recent-wins':
                return new RecentWinsSlide(config, this.displayConfig);
            default:
                logger.warn({ type: config.type }, 'Unknown slide type');
                return null;
        }
    }
    // Reload slides from database config
    async reloadFromDatabase(dbSlides) {
        const newSlides = [];
        for (const dbSlide of dbSlides) {
            if (!dbSlide.enabled)
                continue;
            const config = {
                type: this.mapSlideType(dbSlide.slide_type),
                enabled: dbSlide.enabled,
                duration: dbSlide.duration_ms,
                title: dbSlide.title || undefined,
                maxItems: dbSlide.config?.maxItems,
                scrollSpeed: dbSlide.config?.scrollSpeed,
            };
            const slide = this.createSlide(config);
            if (slide) {
                await slide.loadLogo();
                newSlides.push(slide);
            }
        }
        if (newSlides.length > 0) {
            this.slides = newSlides;
            // Reset to first slide when reloading
            if (this.currentSlideIndex >= this.slides.length) {
                this.currentSlideIndex = 0;
                this.slideStartTime = Date.now();
            }
            logger.info({ slideCount: newSlides.length }, 'Slides reloaded from database');
        }
    }
    mapSlideType(dbType) {
        const typeMap = {
            'project-list': 'project-list',
            'project-metrics': 'project-metrics',
            'po-ticker': 'po-ticker',
            'revenue-dashboard': 'revenue-dashboard',
            'team-schedule': 'team-schedule',
            'active-projects': 'active-projects',
            // New slide types
            'upcoming-projects': 'upcoming-projects',
            'in-progress': 'in-progress',
            'monthly-scorecard': 'monthly-scorecard',
            'bottleneck-alert': 'bottleneck-alert',
            'recent-wins': 'recent-wins',
        };
        return typeMap[dbType] || 'active-projects';
    }
    async loadAssets() {
        for (const slide of this.slides) {
            await slide.loadLogo();
        }
    }
    render(canvasManager, data) {
        if (this.slides.length === 0)
            return;
        const now = Date.now();
        const deltaTime = this.lastFrameTime ? now - this.lastFrameTime : 16.67;
        this.lastFrameTime = now;
        const ctx = canvasManager.getBackContext();
        canvasManager.clear();
        const currentSlide = this.slides[this.currentSlideIndex];
        const currentConfig = this.getSlideConfig(this.currentSlideIndex);
        // Check if it's time to transition
        if (!this.isTransitioning && now - this.slideStartTime >= currentConfig.duration) {
            this.startTransition();
        }
        if (this.isTransitioning) {
            this.renderTransition(ctx, canvasManager, data, deltaTime);
        }
        else {
            currentSlide.render(ctx, data, deltaTime);
        }
        canvasManager.swap();
    }
    startTransition() {
        this.isTransitioning = true;
        this.transitionProgress = 0;
        logger.debug({ from: this.currentSlideIndex, to: (this.currentSlideIndex + 1) % this.slides.length }, 'Starting transition');
    }
    renderTransition(ctx, canvasManager, data, deltaTime) {
        const duration = this.transitionConfig.duration;
        this.transitionProgress += deltaTime / duration;
        if (this.transitionProgress >= 1) {
            this.transitionProgress = 0;
            this.isTransitioning = false;
            this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
            this.slideStartTime = Date.now();
            this.slides[this.currentSlideIndex].render(ctx, data, deltaTime);
            return;
        }
        const currentSlide = this.slides[this.currentSlideIndex];
        const nextIndex = (this.currentSlideIndex + 1) % this.slides.length;
        const nextSlide = this.slides[nextIndex];
        switch (this.transitionConfig.type) {
            case 'fade':
                this.renderFadeTransition(ctx, canvasManager, data, deltaTime, currentSlide, nextSlide);
                break;
            case 'slide':
                this.renderSlideTransition(ctx, canvasManager, data, deltaTime, currentSlide, nextSlide);
                break;
            case 'none':
            default:
                nextSlide.render(ctx, data, deltaTime);
        }
    }
    renderFadeTransition(ctx, _canvasManager, data, deltaTime, currentSlide, nextSlide) {
        // Render current slide
        currentSlide.render(ctx, data, deltaTime);
        // Apply fade overlay
        ctx.globalAlpha = this.transitionProgress;
        ctx.fillStyle = this.displayConfig.backgroundColor;
        ctx.fillRect(0, 0, this.displayConfig.width, this.displayConfig.height);
        // Render next slide with increasing opacity
        nextSlide.render(ctx, data, deltaTime);
        ctx.globalAlpha = 1;
    }
    renderSlideTransition(ctx, _canvasManager, data, deltaTime, currentSlide, nextSlide) {
        const offset = this.displayConfig.width * this.transitionProgress;
        ctx.save();
        ctx.translate(-offset, 0);
        currentSlide.render(ctx, data, deltaTime);
        ctx.restore();
        ctx.save();
        ctx.translate(this.displayConfig.width - offset, 0);
        nextSlide.render(ctx, data, deltaTime);
        ctx.restore();
    }
    getSlideConfig(index) {
        // Find the config for this slide
        const enabledConfigs = this.slides.map((_, i) => i);
        return this.slides[enabledConfigs[index]]?.['config'] || { type: 'active-projects', enabled: true, duration: 15000 };
    }
    getCurrentSlideIndex() {
        return this.currentSlideIndex;
    }
    getSlideCount() {
        return this.slides.length;
    }
    reset() {
        this.currentSlideIndex = 0;
        this.slideStartTime = Date.now();
        this.isTransitioning = false;
        this.transitionProgress = 0;
    }
}
//# sourceMappingURL=slide-manager.js.map