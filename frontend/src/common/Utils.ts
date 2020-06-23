

export class Utils {
    static getQueryparam(param: string): string | undefined {
        const queryParams = (window.location.href.split('?')[1] || '').split('&').map(p => p.split('='));
        return (queryParams.find(p => p[0] === param) || [])[1];
    }

    static getRoute(subRoute: string) {
        let base = window.location.href.split('?')[0];
        if (!base.endsWith('/')) {
            base = base + '/';
        }
        return base + subRoute;
    }

    static platform(): 'desktop' | 'iOS' | 'android' {
        var iOs = /Phone|iPad|iPod/i.test(navigator.userAgent);
        var android = /Android/i.test(navigator.userAgent);
        if (iOs) { return 'iOS'; };
        if (android) { return 'android'; };
        return 'desktop';
    }

    static shorten(s: string) {
        if (s.length <= 25) { return s; }
        return `${s.substr(0, 10)}...${s.substr(s.length - 10)}`;
    }

    static linkForAddress(network: string, addr: string) {
        return  (network === 'RINKEBY') ?
            `https://rinkeby.etherscan.com/address/${addr}` :
            `https://etherscan.com/address/${addr}`;
    }

    static linkForTransaction(network: string, tid: string) {
        return  (network === 'RINKEBY') ?
            `https://rinkeby.etherscan.com/tx/${tid}` :
            `https://etherscan.com/tx/${tid}`;
    }
}