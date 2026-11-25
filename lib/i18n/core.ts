/**
 * Locales and the plain-text messages used outside React (training logs, which
 * are written inside Web Workers, and file/loading errors).
 * The UI texts live in app/i18n/messages.tsx.
 */

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

/** Non-breaking space, used before French ":" and inside « ». */
const NB = " ";

/** Lines written to the training output. */
export interface LearnerMessages {
  /** Names of the actions, index-aligned with ACTIONS (U, D, L, R). */
  actions: readonly [string, string, string, string];
  newBestLifetime: (lifetime: number) => string;
  length: (size: number) => string;
  newLongestSize: (size: number) => string;
  episode: (episode: number) => string;
  trainingFinished: (sessions: number, longestSize: number, longestLife: number) => string;
}

export const LEARNER_MESSAGES: Record<Locale, LearnerMessages> = {
  en: {
    actions: ["UP", "DOWN", "LEFT", "RIGHT"],
    newBestLifetime: (n) => `Newest best lifetime: ${n}`,
    length: (n) => `Length: ${n}`,
    newLongestSize: (n) => `Newest longest size: ${n}`,
    episode: (n) => `Episode ${n}`,
    trainingFinished: (sessions, size, life) =>
      `Training finished for ${sessions} sessions. Longest size: ${size} Longest session: ${life}`,
  },
  fr: {
    actions: ["HAUT", "BAS", "GAUCHE", "DROITE"],
    newBestLifetime: (n) => `Nouvelle meilleure durée de vie${NB}: ${n}`,
    length: (n) => `Longueur${NB}: ${n}`,
    newLongestSize: (n) => `Nouvelle taille maximale${NB}: ${n}`,
    episode: (n) => `Épisode ${n}`,
    trainingFinished: (sessions, size, life) =>
      `Entraînement terminé pour ${sessions} sessions. Taille maximale${NB}: ${size} ` +
      `Session la plus longue${NB}: ${life}`,
  },
};

/** Parameters of each error that can be shown to the user. */
export interface ErrorParams {
  invalidNumber: { token: string };
  rowCount: { expected: number; found: number };
  columnCount: { row: number; found: number; expected: number };
  replayJson: Record<string, never>;
  replayFields: Record<string, never>;
  replayInputs: Record<string, never>;
  noHead: Record<string, never>;
  fetchFailed: { url: string; status: number };
}

export type ErrorKey = keyof ErrorParams;

export type ErrorMessages = { [K in ErrorKey]: (params: ErrorParams[K]) => string };

export const ERROR_MESSAGES: Record<Locale, ErrorMessages> = {
  en: {
    invalidNumber: ({ token }) => `Invalid number in Q values file: "${token}"`,
    rowCount: ({ expected, found }) => `Expected ${expected} rows of Q values, found ${found}.`,
    columnCount: ({ row, found, expected }) =>
      `Row ${row} has ${found} values, expected ${expected}.`,
    replayJson: () => "Replay file is not valid JSON.",
    replayFields: () => "Replay file is missing starting_state, inputs or seed.",
    replayInputs: () => "Replay inputs must be [dx, dy] pairs.",
    noHead: () => "Replay starting state has no snake head (H).",
    fetchFailed: ({ url, status }) => `Could not load ${url} (${status})`,
  },
  fr: {
    invalidNumber: ({ token }) =>
      `Nombre invalide dans le fichier de valeurs Q${NB}: «${NB}${token}${NB}»`,
    rowCount: ({ expected, found }) =>
      `${expected} lignes de valeurs Q attendues, ${found} trouvées.`,
    columnCount: ({ row, found, expected }) =>
      `La ligne ${row} contient ${found} valeurs, ${expected} attendues.`,
    replayJson: () => "Le fichier de replay n’est pas un JSON valide.",
    replayFields: () => "Il manque starting_state, inputs ou seed dans le fichier de replay.",
    replayInputs: () => "Les entrées du replay doivent être des paires [dx, dy].",
    noHead: () => "L’état de départ du replay n’a pas de tête de serpent (H).",
    fetchFailed: ({ url, status }) => `Impossible de charger ${url} (${status})`,
  },
};

/**
 * An error the UI can show in the reader's language. `message` is the English
 * text, so it still reads well in the console or anywhere untranslated.
 */
export class L2sError<K extends ErrorKey = ErrorKey> extends Error {
  constructor(
    readonly key: K,
    readonly params: ErrorParams[K],
  ) {
    super((ERROR_MESSAGES.en[key] as (p: ErrorParams[K]) => string)(params));
  }
}

/** The message of any thrown value, translated when it is an L2sError. */
export function errorText(err: unknown, locale: Locale): string {
  if (err instanceof L2sError) {
    return (ERROR_MESSAGES[locale][err.key as ErrorKey] as (p: unknown) => string)(err.params);
  }
  return err instanceof Error ? err.message : String(err);
}
