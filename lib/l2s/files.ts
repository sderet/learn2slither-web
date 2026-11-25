import type { QTable } from "./agent";
import type { Vec } from "./constants";
import type { Replay } from "./qlearner";

/** Format a number like numpy's default savetxt format, `%.18e`. */
function formatScientific(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
  const [mantissa, exponent] = value.toExponential(18).split("e");
  const sign = exponent.startsWith("-") ? "-" : "+";
  const digits = exponent.replace(/^[+-]/, "").padStart(2, "0");
  return `${mantissa}e${sign}${digits}`;
}

/** Serialize a Q table in the same text format as `numpy.savetxt`. */
export function formatQValues(states: QTable): string {
  return states.map((row) => row.map(formatScientific).join(" ")).join("\n") + "\n";
}

function parseNumber(token: string): number {
  const lower = token.toLowerCase();
  if (lower === "nan" || lower === "-nan") return NaN;
  if (lower === "inf" || lower === "+inf" || lower === "infinity") return Infinity;
  if (lower === "-inf" || lower === "-infinity") return -Infinity;
  const value = Number(token);
  if (Number.isNaN(value)) throw new Error(`Invalid number in Q values file: "${token}"`);
  return value;
}

/** Parse a .qval file (as written by `numpy.savetxt`). */
export function parseQValues(text: string, expectedRows: number, expectedColumns = 4): QTable {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/).map(parseNumber));

  if (rows.length !== expectedRows) {
    throw new Error(`Expected ${expectedRows} rows of Q values, found ${rows.length}.`);
  }
  rows.forEach((row, i) => {
    if (row.length !== expectedColumns) {
      throw new Error(
        `Row ${i + 1} has ${row.length} values, expected ${expectedColumns}.`,
      );
    }
  });
  return rows;
}

/** Parse and validate a .rpl replay file. */
export function parseReplay(text: string): Replay {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Replay file is not valid JSON.");
  }
  const r = data as Partial<Replay>;
  if (
    !r ||
    !Array.isArray(r.starting_state) ||
    !r.starting_state.every((col) => Array.isArray(col)) ||
    !Array.isArray(r.inputs) ||
    typeof r.seed !== "number"
  ) {
    throw new Error("Replay file is missing starting_state, inputs or seed.");
  }
  const inputs = r.inputs.map((input) => {
    if (!Array.isArray(input) || input.length !== 2) {
      throw new Error("Replay inputs must be [dx, dy] pairs.");
    }
    return [Number(input[0]), Number(input[1])] as Vec;
  });
  return {
    score: Number(r.score ?? 0),
    lifetime: Number(r.lifetime ?? inputs.length),
    starting_state: r.starting_state,
    inputs,
    seed: r.seed,
  };
}

/** Serialize a replay with the same spacing as Python's `json.dump`. */
export function formatReplay(replay: Replay): string {
  return JSON.stringify(replay)
    .replace(/,(?=\S)/g, ", ")
    .replace(/":(?=\S)/g, '": ');
}

/** Trigger a browser download of a text file. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
