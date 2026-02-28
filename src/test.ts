import type { TestCase } from './test/TestCase.js';

const testList = [
    import('./test/basic.js'),
    import('./test/context.js'),
    import('./test/socketio.js'),
    import('./test/authorization.js'),
    import('./test/expressmix.js'),
    import('./test/socket.js'),
]

async function main() {
    for(let i of testList){
        let exp = await i;
        let test = new (exp.default)() as TestCase;
        let result = await test.run().catch((e) => {
            console.log(`Test:${test.name()} failed. ${e}`);
            throw e;
        })
        await test.finally();
        if(result){
            console.log(`\x1b[32m[PASS]\x1b[0m ${test.name()}`);
        }else{
            console.log(`\x1b[31m[FAIL]\x1b[0m ${test.name()}`);
        }

    }
}

main().then(() => {
    console.log('TypedRPC test finished.');
}).catch((e) => {
    console.log(`TypedRPC test failed. ${e}`);
    throw e;
})