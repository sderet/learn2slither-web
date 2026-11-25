"use client";

import { useRef, useState } from "react";
import Demo from "./Demo";
import Trainer from "./Trainer";
import Visualizer, { type LoadRequest, type VisualizerHandle } from "./Visualizer";

const TABS = [
  { id: "demo", label: "Demo" },
  { id: "play", label: "Visualizer" },
  { id: "train", label: "Batch training" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function Lab() {
  const [tab, setTab] = useState<Tab>("demo");
  const visualizer = useRef<VisualizerHandle>(null);
  const openInVisualizer = (request: LoadRequest) => {
    visualizer.current?.load(request);
    setTab("play");
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Mode"
        className="flex w-fit gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded border px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 active:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* All panels stay mounted so switching tabs never loses state. */}
      <div role="tabpanel" hidden={tab !== "demo"}>
        <Demo onOpen={openInVisualizer} />
      </div>
      <div role="tabpanel" hidden={tab !== "play"}>
        <Visualizer ref={visualizer} active={tab === "play"} />
      </div>
      <div role="tabpanel" hidden={tab !== "train"}>
        <Trainer onOpen={openInVisualizer} />
      </div>
    </div>
  );
}
