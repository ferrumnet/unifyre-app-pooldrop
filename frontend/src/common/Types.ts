import { Network } from "ferrum-plumbing";

export interface PoolDropClaim {
    address: string;
    userId: string;
}

export interface PoolDrop {
    version: number;
    id: string;
    network: Network;
    creatorId: string;
    displayName: string;
    createdAt: number;
    currency: string;
    symbol: string;
    totalAmount: string;
    numberOfParticipants: number;
    participationAmount: string;
    participationAmountFormatted: string;
    claims: PoolDropClaim[];
    cancelled: boolean;
    executed: boolean;
    transactionIds: string[];
    completedMessage?: string;
    completedLink?: string;
}
