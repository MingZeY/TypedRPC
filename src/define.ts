
type TypedRPCAPIDefineType = Record<string, Record<string, any>>

type TypedRPCMethodConfig = {
    // timeout for this method
    timeout?:number | undefined;//ms
}

type TypedRPCServiceConfig<T extends TypedRPCAPIDefineType,S extends keyof T> = {
    methods?:{
        [M in keyof T[S]]?:TypedRPCMethodConfig;
    }
    // default timeout for all methods in this service
    timeout?:number | undefined;//ms
}

type TypedRPCDefineConfig<T extends TypedRPCAPIDefineType> = {
    services?:{
        [S in keyof T]?:TypedRPCServiceConfig<T,S>;
    },
    // default timeout for all services
    timeout?:number | undefined;
}

class TypedRPCAPIDefine<T extends TypedRPCAPIDefineType> {

    static TypedRPCService = Symbol('TypedRPCService');
    static TypedRPCMethod = Symbol('TypedRPCMethod');
    static TypedRPCMethodList = Symbol('TypedRPCMethodList');

    private config:TypedRPCDefineConfig<T>;

    constructor(config?:TypedRPCDefineConfig<T>){
        this.config = config || {};
    }

    static method(){
        return  function(target:any, propertyKey:string, descriptor:PropertyDescriptor){
            descriptor.value[TypedRPCAPIDefine.TypedRPCMethod] = true;
            if(!target[TypedRPCAPIDefine.TypedRPCService]){
                target[TypedRPCAPIDefine.TypedRPCService] = true;
            }
            if(!target[TypedRPCAPIDefine.TypedRPCMethodList]){
                target[TypedRPCAPIDefine.TypedRPCMethodList] = new Set<string>();
            }
            target[TypedRPCAPIDefine.TypedRPCMethodList].add(propertyKey);
        }
    }

    static isService(target:any){
        return target[TypedRPCAPIDefine.TypedRPCService] === true;
    }

    static isMethod(method:any){
        // 判断是否是方法
        if(typeof method !== 'function'){
            return false;
        }
        if(method[TypedRPCAPIDefine.TypedRPCMethod] != true){
            return false;
        }
        return true;
    }

    static getMethodList(service:any):string[]{
        if(!TypedRPCAPIDefine.isService(service)){
            return [];
        }
        return Array.from(service[TypedRPCAPIDefine.TypedRPCMethodList]);
    }

    resolveMethodConfig<S extends keyof T,M extends keyof T[S]>(service:S,methodName:M):TypedRPCMethodConfig|undefined{
        const serviceConfig = this.config.services?.[service];
        const methodConfig = serviceConfig?.methods?.[methodName];
        
        return {
            timeout: methodConfig?.timeout || serviceConfig?.timeout || this.config.timeout,
        }
    }
}


export type {
    TypedRPCAPIDefineType,
    TypedRPCDefineConfig,
    TypedRPCServiceConfig,
    TypedRPCMethodConfig,
}

export {
    TypedRPCAPIDefine,
}