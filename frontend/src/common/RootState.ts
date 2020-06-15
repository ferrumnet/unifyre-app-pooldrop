import { AppUserProfile } from "unifyre-extension-sdk/dist/client/model/AppUserProfile";
import { PoolDrop } from "./Types";

export interface UserPreference {
    lastRedirectLink?: string;
    lastSuccessMessage?: string;
}

export const defaultUserPreference = {
} as UserPreference;

export interface DashboardProps {
    initialized: boolean;
    fatalError?: string;
    activePoolDrop?: string;
}

export interface ClaimState {
    error?: string;
}

export interface PoolDropCreateState {
    totalAmount: string;
    numberOfParticipants: string;
    completedMessage: string;
    completedLink: string;
    error?: string;
}

export interface RootState {
    data : {
        userData: { profile: AppUserProfile },
        userPreference: UserPreference,
        currentPoolDrop: PoolDrop,
        activePoolDrops: string[],
    },
    ui: {
        flags: {
            waiting: boolean,
        },
        dashboard: DashboardProps,
        claim: ClaimState,
        create: PoolDropCreateState,
    }
}