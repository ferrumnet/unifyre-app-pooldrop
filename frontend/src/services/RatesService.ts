import { Injectable, ValidationUtils, LocalCache } from "ferrum-plumbing";
import Big from 'big.js';
import { LocaleManager, intl } from "unifyre-react-helper";
import { Dispatch } from "react";
import { AnyAction } from "redux";
import { addAction } from "../common/Actions";

const FEE_RATE = new Big('0.0');

export const RateServiceActions = {
    FETCH_RATES_FAILED: 'FETCH_RATES_FAILED',
    FETCH_RATES_SUCEEDED: 'FETCH_RATES_SUCEEDED',
}

export class CurrencyFormatter {
    unFormat(num: string): string | undefined {
        if (!num) return num;
        return LocaleManager.unFormatDecimalString(num);
    }

    format(num: string, isFiat: boolean): string | undefined {
        if (!num) return num;
        const decimals = isFiat ? 2 : 4;
        const canonical = LocaleManager.unFormatDecimalString(num);
        if (!canonical) {
            return;
        }
        return LocaleManager.formatDecimalString(canonical, decimals);
    }
}

export const formatter = new CurrencyFormatter();

export class RatesService implements Injectable {
    private readonly cache = new LocalCache();
    private prices: {[pair: string]: number} | undefined; 

    async init(dispatch: Dispatch<AnyAction>) {
        await this.cache.getAsync('FETCH_PRICES', async () => this.loadPrices(dispatch));
    }

    pairSupported(fiat: string, cryptoCurrency: any): boolean {
        const key = fiat + cryptoCurrency;
        return !!(this.prices || {})[key];
    }

    private async loadPrices(dispatch: Dispatch<AnyAction>) {
        try {
            const pricesRes = await fetch('https://api.sendwyre.com/v3/rates');
            if (pricesRes.status !== 200) {
                dispatch(addAction(RateServiceActions.FETCH_RATES_FAILED, {
                    message: intl('err-loading-prices') }));
            }
            this.prices = await pricesRes.json();
            return true;
        } catch (e) {
            console.error('RateService.init', e);
            dispatch(addAction(RateServiceActions.FETCH_RATES_FAILED, {
                message: intl('err-loading-prices') }));
        }
    }

    __name__() { return 'RatesService'; }

    forBuy(cryptoCurrency: string, fiatCurrency: string):
            TradeInstance | undefined {
        // Call srvice
        ValidationUtils.isTrue(!!cryptoCurrency, '"cryptoCurrency" must be provided');
        ValidationUtils.isTrue(!!fiatCurrency, '"fiatCurrency" must be provided');
        const pair = cryptoCurrency + fiatCurrency;
        if (!this.prices || !this.prices[pair]) {
            return;
        }
        return new TradeInstance(Big(1).div(Big(this.prices[pair])), FEE_RATE);
    }

    forSell(cryptoCurrency: string, fiatCurrency: string):
            TradeInstance | undefined {
        // Call srvice
        ValidationUtils.isTrue(!!cryptoCurrency, '"cryptoCurrency" must be provided');
        ValidationUtils.isTrue(!!fiatCurrency, '"fiatCurrency" must be provided');
        const pair = cryptoCurrency + fiatCurrency;
        if (!this.prices || !this.prices[pair]) {
            return;
        }
        return new TradeInstance(Big(1).div(Big(this.prices[pair])), FEE_RATE);
    }

    exchangeFiat(sourceFiat: string, sourceAmount: string, targetFiat: string): string {
        if (!sourceAmount || sourceFiat === targetFiat)  {
            return sourceAmount;
        }
        ValidationUtils.isTrue(!!sourceFiat, '"cryptoCurrency" must be provided');
        ValidationUtils.isTrue(!!targetFiat, '"targetFiat" must be provided');
        const pair = sourceFiat + targetFiat;
        if (!this.prices || !this.prices[pair]) {
            return sourceAmount;
        }
        try {
            return Big(sourceAmount).div(Big(this.prices[pair])).toString();
        } catch(e) {
            return sourceAmount;
        }
    }

}

/**
 * Formula:
 * - We assume rate is: Top/Bottom
 * - Fee is always from Bottom
 * - We always spend bottom and aquire top
 * 
 * B * (1-Fee) / Rate = T
 */
export class TradeInstance {
    constructor(
        private rate: Big,
        private feeRate: Big,
    ) {}

    spendToAquire(aquireAmount: string): [string, string] {
        // How much do we spend to aquire the amount.
        // B is unknown, T is known
        ValidationUtils.isTrue(!this.rate.eq(Big(0)), 'rate cannot be zero');
        const t = Big(aquireAmount);
        const b = t.times(this.rate).div(Big(1).minus(this.feeRate));
        const fee = b.times(this.feeRate);
        return [b.toString(), fee.toString()];
    }

    aquireIfSpend(spendAmount: string): [string, string] {
        // How much do we aquire if spend the amount
        // T is unknown, B is known
        ValidationUtils.isTrue(!this.rate.eq(Big(0)), 'rate cannot be zero');
        const b = Big(spendAmount);
        const t = b.mul(Big(1).minus(this.feeRate)).div(this.rate);
        const fee = b.times(this.feeRate);
        console.log('FEE CALCED', fee.toString(), {spendAmount,
            b: b.toString(), f: this.feeRate.toString(), r: this.rate.toString()})
        return [t.toString(), fee.toString()];
    }
}
