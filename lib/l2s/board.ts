import { APPLE_CODES, type Cell, type EatResult, type Vec } from "./constants";
import { PyRandom } from "./random";

export interface BoardOptions {
  boardSize?: number;
  greenApplesCount?: number;
  redApplesCount?: number;
  snakeSize?: number;
  seed?: number;
}

/** The subset of a replay file needed to restore a board. */
export interface BoardSnapshot {
  starting_state: string[][];
  seed: number;
}

/**
 * Snake board. `area[x][y]` holds a Cell code, exactly like the numpy array in
 * the Python version (x = column, y = row).
 */
export class Board {
  lost = false;
  area: Cell[][];
  boardSize: number;
  snakeSize: number;
  snakePos: Vec[] = [];
  greenApplesCount: number;
  redApplesCount: number;
  greenApplesPos: Vec[];
  redApplesPos: Vec[];
  rngseed: number;
  private rng: PyRandom;

  constructor({
    boardSize = 10,
    greenApplesCount = 2,
    redApplesCount = 1,
    snakeSize = 3,
    seed,
  }: BoardOptions = {}) {
    this.boardSize = boardSize;
    this.area = this.emptyArea();

    // The starting layout comes from fresh entropy; only apple respawns are
    // driven by `rngseed` (which is what replays record).
    this.rng = new PyRandom();

    this.snakeSize = snakeSize;
    this.initSnake();

    this.greenApplesCount = greenApplesCount;
    this.redApplesCount = redApplesCount;
    this.greenApplesPos = Array.from({ length: greenApplesCount }, () => [0, 0] as Vec);
    this.redApplesPos = Array.from({ length: redApplesCount }, () => [0, 0] as Vec);
    this.initApples(true);

    this.rngseed = seed ? seed : this.rng.randrange(0, 100000);
    this.rng = new PyRandom(this.rngseed);

    this.updateArea();
  }

  /** Build a board from a replay's starting state and seed. */
  static fromSnapshot(snapshot: BoardSnapshot): Board {
    const board = new Board({ boardSize: snapshot.starting_state.length });
    board.setBoard(snapshot);
    return board;
  }

  setBoard(newBoard: BoardSnapshot): void {
    this.area = newBoard.starting_state.map((column) => [...column]) as Cell[][];
    this.boardSize = this.area.length;
    this.lost = false;

    this.snakePos = [];
    this.greenApplesPos = [];
    this.redApplesPos = [];
    this.greenApplesCount = 0;
    this.redApplesCount = 0;

    this.area.forEach((column, x) => {
      column.forEach((cell, y) => {
        if (cell === "G") {
          this.greenApplesPos.push([x, y]);
          this.greenApplesCount++;
        }
        if (cell === "R") {
          this.redApplesPos.push([x, y]);
          this.redApplesCount++;
        }
        if (cell === "H") this.snakePos.push([x, y]);
      });
    });

    if (this.snakePos.length === 0) {
      throw new Error("Replay starting state has no snake head (H).");
    }

    // Walk the body from the head by following adjacent "S" cells.
    const directions: Vec[] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    this.snakeSize = 1;
    let finished = false;
    while (!finished) {
      finished = true;
      const last = this.snakePos[this.snakePos.length - 1];
      for (const direction of directions) {
        const newPos: Vec = [last[0] + direction[0], last[1] + direction[1]];
        if (
          !this.isOutOfBounds(newPos) &&
          !this.snakePos.some((p) => p[0] === newPos[0] && p[1] === newPos[1]) &&
          this.area[newPos[0]][newPos[1]] === "S"
        ) {
          this.snakePos.push(newPos);
          this.snakeSize++;
          finished = false;
          break;
        }
      }
    }

    this.rngseed = newBoard.seed;
    this.rng = new PyRandom(this.rngseed);
  }

  private emptyArea(): Cell[][] {
    return Array.from({ length: this.boardSize }, () =>
      Array.from({ length: this.boardSize }, () => "0" as Cell),
    );
  }

  initApples(all = true): void {
    const appleTypes = [this.greenApplesPos, this.redApplesPos];

    appleTypes.forEach((appleType, appleTypeIndex) => {
      appleType.forEach((apple, index) => {
        if (all || (apple[0] === -1 && apple[1] === -1)) {
          // Guard against an infinite loop on a completely full board.
          if (!this.area.some((column) => column.includes("0"))) return;

          let x = this.randomIntWithinWidth();
          let y = this.randomIntWithinWidth();
          while (this.area[x][y] !== "0") {
            x = this.randomIntWithinWidth();
            y = this.randomIntWithinWidth();
          }
          appleType[index] = [x, y];
          this.area[x][y] = APPLE_CODES[appleTypeIndex];
        }
      });
    });
  }

  initSnake(): void {
    this.snakePos = [];

    // Head
    this.snakePos.push([this.randomIntWithinWidth(), this.randomIntWithinWidth()]);

    // Body
    for (let i = 1; i < this.snakeSize; i++) {
      let newPos = -1;
      let dimension = 0;

      while (newPos === -1) {
        // Choose X or Y
        dimension = this.rng.randint(0, 1);
        const last = this.snakePos[this.snakePos.length - 1];
        newPos = last[dimension] + [-1, 1][this.rng.randrange(2)];

        // Check if new position is valid
        if (newPos >= this.boardSize) newPos = -1;

        const tileToBe: Vec = [last[0], last[1]];
        tileToBe[dimension] = newPos;

        // Check if new position isn't already taken
        for (const chunk of this.snakePos) {
          if (chunk[0] === tileToBe[0] && chunk[1] === tileToBe[1]) {
            newPos = -1;
            break;
          }
        }
      }

      const last = this.snakePos[this.snakePos.length - 1];
      const next: Vec = [last[0], last[1]];
      next[dimension] = newPos;
      this.snakePos.push(next);
    }

    this.updateAreaSnake();
  }

  private inBounds(pos: Vec): boolean {
    return !this.isOutOfBounds(pos);
  }

  updateAreaSnake(): void {
    for (const chunk of this.snakePos) {
      if (this.inBounds(chunk)) this.area[chunk[0]][chunk[1]] = "S";
    }
    const head = this.snakePos[0];
    if (this.inBounds(head)) this.area[head[0]][head[1]] = "H";
  }

  updateAreaApples(): void {
    const appleTypes = [this.greenApplesPos, this.redApplesPos];
    appleTypes.forEach((appleType, i) => {
      for (const apple of appleType) {
        if (this.inBounds(apple)) this.area[apple[0]][apple[1]] = APPLE_CODES[i];
      }
    });
  }

  updateArea(): void {
    this.area = this.emptyArea();
    this.updateAreaSnake();
    this.updateAreaApples();
  }

  randomIntWithinWidth(): number {
    return this.rng.randint(0, this.boardSize - 1);
  }

  moveSnake(direction: Vec): EatResult {
    const head = this.snakePos[0];
    const newHeadPos: Vec = [head[0] + direction[0], head[1] + direction[1]];

    if (this.isOutOfBounds(newHeadPos)) this.lost = true;

    let ateGreen = false;
    let ateRed = false;

    this.greenApplesPos.forEach((apple, index) => {
      if (newHeadPos[0] === apple[0] && newHeadPos[1] === apple[1]) {
        ateGreen = true;
        this.greenApplesPos[index] = [-1, -1];
      }
    });

    this.redApplesPos.forEach((apple, index) => {
      if (newHeadPos[0] === apple[0] && newHeadPos[1] === apple[1]) {
        ateRed = true;
        this.redApplesPos[index] = [-1, -1];
      }
    });

    if (ateRed && this.snakePos.length <= 1) this.lost = true;

    this.snakePos.unshift(newHeadPos);
    if (!ateGreen) this.snakePos.pop();
    if (ateRed && !this.lost) this.snakePos.pop();

    for (let i = 1; i < this.snakePos.length; i++) {
      if (this.snakePos[i][0] === newHeadPos[0] && this.snakePos[i][1] === newHeadPos[1]) {
        this.lost = true;
        break;
      }
    }

    // Note: apples respawn against the area as it was *before* this move,
    // matching the Python implementation (and therefore its replays).
    if (ateGreen || ateRed) this.initApples(false);

    this.updateArea();

    if (this.lost) return "L";
    if (ateGreen) return "G";
    if (ateRed) return "R";
    return "0";
  }

  isOutOfBounds(position: readonly number[]): boolean {
    return position.some((v) => v < 0 || v >= this.boardSize);
  }

  /** CLI-style rendering, with walls. Rows are y, columns are x. */
  toText(): string {
    const size = this.boardSize;
    const wall = "W".repeat(size + 2);
    const rows = [wall];
    for (let y = 0; y < size; y++) {
      let row = "W";
      for (let x = 0; x < size; x++) row += this.area[x][y];
      rows.push(row + "W");
    }
    rows.push(wall);
    return rows.join("\n");
  }
}
