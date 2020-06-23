import {Container, ValidationUtils, LoggerFactory, ConsoleLogger} from 'ferrum-plumbing';
import { IntlManager } from 'unifyre-react-helper';
import { stringsEn } from '../intl/en';
import { UserPreferenceService } from '../services/UserPreferenceService';
import { Dispatch, AnyAction } from 'redux';
import { PoolDropClient } from '../services/PoolDropClient';
import { UnifyreExtensionKitClient, ClientModule } from 'unifyre-extension-sdk';

export const UNIFYRE_BACKEND = 'http://192.168.1.244:9000/api/';
export const POOLDROP_BACKEND = 'http://6f98fbf90ddb.ngrok.io';
// const POOLDROP_BACKEND = 'http://localhost:8080';

export class IocModule {
    private static _container: Container;
    static async init(dispatch: Dispatch<AnyAction>) {
        if (!!IocModule._container) {
            return IocModule._container;
        }

        const c = new Container();
        c.register(LoggerFactory, () => new LoggerFactory(n => new ConsoleLogger(n)));
        c.register('JsonStorage', () => new Object());
        await c.registerModule(new ClientModule(UNIFYRE_BACKEND, 'POOL_DROP'));
        c.registerSingleton(PoolDropClient, c => new PoolDropClient(c.get(UnifyreExtensionKitClient)));
        c.registerSingleton(UserPreferenceService, c => new UserPreferenceService());
        IntlManager.instance.load([stringsEn], 'en-US');
        IocModule._container = c;

        // init other dependencies
        c.get<UserPreferenceService>(UserPreferenceService).init(dispatch);
    }

    static container() {
        ValidationUtils.isTrue(!!IocModule._container, 'Container not initialized');
        return IocModule._container;
    }
}

export function inject<T>(type: any): T {
    return IocModule.container().get<T>(type);
}