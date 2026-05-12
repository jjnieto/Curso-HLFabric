// ABI mínimo de MultiTimeLock (vault.sol).
// Solo las tres funciones que la DApp necesita:
//   - lock(seconds) payable
//   - withdraw()
//   - deposits(address) → { amount, unlockTime }
export const MULTI_TIMELOCK_ABI = [
    {
        inputs: [{ internalType: 'uint256', name: '_secondsToLock', type: 'uint256' }],
        name: 'lock',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'deposits',
        outputs: [
            { internalType: 'uint256', name: 'amount', type: 'uint256' },
            { internalType: 'uint256', name: 'unlockTime', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];

// Dirección ya desplegada del contrato (testnet). Se puede sobrescribir desde la UI.
export const DEFAULT_CONTRACT_ADDRESS = '0xFaEC1ce8470b640eebE8a1E73a887FD4534d1884';
