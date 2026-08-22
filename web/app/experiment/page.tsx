import type { Metadata } from "next";
import { ExperimentConsole } from "@/components/ExperimentConsole";

export const metadata: Metadata = {
  title: "Experiment — Truce",
  description: "The same keeper job run naively and coordinated, measured on-chain. See the gas Monad bills either way.",
};

export default function ExperimentPage() {
  return <ExperimentConsole />;
}
