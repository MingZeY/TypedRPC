import { IdMaker } from "./utils.js";

export interface TypedRPCPacket {
    id:string;
    type:string;
    meta?:{[key:string]:any};// 元数据，用于传递一些额外的信息
}

export interface TypedRPCRequestPacket extends TypedRPCPacket {
    type:'request';
    serviceName:string;
    methodName:string;
    args:any[];
}

export interface TypedRPCResponsePacket extends TypedRPCPacket {
    type:'response';
    requestId:string;
    result?:any;
    error?:any;
}



export class TypedRPCPacketFactory {

    static createID():string{
        return IdMaker.makeId();
    }

    static createRequestPacket(data:{
        serviceName:string,
        methodName:string,
        args:any[]
    }):TypedRPCRequestPacket{
        return {
            id:TypedRPCPacketFactory.createID(),
            type:'request',
            serviceName:data.serviceName,
            methodName:data.methodName,
            args:data.args,
        }
    }

    static createResponsePacket(data:{
        requestId:string,
        result?:any,
        error?:any,
    }):TypedRPCResponsePacket{
        return {
            id:TypedRPCPacketFactory.createID(),
            type:'response',
            requestId:data.requestId,
            result:data.result,
            error:data.error,
        }
    }

    static isPacket(data:any):data is TypedRPCPacket{
        return data && typeof data === 'object' && 'id' in data && 'type' in data;
    }

    static isRequestPacket(data:any):data is TypedRPCRequestPacket{
        if(!TypedRPCPacketFactory.isPacket(data)){
            return false;
        }
        return data.type === 'request';
    }

    static isResponsePacket(data:any):data is TypedRPCResponsePacket{
        if(!TypedRPCPacketFactory.isPacket(data)){
            return false;
        }
        return data.type === 'response';
    }
}

