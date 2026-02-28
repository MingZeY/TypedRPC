import type { TypedRPCAPIDefine, TypedRPCAPIDefineType } from "./define.js";
import type { TypedRPCRequestPacket, TypedRPCResponsePacket } from "./packet.js";
import type { TypedRPCDefineToTypedRPCAPI } from "./utils.js";


class TypedRPCAPI<T extends TypedRPCAPIDefine<TypedRPCAPIDefineType>>{
    constructor(){
        
    }

    interface(callback:(context:{
        serviceName:string,methodName:string,args:any[]
    }) => Promise<{
        request:TypedRPCRequestPacket,
        response:TypedRPCResponsePacket,
    }>):TypedRPCDefineToTypedRPCAPI<T>{
        return new Proxy({}, {
            get(target, serviceName, receiver) {
                if (typeof serviceName !== 'string') {
                    return Reflect.get(target, serviceName, receiver);
                }
                return new Proxy({}, {
                    get(target, methodName, receiver) {
                        if (typeof methodName !== 'string') {
                            return Reflect.get(target, methodName, receiver);
                        }
                        
                        const path = `${serviceName}.${methodName}`;
                        const id = `${serviceName}.${methodName}`;
                        
                        return {
                            call: async (...args: any[]) => {
                                const result = await callback({
                                    serviceName:serviceName,
                                    methodName:methodName,
                                    args:args,
                                });
                                if(result.response.error){
                                    throw result.response.error;
                                }
                                return result.response.result;
                            },
                            request:async (config:{
                                args?:any[],
                                callback?:(result:any,req:TypedRPCRequestPacket,res:TypedRPCResponsePacket) => void,
                                error?:(error:any,req:TypedRPCRequestPacket,res:TypedRPCResponsePacket) => void,
                            }) => {
                                const result = await callback({
                                    serviceName:serviceName,
                                    methodName:methodName,
                                    args:config.args || [],
                                });
                                if(result.response.error){
                                    config.error?.(result.response.error,result.request,result.response);
                                }else{
                                    config.callback?.(result.response.result,result.request,result.response);
                                }
                            },
                            id,
                            path
                        };
                    }
                });
            }
        }) as TypedRPCDefineToTypedRPCAPI<T>;
    }
}


export {
    TypedRPCAPI
}