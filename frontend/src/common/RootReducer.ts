import { combineReducers, AnyAction } from "redux";
import { Dashboard } from "../pages/dashboard/Dashboard";
import { CommonActions } from "./Actions";
import { userPreferenceReducer } from "../services/UserPreferenceService";
import { Claim } from "../pages/claim/Claim";
import { poolDropReducer, PoolDropServiceActions, activePoolDropReducer } from "../services/PoolDropClient";
import { PoolDropCreate } from "../pages/poolDropCreate/PoolDropCreate";
import { AppUserProfile } from "unifyre-extension-sdk/dist/client/model/AppUserProfile";

function flags(state: { waiting: boolean } = { waiting: false }, action: AnyAction) {
    switch (action.type) {
        case CommonActions.WAITING:
            return { waiting: true };
        case CommonActions.WAITING_DONE:
            return { waiting: false };
        default:
            return state;
    }
}

function userData(state: { userProfile: AppUserProfile } = {} as any, action: AnyAction) {
    switch(action.type) {
        case PoolDropServiceActions.USER_DATA_RECEIVED:
            const {userProfile} = action.payload;
            return {...state, profile: userProfile};
        default:
            return state;
    }
}

const data = combineReducers({
    userData,
    userPreference: userPreferenceReducer,
    currentPoolDrop: poolDropReducer,
    activePoolDrops: activePoolDropReducer,
});

const ui = combineReducers({
    flags,
    dashboard: Dashboard.reduce,
    claim: Claim.reduce,
    create: PoolDropCreate.reduce,
});

export const rootReducer = combineReducers({ data, ui });
