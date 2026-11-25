"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_AGENT_PARAMS, type AgentParams, type QTable } from "@/lib/l2s/agent";
import { downloadText, formatQValues, formatReplay, parseQValues } from "@/lib/l2s/files";
import { Interpreter } from "@/lib/l2s/interpreter";
import { fetchText, PRESET_MODELS } from "@/lib/l2s/presets";
import {
  MAX_SNAKES,
  startTraining,
  TrainingCancelled,
  type TrainingOutcome,
  type TrainingRun,
} from "@/lib/l2s/training";
import type { LoadRequest } from "./Visualizer";
import { Button, FileButton, inputClass, Panel, Slider, selectClass, Stat } from "./ui";

const MAX_LOG_LINES = 2000;

type Status = "idle" | "running" | "done" | "cancelled" | "error";

export default function Trainer({
  onOpen,
}: {
  onOpen: (request: LoadRequest) => void;
}) {
  const [sessions, setSessions] = useState("100");
  const [snakes, setSnakes] = useState("1");
  const [noLearning, setNoLearning] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [params, setParams] = useState<AgentParams>(DEFAULT_AGENT_PARAMS);
  const [input, setInput] = useState<{ name: string; qvalues: QTable } | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, snakesDone: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<TrainingOutcome | null>(null);

  const runRef = useRef<TrainingRun | null>(null);
  const logRef = useRef<string[]>([]);
  const logBoxRef = useRef<HTMLPreElement>(null);

  const stateCount = new Interpreter().stateCount;

  useEffect(() => () => runRef.current?.cancel(), []);

  // Sync progress & logs from refs at a steady rate while training.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      const run = runRef.current;
      if (run) setProgress((p) => ({ ...p, done: run.episodes(), snakesDone: run.snakesDone() }));
      setLogs([...logRef.current]);
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [logs]);

  const pushLog = (...lines: string[]) => {
    const log = logRef.current;
    log.push(...lines);
    if (log.length > MAX_LOG_LINES) log.splice(0, log.length - MAX_LOG_LINES);
  };

  const loadInput = (text: string, name: string) => {
    try {
      setInput({ name, qvalues: parseQValues(text, stateCount) });
      setError(null);
    } catch (err) {
      setError(`${name}: ${(err as Error).message}`);
    }
  };

  const start = () => {
    const sessionCount = Math.floor(Number(sessions));
    const snakeCount = Math.floor(Number(snakes));
    if (!(sessionCount >= 1)) {
      setError("Sessions must be a positive whole number.");
      return;
    }
    if (!(snakeCount >= 1)) {
      setError("Snakes must be a positive whole number.");
      return;
    }
    if (snakeCount > MAX_SNAKES) {
      setError(`Too many snakes (${snakeCount}). Maximum value is ${MAX_SNAKES}.`);
      return;
    }

    runRef.current?.cancel();
    setError(null);
    setOutcome(null);
    logRef.current = [];
    setLogs([]);
    setProgress({ done: 0, total: sessionCount * snakeCount, snakesDone: 0 });
    setStatus("running");

    if (input) pushLog(`Loaded model from ${input.name}.`);

    const prefix = (job: number) => (snakeCount > 1 ? `[snake ${job + 1}] ` : "");
    const run = startTraining(
      {
        sessions: sessionCount,
        snakes: snakeCount,
        qvalues: input?.qvalues ?? null,
        noLearning,
        verbose,
        agentParams: params,
      },
      (job, lines, dropped) => {
        if (dropped) pushLog(`${prefix(job)}… ${dropped} lines omitted …`);
        pushLog(...lines.map((l) => prefix(job) + l));
      },
    );
    runRef.current = run;

    run.promise.then(
      (result) => {
        if (runRef.current !== run) return;
        if (snakeCount > 1) {
          const best = result.snakes[result.bestIndex];
          pushLog(`Best snake: #${result.bestIndex + 1} (size ${best.longestSize}).`);
        }
        setLogs([...logRef.current]);
        setProgress((p) => ({ ...p, done: p.total, snakesDone: snakeCount }));
        setOutcome(result);
        setStatus("done");
      },
      (err: Error) => {
        if (runRef.current !== run || err instanceof TrainingCancelled) return;
        setError(err.message);
        setLogs([...logRef.current]);
        setStatus("error");
      },
    );
  };

  const cancel = () => {
    runRef.current?.cancel();
    pushLog("Training cancelled.");
    setLogs([...logRef.current]);
    setStatus("cancelled");
  };

  const running = status === "running";
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0;
  const best = outcome ? outcome.snakes[outcome.bestIndex] : null;
  const snakeLabel = outcome && outcome.snakes.length > 1 ? `snake #${outcome.bestIndex + 1}` : "trained model";

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Panel title="Training run">
          <div className="flex flex-col gap-3">
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              Sessions per snake
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min={1}
                value={sessions}
                disabled={running}
                onChange={(e) => setSessions(e.target.value)}
              />
            </label>
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              Snakes trained in parallel
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min={1}
                max={MAX_SNAKES}
                value={snakes}
                disabled={running}
                onChange={(e) => setSnakes(e.target.value)}
              />
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Each snake learns independently in a Web Worker; only the best one is kept.
              </span>
            </label>

            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              Starting Q values
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  className={selectClass}
                  disabled={running}
                  value=""
                  onChange={async (e) => {
                    const preset = PRESET_MODELS.find((p) => p.name === e.target.value);
                    if (!preset) return;
                    try {
                      loadInput(await fetchText(preset.url), preset.name);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  aria-label="Start from a bundled model"
                >
                  <option value="">Bundled…</option>
                  {PRESET_MODELS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <FileButton accept=".qval,.txt,text/plain" onText={loadInput} disabled={running}>
                  File…
                </FileButton>
                {input && (
                  <Button variant="ghost" disabled={running} onClick={() => setInput(null)}>
                    Clear
                  </Button>
                )}
              </div>
              <span className="mt-1 block font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {input ? input.name : "all zeros (fresh model)"}
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={noLearning}
                disabled={running}
                onChange={(e) => setNoLearning(e.target.checked)}
                className="accent-zinc-700 dark:accent-zinc-300"
              />
              No learning (don&apos;t update Q values)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={verbose}
                disabled={running}
                onChange={(e) => setVerbose(e.target.checked)}
                className="accent-zinc-700 dark:accent-zinc-300"
              />
              Verbose output
            </label>
          </div>
        </Panel>

        <Panel title="Agent parameters">
          <div className="flex flex-col gap-3">
            <Slider
              label="Learning rate"
              min={0}
              max={0.5}
              step={0.05}
              value={params.learningRate}
              onChange={(v) => setParams((p) => ({ ...p, learningRate: v }))}
            />
            <Slider
              label="Exploration rate"
              min={0}
              max={1}
              step={0.05}
              value={params.explorationRate}
              onChange={(v) => setParams((p) => ({ ...p, explorationRate: v }))}
            />
            <Slider
              label="Reward decay rate"
              min={0}
              max={1}
              step={0.05}
              value={params.decay}
              onChange={(v) => setParams((p) => ({ ...p, decay: v }))}
            />
          </div>
        </Panel>

        <div className="flex gap-2">
          {running ? (
            <Button variant="danger" onClick={cancel} className="flex-1">
              Cancel
            </Button>
          ) : (
            <Button variant="primary" onClick={start} className="flex-1">
              Start training
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Progress">
          <div className="h-2 overflow-hidden rounded-sm bg-white dark:bg-zinc-800">
            <div
              className="h-full bg-emerald-600 transition-[width] duration-150 dark:bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Status" value={<span className="text-base">{status}</span>} />
            <Stat label="Episodes" value={`${progress.done} / ${progress.total}`} />
            <Stat label="Snakes done" value={progress.snakesDone} />
            <Stat
              label="Time"
              value={outcome ? `${(outcome.elapsedMs / 1000).toFixed(1)}s` : "—"}
            />
          </div>
        </Panel>

        {outcome && best && (
          <Panel title="Result">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Longest size" value={best.longestSize} />
              <Stat label="Longest session" value={best.longestLife} />
              <Stat label="Best replay moves" value={best.replay?.inputs.length ?? "—"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!best.replay}
                onClick={() =>
                  onOpen({ source: snakeLabel, qvalues: best.qvalues, replay: best.replay ?? undefined })
                }
              >
                Watch best replay
              </Button>
              <Button onClick={() => onOpen({ source: snakeLabel, qvalues: best.qvalues })}>
                Use Q values in visualizer
              </Button>
              <Button onClick={() => downloadText("learn2slither.qval", formatQValues(best.qvalues))}>
                Download .qval
              </Button>
              <Button
                disabled={!best.replay}
                onClick={() => best.replay && downloadText("learn2slither.rpl", formatReplay(best.replay))}
              >
                Download .rpl
              </Button>
            </div>

            {outcome.snakes.length > 1 && (
              <div className="mt-4 max-h-56 overflow-auto rounded bg-white dark:bg-zinc-950">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="sticky top-0 bg-white text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Snake</th>
                      <th className="px-3 py-1.5 font-medium">Longest size</th>
                      <th className="px-3 py-1.5 font-medium">Longest session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.snakes.map((s, i) => (
                      <tr
                        key={i}
                        className={
                          i === outcome.bestIndex
                            ? "bg-emerald-50 dark:bg-emerald-500/10"
                            : "border-t border-zinc-100 dark:border-zinc-800"
                        }
                      >
                        <td className="px-3 py-1">#{i + 1}</td>
                        <td className="px-3 py-1">{s.longestSize}</td>
                        <td className="px-3 py-1">{s.longestLife}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        <Panel title="Output" className="min-w-0">
          <pre
            ref={logBoxRef}
            className="h-72 overflow-auto rounded bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200"
          >
            {logs.length ? logs.join("\n") : "Output will appear here."}
          </pre>
        </Panel>
      </div>
    </div>
  );
}
