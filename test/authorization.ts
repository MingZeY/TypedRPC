import { TypedRPCClient } from "../src/index.js";
import type { TypedRPCContext } from "../src/index.js";
import { TypedRPCAPIDefine } from "../src/index.js";
import { TypedRPCHandlerMiddleware } from "../src/index.js";
import { TypedRPCPacketFactory } from "../src/index.js";
import { TypedRPCServer } from "../src/index.js";
import { TestCase } from "./TestCase.js";

interface MathServiceInterface{
    add:(a:number,b:number) => number,
}

interface AuthServiceInterface{
    login:(username:string,password:string) => string
}

const ServerAPIDefine = new TypedRPCAPIDefine<{
    math:MathServiceInterface,
    auth:AuthServiceInterface,
}>()

class MathService implements MathServiceInterface{
    @TypedRPCAPIDefine.method()
    add(a: number, b: number): number {
        return a+b;
    }
}

class AuthService implements AuthServiceInterface{

    private authUsers = new Map<string,string>();

    @TypedRPCAPIDefine.method()
    login(username: string, password: string): string {
        if(username === 'admin' && password === '123456'){
            const token = Math.random().toString(36).substring(2);
            this.authUsers.set(username,token);
            return token;
        }
        return '';
    }

    checkToken(username:string,token:string):boolean{
        return this.authUsers.get(username) === token;
    }
}

class AuthMiddleware extends TypedRPCHandlerMiddleware{

    private username?:string;
    private token?:string;
    
    constructor(
        private auth?:AuthService
    ){
        super();
    }

    /**
     * 对外站进入的请求包进行验证
     */
    async inbound(context: TypedRPCContext): Promise<TypedRPCContext> {
        if(context.inbound){
            if(TypedRPCPacketFactory.isRequestPacket(context.inbound)){
                const protectService = ['math'];
                if(protectService.includes(context.inbound.serviceName)){
                    const unauthorizedPacket = TypedRPCPacketFactory.createResponsePacket({
                        requestId:context.inbound.id,
                        error:"unauthorized",
                    })
                    // 进行验证
                    const username = context.inbound.meta?.username;
                    const token = context.inbound.meta?.token;
                    if(!token || !username){
                        context.outbound = unauthorizedPacket;
                    }else{
                        if(!this.auth || !this.auth.checkToken(username,token)){
                            context.outbound = unauthorizedPacket;
                        }
                    }
                    
                }
            }
            // 如果入站的是响应包，判断出站是否是登录包
            if(TypedRPCPacketFactory.isResponsePacket(context.inbound)
            && TypedRPCPacketFactory.isRequestPacket(context.outbound)
            && context.outbound.serviceName == 'auth'
            && context.outbound.methodName == 'login'
            ){
                const username = context.outbound.args?.[0] as string;
                const token = context.inbound.result as string;
                this.token = token;
                this.username = username;
            }
        }
        return context;
    }

    async outbound(context: TypedRPCContext): Promise<TypedRPCContext> {
        if(context.outbound){
            if(TypedRPCPacketFactory.isRequestPacket(context.outbound)){
                // 如果有token，附带token
                if(this.token){
                    context.outbound.meta = {
                        username:this.username,
                        token:this.token,
                    }
                }
            }
        }
        return context;
    }

}

class ServerApp{
    private math = new MathService();
    private auth = new AuthService();
    private server = new TypedRPCServer({
        local:ServerAPIDefine,
    })

    constructor(){
        this.server.use(new AuthMiddleware(this.auth));
        this.server.hookService('math',this.math);
        this.server.hookService('auth',this.auth);
    }

    async start(){
        return this.server.listen({
            port:3698,
        })
    }

    async stop(){
        return this.server.close();
    }
}

const serverApp = new ServerApp();


class TestAuthorization extends TestCase{
    name(): string {
        return 'Authorization';
    }
    async run(): Promise<boolean> {
        await serverApp.start();

        const client = new TypedRPCClient({
            remote:ServerAPIDefine,
        })
        client.use(new AuthMiddleware());
        const connection = await client.connect('localhost:3698');
        const api = client.getAPI(connection);

        // 未登录调用
        const unauthorizedResult = await new Promise((resolve) => {
            api.math.add.request({
                args:[1,2],
                callback(result,req,res) {
                    resolve(result);
                },
                error(error,req,res) {
                    resolve(error);
                },
            })
        })
        if(unauthorizedResult != 'unauthorized'){
            console.log('Unauthorized call result should be "unauthorized"');
            return false;
        }

        // 进行登录
        const token = await api.auth.login.call('admin','123456');
        if(!token){
            console.log('Login failed');
            return false;
        }

        // 重新请求
        const authorizedResult = await api.math.add.call(1,2);
        if(authorizedResult != 3){
            console.log('Authorized call result should be 3');
            return false;
        }
        return true;        
    }

    public async finally(): Promise<void> {
        await serverApp.stop();
        return;
    }

}

export default TestAuthorization;