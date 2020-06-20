import { RootState, PoolDropCreateState } from "../../common/RootState";
import { AnyAction, Dispatch } from "redux";
import { inject } from "../../common/IocModule";
import { PoolDropClient, PoolDropServiceActions } from "../../services/PoolDropClient";
import { Network, ValidationUtils } from "ferrum-plumbing";
import { History } from 'history';
import { addAction } from "../../common/Actions";
import { formatter } from "../../services/RatesService";
import Big from 'big.js';
import { UserPreferenceService } from "../../services/UserPreferenceService";

const PoolDropCreateActions = {
    TOTAL_AMOUNT_CHANGED: 'TOTAL_AMOUNT_CHANGED',
    NO_OF_PARTICIPANTS_CHANGED: 'NO_OF_PARTICIPANTS_CHANGED',
    COMPLETED_MESSAGE_CHANGED: 'COMPLETED_MESSAGE_CHANGED',
    COMPLETED_LINK_CHANGED : 'COMPLETED_LINK_CHANGED',
    CREATE_FAILED: 'CREATE_FAILED',
};

const Actions = PoolDropCreateActions;

export interface PoolDropCreateProps extends PoolDropCreateState {
    network: Network;
    currency: string;
    symbol: string;
    participationAmount: string;
}

export interface PoolDropCreateDispatch {
    onCompletedLinkChanged: (value: string) => void;
    onCompletedMessageChanged: (value: string) => void;
    onNumberOfParticipantsChanged: (value: string) => void;
    onTotalAmountChanged: (value: string) => void;
    onCreate: (history: History, props: PoolDropCreateProps) => void;
}

const mapStateToProps = (root: RootState) => {
    const userProfile = root.data.userData?.profile;
    const addr = userProfile?.accountGroups[0]?.addresses || {};
    const address = addr[0] || {};
    const state = root.ui.create;
    const preferences = root.data.userPreference;
    const num = Number.isFinite(Number(state.numberOfParticipants)) ?
        Number(state.numberOfParticipants) : 1;
    let participationAmount = '';
    try {
        participationAmount = Big(formatter.unFormat(state.totalAmount || '0') || '0').div(num).toString();
    } catch (e) {
        participationAmount = '';
    }
    return {
        ...state,
        network: address?.network,
        currency: address?.currency,
        symbol: (address as any)?.symbol,
        completedLink: state.completedLink === undefined ?
            preferences.lastRedirectLink : state.completedLink,
        completedMessage: state.completedMessage === undefined ?
            preferences.lastSuccessMessage : state.completedMessage,
        participationAmount,
    } as PoolDropCreateProps;
}

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => ({
    onCreate: async (history, props) => {
        try {
            const client = inject<PoolDropClient>(PoolDropClient);
            const numberOfParticipants = Number(props.numberOfParticipants)
            ValidationUtils.isTrue(Big(props.totalAmount || '0').gt(Big(0)), 'Total amount must be positive');
            ValidationUtils.isTrue(numberOfParticipants <= 100, 'Maximum number of participants is 100');
            ValidationUtils.isTrue(numberOfParticipants === Math.round(numberOfParticipants), 
                'Number of participands must be an integer');
            const pref = inject<UserPreferenceService>(UserPreferenceService);
            pref.update(dispatch, {
                lastRedirectLink: props.completedLink,
                lastSuccessMessage: props.completedMessage
            });
            const pd = await client.createPoolDrop(dispatch,
                props.network,
                props.currency,
                props.symbol,
                props.totalAmount,
                numberOfParticipants,
                props.completedMessage,
                props.completedLink,
                );
            if (pd) {
                history.replace(`/claim/${pd.id}`);
            }
        } catch (e) {
            console.error('onCreate', e);
            dispatch(addAction(Actions.CREATE_FAILED, {message: e.message}));
        }
    },
    onCompletedLinkChanged: value => dispatch(addAction(Actions.COMPLETED_LINK_CHANGED, {value})),
    onCompletedMessageChanged: value => dispatch(addAction(Actions.COMPLETED_MESSAGE_CHANGED, {value})),
    onNumberOfParticipantsChanged: value => dispatch(addAction(Actions.NO_OF_PARTICIPANTS_CHANGED, {value})),
    onTotalAmountChanged: value => dispatch(addAction(Actions.TOTAL_AMOUNT_CHANGED, {value})),
} as PoolDropCreateDispatch);

const defaultPoolDropState = {
    numberOfParticipants: '1',
    totalAmount: '',
} as PoolDropCreateState;

function reduce(state: PoolDropCreateState = defaultPoolDropState, action: AnyAction) {
    switch (action.type) {
        case Actions.COMPLETED_LINK_CHANGED:
            return {...state, completedLink: action.payload.value, error: undefined};
        case Actions.COMPLETED_MESSAGE_CHANGED:
            return {...state, completedMessage: action.payload.value, error: undefined};
        case Actions.NO_OF_PARTICIPANTS_CHANGED:
            return {...state, numberOfParticipants: action.payload.value, error: undefined};
        case Actions.TOTAL_AMOUNT_CHANGED:
            return {...state, totalAmount: action.payload.value, error: undefined};
        case Actions.CREATE_FAILED:
            return {...state, error: action.payload.message};
        case PoolDropServiceActions.CREATE_POOL_DROP_FAILED:
            return {...state, error: action.payload.message};
        default:
            return state;
    }
}

export const PoolDropCreate = {
    mapStateToProps,
    mapDispatchToProps,
    reduce,
}