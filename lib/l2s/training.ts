import type { AgentParams, QTable } from "./agent";
import type { Locale } from "../i18n/core";
import type { Replay } from "./qlearner";
import type { TrainRequest, TrainResponse } from "./train.worker";

export const MAX_SNAKES = 256;
export const MAX_EPOCH = 10000;

export interface TrainingOptions {
  sessions: number;
  snakes: number;
  qvalues: QTable | null;
  noLearning: boolean;
  verbose: boolean;
  agentParams: AgentParams;
  maxEpoch?: number;
  /** Language of the log lines. */
  locale: Locale;
}

export interface SnakeResult {
  longestSize: number;
  longestLife: number;
  replay: Replay | null;
  qvalues: QTable;
}

export interface TrainingOutcome {
  snakes: SnakeResult[];
  /** Index of the snake with the best replay score (first one on ties). */
  bestIndex: number;
  elapsedMs: number;
}

export interface TrainingRun {
  /** Resolves when every snake is done; rejects with TrainingCancelled after cancel(). */
  promise: Promise<TrainingOutcome>;
  cancel: () => void;
  /** Episodes finished so far, across all snakes. */
  episodes: () => number;
  snakesDone: () => number;
}

export class TrainingCancelled extends Error {
  constructor() {
    super("Training cancelled.");
  }
}

export type TrainingLogger = (job: number, lines: string[], dropped: number) => void;

/**
 * Train `snakes` independent learners in a pool of Web Workers (sized to the
 * machine's core count), each for `sessions` episodes.
 */
export function startTraining(options: TrainingOptions, onLog?: TrainingLogger): TrainingRun {
  const { sessions, snakes } = options;
  const workers: Worker[] = [];
  const episodes = new Array<number>(snakes).fill(0);
  const results: (SnakeResult | null)[] = new Array(snakes).fill(null);
  const startedAt = performance.now();
  let snakesDone = 0;
  let nextJob = 0;
  let settled = false;

  let resolve!: (outcome: TrainingOutcome) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<TrainingOutcome>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const terminateAll = () => {
    workers.forEach((w) => w.terminate());
    workers.length = 0;
  };

  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    terminateAll();
    fn();
  };

  const dispatch = (worker: Worker) => {
    if (nextJob >= snakes) return;
    const job = nextJob++;
    worker.postMessage({
      type: "train",
      job,
      sessions,
      maxEpoch: options.maxEpoch ?? MAX_EPOCH,
      qvalues: options.qvalues,
      noLearning: options.noLearning,
      verbose: options.verbose,
      agentParams: options.agentParams,
      locale: options.locale,
    } satisfies TrainRequest);
  };

  const finish = () => {
    const done = results as SnakeResult[];
    let bestIndex = 0;
    done.forEach((r, i) => {
      if ((r.replay?.score ?? 0) > (done[bestIndex].replay?.score ?? 0)) bestIndex = i;
    });
    settle(() =>
      resolve({ snakes: done, bestIndex, elapsedMs: performance.now() - startedAt }),
    );
  };

  const poolSize = Math.min(snakes, navigator.hardwareConcurrency || 4);
  for (let i = 0; i < poolSize; i++) {
    const worker = new Worker(new URL("./train.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<TrainResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case "progress":
          episodes[msg.job] = msg.episodes;
          break;
        case "log":
          onLog?.(msg.job, msg.lines, msg.dropped);
          break;
        case "done":
          episodes[msg.job] = sessions;
          results[msg.job] = {
            longestSize: msg.longestSize,
            longestLife: msg.longestLife,
            replay: msg.best,
            qvalues: msg.qvalues,
          };
          snakesDone++;
          if (snakesDone === snakes) finish();
          else dispatch(worker);
          break;
        case "error":
          settle(() => reject(new Error(`Snake ${msg.job + 1}: ${msg.message}`)));
          break;
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      settle(() => reject(new Error(e.message || "Worker crashed.")));
    };
    workers.push(worker);
    dispatch(worker);
  }

  return {
    promise,
    cancel: () => settle(() => reject(new TrainingCancelled())),
    episodes: () => episodes.reduce((a, b) => a + b, 0),
    snakesDone: () => snakesDone,
  };
}
