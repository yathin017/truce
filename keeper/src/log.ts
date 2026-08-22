/* Minimal structured logger — keeps keeper output legible when 4 bots race. */

const COLORS: Record<string, string> = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const LABEL_COLORS = ["cyan", "magenta", "blue", "yellow"] as const;

export class Logger {
  private readonly color: string;

  constructor(private readonly label: string, colorIndex = 0) {
    const key = LABEL_COLORS[colorIndex % LABEL_COLORS.length] ?? "reset";
    this.color = COLORS[key] ?? COLORS.reset!;
  }

  private line(icon: string, msg: string): void {
    const tag = `${this.color}[${this.label}]${COLORS.reset}`;
    console.log(`${tag} ${icon} ${msg}`);
  }

  info(msg: string): void {
    this.line("·", msg);
  }
  win(msg: string): void {
    this.line(`${COLORS.green}✓${COLORS.reset}`, msg);
  }
  standDown(msg: string): void {
    this.line(`${COLORS.dim}⏹${COLORS.reset}`, `${COLORS.dim}${msg}${COLORS.reset}`);
  }
  warn(msg: string): void {
    this.line(`${COLORS.yellow}!${COLORS.reset}`, msg);
  }
  fail(msg: string): void {
    this.line(`${COLORS.red}✗${COLORS.reset}`, msg);
  }
}
