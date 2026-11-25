import { Agent, type AgentParams, type QTable } from "./agent";
import { Board } from "./board";
import { ACTIONS_NAMES, directionIndex, type Vec } from "./constants";
import { Interpreter, type Logger } from "./interpreter";

/** Contents of a .rpl file, compatible with the Python version. */
export interface Replay {
  score: number;
  lifetime: number;
  starting_state: string[][];
  inputs: Vec[];
  seed: number;
}

export interface QlearnerOptions {
  board?: Board;
  interpreter?: Interpreter;
  agent?: Agent;
  agentParams?: Partial<AgentParams>;
  maxSessions?: number;
  maxEpoch?: number;
  /** Q values to start from (equivalent of `--input`). Copied, never mutated. */
  qvalues?: QTable | null;
  noLearning?: boolean;
  verbose?: boolean;
  log?: Logger;
}

export interface TrainingResult {
  best: Replay | null;
  longestSize: number;
  longestLife: number;
}

export class Qlearner {
  board: Board;
  interpreter: Interpreter;
  agent: Agent;
  noLearning: boolean;
  verbose: boolean;
  maxSessions: number;
  maxEpoch: number;
  startingState: string[][];
  inputs: Vec[] = [];
  private log: Logger;

  constructor(options: QlearnerOptions = {}) {
    this.board = options.board ?? new Board();
    this.interpreter = options.interpreter ?? new Interpreter();
    this.agent = options.agent ?? new Agent(options.agentParams);
    this.noLearning = options.noLearning ?? false;
    this.verbose = options.verbose ?? false;
    this.log = options.log ?? ((line) => console.log(line));

    // Lowest possible number of states without repeats
    this.agent.states = options.qvalues
      ? options.qvalues.map((row) => [...row])
      : Array.from({ length: this.interpreter.stateCount }, () => [0, 0, 0, 0]);

    this.maxSessions = options.maxSessions ?? 100;
    this.maxEpoch = options.maxEpoch ?? 10000;
    this.startingState = cloneArea(this.board.area);
  }

  newStep(): void {
    const verboseLog = this.verbose ? this.log : undefined;
    const state = this.interpreter.calculateState(this.board, verboseLog);

    const [action, direction] = this.agent.chooseDirection(state);
    this.inputs.push(direction);

    if (this.verbose) this.log(`${ACTIONS_NAMES[directionIndex(direction)]}\n`);

    const typeEaten = this.board.moveSnake(direction);

    if (!this.noLearning) {
      const newState = this.interpreter.calculateState(this.board);
      const reward = this.interpreter.calculateReward(direction, typeEaten, this.board);
      this.agent.updateStates(state, newState, action, reward);
    }
  }

  /** Replace the board with a fresh one, resetting the recorded inputs. */
  resetBoard(board: Board = new Board()): void {
    this.board = board;
    this.startingState = cloneArea(board.area);
    this.inputs = [];
  }

  /** Progress of the current training run (see trainSteps / loop). */
  private training = { episodes: 0, epoch: 0, longestSize: 0, longestLife: 0, best: null as Replay | null };

  /** Episodes finished so far in the current training run. */
  get episodesDone(): number {
    return this.training.episodes;
  }

  get trainingResult(): TrainingResult {
    const { best, longestSize, longestLife } = this.training;
    return { best, longestSize, longestLife };
  }

  /** Record a finished episode (lost, or hit maxEpoch) and start a new board. */
  private endEpisode(): number {
    const t = this.training;
    const epoch = t.epoch;
    t.episodes++;

    if (epoch > t.longestLife) {
      if (this.verbose) this.log(`Newest best lifetime: ${epoch}`);
      t.longestLife = epoch;
    }
    const size = this.board.snakePos.length;
    if (this.verbose) this.log(`Length: ${size}`);
    if (size > t.longestSize) {
      if (this.verbose) this.log(`Newest longest size: ${size}`);
      t.longestSize = size;
      t.best = {
        score: t.longestSize,
        lifetime: epoch,
        starting_state: this.startingState,
        inputs: this.inputs,
        seed: this.board.rngseed,
      };
    }

    this.resetBoard();
    t.epoch = 0;
    if (this.verbose) this.log(`Episode ${t.episodes}`);
    return size;
  }

  /**
   * Advance training by at most `maxSteps` moves, so it can be spread over
   * animation frames. `onEpisode` gets the number of finished episodes and the
   * final snake size of the episode. Returns true once all `maxSessions` are done.
   */
  trainSteps(maxSteps: number, onEpisode?: (episodes: number, size: number) => void): boolean {
    const t = this.training;
    let steps = 0;
    while (t.episodes < this.maxSessions) {
      if (this.board.lost || t.epoch >= this.maxEpoch) {
        const size = this.endEpisode();
        onEpisode?.(t.episodes, size);
        continue;
      }
      if (steps >= maxSteps) return false;
      this.newStep();
      t.epoch++;
      steps++;
    }
    return true;
  }

  /**
   * Train for `maxSessions` episodes in one go (the CLI mode). `onEpisode` is
   * called after each finished episode with the number of completed episodes.
   */
  loop(onEpisode?: (episodes: number, size: number) => void): TrainingResult {
    this.trainSteps(Infinity, onEpisode);
    const { longestSize, longestLife } = this.training;
    this.log(
      `Training finished for ${this.maxSessions} sessions. ` +
        `Longest size: ${longestSize} Longest session: ${longestLife}`,
    );
    return this.trainingResult;
  }
}

function cloneArea(area: string[][]): string[][] {
  return area.map((column) => [...column]);
}
