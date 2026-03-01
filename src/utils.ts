import type { TypedRPCAPIDefine } from "./define.js";
import type { TypedRPCRequestPacket, TypedRPCResponsePacket } from "./packet.js";

export type FunctionTypeToPromiseFunctionType<T extends (...args: any[]) => any> = 
    T extends (...args: infer P) => Promise<infer R> ? 
        (...args: P) => Promise<R | undefined>
    : T extends (...args: infer P) => infer R ? 
        (...args: P) => Promise<R | undefined>
    : never
;

export type TypedRPCDefineToTypedRPCAPI<T extends TypedRPCAPIDefine<any>> = T extends TypedRPCAPIDefine<infer U> ? 
    {
        [S in keyof U]:{
            [M in keyof U[S]]:{
                /** 调用该方法 */
                call:FunctionTypeToPromiseFunctionType<U[S][M]>,
                /** 获取方法id */
                request:(config:{
                    args:Parameters<U[S][M]>,
                    timeout?:number,
                    callback?:(result:ReturnType<U[S][M]>,req:TypedRPCRequestPacket,res:TypedRPCResponsePacket) => void,
                    error?:(error:any,req:TypedRPCRequestPacket,res:TypedRPCResponsePacket) => void,
                }) => string,
                id:string,
                /** 获取方法路径 */
                path:string,
            }
        }
    }
: never;

export type TypedRPCDefineServiceName<T extends TypedRPCAPIDefine<any>> = T extends TypedRPCAPIDefine<infer U> ? keyof U & string : never;
export type TypedRPCDefineMethodName<T extends TypedRPCAPIDefine<any>,S extends TypedRPCDefineServiceName<T>> = T extends TypedRPCAPIDefine<infer U> ? keyof U[S] & string: never;
export type TypedRPCDefineMethodBody<T extends TypedRPCAPIDefine<any>,S extends TypedRPCDefineServiceName<T>,M extends TypedRPCDefineMethodName<T,S>> = T extends TypedRPCAPIDefine<infer U> ? U[S][M] : never;
export type TypedRPCDefineServiceInstance<T extends TypedRPCAPIDefine<any>,S extends TypedRPCDefineServiceName<T>> = T extends TypedRPCAPIDefine<infer U> ? U[S] : never;


export type TypedEmitterEvents = {
    [key:string]:(...args:any[]) => void
}

export class TypedEmitter<T extends TypedEmitterEvents> {

    private record:Map<keyof T,Set<T[keyof T]>> = new Map();

    on<K extends keyof T>(event:K,callback:T[K]){
        if(!this.record.has(event)){
            this.record.set(event,new Set());
        }
        this.record.get(event)!.add(callback);
        return () => {
            this.off(event,callback);
        }
    }

    off<K extends keyof T>(event:K,callback:T[K]){
        if(!this.record.has(event)){
            return;
        }
        this.record.get(event)!.delete(callback);
    }

    emit<K extends keyof T>(event:K,...args:Parameters<T[K]>){
        if(!this.record.has(event)){
            return;
        }
        for(const callback of this.record.get(event)!){
            callback(...args);
        }
    }

    once<K extends keyof T>(event:K,callback:T[K]){
        const wrapper = (...args:Parameters<T[K]>) => {
            callback(...args);
            this.off(event,wrapper as T[K]);
        }
        this.on(event,wrapper as T[K]);
    }
}

export class IdMaker{

    public static instance = new IdMaker();

    static makeId():string{
        return IdMaker.instance.makeId();
    }

    public makeId():string{
        // 生成12位随机字符串
        const suffix = Math.random().toString(36).substring(2,10);
        const timestamp = Date.now().toString(36);
        return `${timestamp}${suffix}`;
    }
}

export class PromiseTimeout<T>{

  private promise:Promise<T>;
  private reject?: (reason?: any) => void;
  private timer?:ReturnType<typeof setTimeout>;
  
  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void
  ){
    this.promise = new Promise<T>((resolve,reject) => {
      this.reject = reject;
      executor(resolve,reject);
    }).finally(() => {
      if(this.timer){
        clearTimeout(this.timer)
      }
    })
  }

  public timeout(time:number){
    if(time <= 0){
      clearTimeout(this.timer);
      return this;
    }
    if(this.timer){
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.reject?.(new Error(`Promise timed out after ${time}ms`));
    },time)
    return this;
  }

  get catch(){
    return this.promise.catch.bind(this.promise);
  }
  
  get finally(){
    return this.promise.finally.bind(this.promise);
  }

  get then(){
    return this.promise.then.bind(this.promise);
  }
}

// export class PromiseTimeout<T> extends Promise<T> {
//   private timer: ReturnType<typeof setTimeout> | null = null;
//   private rejectFn: ((reason?: any) => void) | null = null;

//   constructor(
//     executor: (
//       resolve: (value: T | PromiseLike<T>) => void,
//       reject: (reason?: any) => void
//     ) => void
//   ) {
//     let internalReject: (reason?: any) => void;
    
//     // 调用父类构造函数
//     super((resolve, reject) => {
//       internalReject = reject;
//       executor(resolve, reject);
//     });

//     this.rejectFn = internalReject!;
//   }

//   /**
//    * 设置超时时间
//    * @param ms 毫秒数
//    * @returns 返回实例支持链式调用
//    */
//   timeout(ms: number): this {
//     if (this.timer) {
//       clearTimeout(this.timer);
//     }

//     this.timer = setTimeout(() => {
//       if (this.rejectFn) {
//         this.rejectFn(new Error(`Promise timed out after ${ms}ms`));
//       }
//     }, ms);

//     // 无论成功或失败，都要清除定时器，防止内存泄漏
//     this.finally(() => {
//       if (this.timer) {
//         clearTimeout(this.timer);
//       }
//     });

//     return this;
//   }

//   // 必须重写 Symbol.species 以确保 then/catch 返回的是原生 Promise 
//   // 否则链式调用可能会因为构造函数参数不匹配而报错
//   static get [Symbol.species]() {
//     return Promise;
//   }
// }