const {FakeSource, Transformer, Writer, WaitEnd, WaitPromise} = require('.');
const stream = FakeSource(10)
  .pipe(Transformer(async (i) => {
    await WaitPromise(100)
    return i + 100
  }))
  .pipe(Writer(async (result) => console.log(result)));

WaitEnd(stream)
  .then(() => console.log('done'))
