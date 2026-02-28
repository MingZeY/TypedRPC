
import { TypedRPCAPI } from "./api.js";
import type { TypedRPCConnection, TypedRPCConnectionProvider } from "./connecitons/basic.js";
import { TypedRPCCore } from "./core.js";
import { TypedRPCAPIDefine } from "./define.js";
import { TypedEmitter, type TypedRPCDefineMethodBody, type TypedRPCDefineMethodName, type TypedRPCDefineServiceInstance, type TypedRPCDefineServiceName, type TypedRPCDefineToTypedRPCAPI } from "./utils.js";

type TypedRPCServerConfig<T extends TypedRPCAPIDefine<any>,R extends TypedRPCAPIDefine<any>> = {
    local?:T,
    remote?:R,
    connection?:{
        provider:TypedRPCConnectionProvider,
    }
}

type TypedRPCServerEvents = {
    connection:(connection:TypedRPCConnection)=>void,
}

class TypedRPCServer<T extends TypedRPCAPIDefine<any>,R extends TypedRPCAPIDefine<any>> {

    public emitter = new TypedEmitter<TypedRPCServerEvents>();
    private config:TypedRPCServerConfig<T,R>;
    public core:TypedRPCCore;

    constructor(config?:TypedRPCServerConfig<T,R>){
        const defaultConfig:TypedRPCServerConfig<T,R> = {
            
        }
        this.config = {...defaultConfig,...config};
        this.core = new TypedRPCCore(this.config);
        this.core.emitter.on('connection',(connection) => {
            this.emitter.emit('connection',connection);
        })
    }

    hook<S extends TypedRPCDefineServiceName<T>,M extends TypedRPCDefineMethodName<T,S>>(serviceName:S,methodName:M,config:{
        handler:TypedRPCDefineMethodBody<T,S,M>,
        bind?:any,
    }){
        return this.core.hook(serviceName,methodName,config);
    }

    hookService<S extends TypedRPCDefineServiceName<T>>(serviceName:S,instance:TypedRPCDefineServiceInstance<T,S>){
        const methodList = TypedRPCAPIDefine.getMethodList(instance);
        for(let methodName of methodList){
            this.hook(serviceName,methodName as TypedRPCDefineMethodName<T,S>,{
                handler:instance[methodName],
                bind:instance,
            })
        }
    }

    get use(){
        return this.core.handler.use.bind(this.core.handler);
    }

    get listen(){
        return this.core.listen.bind(this.core);
    }

    get close(){
        return this.core.close.bind(this.core);
    }

    getAPI(connection:TypedRPCConnection):TypedRPCDefineToTypedRPCAPI<R>{
        const api = new TypedRPCAPI<R>();
        return api.interface(async (context) => {
            return await this.core.request({
                connection,
                serviceName:context.serviceName,
                methodName:context.methodName,
                args:context.args,
            })
        })
    }

}

export {
    TypedRPCServer,
}