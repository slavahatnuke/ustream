# ustream
`ustream` is `async-await` stream lib

### Example
```javascript
const {FakeSource, Transformer, Writer, WaitEnd, WaitPromise} = require('ustream');
const stream = FakeSource(10)
  .pipe(Transformer(async (i) => {
    await WaitPromise(100)
    return i + 100
  }))
  .pipe(Writer(async (result) => console.log(result)));

WaitEnd(stream)
  .then(() => console.log('done'))
```

### All
```
  Transformer,
  ParallelTransformer,
  BatchTransformer,

  Writer,
  BatchWriter,
  ParallelWriter,

  FakeSource,
  WaitStream,
  ArrayStream,
  CounterStream,

  Write,
  WaitEnd,
  CloseStream,

  Reader,

  WaitPromise,
  Defer
```

