import { Injectable, JsonRpcRequest, ValidationUtils, Network } from "ferrum-plumbing";
import { Dispatch, AnyAction } from "redux";
import { AppUserProfile } from "unifyre-extension-sdk/dist/client/model/AppUserProfile";
import { addAction, CommonActions } from "../common/Actions";
import { PoolDrop } from "../common/Types";
import { formatter } from "./RatesService";
import Big from 'big.js';
import { Utils } from "../common/Utils";
import { UnifyreExtensionKitClient } from 'unifyre-extension-sdk';
import { POOLDROP_BACKEND } from "../common/IocModule";

export const PoolDropServiceActions = {
    TOKEN_NOT_FOUND_ERROR: 'TOKEN_NOT_FOUND_ERROR',
    API_ERROR: 'API_ERROR',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    AUTHENTICATION_COMPLETED: 'AUTHENTICATION_COMPLETED',
    USER_DATA_RECEIVED: 'USER_DATA_RECEIVED',
    ACTIVE_POOLDROPS_RECEIVED: 'ACTIVE_POOLDROPS_RECEIVED',

    POOL_DROP_RECEIVED: 'POOL_DROP_RECEIVED',
    POOL_DROP_RECEIVE_FAILED: 'POOL_DROP_RECEIVE_FAILED',
    CLAIM_FAILED: 'CLAIM_FAILED',
    CREATE_POOL_DROP_FAILED: 'CREATE_POOL_DROP_FAILED',
};

const Actions = PoolDropServiceActions;

export class PoolDropClient implements Injectable {
    private jwtToken: string = '';
    constructor(
        private client: UnifyreExtensionKitClient,
    ) { }

    __name__() { return 'PoolDropClient'; }

    async signInToServer(dispatch: Dispatch<AnyAction>): Promise<AppUserProfile | undefined> {
        const token = this.getToken(dispatch);
        if (!token) { return; }
        try {
            dispatch(addAction(CommonActions.WAITING, { source: 'signInToServer' }));
            const res = await this.api({
                command: 'signInToServer', data: {token}, params: [] } as JsonRpcRequest);
            const {userProfile, activePoolDrops, session} = res;
            if (!session) {
                dispatch(addAction(Actions.AUTHENTICATION_FAILED, { message: 'Could not connect to Unifyre' }));
                return;
            }
            this.jwtToken = session;
            dispatch(addAction(Actions.AUTHENTICATION_COMPLETED, { }));
            dispatch(addAction(Actions.ACTIVE_POOLDROPS_RECEIVED, { activePoolDrops }));
            dispatch(addAction(Actions.USER_DATA_RECEIVED, { userProfile }));
            return userProfile;
        } catch (e) {
            console.error('Error sigining in', e);
            dispatch(addAction(Actions.AUTHENTICATION_FAILED, { message: 'Could not connect to Unifyre' }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'signInToServer' }));
        }
    }

    async createPoolDrop(dispatch: Dispatch<AnyAction>,
        network: Network,
        currency: string,
        symbol: string,
        totalAmount: string,
        numberOfParticipants: number,
        completedMessge?: string,
        completedLink?: string,
    ): Promise<PoolDrop|undefined> {
        try {
            ValidationUtils.isTrue(!!currency, "'currency' is required");
            ValidationUtils.isTrue(!!numberOfParticipants && numberOfParticipants >= 1, "'numberOfParticipants' is required");
            ValidationUtils.isTrue(!!totalAmount, "'totalAmount' is required");
            ValidationUtils.isTrue(!!network, '"network" is required');
            ValidationUtils.isTrue(!!symbol, '"symbol" is required');
            dispatch(addAction(CommonActions.WAITING, { source: 'createPoolDrop' }));
            const token = this.getToken(dispatch);
            const participationAmount = Big(totalAmount).div(numberOfParticipants).toString();
            const participationAmountFormatted = formatter.format(participationAmount, false);
            const poolDrop = await this.api({
                command: 'createLinkAndRegister', data: {
                    token,
                    network,
                    currency,
                    symbol,
                    totalAmount,
                    numberOfParticipants,
                    participationAmount,
                    participationAmountFormatted,
                    completedMessge,
                    completedLink,
                }, params: [] } as JsonRpcRequest);
            if (!poolDrop) {
                dispatch(addAction(Actions.CREATE_POOL_DROP_FAILED, { message: 'Could not connect to Unifyre' }));
                return;
            }
            // dispatch(addAction(Actions.POOL_DROP_RECEIVED, { poolDrop }));
            return poolDrop;
        } catch (e) {
            console.error('Error sigining in', e);
            dispatch(addAction(Actions.CREATE_POOL_DROP_FAILED, { message: e.message || 'Could not create the pool drop' }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'createPoolDrop' }));
        }
    }

    async getPoolDrop(dispatch: Dispatch<AnyAction>, linkId: string) {
        try {
            dispatch(addAction(CommonActions.WAITING, { source: 'getLink' }));
            const poolDrop = await this.api({
                command: 'getLink', data: {linkId}, params: [] } as JsonRpcRequest);
            console.log("GET POOL DROP", poolDrop);
            if (!poolDrop) {
                dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Link not found' }));
                return;
            }
            dispatch(addAction(Actions.POOL_DROP_RECEIVED, { poolDrop }));
            return poolDrop;
        } catch (e) {
            console.error('Error get poolDrop', e);
            dispatch(addAction(Actions.CLAIM_FAILED, { message: e.message }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'signInToServer' }));
        }
    }

    async claim(dispatch: Dispatch<AnyAction>, linkId: string) {
        const token = this.getToken(dispatch);
        if (!token) { return; }
        try {
            dispatch(addAction(CommonActions.WAITING, { source: 'claim' }));
            ValidationUtils.isTrue(!!linkId, "No link provided");
            const poolDrop = await this.api({
                command: 'claim', data: {token, linkId}, params: [] } as JsonRpcRequest) as PoolDrop;
            if (!poolDrop) {
                dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Could not claim the link. Try again.' }));
            }
            return this.getPoolDrop(dispatch, linkId);
        } catch (e) {
            console.error('Error claiming', e);
            dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Could not claim the link. ' + e.message }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'claim' }));
        }
    }

    async cancel(dispatch: Dispatch<AnyAction>, linkId: string) {
        try {
            dispatch(addAction(CommonActions.WAITING, { source: 'cancel' }));
            const poolDrop = await this.api({
                command: 'cancelLink', data: {linkId}, params: [] } as JsonRpcRequest) as PoolDrop;
            if (!poolDrop) {
                dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Could not cancel the link. Try again.' }));
            }
            return this.getPoolDrop(dispatch, linkId);
        } catch (e) {
            console.error('Error cancelling', e);
            dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Could not cancel the link.' + e.message || '' }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'cancel' }));
        }
    }

    async signAndSend(dispatch: Dispatch<AnyAction>, linkId: string) {
        try {
            dispatch(addAction(CommonActions.WAITING, { source: 'signAndSend' }));
            const token = this.getToken(dispatch);
            if (!token) { return; }
            const {requestId} = await this.api({
                command: 'signAndSendAsync', data: {linkId, token}, params: []
            } as JsonRpcRequest) as {requestId: string};
            if (!requestId) {
                dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Could not send a sign request.' }));
            }
            this.client.setToken(token);
            const transactionIds = await this.client.getSendTransactionResponse(requestId);

            if (transactionIds) {
                const res = await this.api({
                    command: 'transactionsReceived', data: { transactionIds, linkId }, params: []
                } as JsonRpcRequest) as {requestId: string};
                ValidationUtils.isTrue(!!res, 'Error updating transaction IDs');
                return this.getPoolDrop(dispatch, linkId);
            } else {
                dispatch(addAction(Actions.CLAIM_FAILED, { message:
                    'No transaction ID was received from unifyre.' +
                    ' Make sure to doube check your unifyre wallet and etherscan to ensure there was ' +
                    'no transaction submitted to chain before retrying. ' +
                    'Otherwise you may risk double paying a link drop' }));
            }
        } catch (e) {
            console.error('Error signAndSend', e);
            dispatch(addAction(Actions.CLAIM_FAILED, { message: 'Could send a sign request.' + e.message || '' }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'signAndSend' }));
        }
    }

    private getToken(dispatch: Dispatch<AnyAction>) {
        const storedToken = localStorage.getItem('SIGNIN_TOKEN');
        const token = Utils.getQueryparam('token') || storedToken;
        if (!!token && token !== storedToken) {
            localStorage.setItem('SIGNIN_TOKEN', token!);
        }
        if (!token) {
            dispatch(addAction(Actions.TOKEN_NOT_FOUND_ERROR, {}));
            return;
        }
        return token;
    }

    private async api(req: JsonRpcRequest): Promise<any> {
        try {
            const res = await fetch(POOLDROP_BACKEND, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(req),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwtToken}`
                },
            });
            const resText = await res.text();
            if (Math.round(res.status / 100) === 2) {
                return resText ? JSON.parse(resText) : undefined;
            }
            const error = resText;
            let jerror: any;
            try {
                jerror = JSON.parse(error);
            } catch (e) {}
            console.error('Server returned an error when calling ', req, {
                status: res.status, statusText: res.statusText, error});
            throw new Error(jerror?.error ? jerror.error : error);
        } catch (e) {
            console.error('Error calling api with ', req, e);
            throw e;
        }
    }
}

const defaultPoolDrop = {
    id: '',
    claims: [],
    createdAt: 0,
    network: '',
} as any as PoolDrop;

export function poolDropReducer(state: PoolDrop = defaultPoolDrop, action: AnyAction) {
    switch(action.type) {
        case Actions.POOL_DROP_RECEIVED:
            const {poolDrop} = action.payload;
            return {...poolDrop};
        default:
            return state;
    }
}

export function activePoolDropReducer(state: string[] = [], action: AnyAction) {
    switch(action.type) {
        case Actions.ACTIVE_POOLDROPS_RECEIVED:
            const {activePoolDrops} = action.payload;
            return [...activePoolDrops];
        default:
            return state;
    }
}