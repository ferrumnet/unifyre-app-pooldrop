import { MongooseConnection } from "aws-lambda-helper";
import { Connection, Model, Document } from "mongoose";
import { Injectable, ValidationUtils } from "ferrum-plumbing";
import { UnifyreExtensionKitClient } from "unifyre-extension-sdk";
import { PoolDrop, PoolDropClaim } from "./Types";
import { PoolDropModel } from "./MongoTypes";
import { AppLinkRequest } from "unifyre-extension-sdk/dist/client/model/AppLink";
import { SmartContratClient } from "./SmartContractClient";

export class PoolDropService extends MongooseConnection implements Injectable {
    private model: Model<PoolDrop & Document, {}> | undefined;
    constructor(
        private uniClientFac: () => UnifyreExtensionKitClient,
        private contract: SmartContratClient,
    ) { super(); }

    initModels(con: Connection): void {
        this.model = PoolDropModel(con);
    }

    async claim(token: string, linkId: string): Promise<PoolDrop> {
        ValidationUtils.isTrue(!!token, '"token" must be provided');
        ValidationUtils.isTrue(!!linkId, '"linkId" must be provided');
        const link = await this.get(linkId);
        ValidationUtils.isTrue(!!link, 'Link not found');
        const client = this.uniClientFac();
        await client.signInWithToken(token);
        const userProfile = client.getUserProfile();
        ValidationUtils.isTrue(!!userProfile, 'Could not sign in to unifyre - bad token');
        const userId = userProfile.userId;
        const addresses = userProfile?.accountGroups[0]?.addresses || [];
        ValidationUtils.isTrue(!!addresses.length, 'User has no address');
        ValidationUtils.isTrue(addresses.length == 1, 'User has more than one address');
        const address = addresses[0].address;
        ValidationUtils.isTrue(!!address, `No address was found for ${link?.symbol}`);
        ValidationUtils.isTrue(!link!.cancelled, "Link is already cancelled");
        ValidationUtils.isTrue(!link!.executed, "Link is already completed");
        ValidationUtils.isTrue(!link!.claims.find(c => (c.userId === userId) || c.address === address),
            "You have already claimed this link");
        ValidationUtils.isTrue(link!.claims.length < link!.numberOfParticipants,
            "This link is fully claimed. Hopefully next time");
        const newClaim = {
            address,
            userId,
        } as PoolDropClaim;
        await this.update({...link!, claims: link!.claims.concat(newClaim)});
        return (await this.get(linkId))!;
    }

    async cancelLink(userId: string, linkId: string): Promise<PoolDrop> {
        ValidationUtils.isTrue(!!linkId, '"linkId" must be provided');
        const pd = await this.get(linkId);
        ValidationUtils.isTrue(!!pd, 'Link not found');
        ValidationUtils.isTrue(userId === pd!.creatorId, "You are not creator");
        pd!.cancelled = true;
        await this.update(pd!);
        return (await this.get(linkId))!;
    }

    async createLinkAndRegister(uniToken: string, link: PoolDrop): Promise<PoolDrop> {
        // 1. Register a link to uni. Get the ID
        // 2. Save the link to mongo
        const client = this.uniClientFac();
        await client.signInWithToken(uniToken);
        const userProfile = client.getUserProfile();
        ValidationUtils.isTrue(!!userProfile, 'Error connecting to unifyre');
        link.creatorId = userProfile.userId;
        link.creatorAddress = (userProfile.accountGroups[0]?.addresses || [])[0]?.address;
        link.network = (userProfile.accountGroups[0]?.addresses || [])[0]?.network;
        link.currency = (userProfile.accountGroups[0]?.addresses || [])[0]?.currency;
        link.symbol = (userProfile.accountGroups[0]?.addresses || [])[0]?.symbol;
        link.createdAt = Date.now();
        link.displayName = userProfile.displayName;
        const message = `${userProfile.displayName} is distributing ${link.participationAmountFormatted} ${link.symbol} to ${link.numberOfParticipants} lucky individuals using the Unifyre Wallet`;
        const linkId = await client.createLinkObject({
            imageTopTitle: 'POOL DROP',
            imageMainLine: `${link.participationAmountFormatted}`,
            imageSecondLine: `${link.symbol}`,
            message,
            data: {},
            currency: link.currency,
        } as AppLinkRequest<{}>);
        link.id = linkId;
        link.version = 0;
        link.claims = [];
        await this.save(link);
        return link;
    }

    async signAndSendAsync(userId: string, linkId: string, uniToken: string): Promise<string> {
        const poolDrop = await this.get(linkId);
        ValidationUtils.isTrue(!!poolDrop, 'Pool drop not found');
        ValidationUtils.isTrue(userId === poolDrop?.creatorId, "Not your pooldrop");
        ValidationUtils.isTrue(!poolDrop!.cancelled, 'Poold drop is already cancelled');
        ValidationUtils.isTrue(!poolDrop!.executed, 'Poold drop is already executed');

        const client = this.uniClientFac();
        await client.signInWithToken(uniToken);
        const userProfile = client.getUserProfile();
        ValidationUtils.isTrue(!!userProfile, "Could not sign in. Token might have expired");
        const creatorAddress = (userProfile.accountGroups[0]?.addresses || [])[0];
        ValidationUtils.isTrue(!!creatorAddress, "Signed in user has no address");
        ValidationUtils.isTrue(creatorAddress.currency === poolDrop!.currency,
            "Could not find address for " + poolDrop!.currency);
        const txs = await this.contract.createPoolDrop(
            poolDrop!.currency.split(':')[1],
            poolDrop!.currency,
            creatorAddress.symbol || poolDrop!.symbol,
            creatorAddress.address,
            poolDrop!.claims.map(c => c.address),
            poolDrop!.participationAmount,
        );
        console.log('About to send transactions to server', txs);

        return await client.sendTransactionAsync(poolDrop!.network, txs);
    }

    async addTransactionIds(linkId: string, transactionIds: string[]): Promise<PoolDrop> {
        ValidationUtils.isTrue(!!linkId, '"linkId" must be provided');
        const pd = await this.get(linkId);
        ValidationUtils.isTrue(!!pd, 'Pool drop not found');
        if (pd!.transactionIds?.length) {
            transactionIds = transactionIds.filter(tid => pd!.transactionIds.indexOf(tid) < 0);
        }
        pd!.transactionIds = (pd!.transactionIds || []).concat(transactionIds);
        pd!.executed = true;
        console.log('TXS ARE ', transactionIds)
        console.log('UPDATING PD', pd)
        return this.update(pd!);
    }

    async get(id: string): Promise<PoolDrop|undefined> {
        ValidationUtils.isTrue(!!id, '"id" must be provided');
        const pd = await this.model?.findOne({id}).exec();
        if (!pd) return;
        return pd.toJSON();
    }

    async getActiveLinkDrops(creatorId: string, currency: string): Promise<string[]> {
        ValidationUtils.isTrue(!!creatorId, '"creatorId" must be provided');
        ValidationUtils.isTrue(!!currency, '"currency" must be provided');
        const drops = await this.model!.find({
            "$and": [ {creatorId}, {cancelled: false}, {executed: false}, { currency } ]
        })
        return drops.map(d => d.id);
    }

    private async save(pd: PoolDrop) { 
        this.verifyInit();
        return new this.model!(pd).save();
    }
    
    private async update(link: PoolDrop) {
        const newPd = {...link};
        const version = link.version;
        newPd.version = version + 1;
        const id = link.id;
        const updated = await this.model!.findOneAndUpdate({ "$and": [{ id }, { version }] },
            { '$set': { ...newPd } }).exec();
        ValidationUtils.isTrue(!!updated, 'Error updating PoolDrop. Update returned empty. Retry');
        return updated?.toJSON();
    }

    __name__() { return 'PoolDropService'; }
}