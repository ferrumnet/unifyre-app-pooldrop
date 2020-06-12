import {
    LambdaGlobalContext, MongooseConfig, UnifyreBackendProxyModule, UnifyreBackendProxyService,
} from 'aws-lambda-helper';
import {HttpHandler} from "./HttpHandler";
import {
    ConsoleLogger,
    Container,
    LoggerFactory, Module,
} from "ferrum-plumbing";
import { ClientModule, UnifyreExtensionKitClient } from 'unifyre-extension-sdk';
import { getEnv } from './MongoTypes';
import { UserService } from './UserService';

const global = { init: false };

const UNIFYRE_BACKED = 'https://ube.ferrumnetwork.io/api/';
const POOLDROP_APP_ID = 'WYRE_WIDGET'; // TODO: Add POOL_DROP to the backend.

async function init() {
    if (global.init) {
        return LambdaGlobalContext.container();
    }
    const container = await LambdaGlobalContext.container();
    await container.registerModule(new PoolDropModule());
    global.init = true;
    return container;
}

// Once registered this is the handler code for lambda_template
export async function handler(event: any, context: any) {
    try {
        const container = await init();
        const lgc = container.get<LambdaGlobalContext>(LambdaGlobalContext);
        return await lgc.handleAsync(event, context);
    } catch (e) {
        console.error(e);
        return {
            body: e.message,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            isBase64Encoded: false,
            statusCode: 500,
        }
    }
}

export class PoolDropModule implements Module {
    async configAsync(container: Container) {
        // const region = process.env[AwsEnvs.AWS_DEFAULT_REGION] || 'us-east-2';
        // const addressHandlerConfArn = getEnv(AwsEnvs.AWS_SECRET_ARN_PREFIX + 'UNI_APP_WYRE_CONFIG');
        // const addressHandlerConfig = await new SecretsProvider(region, addressHandlerConfArn).get() as
            // MongooseConfig&{authRandomKey: string};
        // makeInjectable('CloudWatch', CloudWatch);
        // container.register('MetricsUploader', c =>
        //     new CloudWatchClient(c.get('CloudWatch'), 'WalletAddressManager', [
        //         { Name:'Application', Value: 'WalletAddressManager' } as Dimension,
        //     ]));
        // container.registerSingleton(MetricsService, c => new MetricsService(
        //   new MetricsAggregator(),
        //   { period: 3 * 60 * 1000 } as MetricsServiceConfig,
        //   c.get('MetricsUploader'),
        //   c.get(LoggerFactory),
        // ));

        const poolDropConfig: MongooseConfig&{authRandomKey: string,
            wyreSecretKey: string, wyreApiKey: string} = {
            connectionString: getEnv('MONGOOSE_CONNECTION_STRING'),
            authRandomKey: getEnv('RANDOM_SECRET'),
        } as any

        await container.registerModule(new ClientModule(UNIFYRE_BACKED, POOLDROP_APP_ID));
        await container.registerModule(
            new UnifyreBackendProxyModule(POOLDROP_APP_ID, poolDropConfig.authRandomKey));
        container.register('JsonStorage', () => new Object());
        container.registerSingleton(UserService,
                c => new UserService(
                    () => c.get(UnifyreExtensionKitClient),
                    ));

        container.registerSingleton('LambdaHttpHandler',
                c => new HttpHandler(c.get(UnifyreBackendProxyService), c.get(UserService)));
        container.registerSingleton("LambdaSqsHandler",
            () => new Object());
        container.register(LoggerFactory,
            () => new LoggerFactory((name: string) => new ConsoleLogger(name)));
        // container.register('KMS', () => new KMS({region}));
        // container.register(KmsCryptor, c => new KmsCryptor(c.get('KMS'), addressHandlerConfig.cmkKeyArn));
        await container.get<UserService>(UserService).init(poolDropConfig);
    }
}
