"use strict";
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}
const canvas = requireElement("#game");
const scoreEl = requireElement("#score");
const bestEl = requireElement("#best");
const speedEl = requireElement("#speed");
const hapticsStatusEl = requireElement("#haptics-status");
const installStatusEl = requireElement("#install-status");
const wrapToggleEl = requireElement("#wrap-toggle");
const restartButtonEl = requireElement("#restart-button");
const touchButtons = Array.from(document.querySelectorAll("[data-dir]"));
const maybeCtx = canvas.getContext("2d");
if (!maybeCtx) {
    throw new Error("2D canvas context unavailable.");
}
const ctx = maybeCtx;
const gridSize = 20;
const tileCount = canvas.width / gridSize;
const baseTickMs = 140;
const bestStorageKey = "snake-best-score";
const boardPalette = {
    background: "#24115e",
    tileA: "#33207d",
    tileB: "#442b96",
    gridGlow: "rgba(255, 255, 255, 0.08)",
    food: "#fff07a",
    foodAccent: "#ff5fb2",
    overlay: "rgba(36, 17, 94, 0.76)",
    overlayText: "#fffdfd",
};
const snakePalette = ["#3cf2ff", "#7c5cff", "#ff4fbf", "#ff8a3d", "#ffe45e", "#57f287"];
const vibrationPatterns = {
    controlTap: 12,
    food: 18,
    gameOver: [24, 18, 32],
};
const isTouchCapable = (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
const isAppleMobileDevice = /iPhone|iPad|iPod/i.test(userAgent) ||
    (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandaloneDisplayMode = (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && "standalone" in navigator && Boolean(navigator.standalone));
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 10, y: 10 };
let score = 0;
let best = Number(localStorage.getItem(bestStorageKey) ?? 0);
let gameOver = false;
let wrapWalls = false;
let lastTick = 0;
let shakeTimeout = null;
let hapticsSupport = "unknown";
bestEl.textContent = String(best);
function setWrapToggleUi() {
    wrapToggleEl.textContent = `Wrap: ${wrapWalls ? "On" : "Off"}`;
    wrapToggleEl.setAttribute("aria-pressed", String(wrapWalls));
}
function randomCell() {
    return {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
    };
}
function placeFood() {
    let next = randomCell();
    while (snake.some((segment) => segment.x === next.x && segment.y === next.y)) {
        next = randomCell();
    }
    food = next;
}
function setRestartButtonVisibility(visible) {
    restartButtonEl.hidden = !visible;
}
function resetGame() {
    snake = [
        { x: 5, y: 10 },
        { x: 4, y: 10 },
        { x: 3, y: 10 },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    gameOver = false;
    scoreEl.textContent = "0";
    speedEl.textContent = "1x";
    setRestartButtonVisibility(false);
    placeFood();
}
function updateBest() {
    if (score > best) {
        best = score;
        localStorage.setItem(bestStorageKey, String(best));
        bestEl.textContent = String(best);
    }
}
function currentSpeedMultiplier() {
    return 1 + Math.floor(score / 5) * 0.15;
}
function tickInterval() {
    return Math.max(55, baseTickMs - Math.floor(score / 5) * 10);
}
function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
}
function applyWrap(point) {
    return {
        x: (point.x + tileCount) % tileCount,
        y: (point.y + tileCount) % tileCount,
    };
}
function setDirection(next) {
    nextDirection = next;
}
function triggerShake() {
    canvas.classList.remove("shake");
    void canvas.offsetWidth;
    canvas.classList.add("shake");
    if (shakeTimeout !== null) {
        window.clearTimeout(shakeTimeout);
    }
    shakeTimeout = window.setTimeout(() => {
        canvas.classList.remove("shake");
        shakeTimeout = null;
    }, 180);
}
function setHapticsStatus(next) {
    hapticsSupport = next;
    const supportedAttribute = next === "supported" ? "true" : next === "unsupported" ? "false" : "maybe";
    hapticsStatusEl.dataset.supported = supportedAttribute;
    if (!isTouchCapable) {
        hapticsStatusEl.textContent = "Haptics: Mostly relevant on phones and tablets.";
        return;
    }
    if (next === "supported") {
        hapticsStatusEl.textContent = isStandaloneDisplayMode
            ? "Haptics: This installed app can use browser vibration support when the device exposes it."
            : "Haptics: Ready on this device/browser.";
        return;
    }
    if (next === "limited") {
        hapticsStatusEl.textContent = isStandaloneDisplayMode
            ? "Haptics: Installed iPhone/iPad PWAs still do not get native Taptic Engine APIs, so vibration may stay silent unless the game is wrapped natively."
            : "Haptics: iPhone/iPad browsers still expose vibration inconsistently, so this device may stay silent.";
        return;
    }
    if (next === "unsupported") {
        hapticsStatusEl.textContent = "Haptics: Not available here — gameplay still works without vibration.";
        return;
    }
    hapticsStatusEl.textContent = "Haptics: This browser may ignore vibration unless the device/browser supports it.";
}
function setInstallStatus() {
    if (isStandaloneDisplayMode) {
        installStatusEl.dataset.supported = "true";
        installStatusEl.textContent = "Install: Running as an installed app.";
        return;
    }
    const canInstall = typeof window !== "undefined" && "serviceWorker" in navigator;
    installStatusEl.dataset.supported = canInstall ? "maybe" : "false";
    installStatusEl.textContent = canInstall
        ? "Install: Browser should offer Add to Home Screen or install once the page finishes loading."
        : "Install: This browser does not expose the usual install hooks.";
}
function triggerHaptic(pattern) {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
        setHapticsStatus(isAppleMobileDevice ? "limited" : "unsupported");
        return false;
    }
    const didVibrate = typeof pattern === "number" ? navigator.vibrate(pattern) : navigator.vibrate(Array.from(pattern));
    setHapticsStatus(didVibrate ? "supported" : isAppleMobileDevice ? "limited" : "unsupported");
    return didVibrate;
}
function step() {
    if (gameOver) {
        return;
    }
    if (!isOpposite(direction, nextDirection)) {
        direction = nextDirection;
    }
    const head = snake[0];
    let nextHead = {
        x: head.x + direction.x,
        y: head.y + direction.y,
    };
    const crossedWall = nextHead.x < 0 || nextHead.x >= tileCount || nextHead.y < 0 || nextHead.y >= tileCount;
    if (wrapWalls) {
        nextHead = applyWrap(nextHead);
    }
    const hitWall = crossedWall && !wrapWalls;
    const hitSelf = snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
    if (hitWall || hitSelf) {
        gameOver = true;
        setRestartButtonVisibility(true);
        updateBest();
        triggerHaptic(vibrationPatterns.gameOver);
        return;
    }
    snake.unshift(nextHead);
    if (nextHead.x === food.x && nextHead.y === food.y) {
        score += 1;
        scoreEl.textContent = String(score);
        speedEl.textContent = `${currentSpeedMultiplier().toFixed(2)}x`;
        updateBest();
        triggerShake();
        triggerHaptic(vibrationPatterns.food);
        placeFood();
    }
    else {
        snake.pop();
    }
}
function drawCell(point, color, radius = 5, inset = 2) {
    const x = point.x * gridSize + inset;
    const y = point.y * gridSize + inset;
    const size = gridSize - inset * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
}
function drawSavedByTheBellBackdrop() {
    ctx.fillStyle = boardPalette.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let x = 0; x < tileCount; x += 1) {
        for (let y = 0; y < tileCount; y += 1) {
            ctx.fillStyle = (x + y) % 2 === 0 ? boardPalette.tileA : boardPalette.tileB;
            ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
    }
    ctx.save();
    ctx.strokeStyle = boardPalette.gridGlow;
    ctx.lineWidth = 1;
    for (let line = 0; line <= tileCount; line += 1) {
        const offset = line * gridSize;
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(canvas.width, offset);
        ctx.stroke();
    }
    ctx.restore();
}
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSavedByTheBellBackdrop();
    drawCell(food, boardPalette.foodAccent, 10, 4);
    drawCell(food, boardPalette.food, 999, 6);
    snake.forEach((segment, index) => {
        const color = index === 0 ? "#ffffff" : snakePalette[(index - 1) % snakePalette.length];
        const accent = index === 0 ? "#ff4fbf" : color;
        drawCell(segment, accent, 8, 2);
        drawCell(segment, color, 7, 4);
    });
    if (gameOver) {
        ctx.fillStyle = boardPalette.overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = boardPalette.overlayText;
        ctx.textAlign = "center";
        ctx.font = "bold 38px Inter, sans-serif";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = "20px Inter, sans-serif";
        ctx.fillText("Press Space to restart", canvas.width / 2, canvas.height / 2 + 28);
    }
}
function loop(timestamp) {
    if (timestamp - lastTick >= tickInterval()) {
        step();
        render();
        lastTick = timestamp;
    }
    requestAnimationFrame(loop);
}
document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (gameOver && key === " ") {
        resetGame();
        render();
        return;
    }
    const nextMap = {
        arrowup: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
    };
    const selected = nextMap[key];
    if (selected) {
        event.preventDefault();
        setDirection(selected);
    }
});
wrapToggleEl.addEventListener("click", () => {
    wrapWalls = !wrapWalls;
    setWrapToggleUi();
});
restartButtonEl.addEventListener("click", () => {
    resetGame();
    render();
    triggerHaptic(vibrationPatterns.controlTap);
});
const touchMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};
for (const button of touchButtons) {
    button.addEventListener("click", () => {
        const dir = button.dataset.dir;
        if (!dir) {
            return;
        }
        const selected = touchMap[dir];
        if (selected) {
            setDirection(selected);
            triggerHaptic(vibrationPatterns.controlTap);
        }
    });
}
function registerServiceWorker() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return;
    }
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register("./sw.js");
    }, { once: true });
}
setWrapToggleUi();
setInstallStatus();
setHapticsStatus(typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
    ? "unknown"
    : isAppleMobileDevice
        ? "limited"
        : "unsupported");
registerServiceWorker();
resetGame();
render();
requestAnimationFrame(loop);
