import { TestCase } from "./TestCase.js";
import { TypedRPCAPIDefine, TypedRPCClient, TypedRPCConnectionProviderSocket, TypedRPCServer } from "../index.js";

const ServerAPIDefine = new TypedRPCAPIDefine<{
    math: {
        add: (a: number, b: number) => number,
    }
}>

const ClientAPIDefine = new TypedRPCAPIDefine<{
    status: {
        time: () => number,
    }
}>

const server = new TypedRPCServer({
    local: ServerAPIDefine,
    remote: ClientAPIDefine,
    connection: {
        provider: new TypedRPCConnectionProviderSocket(),
    }
})

server.hook('math', 'add', {
    handler: (a, b) => {
        return a + b;
    }
})

const client = new TypedRPCClient({
    local: ClientAPIDefine,
    remote: ServerAPIDefine,
    connection: {
        provider: new TypedRPCConnectionProviderSocket(),
    }
})

client.hook('status', 'time', {
    handler: () => {
        return Date.now();
    }
})


class TestSocket extends TestCase {
    name(): string {
        return 'Socket';
    }
    async run(): Promise<boolean> {
        let requestToServer: Promise<boolean>;
        let requestToClient: Promise<boolean>;

        requestToClient = new Promise<boolean>((resolve) => {
            server.emitter.on('connection', async (connectionToClient) => {
                const apiToClient = server.getAPI(connectionToClient);
                const result = await apiToClient.status.time.call();
                if (result != null) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
        })

        await server.listen({
            port: 3698,
        })

        requestToServer = new Promise<boolean>(async (resolve) => {
            const connectionToServer = await client.connect("localhost:3698");
            const apiToServer = client.getAPI(connectionToServer);
            const result = await apiToServer.math.add.call(1, 2);
            if (result == 3) {
                resolve(true);
            } else {
                resolve(false);
            }
        })

        const resultToClient = await requestToClient;
        const resultToServer = await requestToServer;
        return resultToClient && resultToServer;
    }
    public async finally(): Promise<void> {
        await server.close();
    }

}

export default TestSocket;