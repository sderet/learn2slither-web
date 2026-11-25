"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { QTable } from "@/lib/l2s/agent";
import { Board } from "@/lib/l2s/board";
import { CSS_COLORS, drawBoard } from "@/lib/l2s/draw";
import { Qlearner, type Replay } from "@/lib/l2s/qlearner";
import { useMessages } from "../i18n/context";
import { Button, Caption, Panel, Stat } from "./ui";
import type { LoadRequest } from "./Visualizer";

/** Games played during the training step. */
const TRAINING_GAMES = 500;
/** Moves simulated per animation frame while training (~15000 moves/s at 60 Hz). */
const TRAINING_STEPS_PER_FRAME = 250;
/** Playback speed of the untrained snake (step 1) and the best game (step 3). */
const CLUELESS_FPS = 8;
const REPLAY_FPS = 15;

type Step = 0 | 1 | 2 | 3 | 4; // 0 = not started, 4 = finished

/** Shared by the steps of one demo run: cancel it, skip the current step, or continue. */
interface Cancel {
  cancelled: boolean;
  skip: boolean;
  raf: number;
  /** Set while waiting for the user to press "Next". */
  next?: () => void;
  abort?: () => void;
}

class Cancelled extends Error {}

function newToken(): Cancel {
  return { cancelled: false, skip: false, raf: 0 };
}

function cancelToken(token: Cancel | null) {
  if (!token) return;
  token.cancelled = true;
  cancelAnimationFrame(token.raf);
  token.abort?.();
}

/** Resolves on the next animation frame, or rejects if the run was cancelled. */
function nextFrame(token: Cancel): Promise<number> {
  return new Promise((resolve, reject) => {
    token.raf = requestAnimationFrame((now) =>
      token.cancelled ? reject(new Cancelled()) : resolve(now),
    );
  });
}

/** Wait until the user presses "Next" (or the run is cancelled). */
function waitForNext(token: Cancel): Promise<void> {
  return new Promise((resolve, reject) => {
    const clear = () => {
      token.next = undefined;
      token.abort = undefined;
    };
    token.next = () => {
      clear();
      resolve();
    };
    token.abort = () => {
      clear();
      reject(new Cancelled());
    };
  });
}

/** A fresh, untrained snake that moves at random until it crashes. */
function cluelessGame(): Replay {
  // Longest clear crash seen so far, used if no game has the ideal length.
  let fallback: Replay | null = null;
  // Pick a game that is long enough to watch but still short. Only ~1.5% of
  // random games qualify, so try plenty (each game takes microseconds).
  for (let attempt = 0; attempt < 2000; attempt++) {
    const learner = new Qlearner({
      agentParams: { explorationRate: 1 }, // knows nothing: every move is a guess
      noLearning: true,
      log: () => {},
    });
    const start = learner.startingState;
    const seed = learner.board.rngseed;
    let reversed = false;
    while (!learner.board.lost && learner.inputs.length < 200) {
      const neck = learner.board.snakePos[1];
      learner.newStep();
      const head = learner.board.snakePos[0];
      reversed = !!neck && head[0] === neck[0] && head[1] === neck[1];
    }
    // Turning straight back into its own neck looks like an unexplained death,
    // so only keep games that end by hitting a wall or the rest of the body.
    if (!learner.board.lost || reversed) continue;
    const replay: Replay = {
      score: learner.board.snakePos.length,
      lifetime: learner.inputs.length,
      starting_state: start,
      inputs: learner.inputs,
      seed,
    };
    const moves = replay.inputs.length;
    if (moves >= 10 && moves <= 40) return replay;
    if (moves <= 40 && (!fallback || moves > fallback.inputs.length)) fallback = replay;
  }
  return fallback!;
}

export default function Demo({ onOpen }: { onOpen: (request: LoadRequest) => void }) {
  const t = useMessages();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const tokenRef = useRef<Cancel | null>(null);
  /**
   * The step 1 game, picked before the demo starts so the board shown while
   * waiting is exactly where that game begins. Used once, by the first run.
   */
  const firstGameRef = useRef<Replay | null>(null);

  const [step, setStep] = useState<Step>(0);
  /** Waiting for the user to press "Next" between steps. */
  const [waiting, setWaiting] = useState(false);
  const [clueless, setClueless] = useState<{ moves: number } | null>(null);
  const [games, setGames] = useState<number[]>([]);
  const [move, setMove] = useState({ index: 0, total: 0, size: 0 });
  const [learner, setLearner] = useState<Qlearner | null>(null);
  /** Copy of the Q-table during training, redrawn every frame. */
  const [brain, setBrain] = useState<QTable | null>(null);
  /** Situations it has met so far, in the order it met them. */
  const [met, setMet] = useState<number[]>([]);
  const [best, setBest] = useState<Replay | null>(null);
  /** Computing time actually spent training (excludes drawing and the slow-down for display). */
  const [trainingMs, setTrainingMs] = useState<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    // A crashed board isn't drawn, so the frame before the crash stays visible.
    if (canvas && boardRef.current) drawBoard(canvas, boardRef.current);
  }, []);

  /** Play a recorded game at `fps`; "Skip" jumps to the end. */
  const playGame = useCallback(
    async (game: Replay, fps: number, token: Cancel) => {
      const board = Board.fromSnapshot(game);
      boardRef.current = board;
      setMove({ index: 0, total: game.inputs.length, size: board.snakePos.length });
      draw();
      let index = 0;
      let last = performance.now();
      while (index < game.inputs.length && !board.lost) {
        const now = await nextFrame(token);
        const due = token.skip ? game.inputs.length - index : Math.floor((now - last) / (1000 / fps));
        if (due <= 0) continue;
        last = now;
        for (let i = 0; i < due && index < game.inputs.length && !board.lost; i++) {
          board.moveSnake(game.inputs[index++]);
        }
        setMove({ index, total: game.inputs.length, size: board.snakePos.length });
        draw();
      }
      token.skip = false;
    },
    [draw],
  );

  /** Train visibly: many moves per frame, drawing the board every frame. */
  const train = useCallback(
    async (token: Cancel) => {
      const agent = new Qlearner({ maxSessions: TRAINING_GAMES, log: () => {} });
      setLearner(agent);
      setBrain(agent.agent.states.map((row) => [...row]));
      setMet([]);
      const order: number[] = [];
      const sizes: number[] = [];
      setGames([]);
      let done = false;
      let computeMs = 0;
      while (!done) {
        await nextFrame(token);
        const started = performance.now();
        done = agent.trainSteps(token.skip ? Infinity : TRAINING_STEPS_PER_FRAME, (_, size) =>
          sizes.push(size),
        );
        computeMs += performance.now() - started;
        boardRef.current = agent.board;
        setGames([...sizes]);
        const qvalues = agent.agent.states.map((row) => [...row]);
        for (const state of metStates(qvalues)) if (!order.includes(state)) order.push(state);
        setBrain(qvalues);
        setMet([...order]);
        draw();
      }
      token.skip = false;
      setTrainingMs(computeMs);
      return agent.trainingResult.best;
    },
    [draw],
  );

  const run = useCallback(async () => {
    cancelToken(tokenRef.current);
    const token = newToken();
    tokenRef.current = token;
    setClueless(null);
    setGames([]);
    setBest(null);
    setLearner(null);
    setBrain(null);
    setMet([]);
    setTrainingMs(null);
    setWaiting(false);

    try {
      // 1. A snake that knows nothing
      setStep(1);
      const game = firstGameRef.current ?? cluelessGame();
      firstGameRef.current = null;
      await playGame(game, CLUELESS_FPS, token);
      setClueless({ moves: game.inputs.length });
      setWaiting(true);
      await waitForNext(token);
      setWaiting(false);

      // 2. Training, fast-forwarded
      setStep(2);
      const bestGame = await train(token);
      setBest(bestGame);
      setWaiting(true);
      await waitForNext(token);
      setWaiting(false);

      // 3. Its best game, at a watchable speed
      setStep(3);
      if (bestGame) await playGame(bestGame, REPLAY_FPS, token);
      setStep(4);
    } catch (err) {
      if (!(err instanceof Cancelled)) throw err;
    }
  }, [playGame, train]);

  const watchAgain = async () => {
    if (!best) return;
    cancelToken(tokenRef.current);
    const token = newToken();
    tokenRef.current = token;
    setWaiting(false);
    try {
      setStep(3);
      await playGame(best, REPLAY_FPS, token);
      setStep(4);
    } catch (err) {
      if (!(err instanceof Cancelled)) throw err;
    }
  };

  // Show a starting board before the demo runs, and redraw on resize.
  useEffect(() => {
    if (!boardRef.current) {
      firstGameRef.current = cluelessGame();
      boardRef.current = Board.fromSnapshot(firstGameRef.current);
    }
    draw();
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
  }, [draw]);

  useEffect(() => () => cancelToken(tokenRef.current), []);

  const bestSize = games.length ? Math.max(...games) : 0;

  const d = t.demo;
  const caption =
    step === 0
      ? d.captionStart
      : step === 1
        ? clueless
          ? d.captionCrashed(clueless.moves)
          : d.captionUntrained
        : step === 2
          ? waiting
            ? d.captionTrainingDone
            : d.captionTraining(Math.min(games.length + 1, TRAINING_GAMES), TRAINING_GAMES)
          : step === 3
            ? d.captionBest(move.index, move.total)
            : d.captionFinished;
  const trainingTime = t.seconds(trainingMs ?? 0);

  const skip = () => {
    if (tokenRef.current) tokenRef.current.skip = true;
  };
  const restartButton = <Button onClick={run}>{d.restart}</Button>;

  /** Buttons of the step that is running: "Next" once it's done, "Skip" until then. */
  const stepActions = (nextLabel: string) =>
    waiting ? (
      <>
        <Button variant="primary" onClick={() => tokenRef.current?.next?.()}>
          {nextLabel}
        </Button>
        {restartButton}
      </>
    ) : (
      <>
        <Button onClick={skip}>{d.skip}</Button>
        {restartButton}
      </>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <DemoStep
          number={1}
          title={d.step1Title}
          current={step}
          summary={clueless && d.step1Summary(clueless.moves)}
          actions={
            step === 0 ? (
              <Button variant="primary" onClick={run}>
                {d.start}
              </Button>
            ) : step === 1 ? (
              stepActions(d.next1)
            ) : null
          }
        >
          <p>{d.step1Body(<Dot color={CSS_COLORS.green} />, <Dot color={CSS_COLORS.red} />)}</p>
        </DemoStep>

        <DemoStep
          number={2}
          title={d.step2Title}
          current={step}
          summary={step > 2 && d.step2Summary(games.length, trainingTime, bestSize)}
          actions={step === 2 ? stepActions(d.next2) : null}
        >
          <p>{d.step2Body(TRAINING_GAMES)}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label={d.gamesPlayed} value={`${games.length} / ${TRAINING_GAMES}`} />
            <Stat label={d.bestSize} value={bestSize || "-"} />
            <Stat
              label={d.situationsMet}
              value={brain ? met.length : "-"}
            />
          </div>
          {brain && <Brain qvalues={brain} order={met} />}
          {waiting && trainingMs !== null && (
            <Highlight>
              {d.step2Highlight(
                trainingTime,
                trainingMs < 1000 ? d.lessThanASecond : trainingTime,
                bestSize,
              )}
            </Highlight>
          )}
        </DemoStep>

        <DemoStep
          number={3}
          title={d.step3Title}
          current={step}
          summary={
            step === 4 &&
            best && (
              <Highlight>{d.step3Summary(trainingTime, best.score, best.inputs.length)}</Highlight>
            )
          }
          actions={
            step === 3 ? (
              <>
                <Button onClick={skip}>{d.skip}</Button>
                {restartButton}
              </>
            ) : step === 4 && best ? (
              <>
                <Button onClick={watchAgain}>{d.watchAgain}</Button>
                <Button
                  onClick={() =>
                    learner &&
                    onOpen({ source: d.sourceName, qvalues: learner.agent.states, replay: best })
                  }
                >
                  {d.openInVisualizer}
                </Button>
                {restartButton}
              </>
            ) : null
          }
        >
          <p>{d.step3Body(trainingTime)}</p>
        </DemoStep>
      </div>

      <figure className="w-full max-w-[560px]">
        <canvas
          ref={canvasRef}
          className="aspect-square w-full rounded-sm border border-muted bg-board-bg"
          aria-label={d.boardLabel}
        />
        <Caption label={d.figure} aside={(step === 1 || step === 3) && d.size(move.size)}>
          {caption}
        </Caption>
      </figure>
    </div>
  );
}

function DemoStep({
  number,
  title,
  current,
  summary,
  actions,
  children,
}: {
  number: number;
  title: string;
  current: Step;
  summary?: ReactNode;
  /** Buttons shown at the bottom of the step; a step with buttons is never dimmed. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const active = current === number || (current === 0 && number === 1);
  const done = current > number;
  return (
    <Panel
      className={active || actions ? "" : "opacity-60"}
      title={
        <span className="flex items-baseline gap-2 text-base [font-variant-caps:normal]">
          {/* Plain numerals; a finished step's number is muted */}
          <span className={`tabular-nums ${done ? "text-muted" : ""}`}>{number}.</span>
          <span className={done ? "text-muted" : ""}>{title}</span>
        </span>
      }
    >
      {active ? (
        <div className="text-[15px] leading-relaxed">{children}</div>
      ) : done && summary ? (
        <div className="text-[15px] leading-relaxed text-muted">{summary}</div>
      ) : null}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </Panel>
  );
}

/** A short, emphasized result. */
function Highlight({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-ink pl-3 text-base leading-relaxed text-ink">
      {children}
    </p>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2.5 rounded-full align-baseline"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

/** Situations per row in the Q-table picture. */
const BRAIN_COLUMNS = 14;
/** Rows kept free from the start, so the step doesn't jump as squares appear. */
const BRAIN_MIN_ROWS = 2;
/** |Q| at which a cell is fully coloured; smaller values fade on a log scale. */
const BRAIN_FULL_AT = 150;

/** States whose Q values are no longer all zero, i.e. situations it has met. */
function metStates(qvalues: QTable): number[] {
  return qvalues.flatMap((row, state) => (row.some((q) => q !== 0) ? [state] : []));
}

/**
 * The Q-table as the snake's "brain": one square per situation it has met, in
 * the order it met them, split into its 4 moves (up, down, left, right).
 * Green = worth doing, red = to avoid, blank = not tried yet there. Squares are
 * only ever added, and their colours deepen as the values grow.
 */
function Brain({ qvalues, order }: { qvalues: QTable; order: number[] }) {
  const t = useMessages();
  const rows = Math.max(BRAIN_MIN_ROWS, Math.ceil(order.length / BRAIN_COLUMNS));
  // Each situation is a 2x2 block of 1-unit cells, with a 0.5 gap between blocks.
  const block = 2.5;
  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${BRAIN_COLUMNS * block - 0.5} ${rows * block - 0.5}`}
        className="w-full"
        role="img"
        aria-label={t.demo.brainLabel(order.length)}
      >
        {order.map((state, slot) => {
          const bx = (slot % BRAIN_COLUMNS) * block;
          const by = Math.floor(slot / BRAIN_COLUMNS) * block;
          return qvalues[state].map((q, action) => {
            const x = bx + (action % 2) + 0.05;
            const y = by + Math.floor(action / 2) + 0.05;
            const strength = Math.min(1, Math.log1p(Math.abs(q)) / Math.log1p(BRAIN_FULL_AT));
            return (
              <rect
                key={`${state}-${action}`}
                x={x}
                y={y}
                width={0.9}
                height={0.9}
                fill={q === 0 ? "var(--paper)" : q > 0 ? "var(--board-green)" : "var(--board-red)"}
                fillOpacity={q === 0 ? 1 : 0.25 + 0.75 * strength}
              />
            );
          });
        })}
      </svg>
      <figcaption className="mt-1 text-xs italic text-muted">{t.demo.brainCaption}</figcaption>
    </figure>
  );
}
