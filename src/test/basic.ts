import { TypedRPCClient } from "../index.js";
import { TypedRPCAPIDefine } from "../index.js";
import { TypedRPCServer } from "../index.js";
import { TestCase } from "./TestCase.js";

const serverAPIDefine = new TypedRPCAPIDefine<{
    math:{
        add(a:number,b:number):number,
    },
}>();

const server = new TypedRPCServer({
    local:serverAPIDefine,
});

server.hook('math','add',{
    handler:(a,b)=>a+b,
});

const client = new TypedRPCClient({
    remote:serverAPIDefine,
});

export default class TestBasic extends TestCase{
    name(): string {
        return 'Basic';
    }
    async run(): Promise<boolean> {
        await server.listen({
            port:3698,
        })
        const connection = await client.connect("localhost:3698");
        const api = client.getAPI(connection);
        const result = await api.math.add.call(1,2);
        if(result == 3){
            return true;
        }
        return false;
    }

    public async finally(): Promise<void> {
        await server.close();
    }
}
