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
import { PoolDropService } from './PoolDropService';
import { SmartContratClient } from './SmartContractClient';

const global = { init: false };
const POOLDROP_APP_ID = 'POOL_DROP';

const IS_DEV = true;

const UNIFYRE_BACKED_PROD = 'https://ube.ferrumnetwork.io/api/';
const UNIFYRE_BACKED_DEV = 'http://192.168.1.244:9000/api/';
const UNIFYRE_BACKED = IS_DEV ? UNIFYRE_BACKED_DEV : UNIFYRE_BACKED_PROD;

const POOL_DROP_SMART_CONTRACT_ADDRESS_PROD = '';
const POOL_DROP_SMART_CONTRACT_ADDRESS_DEV = '';
const POOL_DROP_ADDRESS = IS_DEV ? POOL_DROP_SMART_CONTRACT_ADDRESS_DEV : POOL_DROP_SMART_CONTRACT_ADDRESS_PROD;


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

        // TODO: CONFIGURE THE SIGNING PRIVATE KEY AS KMS ENCRYPTED

        const poolDropConfig: MongooseConfig&{
            authRandomKey: string, signingKey: string, web3Provider: string} = {
            connectionString: getEnv('MONGOOSE_CONNECTION_STRING'),
            authRandomKey: getEnv('RANDOM_SECRET'),
            signingKey: getEnv('REQUEST_SIGNING_KEY'),
            web3Provider: getEnv('WEB3_PROVIDER'),
        } as any;

        // This will register sdk modules. Good for client-side, for server-side we also need the next
        // step
        await container.registerModule(new ClientModule(UNIFYRE_BACKED, POOLDROP_APP_ID));
        
        // Note: we register UnifyreBackendProxyModule for the backend applications
        // this will ensure that the ExtensionClient does not cache the token between different
        // requests, and also it will ensure that client will sign the requests using sigining_key.
        await container.registerModule(
            new UnifyreBackendProxyModule(POOLDROP_APP_ID, poolDropConfig.authRandomKey,
                poolDropConfig.signingKey,));

        container.registerSingleton(SmartContratClient,
            () => new SmartContratClient(poolDropConfig.web3Provider, POOL_DROP_ADDRESS));
        container.register('JsonStorage', () => new Object());
        container.registerSingleton(PoolDropService,
                c => new PoolDropService(
                    () => c.get(UnifyreExtensionKitClient),
                    c.get(SmartContratClient),
                    ));

        container.registerSingleton('LambdaHttpHandler',
                c => new HttpHandler(c.get(UnifyreBackendProxyService), c.get(PoolDropService)));
        container.registerSingleton("LambdaSqsHandler",
            () => new Object());
        container.register(LoggerFactory,
            () => new LoggerFactory((name: string) => new ConsoleLogger(name)));
        // container.register('KMS', () => new KMS({region}));
        // container.register(KmsCryptor, c => new KmsCryptor(c.get('KMS'), addressHandlerConfig.cmkKeyArn));
        await container.get<PoolDropService>(PoolDropService).init(poolDropConfig);
    }
}
