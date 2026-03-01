import { TypedRPCAPI } from "./api.js";
import type { TypedRPCConnection, TypedRPCConnectionProvider } from "./connections/basic.js";
import { TypedRPCConnectionProviderDefault } from "./connection.js";
import { TypedRPCCore } from "./core.js";
import { TypedRPCAPIDefine } from "./define.js";

import { TypedEmitter, type TypedRPCDefineMethodBody, type TypedRPCDefineMethodName, type TypedRPCDefineServiceInstance, type TypedRPCDefineServiceName, type TypedRPCDefineToTypedRPCAPI } from "./utils.js";

type TypedRPCClientConfig<T extends TypedRPCAPIDefine<any>,R extends TypedRPCAPIDefine<any>> = {
    local?:T,
    remote?:R,
    connection?:{
        provider:TypedRPCConnectionProvider,
    }
}

type TypedRPCClientEvents = {
    // connection:(connection:TypedRPCConnection)=>void,
}

class TypedRPCClient<T extends TypedRPCAPIDefine<any>,R extends TypedRPCAPIDefine<any>> {

    public emitter = new TypedEmitter<TypedRPCClientEvents>();
    private config:TypedRPCClientConfig<T,R>;
    public core:TypedRPCCore;

    constructor(config?:TypedRPCClientConfig<T,R>){
        const defaultConfig:TypedRPCClientConfig<T,R> = {
            connection:{
                provider:new TypedRPCConnectionProviderDefault(),
            }
        }
        this.config = {...defaultConfig,...config};
        this.core = new TypedRPCCore(this.config);
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

    get connect(){
        return this.core.connect.bind(this.core);
    }

    getAPI(connection:TypedRPCConnection):TypedRPCDefineToTypedRPCAPI<R>{
        const api = new TypedRPCAPI<R>();
        return api.interface(async (context) => {
            const methodConfig = this.config.remote?.resolveMethodConfig(context.serviceName,context.methodName);
            return await this.core.request({
                connection,
                serviceName:context.serviceName,
                methodName:context.methodName,
                args:context.args,
                timeout:methodConfig?.timeout,
            })
        })
    }
}

export {
    TypedRPCClient,
}
