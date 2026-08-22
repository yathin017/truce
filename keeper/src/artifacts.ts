import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Abi, Hex } from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "contracts", "out");

export interface Artifact {
  abi: Abi;
  bytecode: Hex;
}

/**
 * Load a compiled contract artifact (abi + deploy bytecode) from Foundry's output.
 * Requires `forge build` to have run. Used by the `race` demo to deploy executors.
 */
export function loadArtifact(name: string): Artifact {
  const path = join(OUT_DIR, `${name}.sol`, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`Artifact ${name} not found at ${path}. Run \`forge build --root contracts\`.`);
  }
  const json = JSON.parse(readFileSync(path, "utf8")) as {
    abi: Abi;
    bytecode: { object: Hex };
  };
  return { abi: json.abi, bytecode: json.bytecode.object };
}
