import { Injectable, HexString, LocalCache, ValidationUtils } from "ferrum-plumbing";
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
        ValidationUtils.isTrue(!!token, '"token" is required');
        ValidationUtils.isTrue(!!currency, '"currency" is required');
        ValidationUtils.isTrue(!!symbol, '"symbol" is required');
        ValidationUtils.isTrue(!!from, '"from" is required');
        ValidationUtils.isTrue(!!recepients && !!recepients.length, '"recepients" is required');
        ValidationUtils.isTrue(!!amount, '"amount" is required');
        const decimalFactor = 10 ** await this.decimals(token);
        console.log('DECIMAL FACTOR IS ', decimalFactor.toString())
        const amountPerPerson = new Big(amount).times(new Big(decimalFactor));
        const fullAmount = amountPerPerson.mul(new Big(recepients.length));
        console.log('AMOUNTS: FULL ', fullAmount.toString(), amountPerPerson.toString())
        const [approve, approveGas] = await this.approve(token, fullAmount);
        console.log('APPROVE: >')
        console.log(approve)
        console.log(approveGas)
        const [poolDrop, poolDropGas] = await this.transferManyFrom(token, from, recepients, amountPerPerson);
        console.log('POOL_DROP: >')
        console.log(poolDrop)
        console.log(poolDropGas)
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
            console.log('transferManyFrom', {token, from, to, amount});
        const m = this.poolDrop().methods.transferManyFrom(token, from, to, amount.toString());
        const gas = await m.estimateGas();
        return [m.encodeABI(), gas];
    }

    private async approve(token: string, amount: Big): Promise<[HexString, number]> {
        console.log('about to approve: ', { token, to: this.poolDropContract, amount: amount.toString(), })
        const m = this.erc20(token).methods.approve(this.poolDropContract, amount.toString());
        const gas = await m.estimateGas();
        return [m.encodeABI(), gas];
    }

    private async decimals(token: string): Promise<number> {
        return this.cache.getAsync('DECIMALS_' + token, async () => {
            const tokenCon = this.erc20(token);
            return await tokenCon.methods.decimals().call();
        });
    }

    private erc20(token: string) {
        const web3 = this.web3();
        return new web3.eth.Contract(erc20Abi.default, token);
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
        // @ts-ignore
    return { network: 'ETHEREUM',
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