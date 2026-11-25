import type { Board } from "./board";
import type { Cell } from "./constants";

/** Board colours, defined as CSS variables in app/globals.css (light and dark). */
const COLOR_VARS = {
  background: "--board-bg",
  grid: "--board-grid",
  gridStrong: "--board-grid-strong",
  body: "--board-body",
  head: "--board-head",
  eye: "--board-eye",
  green: "--board-green",
  red: "--board-red",
} as const;

type Colors = Record<keyof typeof COLOR_VARS, string>;

/** Used if the CSS variables are missing (light theme values). */
const FALLBACK: Colors = {
  background: "#f6f8fa",
  grid: "#e4e8ec",
  gridStrong: "#c9d1d9",
  body: "#6aa7ff",
  head: "#3b82f0",
  eye: "#ffffff",
  green: "#1a7f37",
  red: "#cf222e",
};

/** CSS values for using the board colours outside the canvas (e.g. `style={{ background: CSS_COLORS.green }}`). */
export const CSS_COLORS = Object.fromEntries(
  Object.entries(COLOR_VARS).map(([key, name]) => [key, `var(${name})`]),
) as Colors;

function readColors(canvas: HTMLCanvasElement): Colors {
  const style = getComputedStyle(canvas);
  const colors = { ...FALLBACK };
  for (const key of Object.keys(COLOR_VARS) as (keyof Colors)[]) {
    const value = style.getPropertyValue(COLOR_VARS[key]).trim();
    if (value) colors[key] = value;
  }
  return colors;
}

/**
 * Draw a board onto a square canvas, sized to the canvas's CSS width, in a
 * graph-paper style. Lost boards are not drawn, so the last frame before
 * losing stays visible.
 */
export function drawBoard(canvas: HTMLCanvasElement, board: Board): void {
  if (board.lost) return;

  const size = canvas.clientWidth;
  // Hidden (e.g. inactive tab): skip, so the existing frame isn't wiped.
  if (size === 0) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = canvas.height = Math.round(size * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const colors = readColors(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, size, size);

  const n = board.boardSize;
  const tile = size / n;

  // Graph paper: a thin line on every cell edge, a stronger one every 5 cells.
  for (let i = 1; i < n; i++) {
    const p = Math.round(i * tile) + 0.5;
    ctx.strokeStyle = i % 5 === 0 ? colors.gridStrong : colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc((x + 0.5) * tile, (y + 0.5) * tile, r * tile, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  // The body is one thick line through every segment's centre, with round
  // joins and caps, so it stays the same width and bends smoothly at corners.
  const snake = board.snakePos;
  ctx.beginPath();
  snake.forEach(([x, y], i) => {
    const px = (x + 0.5) * tile;
    const py = (y + 0.5) * tile;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 0.6 * tile;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Apples and the head (body cells are already covered by the line above)
  board.area.forEach((column, x) => {
    column.forEach((cell: Cell, y) => {
      switch (cell) {
        case "G":
          circle(x, y, 0.3, colors.green);
          break;
        case "R":
          circle(x, y, 0.3, colors.red);
          break;
        case "H": {
          circle(x, y, 0.36, colors.head);
          // Eyes, looking away from the neck
          const neck = snake[1];
          const dx = neck ? x - neck[0] : 0;
          const dy = neck ? y - neck[1] : -1;
          for (const side of [-1, 1]) {
            const ex = x + dx * 0.12 + -dy * side * 0.15;
            const ey = y + dy * 0.12 + dx * side * 0.15;
            circle(ex, ey, 0.06, colors.eye);
          }
          break;
        }
      }
    });
  });
}
