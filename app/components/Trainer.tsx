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
import { useMessages } from "../i18n/context";
import type { LoadRequest } from "./Visualizer";
import { Button, FileButton, inputClass, Notice, Panel, Slider, selectClass, Stat } from "./ui";

const MAX_LOG_LINES = 2000;

type Status = "idle" | "running" | "done" | "cancelled" | "error";

export default function Trainer({
  onOpen,
}: {
  onOpen: (request: LoadRequest) => void;
}) {
  const t = useMessages();
  const tr = t.trainer;
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
      setError(`${name}: ${t.error(err)}`);
    }
  };

  const start = () => {
    const sessionCount = Math.floor(Number(sessions));
    const snakeCount = Math.floor(Number(snakes));
    if (!(sessionCount >= 1)) {
      setError(tr.sessionsError);
      return;
    }
    if (!(snakeCount >= 1)) {
      setError(tr.snakesError);
      return;
    }
    if (snakeCount > MAX_SNAKES) {
      setError(tr.tooManySnakes(snakeCount, MAX_SNAKES));
      return;
    }

    runRef.current?.cancel();
    setError(null);
    setOutcome(null);
    logRef.current = [];
    setLogs([]);
    setProgress({ done: 0, total: sessionCount * snakeCount, snakesDone: 0 });
    setStatus("running");

    if (input) pushLog(tr.loadedModel(input.name));

    const prefix = (job: number) => (snakeCount > 1 ? tr.snakePrefix(job + 1) : "");
    const run = startTraining(
      {
        sessions: sessionCount,
        snakes: snakeCount,
        qvalues: input?.qvalues ?? null,
        noLearning,
        verbose,
        agentParams: params,
        locale: t.locale,
      },
      (job, lines, dropped) => {
        if (dropped) pushLog(prefix(job) + tr.linesOmitted(dropped));
        pushLog(...lines.map((l) => prefix(job) + l));
      },
    );
    runRef.current = run;

    run.promise.then(
      (result) => {
        if (runRef.current !== run) return;
        if (snakeCount > 1) {
          const best = result.snakes[result.bestIndex];
          pushLog(tr.bestSnake(result.bestIndex + 1, best.longestSize));
        }
        setLogs([...logRef.current]);
        setProgress((p) => ({ ...p, done: p.total, snakesDone: snakeCount }));
        setOutcome(result);
        setStatus("done");
      },
      (err: Error) => {
        if (runRef.current !== run || err instanceof TrainingCancelled) return;
        setError(t.error(err));
        setLogs([...logRef.current]);
        setStatus("error");
      },
    );
  };

  const cancel = () => {
    runRef.current?.cancel();
    pushLog(tr.cancelled);
    setLogs([...logRef.current]);
    setStatus("cancelled");
  };

  const running = status === "running";
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0;
  const best = outcome ? outcome.snakes[outcome.bestIndex] : null;
  const snakeLabel =
    outcome && outcome.snakes.length > 1 ? tr.snakeName(outcome.bestIndex + 1) : tr.trainedModel;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Panel title={tr.runPanel}>
          <div className="flex flex-col gap-3">
            <label className="block text-sm">
              {tr.sessionsPerSnake}
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min={1}
                value={sessions}
                disabled={running}
                onChange={(e) => setSessions(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              {tr.snakesInParallel}
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min={1}
                max={MAX_SNAKES}
                value={snakes}
                disabled={running}
                onChange={(e) => setSnakes(e.target.value)}
              />
              <span className="mt-1 block text-[13px] leading-snug text-muted">
                {tr.snakesHelp}
              </span>
            </label>

            <div className="text-sm">
              {tr.startingQValues}
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
                      setError(t.error(err));
                    }
                  }}
                  aria-label={tr.bundledLabel}
                >
                  <option value="">{tr.bundled}</option>
                  {PRESET_MODELS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <FileButton accept=".qval,.txt,text/plain" onText={loadInput} disabled={running}>
                  {tr.file}
                </FileButton>
                {input && (
                  <Button variant="ghost" disabled={running} onClick={() => setInput(null)}>
                    {tr.clear}
                  </Button>
                )}
              </div>
              <span className="mt-1 block text-[13px] italic text-muted">
                {input ? input.name : tr.freshModel}
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noLearning}
                disabled={running}
                onChange={(e) => setNoLearning(e.target.checked)}
                className="accent-[var(--ink)]"
              />
              {tr.noLearning}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={verbose}
                disabled={running}
                onChange={(e) => setVerbose(e.target.checked)}
                className="accent-[var(--ink)]"
              />
              {tr.verbose}
            </label>
          </div>
        </Panel>

        <Panel title={tr.agentPanel}>
          <div className="flex flex-col gap-3">
            <Slider
              label={t.params.learningRate}
              min={0}
              max={0.5}
              step={0.05}
              value={params.learningRate}
              onChange={(v) => setParams((p) => ({ ...p, learningRate: v }))}
            />
            <Slider
              label={t.params.explorationRate}
              min={0}
              max={1}
              step={0.05}
              value={params.explorationRate}
              onChange={(v) => setParams((p) => ({ ...p, explorationRate: v }))}
            />
            <Slider
              label={t.params.decay}
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
              {tr.cancel}
            </Button>
          ) : (
            <Button variant="primary" onClick={start} className="flex-1">
              {tr.start}
            </Button>
          )}
        </div>
        {error && (
          <Notice kind="error">{error}</Notice>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title={tr.progressPanel}>
          <div className="h-1.5 overflow-hidden rounded-sm bg-paper">
            <div
              className="h-full bg-ink transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={tr.status} value={<span className="text-base">{tr.statuses[status]}</span>} />
            <Stat label={tr.episodes} value={`${progress.done} / ${progress.total}`} />
            <Stat label={tr.snakesDone} value={progress.snakesDone} />
            <Stat label={tr.time} value={outcome ? tr.shortSeconds(outcome.elapsedMs) : "-"} />
          </div>
        </Panel>

        {outcome && best && (
          <Panel title={tr.resultPanel}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={tr.longestSize} value={best.longestSize} />
              <Stat label={tr.longestSession} value={best.longestLife} />
              <Stat label={tr.bestReplayMoves} value={best.replay?.inputs.length ?? "-"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!best.replay}
                onClick={() =>
                  onOpen({ source: snakeLabel, qvalues: best.qvalues, replay: best.replay ?? undefined })
                }
              >
                {tr.watchBest}
              </Button>
              <Button onClick={() => onOpen({ source: snakeLabel, qvalues: best.qvalues })}>
                {tr.useQValues}
              </Button>
              <Button onClick={() => downloadText("learn2slither.qval", formatQValues(best.qvalues))}>
                {tr.downloadQval}
              </Button>
              <Button
                disabled={!best.replay}
                onClick={() => best.replay && downloadText("learn2slither.rpl", formatReplay(best.replay))}
              >
                {tr.downloadRpl}
              </Button>
            </div>

            {outcome.snakes.length > 1 && (
              <div className="mt-4 max-h-56 overflow-auto rounded-sm bg-paper">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="sticky top-0 bg-paper text-xs text-muted">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">{tr.snake}</th>
                      <th className="px-3 py-1.5 font-medium">{tr.longestSize}</th>
                      <th className="px-3 py-1.5 font-medium">{tr.longestSession}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.snakes.map((s, i) => (
                      <tr
                        key={i}
                        className={
                          i === outcome.bestIndex
                            ? "border-t border-rule font-semibold text-accent"
                            : "border-t border-rule"
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

        <Panel title={tr.outputPanel} className="min-w-0">
          <pre
            ref={logBoxRef}
            className="h-72 overflow-auto rounded-sm bg-paper p-3 font-mono text-xs leading-relaxed text-ink"
          >
            {logs.length ? logs.join("\n") : tr.outputEmpty}
          </pre>
        </Panel>
      </div>
    </div>
  );
}
