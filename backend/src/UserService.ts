import { MongooseConnection } from "aws-lambda-helper";
import { Connection, Model, Document } from "mongoose";
import { Injectable, ValidationUtils } from "ferrum-plumbing";
import { UnifyreExtensionKitClient } from "unifyre-extension-sdk";
import { PoolDrop, PoolDropClaim } from "./Types";
import { PoolDropModel } from "./MongoTypes";
import { AppLinkRequest } from "unifyre-extension-sdk/dist/client/model/AppLink";

export class UserService extends MongooseConnection implements Injectable {
    private model: Model<PoolDrop & Document, {}> | undefined;
    constructor(
        private uniClientFac: () => UnifyreExtensionKitClient,
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
        const curreny = link!.currency;
        const email = userProfile.email;
        const address = userProfile?.accountGroups[0]?.addresses[curreny]?.address;
        ValidationUtils.isTrue(!!address, `No address was found for ${link?.symbol}`);
        ValidationUtils.isTrue(!link!.cancelled, "Link is already cancelled");
        ValidationUtils.isTrue(!link!.completedLink, "Link is already completed");
        ValidationUtils.isTrue(!link!.claims.find(c => (!!email && c.email === email) || c.address === address),
            "You have already claimed this link");
        ValidationUtils.isTrue(link!.claims.length < link!.numberOfParticipants,
            "This link is fully claimed. Hopefully next time");
        const newClaim = {
            address,
            email,
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
        const message = `${link.displayName} is distributon ${link.participationAmountFormatted} ${link.symbol} to ${link.numberOfParticipants} lucky individuals using the Unifyre Wallet`;
        const linkId = await client.createLinkObject({
            imageTopTitle: 'POOL DROP',
            imageMainLine: `${link.participationAmountFormatted}`,
            imageSecondLine: `${link.symbol}`,
            message,
            data: {},
            currency: link.currency,
        } as AppLinkRequest<{}>);
        link.id = linkId;
        link.creatorId = userProfile.userId;
        link.createdAt = Date.now();
        link.displayName = userProfile.displayName;
        link.version = 0;
        link.claims = [];
        await this.save(link);
        return link;
    }

    private async save(pd: PoolDrop) { 
        this.verifyInit();
        return new this.model!(pd).save();
    }

    private async get(id: string): Promise<PoolDrop|undefined> {
        const pd = await this.model?.findOne({id}).exec();
        if (!pd) return;
        return pd.toJSON();
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

    __name__() { return 'UserService'; }
}