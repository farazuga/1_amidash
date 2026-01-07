import { vi, beforeEach, afterEach } from 'vitest';
// Mock canvas context
function createMockCanvasContext() {
    return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        rect: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        clip: vi.fn(),
        drawImage: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        measureText: vi.fn(() => ({ width: 100 })),
        getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(3840 * 2160 * 4),
            width: 3840,
            height: 2160,
        })),
        putImageData: vi.fn(),
        createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        createPattern: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        transform: vi.fn(),
        setTransform: vi.fn(),
        resetTransform: vi.fn(),
        roundRect: vi.fn(),
    };
}
// Mock @napi-rs/canvas
vi.mock('@napi-rs/canvas', () => ({
    createCanvas: vi.fn((width, height) => ({
        width,
        height,
        getContext: vi.fn(() => createMockCanvasContext()),
        toBuffer: vi.fn(() => Buffer.from('mock-png-data')),
    })),
    loadImage: vi.fn(() => Promise.resolve({
        width: 100,
        height: 100,
    })),
    Canvas: vi.fn(),
    SKRSContext2D: vi.fn(),
}));
// Mock @vygr-labs/ndi-node
vi.mock('@vygr-labs/ndi-node', () => ({
    default: {
        initialize: vi.fn(() => true),
        destroy: vi.fn(),
        Sender: vi.fn().mockImplementation(() => ({
            sendVideo: vi.fn(),
            destroy: vi.fn(),
        })),
        FourCC: {
            BGRA: 'BGRA',
            RGBA: 'RGBA',
        },
    },
    initialize: vi.fn(() => true),
    destroy: vi.fn(),
    Sender: vi.fn().mockImplementation(() => ({
        sendVideo: vi.fn(),
        destroy: vi.fn(),
    })),
    FourCC: {
        BGRA: 'BGRA',
        RGBA: 'RGBA',
    },
}));
// Mock Supabase client
vi.mock('../data/supabase-client', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        data: [],
                        error: null,
                    })),
                    data: [],
                    error: null,
                })),
                neq: vi.fn(() => ({
                    data: [],
                    error: null,
                })),
                gte: vi.fn(() => ({
                    lte: vi.fn(() => ({
                        data: [],
                        error: null,
                    })),
                })),
                order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        data: [],
                        error: null,
                    })),
                    data: [],
                    error: null,
                })),
                data: [],
                error: null,
            })),
        })),
    },
}));
// Reset mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});
// Cleanup after each test
afterEach(() => {
    vi.restoreAllMocks();
});
// Export mock factory for use in tests
export { createMockCanvasContext };
//# sourceMappingURL=setup.js.map