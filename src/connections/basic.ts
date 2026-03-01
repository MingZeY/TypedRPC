import { TypedEmitter } from "../utils.js";

type TypedRPCConnectionEvents = {
    /** 有新的请求进入时，应该由Provider调起 */
    request:(context:{
        data:string,
        response:(data:string) => void,
    }) => void;
}

abstract class TypedRPCConnection{
    public emitter = new TypedEmitter<TypedRPCConnectionEvents>();
    /** 发起一个请求并获得返回结果 */
    abstract request(data:string,timeout?:number):Promise<string>;
    /** 获取连接的id */
    abstract getId():string;
    /** 关闭连接 */
    abstract close():boolean;
    /** 是否关闭 */
    abstract isClosed():boolean;
}

type TypedRPCConnectionProviderEvents = {
    /** 新的连接建立时 */
    connection:(connection:TypedRPCConnection) => void,
}
abstract class TypedRPCConnectionProvider{
    public emitter = new TypedEmitter<TypedRPCConnectionProviderEvents>();
    /**
     * Server用，用于监听一个端口
     */
    abstract listen(config:{
        port:number,
        hostname?:string,
    }):Promise<boolean>;

    /**
     * Server用，用于关闭监听的端口
     */
    abstract close():Promise<boolean>;

    /**
     * Client用，用于建立一个连接
     */
    abstract connect(target:string):Promise<TypedRPCConnection>;
}

export {
    TypedRPCConnection,
    TypedRPCConnectionProvider,
}