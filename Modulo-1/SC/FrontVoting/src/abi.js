// ABI mínimo de TokenWeightedVoting.sol
export const VOTING_ABI = [
  {
    inputs: [{ internalType: "address", name: "_tokenAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "governanceToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentProposal",
    outputs: [
      { internalType: "string", name: "description", type: "string" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "yes", type: "uint256" },
      { internalType: "uint256", name: "no", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_description", type: "string" },
      { internalType: "uint256", name: "_durationMinutes", type: "uint256" },
    ],
    name: "createProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint8", name: "choice", type: "uint8" }],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "closeProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: "description", type: "string" },
      { indexed: false, name: "deadline", type: "uint256" },
    ],
    name: "ProposalCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "voter", type: "address" },
      { indexed: false, name: "weight", type: "uint256" },
      { indexed: false, name: "support", type: "bool" },
    ],
    name: "Voted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: "result", type: "string" },
      { indexed: false, name: "yesVotes", type: "uint256" },
      { indexed: false, name: "noVotes", type: "uint256" },
    ],
    name: "ProposalClosed",
    type: "event",
  },
];

// ABI mínimo de MyToken (ERC-20)
export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

// Dirección del contrato TokenWeightedVoting desplegado en Sepolia.
// El token de gobernanza se autodetecta llamando a governanceToken() en este contrato.
export const DEFAULT_VOTING_ADDRESS = "0x8cBb5F9413db45E2699606BBdB18F0FAfA5f79cc";
export const DEFAULT_TOKEN_ADDRESS = "";

// Sepolia chainId
export const SEPOLIA_CHAIN_ID = 11155111n;
