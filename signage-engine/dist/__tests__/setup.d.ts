declare function createMockCanvasContext(): {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    globalAlpha: number;
    font: string;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    fillRect: import("vitest").Mock<import("@vitest/spy").Procedure>;
    strokeRect: import("vitest").Mock<import("@vitest/spy").Procedure>;
    clearRect: import("vitest").Mock<import("@vitest/spy").Procedure>;
    beginPath: import("vitest").Mock<import("@vitest/spy").Procedure>;
    closePath: import("vitest").Mock<import("@vitest/spy").Procedure>;
    moveTo: import("vitest").Mock<import("@vitest/spy").Procedure>;
    lineTo: import("vitest").Mock<import("@vitest/spy").Procedure>;
    arc: import("vitest").Mock<import("@vitest/spy").Procedure>;
    arcTo: import("vitest").Mock<import("@vitest/spy").Procedure>;
    quadraticCurveTo: import("vitest").Mock<import("@vitest/spy").Procedure>;
    bezierCurveTo: import("vitest").Mock<import("@vitest/spy").Procedure>;
    rect: import("vitest").Mock<import("@vitest/spy").Procedure>;
    stroke: import("vitest").Mock<import("@vitest/spy").Procedure>;
    fill: import("vitest").Mock<import("@vitest/spy").Procedure>;
    clip: import("vitest").Mock<import("@vitest/spy").Procedure>;
    drawImage: import("vitest").Mock<import("@vitest/spy").Procedure>;
    fillText: import("vitest").Mock<import("@vitest/spy").Procedure>;
    strokeText: import("vitest").Mock<import("@vitest/spy").Procedure>;
    measureText: import("vitest").Mock<() => {
        width: number;
    }>;
    getImageData: import("vitest").Mock<() => {
        data: Uint8ClampedArray<ArrayBuffer>;
        width: number;
        height: number;
    }>;
    putImageData: import("vitest").Mock<import("@vitest/spy").Procedure>;
    createLinearGradient: import("vitest").Mock<() => {
        addColorStop: import("vitest").Mock<import("@vitest/spy").Procedure>;
    }>;
    createRadialGradient: import("vitest").Mock<() => {
        addColorStop: import("vitest").Mock<import("@vitest/spy").Procedure>;
    }>;
    createPattern: import("vitest").Mock<import("@vitest/spy").Procedure>;
    save: import("vitest").Mock<import("@vitest/spy").Procedure>;
    restore: import("vitest").Mock<import("@vitest/spy").Procedure>;
    translate: import("vitest").Mock<import("@vitest/spy").Procedure>;
    rotate: import("vitest").Mock<import("@vitest/spy").Procedure>;
    scale: import("vitest").Mock<import("@vitest/spy").Procedure>;
    transform: import("vitest").Mock<import("@vitest/spy").Procedure>;
    setTransform: import("vitest").Mock<import("@vitest/spy").Procedure>;
    resetTransform: import("vitest").Mock<import("@vitest/spy").Procedure>;
    roundRect: import("vitest").Mock<import("@vitest/spy").Procedure>;
};
export { createMockCanvasContext };
