import { RootState, ClaimState } from "../../common/RootState";
import { Dispatch, AnyAction } from "redux";
import { inject } from "../../common/IocModule";
import { PoolDropClient, PoolDropServiceActions } from "../../services/PoolDropClient";
import { formatter } from "../../services/RatesService";
// @ts-ignore
import { Dialogue } from 'unifyre-web-components';
import { intl } from "unifyre-react-helper";
import { addAction } from "../../common/Actions";
import { ValidationUtils } from "ferrum-plumbing";

const BASE_LINK_URL = 'https://u.linkdrop.us/app';

export interface ClaimProps extends ClaimState {
    id: string;
    linkUrl: string;
    error?: string;
    amount: string;
    total: string;
    symbol: string;
    alreadyClaimed: boolean;
    filled: boolean;
    cancelled: boolean;
    message: string;
    redirectUrl?: string;
    isOwner: boolean;
    claimedCount: number;
    claimedTotal: number;
    address: string;
    addressUrl: string;
}

export interface ClaimDispatch {
    onLoad: (linkId: string) => void;
    onClaim: (props: ClaimProps, linkId: string) => void;
    onRedirect: (url: string) => void;
    onCancel: (id: string) => void;
    onSign: (linkId: string) => void;
}

const mapStateToProps = (root: RootState) => {
    const pd = root.data.currentPoolDrop;
    const userId = root.data.userData?.profile?.userId;
    const isOwner = userId === pd.creatorId;
    const addrs = (root.data.userData?.profile?.accountGroups || [])[0]?.addresses ||  {};
    const address = addrs[0]?.address;
    const alreadyClaimed = pd.claims.find(cl => (cl.userId === userId) || cl.address === address) || false;
    const linkUrl = `${BASE_LINK_URL}/${pd.id}`;
    return {
        id: pd.id,
        error: root.ui.claim.error,
        amount: formatter.format(pd.participationAmount, false),
        total: formatter.format(pd.totalAmount, false),
        symbol: pd.symbol,
        alreadyClaimed,
        filled: pd.claims.length >= pd.numberOfParticipants,
        cancelled: pd.cancelled,
        message: pd.completedMessage,
        redirectUrl: pd.completedLink,
        isOwner,
        claimedTotal: pd.numberOfParticipants,
        claimedCount: pd.claims.length,
        linkUrl,
        address: address,
        addressUrl: `https://etherscan.io/address/${address}`,
    } as ClaimProps;
};

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => ({
    onLoad: async linkId => {
        const client = inject<PoolDropClient>(PoolDropClient);
        await client.getPoolDrop(dispatch, linkId);
    },
    onClaim: async (props, linkId) => {
        try {
            if (props.error || props.alreadyClaimed || props.filled) { return; }
            // First load then claim.
            ValidationUtils.isTrue(!!linkId, 'LinkId must be provided');
            const client = inject<PoolDropClient>(PoolDropClient);
            if (!props.isOwner) {
                await client.claim(dispatch, linkId);
            } else {
                console.log('NOT CLAIMING. WE ARE OWNER')
            }
        } catch (e) {
            console.error('onClaim', e);
            dispatch(addAction(PoolDropServiceActions.CLAIM_FAILED, {message: e.message}));
        }
    },
    onRedirect: url => { window.location.href = url; },
    onCancel: async linkId => {
        const result = await Dialogue.show(
            intl('cancel-dlg-title'),
            intl('cancel-dlg-details'),
            [{key: 'ok', label: intl('cancel-dlg-yes')}, {key: 'cancel', label: intl('cancel-dlg-no')}])
        if (result === 'ok') {
            const client = inject<PoolDropClient>(PoolDropClient);
            client.cancel(dispatch, linkId);
        }
    },
    onSign: async linkId => {
        const result = await Dialogue.show(
            intl('sign-dlg-title'),
            intl('sign-dlg-details'),
            [{key: 'ok', label: intl('btn-ok')}, {key: 'cancel', label: intl('btn-cancel')}])
        if (result === 'ok') {
            const client = inject<PoolDropClient>(PoolDropClient);
            client.signAndSend(dispatch, linkId);
        }
    }
} as ClaimDispatch);

const defaultClaimState = {
} as ClaimState;

function reduce(state: ClaimState = defaultClaimState, action: AnyAction) {
    switch(action.type) {
        case PoolDropServiceActions.POOL_DROP_RECEIVED:
            return {...state};
        case PoolDropServiceActions.AUTHENTICATION_FAILED:
            return {...state, error: action.payload?.message};
        case PoolDropServiceActions.POOL_DROP_RECEIVE_FAILED:
            return {...state, error: action.payload?.message};
        case PoolDropServiceActions.CLAIM_FAILED:
            const {message} = action.payload;
            return {...state, error: message};
        default:
            return state;
    }
}

export const Claim = {
    mapStateToProps,
    mapDispatchToProps,
    reduce,
}