import type { ReactNode } from "react";
import type { Action } from "@/lib/l2s/constants";
import type { Locale } from "@/lib/i18n/core";

/** Format a number with a fixed number of decimals ("0.18" / "0,18"). */
function decimals(locale: Locale, value: number, digits: number): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** "0.18 seconds", "1.4 seconds" */
function seconds(locale: Locale, ms: number): string {
  const s = ms / 1000;
  const text = decimals(locale, s, s < 1 ? 2 : 1);
  if (locale === "fr") return `${text} ${s < 2 ? "seconde" : "secondes"}`;
  return `${text} seconds`;
}

type Status = "idle" | "running" | "done" | "cancelled" | "error";

const en = {
  locale: "en" as Locale,
  number: (value: number, digits: number) => decimals("en", value, digits),
  seconds: (ms: number) => seconds("en", ms),

  meta: {
    description: "A snake that learns to play by itself with Q-learning, in the browser.",
  },
  page: {
    intro:
      "A snake that learns to play by itself, using Q-learning. It only sees what is in line with its head. Below you can watch it learn, play with it, or train a lot of them at once.",
    otherLanguage: { title: "Lire cette page en français", href: "/fr" },
  },
  tabs: {
    label: "Mode",
    demo: "Demo",
    play: "Visualizer",
    train: "Batch training",
  },
  moves: { U: "Up", D: "Down", L: "Left", R: "Right" } as Record<Action, string>,

  demo: {
    figure: "fig. 1",
    captionStart: "waiting. Press Start on the left.",
    captionCrashed: (moves: number) => `crashed after ${moves} moves`,
    captionUntrained: "untrained snake, moving at random",
    captionTrainingDone: "training done",
    captionTraining: (game: number, total: number) =>
      `training, game ${game} of ${total} (sped up)`,
    captionBest: (move: number, total: number) => `best game, move ${move} of ${total}`,
    captionFinished: "end of the demo",
    size: (size: number) => `size ${size}`,
    boardLabel: "Demo board",

    start: "Start",
    restart: "Start over",
    skip: "Skip",
    next1: "Next: let it learn",
    next2: "Next: its best game",
    watchAgain: "Watch it again",
    openInVisualizer: "Open in the visualizer",
    sourceName: "demo snake",

    step1Title: "It knows nothing",
    step1Summary: (moves: number) => `It moved at random and crashed after ${moves} moves.`,
    step1Body: (green: ReactNode, red: ReactNode) => (
      <>
        The snake only sees the cells in a straight line from its head: up, down, left and right.
        It has never played, so it doesn&apos;t know that walls and its own body kill it, or that{" "}
        {green} green apples make it longer and {red} red ones shorter. Every move is a guess.
      </>
    ),

    step2Title: "Trial and error",
    step2Summary: (games: number, time: string, size: number) =>
      `${games} games in ${time} of computing. Its best snake reached size ${size}.`,
    step2Body: (games: number) => (
      <>
        Now it plays {games} games in a row, sped up. After each move it gets a reward: a lot for a
        green apple, a penalty for a red one, a big penalty for dying. It keeps a score for each
        move in each situation it can see (its <em>Q-values</em>) and adjusts it after every
        reward, so moves that paid off get picked more often.
      </>
    ),
    gamesPlayed: "Games",
    bestSize: "Best size",
    situationsMet: "Situations met",
    step2Highlight: (time: string, learningTime: string, size: number) => (
      <>
        That took <strong>{time}</strong> of computing; it was slowed down here so you can follow. Nobody
        told it how to play, yet after <strong>{learningTime}</strong> it already reaches{" "}
        <strong>size {size}</strong>.
      </>
    ),
    lessThanASecond: "less than a second",
    brainLabel: (met: number) => `The snake's Q-values for the ${met} situations it has met so far`,
    brainCaption:
      "One square per situation it has met, one cell per move. Green: good, red: bad, blank: not tried. Darker means more sure.",

    step3Title: "What it learned",
    step3Body: (time: string) => (
      <>
        Here is its best game from those <strong>{time}</strong>, at normal speed. Compare with
        step 1: it goes for green apples and stays away from walls and its own tail. Nobody taught
        it that.
      </>
    ),
    step3Summary: (time: string, size: number, moves: number) => (
      <>
        From random moves to <strong>size {size}</strong> (it starts at 3) in a {moves}-move game,
        after <strong>{time}</strong> of training and no human input.
      </>
    ),
  },

  visualizer: {
    figure: "fig. 2",
    unlimited: "Unlimited",
    untrained: "untrained (all zeros)",
    loadedQValues: (name: string) => `Loaded Q values from ${name}.`,
    resetNotice: "Reset Q values to 0 and started a new board.",
    replayNotice: (name: string, score: number, moves: number) =>
      `Replay ${name}: score ${score}, ${moves} moves. Press Resume or Step.`,
    moveLabel: (direction: string, q: string) => `Move ${direction} (Q value ${q})`,
    moveTitle: (direction: string) => `Move ${direction}`,
    qTitle: (direction: string) => `Q value for ${direction}`,
    none: "none",
    captionLost: "game over. Step or Resume for a new board",
    captionReplay: "replay loaded",
    captionPaused: "paused",
    captionRunning: "running",
    replayLeft: (moves: number) => `replay, ${moves} moves left`,
    boardLabel: "Snake board",

    pause: "Pause",
    resume: "Resume",
    step: "Step",
    enterKey: "Enter",
    resetBoard: "Reset board",
    resetAll: "Reset all",
    resetAllTitle: "Reset Q values to 0 and start a new board",
    stopLearning: "Stop learning",
    resumeLearning: "Resume learning",
    exitReplay: "Exit replay mode",

    snakePanel: "Snake",
    snakeSize: "Size",
    bestSize: "Best size",
    episodes: "Episodes",
    agentSteps: "Agent steps",
    model: "Model:",
    learning: "learning",
    notLearning: "not learning",

    qPanel: "Q values and controls",
    stepTitle: "Let the agent take one step (Enter)",
    help: "While paused, click a direction or use the arrow keys to move, and click the head or press Enter to let the agent move.",

    options: "Options",
    maxFps: "Maximum FPS",
    files: "Files",
    loadQValues: "Load Q values",
    saveQValues: "Save Q values",
    loadReplay: "Load replay",
    bundledModel: "Bundled model…",
    bundledModelLabel: "Load a bundled model",
    bundledReplay: "Bundled replay…",
    bundledReplayLabel: "Load a bundled replay",
  },

  params: {
    learningRate: "Learning rate",
    explorationRate: "Exploration rate",
    decay: "Reward decay rate",
  },

  trainer: {
    sessionsError: "Sessions must be a positive whole number.",
    snakesError: "Snakes must be a positive whole number.",
    tooManySnakes: (count: number, max: number) =>
      `Too many snakes (${count}). The maximum is ${max}.`,
    loadedModel: (name: string) => `Loaded model from ${name}.`,
    snakePrefix: (snake: number) => `[snake ${snake}] `,
    linesOmitted: (lines: number) => `… ${lines} lines omitted …`,
    bestSnake: (snake: number, size: number) => `Best snake: #${snake} (size ${size}).`,
    cancelled: "Training cancelled.",
    snakeName: (snake: number) => `snake #${snake}`,
    trainedModel: "trained model",

    runPanel: "Training run",
    sessionsPerSnake: "Sessions per snake",
    snakesInParallel: "Snakes trained in parallel",
    snakesHelp: "Each snake learns on its own in a Web Worker. Only the best one is kept.",
    startingQValues: "Starting Q values",
    bundled: "Bundled…",
    bundledLabel: "Start from a bundled model",
    file: "File…",
    clear: "Clear",
    freshModel: "all zeros (fresh model)",
    noLearning: "No learning (don't update Q values)",
    verbose: "Verbose output",
    agentPanel: "Agent parameters",
    cancel: "Cancel",
    start: "Start training",

    progressPanel: "Progress",
    status: "Status",
    statuses: {
      idle: "idle",
      running: "running",
      done: "done",
      cancelled: "cancelled",
      error: "error",
    } as Record<Status, string>,
    episodes: "Episodes",
    snakesDone: "Snakes done",
    time: "Time",
    shortSeconds: (ms: number) => `${decimals("en", ms / 1000, 1)}s`,

    resultPanel: "Result",
    snake: "Snake",
    longestSize: "Longest size",
    longestSession: "Longest session",
    bestReplayMoves: "Best replay moves",
    watchBest: "Watch best replay",
    useQValues: "Use Q values in the visualizer",
    downloadQval: "Download .qval",
    downloadRpl: "Download .rpl",

    outputPanel: "Output",
    outputEmpty: "Nothing yet.",
  },
};

export type Messages = typeof en;

/** Non-breaking space, used before French ":" and ";". */
const NB = " ";

const fr: Messages = {
  locale: "fr",
  number: (value, digits) => decimals("fr", value, digits),
  seconds: (ms) => seconds("fr", ms),

  meta: {
    description: "Un serpent qui apprend à jouer tout seul par Q-learning, dans le navigateur.",
  },
  page: {
    intro:
      "Un serpent qui apprend à jouer tout seul, par Q-learning. Il ne voit que ce qui est dans l’axe de sa tête. Ci-dessous, vous pouvez le regarder apprendre, jouer avec, ou en entraîner plusieurs à la fois.",
    otherLanguage: { title: "Read this page in English", href: "/" },
  },
  tabs: {
    label: "Mode",
    demo: "Démo",
    play: "Visualiseur",
    train: "Entraînement en lot",
  },
  moves: { U: "Haut", D: "Bas", L: "Gauche", R: "Droite" },

  demo: {
    figure: "fig. 1",
    captionStart: "en attente. Appuyez sur Lancer à gauche.",
    captionCrashed: (moves) => `mort après ${moves} déplacements`,
    captionUntrained: "serpent non entraîné, déplacements au hasard",
    captionTrainingDone: "entraînement terminé",
    captionTraining: (game, total) => `entraînement, partie ${game} sur ${total} (accéléré)`,
    captionBest: (move, total) => `meilleure partie, déplacement ${move} sur ${total}`,
    captionFinished: "fin de la démo",
    size: (size) => `taille ${size}`,
    boardLabel: "Plateau de la démo",

    start: "Lancer",
    restart: "Recommencer",
    skip: "Passer",
    next1: `Suivant${NB}: le laisser apprendre`,
    next2: `Suivant${NB}: sa meilleure partie`,
    watchAgain: "La revoir",
    openInVisualizer: "Ouvrir dans le visualiseur",
    sourceName: "serpent de la démo",

    step1Title: "Il ne sait rien",
    step1Summary: (moves) =>
      `Il s’est déplacé au hasard et il est mort après ${moves} déplacements.`,
    step1Body: (green, red) => (
      <>
        Le serpent ne voit que les cases en ligne droite depuis sa tête&nbsp;: en haut, en bas, à
        gauche et à droite. Il n’a jamais joué, donc il ne sait pas que les murs et son propre corps
        le tuent, ni que les {green} pommes vertes l’allongent et les {red} rouges le raccourcissent.
        Chaque déplacement est un pari.
      </>
    ),

    step2Title: "Essais et erreurs",
    step2Summary: (games, time, size) =>
      `${games} parties en ${time} de calcul. Son meilleur serpent a atteint la taille ${size}.`,
    step2Body: (games) => (
      <>
        Il joue maintenant {games} parties d’affilée, en accéléré. Après chaque déplacement, il
        reçoit une récompense&nbsp;: beaucoup pour une pomme verte, une pénalité pour une rouge, une
        grosse pénalité s’il meurt. Il garde un score pour chaque déplacement dans chaque situation
        qu’il peut voir (ses <em>valeurs Q</em>) et l’ajuste après chaque récompense, si bien que
        les déplacements qui ont payé sont choisis plus souvent.
      </>
    ),
    gamesPlayed: "Parties",
    bestSize: "Meilleure taille",
    situationsMet: "Situations connues",
    step2Highlight: (time, learningTime, size) => (
      <>
        Cela a pris <strong>{time}</strong> de calcul&nbsp;; c’est ralenti ici pour que vous puissiez
        suivre. Personne ne lui a montré comment jouer, et après <strong>{learningTime}</strong> il
        atteint déjà <strong>la taille {size}</strong>.
      </>
    ),
    lessThanASecond: "moins d’une seconde",
    brainLabel: (met) => `Les valeurs Q du serpent pour les ${met} situations rencontrées jusqu’ici`,
    brainCaption:
      `Un carré par situation rencontrée, une case par déplacement. Vert${NB}: bon, rouge${NB}: mauvais, vide${NB}: pas essayé. Plus c’est foncé, plus il est sûr.`,

    step3Title: "Ce qu’il a appris",
    step3Body: (time) => (
      <>
        Voici sa meilleure partie pendant ces <strong>{time}</strong>, à vitesse normale. Comparez
        avec l’étape 1&nbsp;: il va vers les pommes vertes et évite les murs et sa propre queue.
        Personne ne le lui a appris.
      </>
    ),
    step3Summary: (time, size, moves) => (
      <>
        Des déplacements au hasard à <strong>la taille {size}</strong> (il commence à 3) en une
        partie de {moves} déplacements, après <strong>{time}</strong> d’entraînement et sans
        intervention humaine.
      </>
    ),
  },

  visualizer: {
    figure: "fig. 2",
    unlimited: "Illimité",
    untrained: "non entraîné (que des zéros)",
    loadedQValues: (name) => `Valeurs Q chargées depuis ${name}.`,
    resetNotice: "Valeurs Q remises à 0, nouveau plateau.",
    replayNotice: (name, score, moves) =>
      `Replay ${name}${NB}: score ${score}, ${moves} déplacements. Appuyez sur Reprendre ou Avancer.`,
    moveLabel: (direction, q) => `Aller vers ${direction.toLowerCase()} (valeur Q ${q})`,
    moveTitle: (direction) => `Aller vers ${direction.toLowerCase()}`,
    qTitle: (direction) => `Valeur Q pour ${direction.toLowerCase()}`,
    none: "aucune",
    captionLost: "partie terminée. Avancer ou Reprendre pour un nouveau plateau",
    captionReplay: "replay chargé",
    captionPaused: "en pause",
    captionRunning: "en cours",
    replayLeft: (moves) => `replay, ${moves} déplacements restants`,
    boardLabel: "Plateau du serpent",

    pause: "Pause",
    resume: "Reprendre",
    step: "Avancer",
    enterKey: "Entrée",
    resetBoard: "Nouveau plateau",
    resetAll: "Tout réinitialiser",
    resetAllTitle: "Remettre les valeurs Q à 0 et commencer un nouveau plateau",
    stopLearning: "Arrêter l’apprentissage",
    resumeLearning: "Reprendre l’apprentissage",
    exitReplay: "Quitter le mode replay",

    snakePanel: "Serpent",
    snakeSize: "Taille",
    bestSize: "Meilleure taille",
    episodes: "Épisodes",
    agentSteps: "Pas de l’agent",
    model: `Modèle${NB}:`,
    learning: "apprentissage actif",
    notLearning: "apprentissage arrêté",

    qPanel: "Valeurs Q et commandes",
    stepTitle: "Laisser l’agent faire un déplacement (Entrée)",
    help: "En pause, cliquez sur une direction ou utilisez les flèches pour déplacer le serpent, et cliquez sur la tête ou appuyez sur Entrée pour laisser l’agent jouer.",

    options: "Options",
    maxFps: "FPS maximum",
    files: "Fichiers",
    loadQValues: "Charger des valeurs Q",
    saveQValues: "Enregistrer les valeurs Q",
    loadReplay: "Charger un replay",
    bundledModel: "Modèle fourni…",
    bundledModelLabel: "Charger un modèle fourni",
    bundledReplay: "Replay fourni…",
    bundledReplayLabel: "Charger un replay fourni",
  },

  params: {
    learningRate: "Taux d’apprentissage",
    explorationRate: "Taux d’exploration",
    decay: "Facteur d’actualisation",
  },

  trainer: {
    sessionsError: "Le nombre de sessions doit être un entier positif.",
    snakesError: "Le nombre de serpents doit être un entier positif.",
    tooManySnakes: (count, max) => `Trop de serpents (${count}). Le maximum est ${max}.`,
    loadedModel: (name) => `Modèle chargé depuis ${name}.`,
    snakePrefix: (snake) => `[serpent ${snake}] `,
    linesOmitted: (lines) => `… ${lines} lignes omises …`,
    bestSnake: (snake, size) => `Meilleur serpent${NB}: #${snake} (taille ${size}).`,
    cancelled: "Entraînement annulé.",
    snakeName: (snake) => `serpent #${snake}`,
    trainedModel: "modèle entraîné",

    runPanel: "Entraînement",
    sessionsPerSnake: "Sessions par serpent",
    snakesInParallel: "Serpents entraînés en parallèle",
    snakesHelp: "Chaque serpent apprend de son côté dans un Web Worker. Seul le meilleur est gardé.",
    startingQValues: "Valeurs Q de départ",
    bundled: "Fourni…",
    bundledLabel: "Partir d’un modèle fourni",
    file: "Fichier…",
    clear: "Effacer",
    freshModel: "que des zéros (nouveau modèle)",
    noLearning: "Sans apprentissage (ne pas modifier les valeurs Q)",
    verbose: "Sortie détaillée",
    agentPanel: "Paramètres de l’agent",
    cancel: "Annuler",
    start: "Lancer l’entraînement",

    progressPanel: "Progression",
    status: "Statut",
    statuses: {
      idle: "en attente",
      running: "en cours",
      done: "terminé",
      cancelled: "annulé",
      error: "erreur",
    },
    episodes: "Épisodes",
    snakesDone: "Serpents terminés",
    time: "Durée",
    shortSeconds: (ms) => `${decimals("fr", ms / 1000, 1)}${NB}s`,

    resultPanel: "Résultat",
    snake: "Serpent",
    longestSize: "Taille maximale",
    longestSession: "Session la plus longue",
    bestReplayMoves: "Déplacements du meilleur replay",
    watchBest: "Voir le meilleur replay",
    useQValues: "Utiliser les valeurs Q dans le visualiseur",
    downloadQval: "Télécharger le .qval",
    downloadRpl: "Télécharger le .rpl",

    outputPanel: "Sortie",
    outputEmpty: "Rien pour l’instant.",
  },
};

export const MESSAGES: Record<Locale, Messages> = { en, fr };
