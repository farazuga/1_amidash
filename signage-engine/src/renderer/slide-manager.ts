import type { CanvasRenderingContext2D, Image } from 'canvas';
import { logger } from '../utils/logger.js';
import type { SlideConfig, DisplayConfig, TransitionConfig, StaleDataConfig } from '../config/schema.js';
import { BaseSlide, SlideRenderContext } from './slides/base-slide.js';
import { ActiveProjectsSlide, ActiveProjectsData } from './slides/active-projects.js';
import { POTickerSlide, POTickerData } from './slides/po-ticker.js';
import { RevenueDashboardSlide } from './slides/revenue-dashboard.js';
import { TeamScheduleSlide } from './slides/team-schedule.js';
import type { CachedData } from '../data/polling-manager.js';
import { colors } from './components/colors.js';

export type SlideData = ActiveProjectsData | POTickerData | CachedData['revenue'] | CachedData['schedule'];

interface TransitionState {
  active: boolean;
  progress: number; // 0-1
  type: 'fade' | 'slide' | 'none';
  startTime: number;
  duration: number;
}

/**
 * Slide manager handles slide creation, rotation, and transitions
 */
export class SlideManager {
  private slides: BaseSlide[] = [];
  private currentIndex: number = 0;
  private slideStartTime: number = 0;
  private transitionState: TransitionState = {
    active: false,
    progress: 0,
    type: 'none',
    startTime: 0,
    duration: 0,
  };
  private displayConfig: DisplayConfig;
  private transitionConfig: TransitionConfig;
  private staleDataConfig: StaleDataConfig;
  private logo: Image | null = null;

  constructor(
    slideConfigs: SlideConfig[],
    displayConfig: DisplayConfig,
    transitionConfig: TransitionConfig,
    staleDataConfig: StaleDataConfig
  ) {
    this.displayConfig = displayConfig;
    this.transitionConfig = transitionConfig;
    this.staleDataConfig = staleDataConfig;
    this.createSlides(slideConfigs);
    this.slideStartTime = Date.now();
  }

  /**
   * Create slide instances from configurations
   */
  private createSlides(configs: SlideConfig[]): void {
    this.slides = [];

    configs.forEach((config) => {
      if (!config.enabled) return;

      let slide: BaseSlide | null = null;

      switch (config.type) {
        case 'active-projects':
          slide = new ActiveProjectsSlide(config);
          break;
        case 'po-ticker':
          slide = new POTickerSlide(config);
          break;
        case 'revenue-dashboard':
          slide = new RevenueDashboardSlide(config);
          break;
        case 'team-schedule':
          slide = new TeamScheduleSlide(config);
          break;
        default:
          logger.warn({ type: config.type }, 'Unknown slide type');
      }

      if (slide) {
        this.slides.push(slide);
        logger.info({ type: config.type, duration: config.duration }, 'Created slide');
      }
    });

    if (this.slides.length === 0) {
      logger.warn('No slides enabled');
    } else {
      logger.info({ count: this.slides.length }, 'Slide manager initialized');
    }
  }

  /**
   * Set the logo image
   */
  setLogo(logo: Image | null): void {
    this.logo = logo;
  }

  /**
   * Update slide configurations
   */
  updateSlides(configs: SlideConfig[]): void {
    this.createSlides(configs);
    this.currentIndex = 0;
    this.slideStartTime = Date.now();
  }

  /**
   * Update display configuration
   */
  updateDisplayConfig(config: DisplayConfig): void {
    this.displayConfig = config;
  }

  /**
   * Update transition configuration
   */
  updateTransitionConfig(config: TransitionConfig): void {
    this.transitionConfig = config;
  }

  /**
   * Get the current slide index
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get total number of slides
   */
  getTotalSlides(): number {
    return this.slides.length;
  }

  /**
   * Get the current slide
   */
  getCurrentSlide(): BaseSlide | null {
    return this.slides[this.currentIndex] || null;
  }

  /**
   * Get time remaining on current slide (ms)
   */
  getTimeRemaining(): number {
    const currentSlide = this.getCurrentSlide();
    if (!currentSlide) return 0;

    const elapsed = Date.now() - this.slideStartTime;
    return Math.max(0, currentSlide.getDuration() - elapsed);
  }

  /**
   * Check if it's time to advance to the next slide
   */
  private shouldAdvance(): boolean {
    if (this.slides.length <= 1) return false;
    if (this.transitionState.active) return false;

    const currentSlide = this.getCurrentSlide();
    if (!currentSlide) return false;

    const elapsed = Date.now() - this.slideStartTime;
    return elapsed >= currentSlide.getDuration();
  }

  /**
   * Start transition to next slide
   */
  private startTransition(): void {
    if (this.transitionConfig.type === 'none' || this.transitionConfig.duration === 0) {
      // No transition, just advance
      this.advanceSlide();
      return;
    }

    this.transitionState = {
      active: true,
      progress: 0,
      type: this.transitionConfig.type,
      startTime: Date.now(),
      duration: this.transitionConfig.duration,
    };
  }

  /**
   * Update transition progress
   */
  private updateTransition(): void {
    if (!this.transitionState.active) return;

    const elapsed = Date.now() - this.transitionState.startTime;
    this.transitionState.progress = Math.min(1, elapsed / this.transitionState.duration);

    if (this.transitionState.progress >= 1) {
      this.transitionState.active = false;
      this.advanceSlide();
    }
  }

  /**
   * Advance to the next slide
   */
  private advanceSlide(): void {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.slideStartTime = Date.now();

    // Reset scroll on ticker slides
    const currentSlide = this.getCurrentSlide();
    if (currentSlide instanceof POTickerSlide) {
      currentSlide.resetScroll();
    }

    logger.debug({ index: this.currentIndex, type: currentSlide?.getType() }, 'Advanced to slide');
  }

  /**
   * Render the current frame
   */
  render(
    ctx: CanvasRenderingContext2D,
    data: CachedData,
    lastUpdateTime: number,
    width: number,
    height: number
  ): void {
    // Check if we should advance
    if (this.shouldAdvance()) {
      this.startTransition();
    }

    // Update transition
    this.updateTransition();

    // Determine if data is stale
    const isStale = Date.now() - lastUpdateTime > this.staleDataConfig.warningThresholdMs;

    // Create render context
    const context: SlideRenderContext = {
      ctx,
      width,
      height,
      config: this.getCurrentSlide()?.getConfig() || { type: 'active-projects', enabled: true, duration: 15000 },
      displayConfig: this.displayConfig,
      staleDataConfig: this.staleDataConfig,
      logo: this.logo,
      isStale,
      lastUpdate: lastUpdateTime,
    };

    // Get current slide data
    const currentSlide = this.getCurrentSlide();
    if (!currentSlide) {
      this.renderNoSlides(ctx, width, height);
      return;
    }

    // Render based on transition state
    if (this.transitionState.active) {
      this.renderWithTransition(ctx, context, data, width, height);
    } else {
      const slideData = this.getSlideData(currentSlide.getType(), data);
      currentSlide.render(context, slideData);
    }
  }

  /**
   * Render with transition effect
   */
  private renderWithTransition(
    ctx: CanvasRenderingContext2D,
    context: SlideRenderContext,
    data: CachedData,
    width: number,
    height: number
  ): void {
    const currentSlide = this.getCurrentSlide();
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    const nextSlide = this.slides[nextIndex];

    if (!currentSlide || !nextSlide) return;

    const progress = this.transitionState.progress;

    switch (this.transitionState.type) {
      case 'fade':
        // Render current slide
        const currentData = this.getSlideData(currentSlide.getType(), data);
        currentSlide.render(context, currentData);

        // Overlay next slide with increasing opacity
        ctx.globalAlpha = progress;
        const nextContext = { ...context, config: nextSlide.getConfig() };
        const nextData = this.getSlideData(nextSlide.getType(), data);
        nextSlide.render(nextContext, nextData);
        ctx.globalAlpha = 1;
        break;

      case 'slide':
        // Slide current slide out to the left
        ctx.save();
        ctx.translate(-width * progress, 0);
        const slideCurrentData = this.getSlideData(currentSlide.getType(), data);
        currentSlide.render(context, slideCurrentData);
        ctx.restore();

        // Slide next slide in from the right
        ctx.save();
        ctx.translate(width * (1 - progress), 0);
        const slideNextContext = { ...context, config: nextSlide.getConfig() };
        const slideNextData = this.getSlideData(nextSlide.getType(), data);
        nextSlide.render(slideNextContext, slideNextData);
        ctx.restore();
        break;

      default:
        // No transition, just render current
        const defaultData = this.getSlideData(currentSlide.getType(), data);
        currentSlide.render(context, defaultData);
    }
  }

  /**
   * Get data for a specific slide type
   */
  private getSlideData(type: string, data: CachedData): SlideData {
    switch (type) {
      case 'active-projects':
        return { projects: data.projects };
      case 'po-ticker':
        return { pos: data.pos };
      case 'revenue-dashboard':
        return data.revenue;
      case 'team-schedule':
        return data.schedule;
      default:
        return { projects: [] };
    }
  }

  /**
   * Render "no slides" message
   */
  private renderNoSlides(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.font = 'bold 64px Inter, Arial, sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No slides configured', width / 2, height / 2);
  }

  /**
   * Force advance to next slide
   */
  forceNext(): void {
    this.advanceSlide();
  }

  /**
   * Force go to previous slide
   */
  forcePrevious(): void {
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.slideStartTime = Date.now();
  }

  /**
   * Go to a specific slide by index
   */
  goToSlide(index: number): void {
    if (index >= 0 && index < this.slides.length) {
      this.currentIndex = index;
      this.slideStartTime = Date.now();
    }
  }
}
