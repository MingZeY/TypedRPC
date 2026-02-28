import { TypedRPCAPIDefine, TypedRPCClient, TypedRPCConnectionProviderHTTP, TypedRPCServer } from "../index.js";
import http from 'http';
import express from 'express';
import { TestCase } from "./TestCase.js";

const ServerAPIDefine = new TypedRPCAPIDefine<{
    math:{
        add:(a:number,b:number)=>number,
    },
}>();

const httpServer = http.createServer();
/** 
 * TypedRPCConnectionProviderHTTP 是 TypedRPCConnectionProvider 的默认实现
 * 你也可以自定义实现 TypedRPCConnectionProvider 与 TypedRPCConnection 来支持其他协议
 * 例如基于IPC协议的连接、基于Websocket协议的连接、基于udp协议的连接
 * */


const provider = new TypedRPCConnectionProviderHTTP({
    server:httpServer,
})

const server = new TypedRPCServer({
    local:ServerAPIDefine,
    connection:{
        provider:provider,
    }
})
server.hook('math','add',{
    handler:(a,b)=>a+b,
})


const app = express();
app.use("/test",(req,res) => {
    res.end("hello world");
})
/**
 * 通过provider注入express中间件
 * provider会将无法识别的请求转发到express中间件
 */
provider.use(app)



const client = new TypedRPCClient({
    remote:ServerAPIDefine,
})

export default class TextExpressMix extends TestCase{
    name(): string {
        return "ExpressMix";
    }
    async run(): Promise<boolean> {
        await server.listen({
            port:3698
        });
        await new Promise(resolve => setTimeout(resolve,100));

        // RPC测试
        const connection = await client.connect("localhost:3698");
        const result = await client.getAPI(connection).math.add.call(1,2);
        if(result !== 3){
            throw new Error("RPC request result should be 3");
        }

        // express测试
        const response = await fetch("http://localhost:3698/test");
        const text = await response.text();
        if(text !== "hello world"){
            throw new Error("Express request result should be 'hello world'");
        }
        return true;
    }

    public async finally(): Promise<void> {
        await server.close();
    }
    
}