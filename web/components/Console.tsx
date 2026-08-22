"use client";

import { useArena } from "@/lib/arena";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Arena } from "./Arena";
import { BurnMeter } from "./BurnMeter";
import { Footer } from "./Footer";
import { OfflineBanner } from "./OfflineBanner";

export function Console() {
  const arena = useArena();
  return (
    <>
      <Nav connected={arena.connected} state={arena.state} />
      {!arena.connected && <OfflineBanner />}
      <main>
        <Hero state={arena.state} />
        <HowItWorks />
        <Arena arena={arena} />
        <BurnMeter state={arena.state} />
        <Footer state={arena.state} />
      </main>
    </>
  );
}
