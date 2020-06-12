import {ValidationUtils} from "ferrum-plumbing";
import { Schema, Connection, Document } from "mongoose";
import { PoolDrop, PoolDropClaim } from "./Types";

const claimSchema: Schema = new Schema<PoolDropClaim>({
    address: String,
    email: String,
});

const poolDropSchema: Schema = new Schema<PoolDrop>({
    id: String,
    creatorId: String,
    createdAt: Number,
    claims: [claimSchema],
});

export const PoolDropModel = (c: Connection) => c.model<PoolDrop&Document>('users', poolDropSchema);

export function getEnv(env: string) {
    const res = process.env[env];
    ValidationUtils.isTrue(!!res, `Make sure to set environment variable '${env}'`);
    return res!;
}