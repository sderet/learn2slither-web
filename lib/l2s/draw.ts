import type { Board } from "./board";
import type { Cell } from "./constants";

export const COLORS = {
  background: "#0c1222",
  grid: "#1c2438",
  body: "#3b82f6",
  head: "#7dd3fc",
  eye: "#0c1222",
  green: "#22c55e",
  red: "#ef4444",
};

/**
 * Draw a board onto a square canvas, sized to the canvas's CSS width.
 * Lost boards are not drawn, so the last frame before losing stays visible
 * (like the Python GUI).
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, size, size);

  const tile = size / board.boardSize;
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
  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = 0.64 * tile;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Draw the elements (body cells are already covered by the line above)
  board.area.forEach((column, x) => {
    column.forEach((cell: Cell, y) => {
      switch (cell) {
        case "0":
          circle(x, y, 0.08, COLORS.grid);
          break;
        case "G":
          circle(x, y, 0.34, COLORS.green);
          circle(x - 0.1, y - 0.1, 0.08, "rgba(255,255,255,0.35)");
          break;
        case "R":
          circle(x, y, 0.34, COLORS.red);
          circle(x - 0.1, y - 0.1, 0.08, "rgba(255,255,255,0.35)");
          break;
        case "H": {
          circle(x, y, 0.4, COLORS.head);
          // Eyes, looking away from the neck
          const neck = snake[1];
          const dx = neck ? x - neck[0] : 0;
          const dy = neck ? y - neck[1] : -1;
          for (const side of [-1, 1]) {
            const ex = x + dx * 0.15 + -dy * side * 0.17;
            const ey = y + dy * 0.15 + dx * side * 0.17;
            circle(ex, ey, 0.07, COLORS.eye);
          }
          break;
        }
      }
    });
  });
}
