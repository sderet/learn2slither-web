import { L2sError } from "../i18n/core";

/** Prefix for files in /public, so presets still load when the site lives under a sub-path. */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Q-value models and replays bundled from the Python project (served from /public). */
export const PRESET_MODELS = [
  { name: "val1.qval", url: `${BASE}/models/val1.qval` },
  { name: "val10.qval", url: `${BASE}/models/val10.qval` },
  { name: "val100.qval", url: `${BASE}/models/val100.qval` },
] as const;

export const PRESET_REPLAYS = [
  { name: "rp1.rpl", url: `${BASE}/replays/rp1.rpl` },
  { name: "rp10.rpl", url: `${BASE}/replays/rp10.rpl` },
  { name: "rp100.rpl", url: `${BASE}/replays/rp100.rpl` },
] as const;

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new L2sError("fetchFailed", { url, status: res.status });
  return res.text();
}
