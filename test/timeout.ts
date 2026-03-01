import { TypedRPCClient, TypedRPCConnectionProviderSocket } from "../src/index.js";
import { TypedRPCAPIDefine } from "../src/index.js";
import { TypedRPCServer } from "../src/index.js";
import { TestCase } from "./TestCase.js";

const ServerAPIDefine = new TypedRPCAPIDefine<{
    users:{
        list():Promise<string[]>,
    },
}>({
    services:{
        users:{
            methods:{
                list:{
                    /** define timeout 100ms for this method */
                    timeout:100,
                }
            }
        }
    }
});

const server = new TypedRPCServer({
    local:ServerAPIDefine,
    connection:{
        provider:new TypedRPCConnectionProviderSocket(),
    }
});

server.hook('users','list',{
    handler:async ()=>{
        await new Promise(resolve=>{
            // assume this method will take 1s to complete,it should timeout
            setTimeout(resolve,1000);
        })
        return ['user1','user2','user3'];
    },
});

const client = new TypedRPCClient({
    remote:ServerAPIDefine,
    connection:{
        provider:new TypedRPCConnectionProviderSocket()
    }
});

export default class TestTimeout extends TestCase{
    name(): string {
        return 'Timeout';
    }
    async run(): Promise<boolean> {
        await server.listen({
            port:3698,
        })
        const connection = await client.connect("localhost:3698");
        const api = client.getAPI(connection);
        try{
            const result = await api.users.list.call();
            this.asert({
                handler:() => false,
                desc:`Should throw timeout error, but got result:${result}`,
                throw:false,
            })
            return false;
        }catch(error){
            this.asert({
                handler: () => String(error).includes("timed out"),
                desc:`Should throw timeout error,but got [${error}]`,
                throw:false
            })
            return true;
        }
    }

    public async finally(): Promise<void> {
        await server.close();
    }
}
