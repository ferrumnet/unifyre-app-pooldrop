import { Injectable, HexString, LocalCache } from "ferrum-plumbing";
// @ts-ignore
import * as erc20Abi from './resources/IERC20.json'
// @ts-ignore
import * as poolDropAbi from './resources/PoolDrop.json';
import Web3 from 'web3';
import Big from 'big.js';
import { CustomTransactionCallRequest } from "unifyre-extension-sdk";

export class SmartContratClient implements Injectable {
    cache: LocalCache;
    constructor(
        private web3Provider: string,
        private poolDropContract: string,
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
        const decimalFactor = 10 ** await this.decimals(token);
        const amountPerPerson = new Big(amount).times(new Big(decimalFactor));
        const fullAmount = amountPerPerson.mul(new Big(recepients.length));
        const [approve, approveGas] = await this.approve(token, fullAmount);
        const [poolDrop, poolDropGas] = await this.transferManyFrom(token, from, recepients, amountPerPerson);
        const nonce = await this.web3().eth.getTransactionCount(from, 'pending');
        const fullAmountHuman = fullAmount.div(decimalFactor).toString();
        return [
            callRequest(token, currency, from, approve, approveGas.toString(), nonce,
                `Approve ${fullAmountHuman} ${symbol} to be spent by PoolDrop contract`,),
            callRequest(this.poolDropContract, currency, from, poolDrop, poolDropGas.toString(), nonce + 1,
                `${amount} ${symbol} to be distributed to ${recepients.length} addresses using PoolDrop contract`,),
        ];
    }

    private async transferManyFrom(token: string, from: string, to: string[], amount: Big):
        Promise<[HexString, number]> {
        const m = this.poolDrop().methods.transferManyFrom(from, to, amount.toString());
        const gas = await m.estimateGas();
        return [m.encodeABI(), gas];
    }

    private async approve(token: string, amount: Big): Promise<[HexString, number]> {
        const m = this.erc20(token).methods.approve(this.poolDropContract, amount.toString());
        const gas = await m.estimateGas();
        return [m.encodeABI(), gas];
    }

    private async decimals(token: string): Promise<number> {
        return this.cache.getAsync('DECIMALS_' + token, async () => {
            return await this.erc20(token).methods.decimals().call();
        });
    }

    private erc20(token: string) {
        const web3 = this.web3();
        return new web3.eth.Contract(erc20Abi.abi as any, token);
    }

    private poolDrop() {
        const web3 = this.web3();
        return new web3.eth.Contract(poolDropAbi.abi as any, this.poolDropContract);
    }

    private web3() {
        return new Web3(new Web3.providers.HttpProvider(this.web3Provider));
    }
}

function callRequest(contract: string, currency: string, from: string, data: string, gasLimit: string, nonce: number,
    description: string): CustomTransactionCallRequest {
    return {
        network: 'ETHEREUM',
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