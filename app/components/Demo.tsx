"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Board } from "@/lib/l2s/board";
import { COLORS, drawBoard } from "@/lib/l2s/draw";
import { Qlearner, type Replay } from "@/lib/l2s/qlearner";
import { Button, Panel, Stat } from "./ui";
import type { LoadRequest } from "./Visualizer";

/** Games played during the training step. */
const TRAINING_GAMES = 100;
/** Moves simulated per animation frame while training (~3000 moves/s at 60 Hz). */
const TRAINING_STEPS_PER_FRAME = 50;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const tokenRef = useRef<Cancel | null>(null);

  const [step, setStep] = useState<Step>(0);
  /** Waiting for the user to press "Next" between steps. */
  const [waiting, setWaiting] = useState(false);
  const [clueless, setClueless] = useState<{ moves: number } | null>(null);
  const [games, setGames] = useState<number[]>([]);
  const [move, setMove] = useState({ index: 0, total: 0, size: 0 });
  const [learner, setLearner] = useState<Qlearner | null>(null);
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
    setTrainingMs(null);
    setWaiting(false);

    try {
      // 1. A snake that knows nothing
      setStep(1);
      const game = cluelessGame();
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
    if (!boardRef.current) boardRef.current = new Board();
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => () => cancelToken(tokenRef.current), []);

  const bestSize = games.length ? Math.max(...games) : 0;
  const recent = games.slice(-10);
  const recentAverage = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;

  const caption =
    step === 0
      ? "Press “Start the demo” on the left"
      : step === 1
        ? clueless
          ? `Crashed after ${clueless.moves} moves`
          : "Untrained snake — moving at random"
        : step === 2
          ? waiting
            ? "Training done"
            : `Training — game ${Math.min(games.length + 1, TRAINING_GAMES)} of ${TRAINING_GAMES} (fast-forward)`
          : step === 3
            ? `Best game — move ${move.index} of ${move.total}`
            : "Demo finished";

  const skip = () => {
    if (tokenRef.current) tokenRef.current.skip = true;
  };
  const restartButton = <Button onClick={run}>Restart the demo</Button>;

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
        <Button onClick={skip}>Skip this step</Button>
        {restartButton}
      </>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <DemoStep
          number={1}
          title="A snake that knows nothing"
          current={step}
          summary={clueless && `Moved at random and crashed after ${clueless.moves} moves.`}
          actions={
            step === 0 ? (
              <Button variant="primary" onClick={run}>
                Start the demo
              </Button>
            ) : step === 1 ? (
              stepActions("Next: let it learn →")
            ) : null
          }
        >
          <p>
            The snake can only see the cells in a straight line up, down, left and right of its
            head. It has never played before, so it doesn&apos;t know that walls and its own body
            kill it, or that <Dot color={COLORS.green} /> green apples make it grow and{" "}
            <Dot color={COLORS.red} /> red apples shrink it. Every move is a guess.
          </p>
        </DemoStep>

        <DemoStep
          number={2}
          title="Learning by trial and error"
          current={step}
          summary={
            step > 2 &&
            `Played ${games.length} games in ${formatSeconds(trainingMs ?? 0)} of computing time. Its longest snake reached size ${bestSize}.`
          }
          actions={step === 2 ? stepActions("Next: watch its best game →") : null}
        >
          <p>
            Now it plays {TRAINING_GAMES} games in a row, fast-forwarded. After every move it gets
            a reward: a big bonus for a green apple, a penalty for a red one, a big penalty for
            dying. It keeps a score for every move in every situation it can see (its{" "}
            <em>Q-values</em>) and nudges that score after each reward, so good moves become more
            likely.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Games played" value={`${games.length} / ${TRAINING_GAMES}`} />
            <Stat label="Best size" value={bestSize || "—"} />
            <Stat label="Last 10 avg." value={recent.length ? recentAverage.toFixed(1) : "—"} />
          </div>
          <GamesChart sizes={games} />
          {waiting && trainingMs !== null && (
            <Highlight>
              All of that took just <strong>{formatSeconds(trainingMs)}</strong> of actual
              computing. We slowed it down so you could watch. Nobody showed it how to play: after{" "}
              <strong>{trainingMs < 1000 ? "less than a second" : formatSeconds(trainingMs)}</strong>{" "}
              of learning on its own, it already reached <strong>size {bestSize}</strong>.
            </Highlight>
          )}
        </DemoStep>

        <DemoStep
          number={3}
          title="What it learned"
          current={step}
          summary={
            step === 4 &&
            best && (
              <Highlight>
                After <strong>{formatSeconds(trainingMs ?? 0)}</strong> of training and no human
                input, it went from moving at random to reaching <strong>size {best.score}</strong>{" "}
                (it started at size 3) in a {best.inputs.length}-move game.
              </Highlight>
            )
          }
          actions={
            step === 3 ? (
              <>
                <Button onClick={skip}>Skip this step</Button>
                {restartButton}
              </>
            ) : step === 4 && best ? (
              <>
                <Button onClick={watchAgain}>Watch the best game again</Button>
                <Button
                  onClick={() =>
                    learner && onOpen({ source: "demo snake", qvalues: learner.agent.states, replay: best })
                  }
                >
                  Open in Visualizer
                </Button>
                {restartButton}
              </>
            ) : null
          }
        >
          <p>
            This is the best game it played during those{" "}
            <strong>{formatSeconds(trainingMs ?? 0)}</strong> of training, replayed at normal speed.
            Compare it with step 1: it now heads for green apples and avoids walls and its own
            tail. Nobody taught it any of this.
          </p>
        </DemoStep>
      </div>

      <div className="relative w-full max-w-[560px]">
        <canvas
          ref={canvasRef}
          className="aspect-square w-full rounded-md"
          style={{ background: COLORS.background }}
          aria-label="Demo board"
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {caption}
        </div>
        {(step === 1 || step === 3) && (
          <div className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
            Size {move.size}
          </div>
        )}
      </div>
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
        <span className="flex items-center gap-2">
          <span
            className={`inline-flex size-5 items-center justify-center rounded-sm text-xs ${
              current >= number
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
            }`}
          >
            {done ? "✓" : number}
          </span>
          {title}
        </span>
      }
    >
      {active ? (
        <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
      ) : done && summary ? (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">{summary}</div>
      ) : null}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </Panel>
  );
}

/** "0.18 seconds", "1.4 seconds" */
function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds < 1 ? seconds.toFixed(2) : seconds.toFixed(1)} seconds`;
}

/** A short, emphasized result. */
function Highlight({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded bg-emerald-100 px-3 py-2 text-sm leading-relaxed text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-100">
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

/** One bar per training game: the snake's size when that game ended. */
function GamesChart({ sizes }: { sizes: number[] }) {
  const max = Math.max(10, ...sizes);
  const best = sizes.length ? Math.max(...sizes) : -1;
  const width = 100 / TRAINING_GAMES;
  return (
    <figure className="mt-3">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-14 w-full rounded-sm bg-white dark:bg-zinc-800"
        role="img"
        aria-label={`Snake size at the end of each of ${sizes.length} training games`}
      >
        {sizes.map((s, i) => {
          const h = (s / max) * 38;
          return (
            <rect
              key={i}
              x={i * width + width * 0.15}
              y={40 - h}
              width={width * 0.7}
              height={h}
              className={s === best ? "fill-emerald-500" : "fill-zinc-400 dark:fill-zinc-500"}
            />
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Size at the end of each game, from first to last.
      </figcaption>
    </figure>
  );
}
