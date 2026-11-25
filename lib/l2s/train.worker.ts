/// <reference lib="webworker" />
import type { AgentParams, QTable } from "./agent";
import { Qlearner } from "./qlearner";
import type { TrainingResult } from "./qlearner";
import { LEARNER_MESSAGES, type Locale } from "../i18n/core";

export interface TrainRequest {
  type: "train";
  job: number;
  sessions: number;
  maxEpoch: number;
  qvalues: QTable | null;
  noLearning: boolean;
  verbose: boolean;
  agentParams: AgentParams;
  /** Language of the log lines. */
  locale: Locale;
}

export type TrainResponse =
  | { type: "progress"; job: number; episodes: number }
  | { type: "log"; job: number; lines: string[]; dropped: number }
  | ({ type: "done"; job: number; qvalues: QTable } & TrainingResult)
  | { type: "error"; job: number; message: string };

const MAX_BUFFERED_LINES = 500;
const FLUSH_INTERVAL_MS = 100;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<TrainRequest>) => {
  const req = event.data;
  if (req.type !== "train") return;

  let buffer: string[] = [];
  let dropped = 0;
  let lastFlush = performance.now();

  const flush = () => {
    if (buffer.length || dropped) {
      ctx.postMessage({ type: "log", job: req.job, lines: buffer, dropped } satisfies TrainResponse);
    }
    buffer = [];
    dropped = 0;
    lastFlush = performance.now();
  };

  const log = (line: string) => {
    buffer.push(line);
    if (buffer.length > MAX_BUFFERED_LINES) {
      buffer.shift();
      dropped++;
    }
  };

  try {
    const learner = new Qlearner({
      maxSessions: req.sessions,
      maxEpoch: req.maxEpoch,
      qvalues: req.qvalues,
      noLearning: req.noLearning,
      verbose: req.verbose,
      agentParams: req.agentParams,
      log,
      messages: LEARNER_MESSAGES[req.locale],
    });

    const result = learner.loop((episodes) => {
      if (performance.now() - lastFlush >= FLUSH_INTERVAL_MS || episodes === req.sessions) {
        ctx.postMessage({ type: "progress", job: req.job, episodes } satisfies TrainResponse);
        flush();
      }
    });
    flush();

    ctx.postMessage({
      type: "done",
      job: req.job,
      qvalues: learner.agent.states,
      ...result,
    } satisfies TrainResponse);
  } catch (err) {
    flush();
    ctx.postMessage({
      type: "error",
      job: req.job,
      message: err instanceof Error ? err.message : String(err),
    } satisfies TrainResponse);
  }
};
