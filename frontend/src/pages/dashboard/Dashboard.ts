import { AnyAction, Dispatch } from "redux";
import { IocModule, inject } from "../../common/IocModule";
import { addAction, CommonActions } from "../../common/Actions";
import { RootState, DashboardProps } from "../../common/RootState";
import { intl } from "unifyre-react-helper";
import { PoolDropClient } from "../../services/PoolDropClient";

const DashboardActions = {
    INIT_FAILED: 'INIT_FAILED',
    INIT_SUCCEED: 'INIT_SUCCEED',
};
const Actions = DashboardActions;

export interface DashboardDispatch {
    onLoad: () => Promise<void>;
}

function mapStateToProps(state: RootState): DashboardProps {
    return {...state.ui.dashboard, activePoolDrop: state.data.activePoolDrops[0]};
}

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => ({
    onLoad: async () => {
        try {
            dispatch(addAction(CommonActions.WAITING, { source: 'dashboard' }));
            await IocModule.init(dispatch);
            const wyre = inject<PoolDropClient>(PoolDropClient);
            const userProfile = await wyre.signInToServer(dispatch);
            if (userProfile) {
                dispatch(addAction(Actions.INIT_SUCCEED, {}));
            } else {
                dispatch(addAction(Actions.INIT_FAILED, { error: intl('fatal-error-details') }));
            }
        } catch (e) {
            console.error('Dashboard.mapDispatchToProps', e);
            dispatch(addAction(Actions.INIT_FAILED, { error: e.toString() }));
        } finally {
            dispatch(addAction(CommonActions.WAITING_DONE, { source: 'dashboard' }));
        }
    }
} as DashboardDispatch);

function reduce(state: DashboardProps = { initialized: false }, action: AnyAction) {
    switch(action.type) {
        case Actions.INIT_FAILED:
            return {...state, initialized: false, fatalError: action.payload.error};
        case Actions.INIT_SUCCEED:
            return {...state, initialized: true, fatalError: undefined};
        default:
            return state;
    }
}

export const Dashboard = ({
    mapDispatchToProps,
    mapStateToProps,
    reduce
});