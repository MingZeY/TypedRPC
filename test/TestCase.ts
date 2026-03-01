export abstract class TestCase{
    abstract name():string;
    abstract run():Promise<boolean>;
    public async finally():Promise<void>{};
}

