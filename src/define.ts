
type TypedRPCAPIDefineType = Record<string, Record<string, any>>

type TypedRPCDefineConfig = {

    

}

class TypedRPCAPIDefine<T extends TypedRPCAPIDefineType> {

    static TypedRPCService = Symbol('TypedRPCService');
    static TypedRPCMethod = Symbol('TypedRPCMethod');
    static TypedRPCMethodList = Symbol('TypedRPCMethodList');

    constructor(config?:TypedRPCAPIDefineType){
        
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
}


export type {
    TypedRPCAPIDefineType,
}

export {
    TypedRPCAPIDefine,
}