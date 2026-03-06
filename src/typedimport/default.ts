

export type TypedImport_http_Server = typeof import('http')['Server']
export type TypedImport_http = {
    Server:TypedImport_http_Server,
    default:{
        createServer:() => InstanceType<TypedImport_http_Server>
    }
};

type TypedImport_net_Server = typeof import('net')['Server'];
type TypedImport_net_Socket = typeof import('net')['Socket'];
type TypedImport_net = {
    Server:TypedImport_net_Server,
    Socket:TypedImport_net_Socket,
    createServer:(callback:(socket:InstanceType<TypedImport_net_Socket>) => void) => InstanceType<TypedImport_net_Server>,
}

type TypedImport_socketio_Server = typeof import('socket.io')['Server']
type TypedImport_socketio = {
    Server:TypedImport_socketio_Server,
    ServerOptions:import("socket.io").ServerOptions,
}

type TypedImport_socketioclient = {
    ManagerOptions:import('socket.io-client').ManagerOptions,
    SocketOptions:import("socket.io-client").SocketOptions,
    io:typeof import('socket.io-client')['io'],
}

export type TypedImportLib = {
    "http":TypedImport_http,
    "net":TypedImport_net,
    "socket.io":TypedImport_socketio,
    "socket.io-client":TypedImport_socketioclient,
}



export function importTyped<T extends keyof TypedImportLib>(name:T){
    return import(/* @vite-ignore */ name) as Promise<TypedImportLib[T]>
}