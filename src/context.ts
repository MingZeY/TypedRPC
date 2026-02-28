import type { TypedRPCConnection } from "./connections/basic.js";
import type { TypedRPCPacket } from "./packet.js"

type TypedRPCContext = {
    connection:TypedRPCConnection,
    inbound?:TypedRPCPacket,
    outbound?:TypedRPCPacket,
}

export const TypedRPCContextSymbol = Symbol("TypedRPCContext");
interface TypedRPCContextAware{
    [TypedRPCContextSymbol]:TypedRPCContext | null,
}

export type {
    TypedRPCContextAware,
    TypedRPCContext,
}
