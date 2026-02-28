
import type { TypedRPCConnection } from "./connecitons/basic.js";
import { TypedRPCContextSymbol, type TypedRPCContext } from "./context.js";
import { TypedRPCPacketFactory, type TypedRPCPacket, type TypedRPCRequestPacket, type TypedRPCResponsePacket } from "./packet.js";
import { TypedEmitter } from "./utils.js";


// interface TypedRPCHandlerMiddleware{
//     inbound?:(context:TypedRPCContext) => Promise<TypedRPCContext>;
//     outbound?:(context:TypedRPCContext) => Promise<TypedRPCContext>; 
// }

class TypedRPCHandlerMiddleware{
    async inbound(context:TypedRPCContext):Promise<TypedRPCContext>{
        return context;
    }
    async outbound(context:TypedRPCContext):Promise<TypedRPCContext>{
        return context;
    }
}

type TypedRPCHandlerEvents = {
    
}
/**
 * 处理所有TypedRPC数据包，管理入站出站
 */
class TypedRPCHandler{

    public emitter = new TypedEmitter<TypedRPCHandlerEvents>();

    private middlewares:TypedRPCHandlerMiddleware[] = [];

    private hooks:Record<string,Record<string,{
        handler:(...args:any[])=>any,
        bind:any,
    }>> = {};

    constructor(){
        this.use({
            inbound:async (context) => {
                // Fallback 托底返回错误
                if(context.inbound && !context.outbound){
                    context.outbound = TypedRPCPacketFactory.createResponsePacket({
                        requestId:context.inbound.id,
                        error:"service not available or not found",
                    })
                }
                return context;
            },
            outbound:async (context) => {
                return context;
            },
        })
        this.use({
            inbound:async (context) => {
                if(!context.inbound
                || !TypedRPCPacketFactory.isRequestPacket(context.inbound)){
                    return context;
                }
                // 如果已经有出站包，直接返回
                if(context.outbound){
                    return context;
                }
                const serviceName = context.inbound.serviceName;
                const methodName = context.inbound.methodName;
                const args = context.inbound.args;
                const hook = this.hooks[serviceName]?.[methodName];
                if(!hook){
                    return context;
                }
                const result = await hook.handler.call(new Proxy(hook.bind || {},{
                    get(target,prop){
                        if(prop === TypedRPCContextSymbol){
                            return context;
                        }
                        return Reflect.get(target,prop);
                    }
                }),...args);
                const response = TypedRPCPacketFactory.createResponsePacket({
                    requestId:context.inbound.id,
                    result:result,
                });
                context.outbound = response;
                return context;
            },
            outbound:async (context) => {
                return context;
            },
        })
    }

    public use(middleware:TypedRPCHandlerMiddleware){
        this.middlewares.push(middleware);
        return this;
    }

    private async middlewareProcesser(context:TypedRPCContext,index:number,direction:'inbound'|'outbound'):Promise<TypedRPCContext>{
        const middleware = this.middlewares[index];
        if(!middleware){
            return context;
        }
        // 执行中间件
        if(direction == 'inbound'){
            if(middleware.inbound){
                context = await middleware.inbound(context);
            }
            index--;
        }
        if(direction == 'outbound'){
            if(middleware.outbound){
                context = await middleware.outbound(context);
            }
            index++;
        }
        return this.middlewareProcesser(context,index,direction);
    }

    public async outbound(context:TypedRPCContext):Promise<TypedRPCContext>{
        if(this.middlewares.length <= 0){
            return context;
        }
        return this.middlewareProcesser(context,0,'outbound');
    }

    public async inbound(context:TypedRPCContext):Promise<TypedRPCContext>{
        if(this.middlewares.length <= 0){
            return context;
        }
        return this.middlewareProcesser(context,this.middlewares.length - 1,'inbound');
    }

    public async request(connection:TypedRPCConnection,request:TypedRPCRequestPacket):Promise<TypedRPCPacket>{
        let context:TypedRPCContext = {
            connection:connection,
            outbound:request,
        }
        context = await this.outbound(context);
        if(!context.outbound){
            throw new Error("Request failed: outbound is empty");
        }
        const res = await connection.request(JSON.stringify(context.outbound));
        if(!res){
            throw new Error("Response is empty");
        }
        let responseObject:any | null = null;
        try{
            responseObject = JSON.parse(res);
        }catch(e){
            throw new Error("Response is not a valid JSON string:"+res);
        }
        if(!TypedRPCPacketFactory.isPacket(responseObject)){
            throw new Error("Response is not a TypedRPCPacket");
        }
        if(!TypedRPCPacketFactory.isResponsePacket(responseObject)){
            throw new Error("Response is not a TypedRPCResponsePacket");
        }
        context.inbound = responseObject;
        context = await this.inbound(context);
        if(!context.inbound){
            throw new Error("Request failed: inbound is empty");
        }
        return context.inbound;
    }

    public async handle(connection:TypedRPCConnection,request:TypedRPCRequestPacket,response:(packet:TypedRPCResponsePacket) => void){
        let context:TypedRPCContext = {
            connection:connection,
            inbound:request,
        }
        context = await this.inbound(context);
        if(!context.outbound){
            return null
        }
        context = await this.outbound(context);
        if(!context.outbound 
        || !TypedRPCPacketFactory.isResponsePacket(context.outbound)){
            return null;
        }
        response(context.outbound);
    }

    hook(serviceName:string,methodName:string,config:{
        handler:(...args:any[])=>any,
        bind?:any,
    }){
        if(!this.hooks[serviceName]){
            this.hooks[serviceName] = {};
        }
        this.hooks[serviceName]![methodName] = {
            handler:config.handler,
            bind:config.bind,
        };
    }

    
}

export {
    TypedRPCHandler,
    TypedRPCHandlerMiddleware
}