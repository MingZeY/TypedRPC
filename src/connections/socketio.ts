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

class TypedRPCConnectionProviderSocketIO extends TypedRPCConnectionProvider{
    
    private io:import("socket.io").Server | null = null;

    async listen(config: { port: number; hostname?: string; }): Promise<boolean> {
        const httpModule = await import("http").catch(() => null);
        if(!httpModule){
            throw new Error("http module not found");
        }
        const socketIOServerModule = await import("socket.io").catch(() => null);
        if(!socketIOServerModule){
            throw new Error("socket.io module not found");
        }

        const server = httpModule.createServer();


        const io = new socketIOServerModule.Server(server,{
            cors:{
                origin:"*",
                methods:["GET","POST"],
            },
        });
        io.on('connection',(socket) => {
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
            socket.on('message',(data) => {
                connection.msgEmitter.emit('receive',data);
            })
            socket.on('close',() => {
                connection.close();
            })
        })
        this.io = io;
        return new Promise<boolean>((resolve) => {
            server.listen(config.port,config.hostname,() => {
                resolve(true);
            })
        })
    }
    async close(): Promise<boolean> {
        return new Promise<boolean>((resolve,reject) => {
            if(!this.io){
                return resolve(true);
            }
            this.io.sockets.sockets.forEach((socket) => {
                socket.disconnect();
            })
            this.io.close((err) => {
                if(err){
                    reject(err);
                }
                resolve(true);
            })
            this.io = null;
        })
    }

    async connect(target: string): Promise<TypedRPCConnection> {
        const SocketIOClientModule = await import("socket.io-client").catch(() => null);
        if(!SocketIOClientModule){
            throw new Error("socket.io-client module not found");
        }
        return new Promise<TypedRPCConnection>((resolve,reject) => {
            const socket = SocketIOClientModule.io(`ws://${target}`);
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