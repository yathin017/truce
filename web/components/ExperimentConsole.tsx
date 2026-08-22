"use client";

import { useArena } from "@/lib/arena";
import { Nav } from "./Nav";
import { OfflineBanner } from "./OfflineBanner";
import { Experiment } from "./Experiment";
import { Footer } from "./Footer";

export function ExperimentConsole() {
  const arena = useArena();
  return (
    <>
      <Nav connected={arena.connected} state={arena.state} active="experiment" />
      {!arena.connected && <OfflineBanner />}
      <main>
        <Experiment arena={arena} />
        <Footer state={arena.state} />
      </main>
    </>
  );
}
