import {
  createPublicClient,
  createWalletClient,
  http,
  pad,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "@reservoir/shared";
import { loadArtifact } from "@reservoir/keeper/artifacts";

/** Anvil well-known keys: account 0 deploys/seeds, accounts 1-4 are the racing keepers. */
export const KEYS = {
  deployer: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  keepers: [
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  ],
} as const;

export const DEMO_USER: Address = "0x00000000000000000000000000000000000A11cE";
const WAD = 10n ** 18n;

const WINDOW = 3;
const BOND = 10_000_000_000_000_000n; // 0.01 MON

export interface Fixtures {
  chain: Chain;
  rpc: string;
  publicClient: ReturnType<typeof createPublicClient>;
  deployer: ReturnType<typeof createWalletClient>;
  coordinator: Address;
  naivePool: Address; // voluntary — direct liquidation allowed (the world today)
  coordPool: Address; // enforced — liquidation gated on holding the claim
  taskId: Hex;
  subject: Hex;
  bondWei: bigint;
}

async function deploy(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  name: string,
  args: readonly unknown[],
): Promise<Address> {
  const { abi, bytecode } = loadArtifact(name);
  const hash = await wallet.deployContract({ abi, bytecode, args, account: wallet.account!, chain: wallet.chain } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`deploy failed: ${name}`);
  return receipt.contractAddress;
}

/** Deploy a fresh, reproducible world: coordinator + two pools (voluntary + enforced). */
export async function deployFixtures(rpc: string): Promise<Fixtures> {
  const chain = anvil;
  const transport = http(rpc);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(KEYS.deployer);
  const deployer = createWalletClient({ account, chain, transport });

  const coordinator = await deploy(deployer, publicClient, "Coordinator", []);
  const oracle = await deploy(deployer, publicClient, "MockOracle", [1_000n * WAD]);
  const predicate = await deploy(deployer, publicClient, "AaveHealthPredicate", []);
  const naivePool = await deploy(deployer, publicClient, "EnforcedMockPool", [coordinator, oracle]);
  const coordPool = await deploy(deployer, publicClient, "EnforcedMockPool", [coordinator, oracle]);

  // Register the coordinated task against coordPool and opt coordPool into enforcement.
  const checkParam = pad(coordPool, { size: 32 });
  const taskId = (await simulateAndWrite(deployer, publicClient, coordinator, "Coordinator", "registerTask", [
    predicate,
    checkParam,
    WINDOW,
    BOND,
    0n,
  ])) as Hex;
  await write(deployer, publicClient, coordPool, "EnforcedMockPool", "setTaskId", [taskId]);
  // naivePool stays voluntary (no setTaskId) so naive keepers can liquidate directly.

  // Seed identical positions and drop the price on both so each is liquidatable.
  for (const pool of [naivePool, coordPool]) {
    await write(deployer, publicClient, pool, "EnforcedMockPool", "createPosition", [DEMO_USER, 10n * WAD, 7_500n * WAD]);
    await write(deployer, publicClient, pool, "EnforcedMockPool", "setCollateralPrice", [800n * WAD]);
  }

  return {
    chain,
    rpc,
    publicClient,
    deployer,
    coordinator,
    naivePool,
    coordPool,
    taskId,
    subject: pad(DEMO_USER, { size: 32 }),
    bondWei: BOND,
  };
}

async function write(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address,
  artifact: string,
  fn: string,
  args: readonly unknown[],
): Promise<void> {
  const { abi } = loadArtifact(artifact);
  const hash = await wallet.writeContract({ address, abi, functionName: fn, args, account: wallet.account!, chain: wallet.chain } as never);
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Write a state-changing call and return its simulated return value (e.g. new taskId). */
async function simulateAndWrite(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address,
  artifact: string,
  fn: string,
  args: readonly unknown[],
): Promise<unknown> {
  const { abi } = loadArtifact(artifact);
  const { result, request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: fn,
    args,
    account: wallet.account!,
  } as never);
  const hash = await wallet.writeContract(request as never);
  await publicClient.waitForTransactionReceipt({ hash });
  return result;
}
