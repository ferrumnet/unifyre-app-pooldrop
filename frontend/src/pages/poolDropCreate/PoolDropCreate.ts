import { RootState, PoolDropCreateState } from "../../common/RootState";
import { AnyAction, Dispatch } from "redux";
import { inject } from "../../common/IocModule";
import { PoolDropClient, PoolDropServiceActions } from "../../services/PoolDropClient";
import { Network, ValidationUtils } from "ferrum-plumbing";
import { History } from 'history';
import { addAction } from "../../common/Actions";
import { formatter } from "../../services/RatesService";
import Big from 'big.js';
import {Utils} from './../../common/Utils';
import { UserPreferenceService } from "../../services/UserPreferenceService";

const PoolDropCreateActions = {
    TOTAL_AMOUNT_CHANGED: 'TOTAL_AMOUNT_CHANGED',
    NO_OF_PARTICIPANTS_CHANGED: 'NO_OF_PARTICIPANTS_CHANGED',
    COMPLETED_MESSAGE_CHANGED: 'COMPLETED_MESSAGE_CHANGED',
    COMPLETED_LINK_CHANGED : 'COMPLETED_LINK_CHANGED',
    CREATE_FAILED: 'CREATE_FAILED',
    SHOW_WHITELISTED_EMAILS: 'SHOW_WHITELISTED_EMAILS',
    ONCHANGE_WHITE_LISTED_EMAILS: 'ONCHANGE_WHITE_LISTED_EMAILS'
};

const Actions = PoolDropCreateActions;

export interface PoolDropCreateProps extends PoolDropCreateState {
    network: Network;
    currency: string;
    symbol: string;
    participationAmount: string;
    balance: string;
}

export interface PoolDropCreateDispatch {
    onCompletedLinkChanged: (value: string) => void;
    onCompletedMessageChanged: (value: string) => void;
    onNumberOfParticipantsChanged: (value: string) => void;
    onTotalAmountChanged: (value: string) => void;
    onWhiteListChecked: () => void;
    onWhiteListedEmailChanged: (value:string) => void,
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
        balance: address.balance,
    } as PoolDropCreateProps;
}

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => ({
    onCreate: async (history, props) => {
        try {
            const client = inject<PoolDropClient>(PoolDropClient);
            const numberOfParticipants = Number(props.numberOfParticipants)
            console.log('PROPS', props)
            const validatedEmails =  Utils.validateMultipleEmails(props.whiteListedEmails);
            ValidationUtils.isTrue(Big(props.totalAmount || '0').gt(Big(0)), 'Total amount must be positive');
            ValidationUtils.isTrue(numberOfParticipants <= 100, 'Maximum number of participants is 100');
            ValidationUtils.isTrue(numberOfParticipants === Math.round(numberOfParticipants), 
                'Number of participands must be an integer');
            ValidationUtils.isTrue(Big(props.totalAmount).lte(Big(props.balance)), 'Not enough balance');
            ValidationUtils.isTrue(!props.completedLink || props.completedLink.startsWith('http'),
                'Link must start with https://');
            if(props.showWhiteListedEmails) {
                ValidationUtils.isTrue(!!validatedEmails, `Make sure to enter valid emails`);
                ValidationUtils.isTrue(!validatedEmails!.invalidEmails.length, `Invalid Email(s) Entered : ${validatedEmails!.invalidEmails.toString()}`);
                ValidationUtils.isTrue(validatedEmails!.validEmails.length >= numberOfParticipants, `Valid number of Participants cannot be less than Number of Allowed participants`);
            }
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
                (validatedEmails?.validEmails || []).join(','),
                );
            if (pd) {
                history.replace(`/claim/${pd.id}`);
            }
        } catch (e) {
            console.error('onCreate', e);
            dispatch(addAction(Actions.CREATE_FAILED, {message: e.message}));
        }
    },
    onWhiteListedEmailChanged: value => dispatch(addAction(Actions.ONCHANGE_WHITE_LISTED_EMAILS, {value})),
    onCompletedLinkChanged: value => dispatch(addAction(Actions.COMPLETED_LINK_CHANGED, {value})),
    onCompletedMessageChanged: value => dispatch(addAction(Actions.COMPLETED_MESSAGE_CHANGED, {value})),
    onNumberOfParticipantsChanged: value => dispatch(addAction(Actions.NO_OF_PARTICIPANTS_CHANGED, {value})),
    onTotalAmountChanged: value => dispatch(addAction(Actions.TOTAL_AMOUNT_CHANGED, {value})),
    onWhiteListChecked: () => dispatch(addAction(Actions.SHOW_WHITELISTED_EMAILS, {})),
} as PoolDropCreateDispatch);

const defaultPoolDropState = {
    numberOfParticipants: '1',
    totalAmount: '',
    showWhiteListedEmails: false,
    whiteListedEmails: ''
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
        case Actions.SHOW_WHITELISTED_EMAILS:
            return {...state, showWhiteListedEmails:!state.showWhiteListedEmails,whiteListedEmails:'',error: undefined}
        case PoolDropServiceActions.CREATE_POOL_DROP_FAILED:
            return {...state, error: action.payload.message};
        case Actions.ONCHANGE_WHITE_LISTED_EMAILS:
            return {...state, whiteListedEmails: action.payload.value, error: undefined}
        default:
            return state;
    }
}

export const PoolDropCreate = {
    mapStateToProps,
    mapDispatchToProps,
    reduce,
}