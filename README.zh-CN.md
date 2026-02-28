# TypedRPC

基于 TypeScript 的 RPC 框架，支持多种连接类型，包括 HTTP、Socket 和 SocketIO。

## 特性

- **类型安全的 RPC 调用** - 利用 TypeScript 的类型系统实现端到端的类型安全
- **多种连接类型** - 支持 HTTP、Socket 和 SocketIO 连接，或自定义`TypedRPCConnectionProvider`
- **中间件支持** - 可扩展的中间件系统，用于请求/响应处理
- **上下文感知** - 内置上下文系统，用于在处理程序之间传递数据
- **双向通信** - 支持客户端和服务器之间的双向 RPC 调用，能力取决于连接类型
- **易于使用** - 用于定义服务和方法的简单 API

## 安装

```bash
npm install typedrpc
```

## 基本使用

### 服务器设置

```typescript
import { TypedRPCServer, TypedRPCAPIDefine } from 'typedrpc';

// 定义 API 接口
const ServerAPIDefine = new TypedRPCAPIDefine<{
  // 服务层 - 在此处定义服务或使用接口继承
    math:{
      // 方法层 - 在此处定义方法
        add(a:number,b:number):number,
    },
}>();

// 创建服务器实例
const server = new TypedRPCServer({
    // 让 TypeScript 从 ServerAPIDefine 推断类型
    local:ServerAPIDefine,
    // 连接层 - 在此处使用TypedRPCConnectionProvider的实现类
    // connection:{
    //     provider:new TypedRPCConnectionProviderHTTP(),
    // }
});

// 挂钩服务方法
server.hook('math','add',{
    handler:(a,b)=>a+b,
});

// 开始监听
server.listen({
    port:3698,
})
```

### 客户端设置

```typescript
import { TypedRPCClient, TypedRPCAPIDefine } from 'typedrpc';
// 重用或导入相同的 API 定义
const ServerAPIDefine = new TypedRPCAPIDefine<{
  math:{
      add(a:number,b:number):number,
  },
}>();

// 创建客户端实例
const client = new TypedRPCClient({
    // 让 TypeScript 从 ServerAPIDefine 推断类型
    remote:ServerAPIDefine,
});

// 连接到服务器
const connection = await client.connect("localhost:3698");

// 获取 API 实例
const api = client.getAPI(connection);

// 进行 RPC 调用
const result = await api.math.add.call(1,2); // 返回 3
```

## 连接类型

TypedRPC 支持多种连接类型：

1. **HTTP** - RESTful HTTP API
2. **Socket** - 原始套接字连接
3. **SocketIO** - Socket.IO 连接
4. **自定义** - 用户定义的连接提供者，参见抽象类 `TypedRPCConnectionProvider`

```typescript
new TypedRPCServer({
    local:ServerAPIDefine,
    connection:{
        provider:new TypedRPCConnectionProviderHTTP(),
        // provider:new TypedRPCConnectionProviderSocket(),
        // provider:new TypedRPCConnectionProviderSocketIO(),
        // provider:实现您自己的TypedRPCConnectionProvider的子类
    }
})
```

## API 文档

### 服务器 API

- `new TypedRPCServer(config)` - 创建新的服务器实例
- `server.hook(serviceName, methodName, config)` - 挂钩单个方法
- `server.hookService(serviceName, instance)` - 挂钩整个服务
- `server.use(middleware)` - 添加中间件
- `server.listen()` - 开始监听连接
- `server.close()` - 关闭服务器

### 客户端 API

- `new TypedRPCClient(config)` - 创建新的客户端实例
- `client.connect()` - 连接到服务器
- `client.getAPI(connection)` - 获取连接的 API 实例
- `client.use(middleware)` - 添加中间件

## 中间件使用

TypedRPC 支持服务器和客户端的中间件：

```typescript
class MyMiddleware extends TypedRPCHandlerMiddleware{

    async inbound(context: TypedRPCContext): Promise<TypedRPCContext> {
      // 处理入站数据包时执行操作
      return context;
    }

    async outbound(context: TypedRPCContext): Promise<TypedRPCContext> {
      // 处理出站数据包时执行操作
      return context;
    }

}
```

## 上下文使用

TypedRPC 提供内置的上下文系统，允许您在服务方法中访问请求上下文。这对于访问连接信息、认证数据或其他请求特定数据特别有用。

### 示例：在服务中使用上下文

```typescript
// 服务器端代码
import { TypedRPCServer, TypedRPCAPIDefine, TypedRPCContextSymbol, type TypedRPCContext, type TypedRPCContextAware } from 'typedrpc';

// 定义服务接口
interface MathServiceInterface {
    add(a: number, b: number):number;
}

// 创建 API 定义
const serverAPIDefine = new TypedRPCAPIDefine<{
    math: MathServiceInterface,
}>();

// 创建服务器实例
const server = new TypedRPCServer({
    local: serverAPIDefine,
});

// 实现具有上下文感知的服务
class MathService implements MathServiceInterface, TypedRPCContextAware {
    // 使用 TypedRPCContextSymbol 注入上下文
    [TypedRPCContextSymbol]: TypedRPCContext | null = null;

    // 为安全起见，必须使用 @TypedRPCAPIDefine.method() 将方法标记为服务使用中的 RPC 方法
    @TypedRPCAPIDefine.method()
    add(a: number, b: number): number {
        // 访问上下文
        const context = this[TypedRPCContextSymbol];
        if (!context) {
            throw new Error('上下文不可用');
        }
        
        // 使用上下文信息（例如，连接详情、认证）
        console.log('请求来自:', context.connection);
        
        return a + b;
    }
}

// 将服务挂钩到服务器，只有标记有 @TypedRPCAPIDefine.method() 的方法会被挂钩
server.hookService('math', new MathService());

// 启动服务器
server.listen({
    port: 3698,
});
```

```typescript
// 客户端代码
import { TypedRPCClient, TypedRPCAPIDefine } from 'typedrpc';

// 重用 API 定义
const serverAPIDefine = new TypedRPCAPIDefine<{
    math: MathServiceInterface,
}>();

// 创建客户端
const client = new TypedRPCClient({
    remote: serverAPIDefine,
});

// 连接并进行 RPC 调用
const connection = await client.connect("localhost:3698");
const api = client.getAPI(connection);
const result = await api.math.add.call(1, 2); // 返回 3
```

## 更多使用

请参阅 `./test/*.ts` 获取更多使用示例。

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT 许可证 - 详情请参阅 [LICENSE](https://github.com/TypedRPC/TypedRPC/blob/main/LICENSE) 文件。