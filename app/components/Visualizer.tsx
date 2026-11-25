"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { DEFAULT_AGENT_PARAMS, type AgentParams, type QTable } from "@/lib/l2s/agent";
import { Board } from "@/lib/l2s/board";
import type { Action, Vec } from "@/lib/l2s/constants";
import { CSS_COLORS, drawBoard } from "@/lib/l2s/draw";
import { downloadText, formatQValues, parseQValues, parseReplay } from "@/lib/l2s/files";
import { fetchText, PRESET_MODELS, PRESET_REPLAYS } from "@/lib/l2s/presets";
import { Qlearner, type Replay } from "@/lib/l2s/qlearner";
import { useMessages } from "../i18n/context";
import { Button, Caption, FileButton, FoldablePanel, Notice, Panel, Slider, Stat, selectClass } from "./ui";

/** The first option ("unlimited") is labelled in the page language. */
const FPS_OPTIONS = ["unlimited", "120", "60", "30", "15", "5", "1"];
const DEFAULT_FPS_INDEX = FPS_OPTIONS.indexOf("15");
const FRAME_MS = [0, 1000 / 120, 1000 / 60, 1000 / 30, 1000 / 15, 1000 / 5, 1000];
const UNLIMITED_BUDGET_MS = 12;

const MOVES: { code: Action; vec: Vec; key: string; arrow: string }[] = [
  { code: "U", vec: [0, -1], key: "ArrowUp", arrow: "↑" },
  { code: "D", vec: [0, 1], key: "ArrowDown", arrow: "↓" },
  { code: "L", vec: [-1, 0], key: "ArrowLeft", arrow: "←" },
  { code: "R", vec: [1, 0], key: "ArrowRight", arrow: "→" },
];

export interface LoadRequest {
  source: string;
  qvalues?: QTable;
  replay?: Replay;
}

export interface VisualizerHandle {
  load: (request: LoadRequest) => void;
}

interface Snapshot {
  size: number;
  q: (number | null)[];
  lost: boolean;
  episodes: number;
  bestLength: number;
  steps: number;
  replayLeft: number | null;
}

type Notice = { kind: "info" | "error"; text: string } | null;

export default function Visualizer({
  active,
  ref,
}: {
  active: boolean;
  ref?: Ref<VisualizerHandle>;
}) {
  const t = useMessages();
  const v = t.visualizer;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Qlearner | null>(null);
  /** Remaining replay inputs, or null when not in replay mode. */
  const replayRef = useRef<Vec[] | null>(null);
  /** True while the current board came from a replay (not a training episode). */
  const replayBoardRef = useRef(false);
  const statsRef = useRef({ episodes: 0, bestLength: 0, steps: 0 });
  const runningRef = useRef(false);
  const fpsRef = useRef(DEFAULT_FPS_INDEX);

  const [running, setRunning] = useState(false);
  const [fpsIndex, setFpsIndex] = useState(DEFAULT_FPS_INDEX);
  const [learning, setLearning] = useState(true);
  const [params, setParams] = useState<AgentParams>(DEFAULT_AGENT_PARAMS);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [replayMode, setReplayMode] = useState(false);
  /** Name of the loaded Q values; null for the untrained all-zero model. */
  const [modelName, setModelName] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // ---------------------------------------------------------------- drawing

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const model = modelRef.current;
    if (canvas && model) drawBoard(canvas, model.board);
  }, []);

  const refresh = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    const [serial, order] = model.interpreter.calculateState(model.board);
    const row = serial >= 0 ? model.agent.states[serial] : null;
    const stats = statsRef.current;
    setSnap({
      size: model.board.snakePos.length,
      q: MOVES.map((m) => (row ? row[order.indexOf(m.code)] : null)),
      lost: model.board.lost,
      episodes: stats.episodes,
      bestLength: stats.bestLength,
      steps: stats.steps,
      replayLeft: replayRef.current ? replayRef.current.length : null,
    });
  }, []);

  const render = useCallback(() => {
    draw();
    refresh();
  }, [draw, refresh]);

  // ------------------------------------------------------------- simulation

  const exitReplay = useCallback(() => {
    replayRef.current = null;
    setReplayMode(false);
  }, []);

  const newBoard = useCallback(() => {
    const model = modelRef.current!;
    if (model.board.lost && !replayBoardRef.current) statsRef.current.episodes++;
    replayBoardRef.current = false;
    model.resetBoard(new Board());
  }, []);

  /** Advance one tick. Returns false when playback should stop. */
  const advance = useCallback((): boolean => {
    const model = modelRef.current!;
    if (model.board.lost) {
      if (replayRef.current) {
        exitReplay();
        return false;
      }
      newBoard();
      return true;
    }
    if (replayRef.current) {
      const next = replayRef.current.shift();
      if (next) model.board.moveSnake(next);
      else exitReplay(); // Out of inputs: the agent takes over
      return true;
    }
    model.newStep();
    const stats = statsRef.current;
    stats.steps++;
    if (!replayBoardRef.current) {
      stats.bestLength = Math.max(stats.bestLength, model.board.snakePos.length);
    }
    return true;
  }, [exitReplay, newBoard]);

  const step = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    if (model.board.lost) {
      exitReplay();
      newBoard();
    } else {
      advance();
    }
    render();
  }, [advance, exitReplay, newBoard, render]);

  const moveSnake = useCallback(
    (direction: Vec) => {
      const model = modelRef.current;
      if (!model || model.board.lost || runningRef.current) return;
      model.board.moveSnake(direction);
      render();
    },
    [render],
  );

  // Create the model once, on the client.
  useEffect(() => {
    if (!modelRef.current) modelRef.current = new Qlearner({ log: () => {} });
    render();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    // The board colours follow the light/dark theme.
    const theme = matchMedia("(prefers-color-scheme: dark)");
    theme.addEventListener("change", draw);
    return () => {
      observer.disconnect();
      theme.removeEventListener("change", draw);
    };
  }, [draw, render]);

  const updateParams = (patch: Partial<AgentParams>) => {
    const next = { ...params, ...patch };
    setParams(next);
    modelRef.current?.agent.setParams(next);
  };

  const toggleLearning = () => {
    const next = !learning;
    setLearning(next);
    if (modelRef.current) modelRef.current.noLearning = !next;
  };

  const changeFps = (index: number) => {
    setFpsIndex(index);
    fpsRef.current = index;
  };

  // Main loop
  useEffect(() => {
    runningRef.current = running;
    if (!running) return;

    let raf = 0;
    let last = performance.now();
    let backlog = Infinity; // Take the first step immediately

    const frame = (now: number) => {
      const frameMs = FRAME_MS[fpsRef.current];
      let keepGoing = true;

      if (frameMs === 0) {
        const start = performance.now();
        while (performance.now() - start < UNLIMITED_BUDGET_MS) {
          if (!advance()) {
            keepGoing = false;
            break;
          }
        }
      } else {
        backlog = Math.min(backlog + (now - last), frameMs * 4);
        while (backlog >= frameMs) {
          backlog -= frameMs;
          if (!advance()) {
            keepGoing = false;
            break;
          }
        }
      }
      last = now;
      render();

      if (keepGoing) raf = requestAnimationFrame(frame);
      else setRunning(false);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, advance, render]);

  // Keyboard controls while paused (arrows move, Enter steps). Space is left
  // alone so it keeps its native role of pressing the focused button.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (runningRef.current || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const move = MOVES.find((m) => m.key === e.key);
      if (move) {
        e.preventDefault();
        moveSnake(move.vec);
      } else if (e.key === "Enter") {
        // preventDefault stops Enter from also clicking a focused button
        // (e.g. Resume right after pausing).
        e.preventDefault();
        step();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, moveSnake, step]);

  // ------------------------------------------------------------ file loading

  const loadQValues = useCallback(
    (text: string, name: string) => {
      const model = modelRef.current;
      if (!model) return;
      try {
        model.agent.states = parseQValues(text, model.interpreter.stateCount);
        setModelName(name);
        setNotice({ kind: "info", text: v.loadedQValues(name) });
        render();
      } catch (err) {
        setNotice({ kind: "error", text: `${name}: ${t.error(err)}` });
      }
    },
    [render, t, v],
  );

  /** Start over: all-zero Q values, a fresh board and cleared stats. */
  const resetAll = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    model.agent.states = Array.from({ length: model.interpreter.stateCount }, () => [0, 0, 0, 0]);
    exitReplay();
    replayBoardRef.current = false;
    model.resetBoard(new Board());
    statsRef.current = { episodes: 0, bestLength: 0, steps: 0 };
    setModelName(null);
    setNotice({ kind: "info", text: v.resetNotice });
    render();
  }, [exitReplay, render, v]);

  const startReplay = useCallback(
    (replay: Replay, name: string) => {
      const model = modelRef.current;
      if (!model) return;
      setRunning(false);
      model.resetBoard(Board.fromSnapshot(replay));
      replayRef.current = replay.inputs.map((v) => [v[0], v[1]] as Vec);
      replayBoardRef.current = true;
      setReplayMode(true);
      setNotice({ kind: "info", text: v.replayNotice(name, replay.score, replay.inputs.length) });
      render();
    },
    [render, v],
  );

  const loadReplay = useCallback(
    (text: string, name: string) => {
      try {
        startReplay(parseReplay(text), name);
      } catch (err) {
        setNotice({ kind: "error", text: `${name}: ${t.error(err)}` });
      }
    },
    [startReplay, t],
  );

  const loadPreset = async (url: string, name: string, kind: "model" | "replay") => {
    try {
      const text = await fetchText(url);
      if (kind === "model") loadQValues(text, name);
      else loadReplay(text, name);
    } catch (err) {
      setNotice({ kind: "error", text: t.error(err) });
    }
  };

  // Requests coming from the training tab
  useImperativeHandle(ref, () => ({
    load(request: LoadRequest) {
      const model = modelRef.current;
      if (!model) return;
      if (request.qvalues) {
        model.agent.states = request.qvalues.map((row) => [...row]);
        setModelName(request.source);
      }
      if (request.replay) {
        startReplay(request.replay, request.source);
      } else {
        setNotice({ kind: "info", text: v.loadedQValues(request.source) });
        render();
      }
    },
  }), [render, startReplay, v]);

  // ---------------------------------------------------------------------- UI

  const qs = snap?.q ?? [null, null, null, null];
  const finite = qs.filter((v): v is number => v !== null);
  const bestQ = finite.length ? Math.max(...finite) : null;

  const TONES = {
    // Shares its value with another direction (takes priority over "best")
    tied: {
      idle: "bg-marker text-marker-ink",
      pressed: "active:brightness-95",
    },
    // The single highest value: the move the agent picks when not exploring
    best: {
      idle: "bg-paper text-accent underline decoration-2 underline-offset-4",
      pressed: "active:bg-paper-3",
    },
    plain: {
      idle: "bg-paper text-ink",
      pressed: "active:bg-paper-3",
    },
  };

  /** A direction's Q value, doubling as the button that moves the snake that way. */
  const qCell = (index: number) => {
    const move = MOVES[index];
    const label = t.moves[move.code];
    const value = qs[index];
    const tied = value !== null && qs.some((other, i) => i !== index && other === value);
    const tone = TONES[tied ? "tied" : value !== null && value === bestQ ? "best" : "plain"];
    return (
      <button
        type="button"
        onClick={() => moveSnake(move.vec)}
        aria-disabled={running}
        aria-label={v.moveLabel(label, value === null ? v.none : formatQ(value))}
        title={running ? v.qTitle(label) : v.moveTitle(label)}
        className={`rounded-sm px-2 py-1.5 text-center text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          tone.idle
        } ${running ? "cursor-default" : tone.pressed}`}
      >
        <div className="text-[11px] opacity-60">
          {move.arrow} {label}
        </div>
        {value === null ? "-" : formatQ(value)}
      </button>
    );
  };

  const caption = snap?.lost
    ? v.captionLost
    : !running && replayMode
      ? v.captionReplay
      : !running
        ? v.captionPaused
        : v.captionRunning;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <figure className="mx-auto w-full max-w-[max(320px,min(560px,calc(100svh-28rem)))]">
          <canvas
            ref={canvasRef}
            className="aspect-square w-full rounded-sm border border-muted bg-board-bg"
            aria-label={v.boardLabel}
          />
          <Caption
            label={v.figure}
            aside={replayMode && snap?.replayLeft != null && v.replayLeft(snap.replayLeft)}
          >
            {caption}
          </Caption>
        </figure>

        <div className="mx-auto flex w-full max-w-[560px] flex-wrap gap-2">
          <Button variant="primary" onClick={() => setRunning((r) => !r)} className="min-w-24">
            {running ? v.pause : v.resume}
          </Button>
          <Button onClick={step} disabled={running} title={v.enterKey}>
            {v.step}
          </Button>
          <Button
            onClick={() => {
              exitReplay();
              replayBoardRef.current = false;
              modelRef.current?.resetBoard(new Board());
              render();
            }}
          >
            {v.resetBoard}
          </Button>
          <Button onClick={resetAll} title={v.resetAllTitle}>
            {v.resetAll}
          </Button>
          <Button onClick={toggleLearning}>
            {learning ? v.stopLearning : v.resumeLearning}
          </Button>
          {replayMode && (
            <Button
              variant="ghost"
              onClick={() => {
                exitReplay();
                setRunning(false);
                render();
              }}
            >
              {v.exitReplay}
            </Button>
          )}
        </div>

        {notice && (
          <div className="mx-auto w-full max-w-[560px]">
            <Notice kind={notice.kind}>{notice.text}</Notice>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Panel title={v.snakePanel}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={v.snakeSize} value={snap?.size ?? "-"} />
            <Stat label={v.bestSize} value={snap?.bestLength ?? "-"} />
            <Stat label={v.episodes} value={snap?.episodes ?? "-"} />
            <Stat label={v.agentSteps} value={snap?.steps ?? "-"} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {v.model} <span className="italic">{modelName ?? v.untrained}</span>
            {" · "}
            {learning ? v.learning : v.notLearning}
          </p>
        </Panel>

        <Panel title={v.qPanel}>
          <div className="grid grid-cols-3 gap-1.5">
            <div />
            {qCell(0)}
            <div />
            {qCell(2)}
            <button
              type="button"
              onClick={step}
              disabled={running}
              title={v.stepTitle}
              aria-label={v.step}
              className="flex flex-col items-center justify-center gap-0.5 rounded-sm text-xs text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:bg-paper-3 disabled:active:bg-transparent"
            >
              <span className="size-4 rounded-full" style={{ background: CSS_COLORS.head }} />
              {v.step}
            </button>
            {qCell(3)}
            <div />
            {qCell(1)}
            <div />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            {v.help}
          </p>
        </Panel>

        <FoldablePanel title={v.options}>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between text-sm">
              {v.maxFps}
              <select
                className={selectClass}
                value={fpsIndex}
                onChange={(e) => changeFps(Number(e.target.value))}
              >
                {FPS_OPTIONS.map((label, i) => (
                  <option key={label} value={i}>
                    {i === 0 ? v.unlimited : label}
                  </option>
                ))}
              </select>
            </label>
            <Slider
              label={t.params.learningRate}
              min={0}
              max={0.5}
              step={0.05}
              value={params.learningRate}
              onChange={(v) => updateParams({ learningRate: v })}
            />
            <Slider
              label={t.params.explorationRate}
              min={0}
              max={1}
              step={0.05}
              value={params.explorationRate}
              onChange={(v) => updateParams({ explorationRate: v })}
            />
            <Slider
              label={t.params.decay}
              min={0}
              max={1}
              step={0.05}
              value={params.decay}
              onChange={(v) => updateParams({ decay: v })}
            />
          </div>
        </FoldablePanel>

        <FoldablePanel title={v.files}>
          <div className="flex flex-wrap gap-2">
            <FileButton accept=".qval,.txt,text/plain" onText={loadQValues}>
              {v.loadQValues}
            </FileButton>
            <Button
              onClick={() => {
                const model = modelRef.current;
                if (model) downloadText("learn2slither.qval", formatQValues(model.agent.states));
              }}
            >
              {v.saveQValues}
            </Button>
            <FileButton accept=".rpl,.json,application/json" onText={loadReplay}>
              {v.loadReplay}
            </FileButton>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className={selectClass}
              value=""
              onChange={(e) => {
                const preset = PRESET_MODELS.find((p) => p.name === e.target.value);
                if (preset) loadPreset(preset.url, preset.name, "model");
              }}
              aria-label={v.bundledModelLabel}
            >
              <option value="">{v.bundledModel}</option>
              {PRESET_MODELS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value=""
              onChange={(e) => {
                const preset = PRESET_REPLAYS.find((p) => p.name === e.target.value);
                if (preset) loadPreset(preset.url, preset.name, "replay");
              }}
              aria-label={v.bundledReplayLabel}
            >
              <option value="">{v.bundledReplay}</option>
              {PRESET_REPLAYS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </FoldablePanel>
      </div>
    </div>
  );
}

function formatQ(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1e5) return value.toExponential(2);
  return value.toFixed(2);
}
