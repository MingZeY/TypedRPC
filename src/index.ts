import { TypedRPCClient } from './client.js';
import { TypedRPCServer } from './server.js';
import { TypedRPCAPIDefine } from './define.js';
import { TypedRPCConnectionDefault, TypedRPCConnectionProviderDefault } from './connection.js';
import { TypedRPCMiddleware } from './middleware/middleware.js';
import { TypedRPCPacketFactory } from './packet.js';
import { TypedRPCContextSymbol, type TypedRPCContext, type TypedRPCContextAware } from './context.js';
import { TypedRPCConnection, TypedRPCConnectionProvider } from './connections/basic.js';
import { TypedRPCConnectionHTTP, TypedRPCConnectionProviderHTTP } from './connections/http.js';
import { TypedRPCConnectionProviderSocket, TypedRPCConnectionSocket } from './connections/socket.js';
import { TypedRPCConnectionSocketIO } from './connections/socketio.js';
import { TypedRPCConnectionProviderSocketIO } from './connections/socketio.js';

export type {
    TypedRPCContext,
    TypedRPCContextAware,
}

export {
    /** Basic */
    TypedRPCClient,
    TypedRPCServer,
    TypedRPCAPIDefine,
    TypedRPCConnection,
    TypedRPCConnectionProvider,
    TypedRPCMiddleware,
    TypedRPCPacketFactory,
    TypedRPCContextSymbol,

    /** Connections */
    TypedRPCConnectionDefault,
    TypedRPCConnectionProviderDefault,
    TypedRPCConnectionHTTP,
    TypedRPCConnectionProviderHTTP,
    TypedRPCConnectionSocket,
    TypedRPCConnectionProviderSocket,
    TypedRPCConnectionSocketIO,
    TypedRPCConnectionProviderSocketIO,
}
