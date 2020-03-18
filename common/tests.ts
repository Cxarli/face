// Testing
function test_1() {
    let c = 0;

    const foo = (a: number, b: number = 10): number => {
        if (b !== 10) throw new Error("_1 FAILED");
        c += a;
        return a + b;
    };

    let success = true;

    try { c = 0;

        // has to throw
        [1, 2, 3].map(foo);

        success = false;
    } catch (e) { }

    try { c = 0;
        [1, 2, 3].map(foo._1);

        if (c !== 6) success = false;
    } catch (e) { success = false; }

    try { c = 0;
        [1, 2, 3].map(x => foo(x));

        if (c !== 6) success = false;
    } catch (e) { success = false; }

    try { c = 0;
        const add = (a: any, b: any) => a + b;

        [1, 2, 3].map(foo._1).reduce(add, 0)
    } catch (e) { success = false; }

    try {
        // typescript actually doesn't allow this, so cast to <any> first
        (<any> foo._1)(1, 2, 3);
    } catch (e) { success = false; }

    console.log("tests OK? " + success);
}


{
    function bar(a: number, b: number): number;
    function bar(a: string, b: string): string;

    function bar(a: number|string, b: number|string): number|string {
        return 10;
    }

    let test: string = bar("a", "b");
}
