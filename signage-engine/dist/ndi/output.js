import { logger } from '../utils/logger.js';
// Try to import ndi-node (optional dependency)
let ndi = null;
let ndiInitialized = false;
async function loadNDI() {
    try {
        // Dynamic import with error handling for missing module
        ndi = await import('@vygr-labs/ndi-node');
        if (ndi.initialize()) {
            ndiInitialized = true;
            logger.info('NDI SDK (@vygr-labs/ndi-node) loaded and initialized successfully');
        }
        else {
            logger.warn('NDI SDK failed to initialize. Using mock output for testing.');
            ndi = null;
        }
    }
    catch {
        logger.warn('NDI SDK (@vygr-labs/ndi-node) not available. Using mock output for testing.');
    }
}
// Load on module init
loadNDI();
// Wrapper class for the native NDI sender
class NativeNDISenderWrapper {
    nativeSender;
    fourCC;
    constructor(nativeSender, fourCC) {
        this.nativeSender = nativeSender;
        this.fourCC = fourCC;
    }
    sendFrame(frame) {
        this.nativeSender.sendVideo({
            xres: frame.width,
            yres: frame.height,
            fourCC: this.fourCC,
            frameRateN: frame.frameRateN,
            frameRateD: frame.frameRateD,
            data: frame.data,
        });
    }
    destroy() {
        this.nativeSender.destroy();
    }
}
export class NDIOutput {
    sender = null;
    config;
    displayConfig;
    frameCount = 0;
    startTime = 0;
    constructor(config, displayConfig) {
        this.config = config;
        this.displayConfig = displayConfig;
    }
    async initialize() {
        if (ndi && ndiInitialized) {
            try {
                const nativeSender = new ndi.Sender({
                    name: this.config.name,
                    clockVideo: true,
                    clockAudio: false,
                });
                this.sender = new NativeNDISenderWrapper(nativeSender, ndi.FourCC.BGRA);
                logger.info({ name: this.config.name }, 'NDI sender initialized');
            }
            catch (error) {
                logger.error({ error }, 'Failed to initialize NDI sender');
                this.sender = new MockNDISender(this.config.name);
            }
        }
        else {
            this.sender = new MockNDISender(this.config.name);
        }
        this.startTime = Date.now();
        this.frameCount = 0;
    }
    sendFrame(frameData) {
        if (!this.sender)
            return;
        try {
            this.sender.sendFrame({
                data: frameData,
                width: this.displayConfig.width,
                height: this.displayConfig.height,
                frameRateN: this.config.frameRate,
                frameRateD: 1,
            });
            this.frameCount++;
        }
        catch (error) {
            logger.error({ error }, 'Failed to send NDI frame');
        }
    }
    getFPS() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        return elapsed > 0 ? this.frameCount / elapsed : 0;
    }
    getFrameCount() {
        return this.frameCount;
    }
    destroy() {
        if (this.sender) {
            this.sender.destroy();
            this.sender = null;
            logger.info('NDI sender destroyed');
        }
    }
}
// Mock NDI sender for testing without NDI SDK
class MockNDISender {
    name;
    frameCount = 0;
    constructor(name) {
        this.name = name;
        logger.info({ name }, 'Mock NDI sender initialized (no actual NDI output)');
    }
    sendFrame(_frame) {
        this.frameCount++;
        if (this.frameCount % 300 === 0) {
            logger.debug({ name: this.name, frames: this.frameCount }, 'Mock NDI frame count');
        }
    }
    destroy() {
        logger.info({ name: this.name }, 'Mock NDI sender destroyed');
    }
}
// Cleanup NDI on process exit
process.on('exit', () => {
    if (ndi && ndiInitialized) {
        ndi.destroy();
        logger.info('NDI SDK destroyed');
    }
});
//# sourceMappingURL=output.js.map