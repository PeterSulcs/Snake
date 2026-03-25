type Point = { x: number; y: number };

type Direction = Point;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const canvas = requireElement<HTMLCanvasElement>("#game");
const scoreEl = requireElement<HTMLElement>("#score");
const bestEl = requireElement<HTMLElement>("#best");
const speedEl = requireElement<HTMLElement>("#speed");
const maybeCtx = canvas.getContext("2d");

if (!maybeCtx) {
  throw new Error("2D canvas context unavailable.");
}

const ctx: CanvasRenderingContext2D = maybeCtx;

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const baseTickMs = 140;
const bestStorageKey = "snake-best-score";

let snake: Point[] = [];
let direction: Direction = { x: 1, y: 0 };
let nextDirection: Direction = { x: 1, y: 0 };
let food: Point = { x: 10, y: 10 };
let score = 0;
let best = Number(localStorage.getItem(bestStorageKey) ?? 0);
let gameOver = false;
let lastTick = 0;

bestEl.textContent = String(best);

function randomCell(): Point {
  return {
    x: Math.floor(Math.random() * tileCount),
    y: Math.floor(Math.random() * tileCount),
  };
}

function placeFood(): void {
  let next = randomCell();
  while (snake.some((segment) => segment.x === next.x && segment.y === next.y)) {
    next = randomCell();
  }
  food = next;
}

function resetGame(): void {
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
  placeFood();
}

function updateBest(): void {
  if (score > best) {
    best = score;
    localStorage.setItem(bestStorageKey, String(best));
    bestEl.textContent = String(best);
  }
}

function currentSpeedMultiplier(): number {
  return 1 + Math.floor(score / 5) * 0.15;
}

function tickInterval(): number {
  return Math.max(55, baseTickMs - Math.floor(score / 5) * 10);
}

function isOpposite(a: Direction, b: Direction): boolean {
  return a.x === -b.x && a.y === -b.y;
}

function step(): void {
  if (gameOver) {
    return;
  }

  if (!isOpposite(direction, nextDirection)) {
    direction = nextDirection;
  }

  const head = snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const hitWall = nextHead.x < 0 || nextHead.x >= tileCount || nextHead.y < 0 || nextHead.y >= tileCount;
  const hitSelf = snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

  if (hitWall || hitSelf) {
    gameOver = true;
    updateBest();
    return;
  }

  snake.unshift(nextHead);

  if (nextHead.x === food.x && nextHead.y === food.y) {
    score += 1;
    scoreEl.textContent = String(score);
    speedEl.textContent = `${currentSpeedMultiplier().toFixed(2)}x`;
    updateBest();
    placeFood();
  } else {
    snake.pop();
  }
}

function drawCell(point: Point, color: string, radius = 5): void {
  const inset = 2;
  const x = point.x * gridSize + inset;
  const y = point.y * gridSize + inset;
  const size = gridSize - inset * 2;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.fill();
}

function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < tileCount; x += 1) {
    for (let y = 0; y < tileCount; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#0b1220" : "#101a2f";
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    }
  }

  drawCell(food, "#f97316", 8);

  snake.forEach((segment, index) => {
    drawCell(segment, index === 0 ? "#22c55e" : "#16a34a", 6);
  });

  if (gameOver) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.font = "bold 38px Inter, sans-serif";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "20px Inter, sans-serif";
    ctx.fillText("Press Space to restart", canvas.width / 2, canvas.height / 2 + 28);
  }
}

function loop(timestamp: number): void {
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

  const nextMap: Record<string, Direction> = {
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
    nextDirection = selected;
  }
});

resetGame();
render();
requestAnimationFrame(loop);
