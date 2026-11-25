import type { Board } from "./board";
import {
  ACTIONS,
  type Action,
  comb,
  DIRECTIONS,
  type EatResult,
  REWARDS,
  VALUES,
  VALUES_COUNT,
  type Vec,
} from "./constants";

/**
 * A state is [serial number, actions sorted by what the snake sees, lowest reward].
 * When the board is lost, the serial number is REWARDS.L (negative).
 */
export type State = [number, Action[], number];

export type Logger = (line: string) => void;

export class Interpreter {
  visionLength: number;

  constructor(visionLength = 1) {
    this.visionLength = visionLength;
  }

  /** Total number of distinct states (rows of the Q table). */
  get stateCount(): number {
    return comb(
      this.visionLength * VALUES_COUNT + DIRECTIONS.length - 1,
      DIRECTIONS.length,
    );
  }

  calculateVision(board: Board, log?: Logger): number[] {
    const headPos = board.snakePos[0];
    const vision: string[][] = [];

    DIRECTIONS.forEach((direction, index) => {
      vision.push([]);
      let pos: Vec = [headPos[0] + direction[0], headPos[1] + direction[1]];
      while (!board.isOutOfBounds(pos)) {
        vision[index].push(board.area[pos[0]][pos[1]]);
        pos = [pos[0] + direction[0], pos[1] + direction[1]];
      }
    });

    if (log) log(formatVision(vision));

    const types: number[] = [];
    for (const viewed of vision) {
      let distance = 0;
      while (
        distance < viewed.length &&
        distance < this.visionLength &&
        viewed[distance] === "0"
      ) {
        distance++;
      }

      let value: number;
      if (!(distance < this.visionLength)) {
        value = viewed.includes("G") ? VALUES.g : VALUES["0"];
      } else if (!(distance < viewed.length)) {
        value = VALUES.S; // Wall
      } else {
        value = VALUES[viewed[distance] as keyof typeof VALUES] ?? VALUES.S;
      }
      types.push(value);
    }
    return types;
  }

  calculateState(board: Board, log?: Logger): State {
    if (board.lost) return [REWARDS.L, [], 0];

    const types = this.calculateVision(board, log);

    // Stable sort, like Python's sorted()
    const pairs = types.map((t, i) => [t, ACTIONS[i]] as const);
    pairs.sort((a, b) => a[0] - b[0]);
    const actions = pairs.map(([, a]) => a);

    const sortedValues = pairs.map(([t]) => t);
    let total = 0;
    let inc = 0;
    let n = this.visionLength * VALUES_COUNT;
    let k = DIRECTIONS.length;

    for (let value of sortedValues) {
      value -= inc;
      k -= 1;
      for (let j = 0; j < value; j++) {
        total += comb(n - j + k - 1, k);
      }
      n -= value;
      inc += value;
    }

    return [total, actions, REWARDS.L];
  }

  calculateReward(direction: Vec, typeEaten: EatResult, board: Board): number {
    let reward: number = REWARDS[typeEaten];

    const head = board.snakePos[0];
    let pos: Vec = [head[0] + direction[0], head[1] + direction[1]];
    const vision: string[] = [];
    while (!board.isOutOfBounds(pos)) {
      vision.push(board.area[pos[0]][pos[1]]);
      pos = [pos[0] + direction[0], pos[1] + direction[1]];
    }

    if (vision.includes("G") && !board.lost) reward += REWARDS.g;
    return reward;
  }
}

/** The cross-shaped view of the board printed in verbose mode. */
function formatVision(vision: string[][]): string {
  const [up, down, left, right] = vision;
  const leftAlign = left.length + 2;
  const pad = (s: string) => s.padStart(leftAlign);
  let out = pad("W") + "\n";
  for (const tile of [...up].reverse()) out += pad(tile) + "\n";
  out += "W" + [...left].reverse().join("") + "H" + right.join("") + "W\n";
  for (const tile of down) out += pad(tile) + "\n";
  out += pad("W");
  return out;
}
