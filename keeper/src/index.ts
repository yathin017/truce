import { formatMon } from "@reservoir/shared";

// Placeholder entrypoint — the config-driven daemon lands in PR A4.
// Kept minimal so the workspace typechecks and wiring to @reservoir/shared is proven.
function main() {
  console.log("reservoir-keeper: scaffold. Daemon implemented in A4.");
  console.log(`shared wiring ok: ${formatMon(10n ** 18n)}`);
}

main();
