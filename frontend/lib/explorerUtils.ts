import { Chain } from "./types";

export function getExplorerUrl(
  chain: Chain | string | undefined | null,
  type: "address" | "tx",
  value?: string | null
): string | null {
  if (!value || !value.trim()) return null;
  const cleanVal = encodeURIComponent(value.trim());
  const normChain = chain?.toLowerCase();

  switch (normChain) {
    case "base":
      return type === "address"
        ? `https://basescan.org/address/${cleanVal}`
        : `https://basescan.org/tx/${cleanVal}`;
    case "ethereum":
      return type === "address"
        ? `https://etherscan.io/address/${cleanVal}`
        : `https://etherscan.io/tx/${cleanVal}`;
    case "tron":
      return type === "address"
        ? `https://tronscan.org/#/address/${cleanVal}`
        : `https://tronscan.org/#/transaction/${cleanVal}`;
    case "solana":
      return type === "address"
        ? `https://solscan.io/account/${cleanVal}`
        : `https://solscan.io/tx/${cleanVal}`;
    case "bitcoin":
      return type === "address"
        ? `https://mempool.space/address/${cleanVal}`
        : `https://mempool.space/tx/${cleanVal}`;
    default:
      return null;
  }
}

export function getExplorerName(chain: Chain | string | undefined | null): string {
  switch (chain?.toLowerCase()) {
    case "base":
      return "BaseScan";
    case "ethereum":
      return "Etherscan";
    case "tron":
      return "TRONSCAN";
    case "solana":
      return "Solscan";
    case "bitcoin":
      return "Mempool";
    default:
      return "Block Explorer";
  }
}

export function getExplorerButtonLabel(
  chain: Chain | string | undefined | null,
  type: "address" | "tx"
): string {
  const name = getExplorerName(chain);
  return type === "address" ? `Open in ${name} ↗` : `View on ${name} ↗`;
}

export function getExplorerTooltip(
  chain: Chain | string | undefined | null,
  type: "address" | "tx"
): string {
  const name = getExplorerName(chain);
  return type === "address"
    ? `Verify this address on ${name}`
    : `Verify this transaction on ${name}`;
}
