
import { IdMaker } from "../utils.js";
import { TypedRPCConnection, TypedRPCConnectionProvider } from "./basic.js";


/** 基于http的connection和provider */
class TypedRPCConnectionHTTP extends TypedRPCConnection{

    private id:string;
    private closed:boolean = false;

    constructor(private config:{
        side:'client'|'server',
        target?:string,
    }){
        super();
        this.id = this.makeId();
    }

    private makeId(){
        return IdMaker.makeId();
    }

    async request(data: string): Promise<string> {
        if(this.config.side == 'server'){
            throw new Error("The server connection cannot send RPC requests because the current connection is not bidirectional");
        }
        if(!this.config.target){
            throw new Error("Client connection must have target");
        }
        // 发起请求
        const response = await fetch(`http://${this.config.target}`,{
            method:'POST',
            body:data,
            headers:{
                // 必须指定typedrpc为1，否则服务器会认为这是一个普通的POST请求
                typedrpc:'1',
            }
        }).then((res) => {
            return res.text();
        })
        return response;
    }

    getId(): string {
        return this.id;
    }

    close(): boolean {
        this.closed = true;
        return true;// http connection 关闭时，直接返回true
    }

    isClosed(): boolean {
        return this.closed;
    }
    
}

type TypedRPCConnectionProviderHTTPServer = import('http').Server;

type TypedRPCConnectionProviderHTTPConfig = {
    server?:TypedRPCConnectionProviderHTTPServer,
}

type TypedRPCConnectionProviderHTTPMiddleware = (req:any,res:any) => void;

class TypedRPCConnectionProviderHTTP extends TypedRPCConnectionProvider{

    public config:TypedRPCConnectionProviderHTTPConfig;
    public server:TypedRPCConnectionProviderHTTPServer | null = null;
    private middlewares:TypedRPCConnectionProviderHTTPMiddleware[] = [];

    constructor(config?:TypedRPCConnectionProviderHTTPConfig){
        super();
        const defaultConfig:TypedRPCConnectionProviderHTTPConfig = {
            
        }
        this.config = {...defaultConfig,...config};
        this.server = this.config.server || null;
        if(this.server){
            this.initServer(this.server);
        }
    }

    public use(middleware:TypedRPCConnectionProviderHTTPMiddleware){
        this.middlewares.push(middleware);
    }

    private initServer(server:TypedRPCConnectionProviderHTTPServer){
        server.on('request',(req,res) => {
            // 如果请求是不是POST，直接忽略
            // 如果请求头没有typedrpc=1，直接忽略
            if(req.method !== 'POST'
            || req.headers['typedrpc'] !== '1'
            ){
                // 调用中间件
                this.middlewares.forEach((middleware) => {
                    middleware(req,res);
                })
                return;
            }

            let data = '';
            req.on('data',(chunk) => {
                data += chunk.toString();
            })
            req.on('end',() => {
                // 创建一个connection
                const connection = new TypedRPCConnectionHTTP({
                    side:'server',
                });
                this.emitter.emit('connection',connection);
                connection.emitter.emit('request',{
                    data:data,
                    response:(data) => {
                        res.end(data);
                        connection.close();
                    }
                })
            })
        })
    }

    private async createServer():Promise<TypedRPCConnectionProviderHTTPServer>{
        const httpSupport = await import("http").catch(() => null);
        if(!httpSupport){
            throw new Error("http module not found");
        }
        return httpSupport.default.createServer();
    }

    async listen(config:{
        port:number,
        host?:string,
    }): Promise<boolean> {
        if(!this.server){
            this.server = await this.createServer();
            this.initServer(this.server);
        }
        
        return new Promise<boolean>((resolve) => {
            if(!this.server){
                throw new Error("Listen before server created");
            }
            this.server.listen({
                port:config.port,
                host:config.host,
            },() => {
                resolve(true);
            });
        })

    }
    
    close(): Promise<boolean> {
        return new Promise<boolean>((resolve,reject) => {
            if(!this.server){
                return true;
            }
            this.server.close((err) => {
                if(err){
                    reject(err);
                }
                resolve(true);
            })
            this.server = null;
        })
    }

    async connect(target: string): Promise<TypedRPCConnectionHTTP> {
        const connection = new TypedRPCConnectionHTTP({
            side:'client',
            target,
        });
        this.emitter.emit('connection',connection);
        return connection;
    }
}

export {
    TypedRPCConnectionHTTP,
    TypedRPCConnectionProviderHTTP,
}