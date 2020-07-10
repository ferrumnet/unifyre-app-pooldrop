import { Injectable, HexString, LocalCache, ValidationUtils, Network } from "ferrum-plumbing";
// @ts-ignore
import * as erc20Abi from './resources/IERC20.json'
// @ts-ignore
import * as poolDropAbi from './resources/PoolDrop.json';
// import { Eth } from 'web3-eth';
import Web3 from 'web3';
import Big from 'big.js';
import { CustomTransactionCallRequest } from "unifyre-extension-sdk";

export class SmartContratClient implements Injectable {
    cache: LocalCache;
    constructor(
        private web3ProviderEthereum: string,
        private web3ProviderRinkeby: string,
        private poolDropContract: { [network: string]: string},
    ) {
        this.cache = new LocalCache();
    }

    __name__() { return 'SmartContratClient'; }

    async createPoolDrop(
        token: string,
        currency: string,
        symbol: string,
        from: string,
        recepients: string[],
        amount: string,
    ): Promise<CustomTransactionCallRequest[]> {
        ValidationUtils.isTrue(!!token, '"token" is required');
        ValidationUtils.isTrue(!!currency, '"currency" is required');
        ValidationUtils.isTrue(!!symbol, '"symbol" is required');
        ValidationUtils.isTrue(!!from, '"from" is required');
        ValidationUtils.isTrue(!!recepients && !!recepients.length, '"recepients" is required');
        ValidationUtils.isTrue(!!amount, '"amount" is required');
        const network = currency.split(':')[0];
        const contract = this.poolDropContract[network];
        ValidationUtils.isTrue(!!contract, 'No contract address is configured for this network');
        const decimalFactor = 10 ** await this.decimals(network, token);
        // Round down the per person amount, but round up the full to prevent the situation
        // that not enough amount is approved.
        const amountPerPerson = new Big(amount).times(new Big(decimalFactor)).round(0, 0);
        const fullAmount = amountPerPerson.mul(new Big(recepients.length)).round(0, 3);
        const [approve, approveGas] = await this.approve(network, token, from, fullAmount);
        const [poolDrop, poolDropGas] = await this.transferManyFrom(network, token, from, recepients, amountPerPerson);
        const nonce = await this.web3(network).getTransactionCount(from, 'pending');
        const fullAmountHuman = fullAmount.div(decimalFactor).toFixed();
        return [
            callRequest(token, currency, from, approve, approveGas.toFixed(), nonce,
                `Approve ${fullAmountHuman} ${symbol} to be spent by PoolDrop contract`,),
            callRequest(contract, currency, from, poolDrop, poolDropGas.toFixed(), nonce + 1,
                `${amount} ${symbol} to be distributed to ${recepients.length} addresses using PoolDrop contract`,),
        ];
    }

    private async transferManyFrom(network: string, token: string, from: string, to: string[], amount: Big):
        Promise<[HexString, number]> {
        console.log('transferManyFrom', {token, from, to, amount: amount.toFixed()});
        const m = this.poolDrop(network).methods.transferManyFrom(token, from, to, amount.toFixed());
        const gas = 35000 + to.length * 60000;
        // await m.estimateGas({from}); This will fail unfortunately because tx will revert!
        console.log('TRANSFER MANY', gas);
        return [m.encodeABI(), gas];
    }

    private async approve(network: string, token: string, from: string, amount: Big): Promise<[HexString, number]> {
        console.log('about to approve: ', { token, to: this.poolDropContract[network], amount: amount.toFixed(), })
        const m = this.erc20(network, token).methods.approve(this.poolDropContract[network], amount.toFixed());
        const gas = await m.estimateGas({from});
        console.log('APPROVE', gas);
        return [m.encodeABI(), gas];
    }

    private async decimals(network: string, token: string): Promise<number> {
        return this.cache.getAsync('DECIMALS_' + token, async () => {
            const tokenCon = this.erc20(network, token);
            return await tokenCon.methods.decimals().call();
        });
    }

    private erc20(network: string, token: string) {
        const web3 = this.web3(network);
        return new web3.Contract(erc20Abi.default, token);
    }

    private poolDrop(network: string) {
        const web3 = this.web3(network);
        return new web3.Contract(poolDropAbi.abi as any, this.poolDropContract[network]);
    }

    private web3(network: string) {
        return new Web3(new Web3.providers.HttpProvider(
            network === 'ETHEREUM' ? this.web3ProviderEthereum : this.web3ProviderRinkeby)).eth;
    }
}

function callRequest(contract: string, currency: string, from: string, data: string, gasLimit: string, nonce: number,
    description: string): CustomTransactionCallRequest {
    return {
        currency,
        from,
        amount: '0',
        contract,
        data,
        gas: { gasPrice: '0', gasLimit },
        nonce,
        description,
    };
}