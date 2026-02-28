import { TypedRPCClient } from "../index.js";
import { TypedRPCContextSymbol, type TypedRPCContext, type TypedRPCContextAware } from "../index.js";
import { TypedRPCAPIDefine } from "../index.js";
import { TypedRPCServer } from "../index.js";
import { TestCase } from "./TestCase.js";

interface MathServiceInterface{
    add(a:number,b:number):number,
}

const serverAPIDefine = new TypedRPCAPIDefine<{
    math:MathServiceInterface,
}>();

const server = new TypedRPCServer({
    local:serverAPIDefine,
});

class MathService implements MathServiceInterface, TypedRPCContextAware{

    /** 通过 TypedRPCContextAware 接口，将上下文注入到服务中，允许在方法内访问RPC调用时的上下文 */
    [TypedRPCContextSymbol]: TypedRPCContext | null = null;

    /** 使用hookService时，必须声明为TypedRPC方法，否则不予注册为hook，避免外部非法调用方法*/
    @TypedRPCAPIDefine.method()
    add(a: number, b: number): number {
        const context = this[TypedRPCContextSymbol]!;
        if(!context){
            throw new Error('context is null');
        }
        return a+b;
    }
}

server.hookService('math',new MathService());

const client = new TypedRPCClient({
    remote:serverAPIDefine,
});




export default class TestBasic extends TestCase{
    name(): string {
        return 'Context';
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
