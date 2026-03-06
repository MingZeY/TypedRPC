import { importTyped, type TypedImportLib } from "../typedimport/default.js";
import { IdMaker, TypedEmitter } from "../utils.js";
import { TypedRPCConnection, TypedRPCConnectionProvider } from "./basic.js";



type TypedRPCConnectionSocketIOPayload = {
    type:'request' | 'response';
    id:string;
    data:string;
}
type TypedRPCConnectionMessageEvents = {
    receive:(data:string) => void;
}
class TypedRPCConnectionSocketIO extends TypedRPCConnection{
    public msgEmitter = new TypedEmitter<TypedRPCConnectionMessageEvents>();
    
    private currentId = 1;

    private requests:Map<string,{
        resolve:(data:string) => void
    }> = new Map();

    constructor(private socket:{
        id:string,
        send:(data:string) => void;
        close:() => boolean;
        isClosed:() => boolean;
    }){
        super();

        // 处理外部请求
        this.msgEmitter.on('receive',(data) => {
            // console.log(`[${this.socket.id}][R]:${data}`);
            const recivePayload:TypedRPCConnectionSocketIOPayload = JSON.parse(data);
            if(recivePayload.type == 'request'
            && recivePayload.id
            ){
                this.emitter.emit('request',{// 告知TypedRPCHandler有新请求
                    data:recivePayload.data,
                    response:(data) => {
                        const sendPayload:TypedRPCConnectionSocketIOPayload = {
                            type:'response',
                            id:recivePayload.id,
                            data:data,
                        }
                        this.socket.send(JSON.stringify(sendPayload));
                    }
                })
            }else if(recivePayload.type == 'response'
            && recivePayload.id
            ){
                this.requests.get(recivePayload.id)?.resolve(recivePayload.data);
            }
        })
    }

    async request(data: string, timeout?: number): Promise<string> {
        const requestId = `${this.currentId++}`;
        const payload:TypedRPCConnectionSocketIOPayload = {
            type:'request',
            id:requestId,
            data:data,
        }

        let cleanTimeout:Function = () => {};
        const requestPromise = new Promise<string>((resolve,reject) => {
            this.requests.set(requestId,{
                resolve:resolve
            })

            // 发送数据
            this.socket.send(JSON.stringify(payload));
            
            // 超时处理
            if(timeout){
                const timeoutHandle = setTimeout(() => {
                    reject(new Error(`request timeout after ${timeout}ms`));
                }, timeout);
                cleanTimeout = () => {
                    clearTimeout(timeoutHandle);
                }
            }
        }).finally(() => {
            this.requests.delete(requestId);
            cleanTimeout();
        })
        return await requestPromise;
    }

    getId(): string {
        return this.socket.id;
    }
    close(): boolean {
        return this.socket.close();
    }

    isClosed(): boolean {
        return this.socket.isClosed();
    }
    
}

type TypedRPCConnectionSocketIOConfig = {
    type:"client"|"server",
    server?:InstanceType<TypedImportLib['http']['Server']> | undefined;
    io?:InstanceType<TypedImportLib['socket.io']['Server']> | undefined;
    options?:{
        server?:Partial<TypedImportLib['socket.io']['ServerOptions']> | undefined,
        client?:Partial<TypedImportLib['socket.io-client']['ManagerOptions'] & TypedImportLib['socket.io-client']['SocketOptions']> | undefined
    }
}

class TypedRPCConnectionProviderSocketIO extends TypedRPCConnectionProvider{

    private closed = false;
    private config:Promise<TypedRPCConnectionSocketIOConfig>;

    static createServer(config?:{
        server?:InstanceType<TypedImportLib['http']['Server']>,
        io?:InstanceType<TypedImportLib['socket.io']['Server']>,
        options?:Partial<TypedImportLib['socket.io']['ServerOptions']>,
    }){
        return new TypedRPCConnectionProviderSocketIO({
            type:'server',
            server:config?.server,
            io:config?.io,
            options:{
                server:config?.options,
            }
        })
    }

    static createClient(config?:{
        options?:Partial<TypedImportLib['socket.io-client']['ManagerOptions'] & TypedImportLib['socket.io-client']['SocketOptions']>,
    }){
        return new TypedRPCConnectionProviderSocketIO({
            type:'client',
            options:{
                client:config?.options,
            }
        })
    }
    
    constructor(config:TypedRPCConnectionSocketIOConfig){
        super();
        if(config.type == 'server'){
            this.config = this.buildServer(config);
        }else if(config.type == 'client'){
            this.config = this.buildClient(config);
        }else{
            throw new Error('TypedRPCConnectionProviderSocketIO constructor only support server or client type.');
        }
    }

    private async buildClient(config:TypedRPCConnectionSocketIOConfig):Promise<TypedRPCConnectionSocketIOConfig>{
        if(config.type != 'client'){
            throw new Error('TypedRPCConnectionProviderSocketIO buildClient only support client type.');
        }
        return config;
    }
    

    private async buildServer(config:TypedRPCConnectionSocketIOConfig):Promise<TypedRPCConnectionSocketIOConfig>{
        if(config.type != 'server'){
            throw new Error('TypedRPCConnectionProviderSocketIO buildServer only support server type.');
        }

        if(!config.server){
            const httpSupport = await importTyped("http").catch(() => null);
            if(!httpSupport){
                throw new Error("http module not found");
            }
            config.server = httpSupport.default.createServer();
            if(!config.server){
                throw new Error("http server not found");
            }
        }

        if(!config.io){
            config.io = await importTyped('socket.io').then((socketIOServerModule) => {
                return new socketIOServerModule.Server(config.server,{
                    cors:{
                        origin:"*",
                        methods:["GET","POST"],
                    },
                    ...config.options?.server,
                });
            })
            if(!config.io){
                throw new Error("socket.io server not found");
            }
        }

        config.io.on('connection',(socket) => {
            const connection = new TypedRPCConnectionSocketIO({
                id:socket.id,
                send:(data) => {
                    socket.emit('message',data);
                },
                close:() => {
                    socket.disconnect();
                    return true;
                },
                isClosed:() => {
                    return socket.disconnected;
                },
            });
            this.emitter.emit('connection',connection);// 告知TypedRPCHandler有新连接
            socket.on('message',(data:string) => {
                connection.msgEmitter.emit('receive',data);
            })
            socket.on('close',() => {
                connection.close();
            })
        })

        return config;
    }


    async listen(params: { port: number; hostname?: string; }): Promise<boolean> {
        const server = (await this.config).server;
        if(!server){
            throw new Error("http server not found");
        }
        return new Promise<boolean>((resolve) => {
            server.listen(params.port,params.hostname,() => {
                resolve(true);
            })
        })
    }

    async close(): Promise<boolean> {
        const io = (await this.config).io;
        if(!io){
            throw new Error("socket.io server not found");
        }
        return new Promise<boolean>((resolve,reject) => {
            if(!io){
                return resolve(true);
            }
            if(this.closed){
                return resolve(true);
            }
            this.closed = true;
            io.sockets.sockets.forEach((socket) => {
                socket.disconnect();
            })
            io.close((err) => {
                if(err){
                    reject(err);
                }
                resolve(true);
            })
        })
    }

    async connect(target: string): Promise<TypedRPCConnection> {
        // const SocketIOClientModule = await import("socket.io-client").catch(() => null);
        const SocketIOClientModule = await importTyped("socket.io-client").catch(() => null);
        if(!SocketIOClientModule){
            throw new Error("socket.io-client module not found,try to use npm install socket.io-client");
        }
        return new Promise<TypedRPCConnection>(async (resolve,reject) => {
            const socket = SocketIOClientModule.io(`ws://${target}`,{
                ...(await this.config).options?.client,
            });
            const connection = new TypedRPCConnectionSocketIO({
                id:socket.id || IdMaker.makeId(),
                send:(data) => {
                    socket.emit('message',data);
                },
                close:() => {
                    socket.disconnect();
                    return true;
                },
                isClosed:() => {
                    return socket.disconnected;
                },
            });
            this.emitter.emit('connection',connection);// 告知TypedRPCHandler有新连接
            socket.on('connect',() => {
                resolve(connection)
            })
            socket.on('message',(data) => {
                connection.msgEmitter.emit('receive',data);
            })
            socket.on('close',() => {
                connection.close();
            })
        })
    }

}

export {
    TypedRPCConnectionSocketIO,
    TypedRPCConnectionProviderSocketIO,
}