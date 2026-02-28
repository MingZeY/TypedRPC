import type { TypedRPCConnection, TypedRPCConnectionProvider } from "./connecitons/basic.js"
import { TypedRPCConnectionProviderDefault } from "./connection.js"
import { TypedRPCHandler } from "./handler.js"
import { TypedRPCPacketFactory, type TypedRPCRequestPacket, type TypedRPCResponsePacket } from "./packet.js"
import { TypedEmitter } from "./utils.js"

type TypedRPCCoreConfig = {
    connection?:{
        provider:TypedRPCConnectionProvider,
    }
}

type TypedRPCCoreEvents = {
    connection:(connection:TypedRPCConnection)=>void,
}

class TypedRPCCore{

    public emitter = new TypedEmitter<TypedRPCCoreEvents>();
    private config:TypedRPCCoreConfig;
    public handler:TypedRPCHandler;

    constructor(config:TypedRPCCoreConfig){
        const defaultConfig:TypedRPCCoreConfig = {
            connection:{
                provider:new TypedRPCConnectionProviderDefault(),
            }
        }
        this.config = {...defaultConfig,...config};
        this.handler = new TypedRPCHandler();
        this.init();
    }

    private init(){
        const provider = this.config.connection?.provider;
        if(provider){
            provider.emitter.on('connection',(connection) => {
                this.emitter.emit('connection',connection);
            })
        }
        this.emitter.on('connection',(connection) => {
            // 提供对向请求处理
            connection.emitter.on('request',(context) => {
                try{
                    const requestPacket = JSON.parse(context.data);
                    if(!TypedRPCPacketFactory.isRequestPacket(requestPacket)){
                        return;
                    }
                    this.handler.handle(connection,requestPacket,(responsePacket) => {
                        if(!responsePacket){
                            return;
                        }
                        context.response(JSON.stringify(responsePacket));
                    });
                }catch(e){
                    console.error(e);
                }
            })
        })
    }

    get hook(){
        return this.handler.hook.bind(this.handler);
    }

    public async request(config:{
        connection:TypedRPCConnection,
        serviceName:string,
        methodName:string,
        args:any[],
    }):Promise<{
        request:TypedRPCRequestPacket,
        response:TypedRPCResponsePacket,
    }>{
        const requestPacket = TypedRPCPacketFactory.createRequestPacket({
            serviceName:config.serviceName,
            methodName:config.methodName,
            args:config.args,
        })
        const responsePacket = await this.handler.request(config.connection,requestPacket).catch((e) => {
            return TypedRPCPacketFactory.createResponsePacket({
                requestId:requestPacket.id,
                error:e
            })
        });
        if(!TypedRPCPacketFactory.isResponsePacket(responsePacket)){
            throw new Error(`Invalid response packet:\n${JSON.stringify(responsePacket)}`);
        }
        if(responsePacket.requestId != requestPacket.id){
            throw new Error(`Invalid response packet:request id not match\n${JSON.stringify(requestPacket)}\n${JSON.stringify(responsePacket)}`);
        }
        return {
            request:requestPacket,
            response:responsePacket,
        }
    }

    public async listen(config:{
        port:number,
        hostname?:string,
    }):Promise<boolean>{
        const provider = this.config.connection?.provider;
        if(!provider){
            throw new Error("Connection provider not found");
        }
        return provider.listen(config);
    }

    public async close():Promise<boolean>{
        const provider = this.config.connection?.provider;
        if(!provider){
            throw new Error("Connection provider not found");
        }
        return provider.close();
    }

    public async connect(target: string):Promise<TypedRPCConnection>{
        const provider = this.config.connection?.provider;
        if(!provider){
            throw new Error("Connection provider not found");
        }
        const connection = await provider.connect(target);
        return connection;
    }

}

export {
    TypedRPCCore
}