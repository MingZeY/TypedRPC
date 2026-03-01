import type { TypedRPCContext } from "../context.js";

class TypedRPCMiddleware{
    async inbound(context:TypedRPCContext):Promise<TypedRPCContext>{
        return context;
    }
    async outbound(context:TypedRPCContext):Promise<TypedRPCContext>{
        return context;
    }
}

export {
    TypedRPCMiddleware,
}