"use client";

import { useRef, useState } from "react";
import { useMessages } from "../i18n/context";
import Demo from "./Demo";
import Trainer from "./Trainer";
import Visualizer, { type LoadRequest, type VisualizerHandle } from "./Visualizer";

const TABS = ["demo", "play", "train"] as const;

type Tab = (typeof TABS)[number];

export default function Lab() {
  const t = useMessages();
  const [tab, setTab] = useState<Tab>("demo");
  const visualizer = useRef<VisualizerHandle>(null);
  const openInVisualizer = (request: LoadRequest) => {
    visualizer.current?.load(request);
    setTab("play");
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t.tabs.label} className="flex w-fit gap-5">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`border-b-2 pb-0.5 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              tab === id ? "border-ink font-semibold" : "border-transparent text-muted active:text-ink"
            }`}
          >
            {t.tabs[id]}
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
