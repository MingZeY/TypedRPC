import { IdMaker, TypedEmitter } from '../utils.js';
import { TypedRPCConnection, TypedRPCConnectionProvider } from './basic.js';

type TypedRPCConnectionSocketPayload = {
    type: 'request' | 'response',
    id: string,
    data: string,
}

type TypedRPCConnectionMessageEvents = {
    receive: (data: string) => void,
}
class TypedRPCConnectionSocket extends TypedRPCConnection {
    public msgEmitter = new TypedEmitter<TypedRPCConnectionMessageEvents>();
    private currentId = 1;
    private requests: Map<string, {
        resolve: (data: string) => void
    }> = new Map();

    constructor(private socket: {
        id: string,
        send: (data: string) => void;
        close: () => boolean;
        isClosed: () => boolean;
    }) {
        super();
        // 处理外部请求
        this.msgEmitter.on('receive', (data) => {
            const recivePayload: TypedRPCConnectionSocketPayload = JSON.parse(data);
            if (recivePayload.type == 'request'
                && recivePayload.id
            ) {
                this.emitter.emit('request', {// 告知TypedRPCHandler有新请求
                    data: recivePayload.data,
                    response: (data) => {
                        const sendPayload: TypedRPCConnectionSocketPayload = {
                            type: 'response',
                            id: recivePayload.id,
                            data: data,
                        }
                        this.socket.send(JSON.stringify(sendPayload));
                    }
                })
            } else if (recivePayload.type == 'response'
                && recivePayload.id
            ) {
                this.requests.get(recivePayload.id)?.resolve(recivePayload.data);
            }
        })
    }

    async request(data: string,timeout?:number): Promise<string> {
        const requestId = `${this.currentId++}`;
        const payload: TypedRPCConnectionSocketPayload = {
            type: 'request',
            id: requestId,
            data: data,
        }

        // 超时处理
        let cleanTimeout:Function = () => {};
        return new Promise<string>((resolve,reject) => {
            this.requests.set(requestId, {
                resolve: resolve
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

class TypedRPCConnectionProviderSocket extends TypedRPCConnectionProvider {

    private server: import('net').Server | undefined;
    private sockets: Set<import('net').Socket> = new Set();

    async listen(config: { port: number; hostname?: string; }): Promise<boolean> {
        const net = await import('net').catch(() => null);
        if(!net){
            throw new Error("net module not found");
        }
        const server = net.createServer((socket) => {
            this.sockets.add(socket);
            const connection = new TypedRPCConnectionSocket({
                id: IdMaker.makeId(),
                send: (data) => {
                    const buffer = Buffer.from(data);
                    const length = Buffer.alloc(4);
                    length.writeUInt32BE(buffer.length, 0);
                    socket.write(length);
                    socket.write(buffer);
                },
                close: () => {
                    socket.end();
                    return true;
                },
                isClosed: () => {
                    return socket.destroyed;
                },
            })
            this.emitter.emit('connection', connection);

            let buffer = Buffer.alloc(0);
            let expectedLength: number | null = null;
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
                while (buffer.length >= 4) {
                    if (expectedLength === null) {
                        // 读取消息长度
                        expectedLength = buffer.readUInt32BE(0);
                        buffer = Buffer.from(buffer.subarray(4));
                    }

                    if (buffer.length >= expectedLength) {
                        // 读取完整消息
                        const message = buffer.subarray(0, expectedLength).toString();
                        buffer = Buffer.from(buffer.subarray(expectedLength));
                        expectedLength = null;

                        // 处理消息
                        connection.msgEmitter.emit('receive', message);
                    } else {
                        break;
                    }
                }
            });
            socket.on('end', () => {
                connection.close();
            })
            socket.on('close', () => {
                this.sockets.delete(socket);
            })
        })
        this.server = server;
        return new Promise((resolve) => {
            server.listen(config.port, config.hostname, () => {
                resolve(true);
            });
        })
    }


    async close(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (!this.server) {
                return resolve(true);
            }
            // 关闭服务器，停止所有连接
            this.server.close(() => {
                resolve(true);
            });
            this.server = undefined;
            // 关闭所有已建立的连接
            for (const socket of this.sockets) {
                socket.end();
            }
            this.sockets.clear();
        })
    }



    connect(target: string): Promise<TypedRPCConnection> {
        return new Promise<TypedRPCConnection>(async (resolve, reject) => {
            const net = await import('net').catch(() => null);
            if(!net){
                reject(new Error("net module not found"));
                return;
            }
            const socket = new net.Socket();
            const [host, port] = target.split(':');
            if (!host || !port
                || !Number.isInteger(Number(port))
            ) {
                reject(new Error('target format error'));
                return;
            }
            const connection = new TypedRPCConnectionSocket({
                id: IdMaker.makeId(),
                send: (data) => {
                    const buffer = Buffer.from(data);
                    const length = Buffer.alloc(4);
                    length.writeUInt32BE(buffer.length, 0);
                    socket.write(length);
                    socket.write(buffer);
                },
                close: () => {
                    socket.end();
                    return true;
                },
                isClosed: () => {
                    return socket.destroyed;
                }
            })
            this.emitter.emit('connection', connection);
            socket.on('connect', () => {
                resolve(connection);
            })
            let buffer = Buffer.alloc(0);
            let expectedLength: number | null = null;
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
                while (buffer.length >= 4) {
                    if (expectedLength === null) {
                        // 读取消息长度
                        expectedLength = buffer.readUInt32BE(0);
                        buffer = Buffer.from(buffer.subarray(4));
                    }

                    if (buffer.length >= expectedLength) {
                        // 读取完整消息
                        const message = buffer.subarray(0, expectedLength).toString();
                        buffer = Buffer.from(buffer.subarray(expectedLength));
                        expectedLength = null;

                        // 处理消息
                        connection.msgEmitter.emit('receive', message);
                    } else {
                        break;
                    }
                }
            });
            socket.on('close', () => {
                connection.close();
            })
            socket.connect(Number(port), host);
        })
    }

}

export {
    TypedRPCConnectionSocket,
    TypedRPCConnectionProviderSocket,
}