const {WaitPromise, Defer} = require('./promise');

const {Transform, Writable, Readable} = require('stream');

const FakeSource = function (quantity = 1000, generator = (counter) => counter) {
  let counter = 0;

  return Reader(({push, end}) => {
    if (counter >= quantity) {
      end()
    } else {
      return Promise.resolve()
        .then(() => generator(counter++))
        .then((result) => push(result));
    }
  })
};

class WriterStream extends Writable {
  constructor(writer = null, config) {
    config = Object.assign({
      objectMode: true,
      decodeStrings: false,
      highWaterMark: 0
    }, config || {});

    super(config);

    this.writer = writer || ((data) => Promise.resolve(data));
  }

  _write(message, encoding, callback) {
    return Promise.resolve()
      .then(() => this.writer(message))
      .then((result) => callback(null, result))
      .catch((error) => callback(error))
  }

  _writev(chunks, callback) {
    Promise.resolve()
      .then(() => chunks.map(({chunk}) => chunk))
      .then((chunks) => {
        return Promise.all(chunks.map((chunk) => {
          return new Promise((resolve, reject) => {
            this._write(chunk, 'utf8', (error) => error ? reject(error) : resolve())
          })
        }))
      })
      .then(() => callback())
      .catch((error) => callback(error));
  }

}

const Writer = (fn = null, config = {}) => new WriterStream(fn, config);

const Write = (stream, message) => {
  return new Promise((resolve, reject) => {
    return Promise.resolve()
      .then(() => {
        stream.write(message, 'utf8', (error) => error ? reject(error) : resolve());
      })
      .catch((error) => reject(error))
  })
};

const Transformer = function (transformer = null, config = {}) {
  transformer = transformer || ((data) => Promise.resolve(data))

  const defaults = {
    objectMode: true,
    decodeStrings: true,
    highWaterMark: 0,
  };

  const tools = {SKIP: Transformer.SKIP};

  const transformation = {
    transform(message, encoding, callback) {
      Promise.resolve()
        .then(() => transformer(message, tools))
        .then((data) => {
          if (data === Transformer.SKIP) {
            callback();
          } else {
            callback(null, data)
          }
        })
        .catch((error) => callback(error));
    }
  };

  return new Transform(Object.assign(defaults, config, transformation));
};

Transformer.SKIP = Symbol('SKIP');

const WaitStream = (timeout = 0) => Transformer((message) => {
  return Promise.resolve()
    .then(() => WaitPromise(timeout))
    .then(() => message)
});

const WaitEnd = (stream) => {
  const defer = Defer();

  let resolved = false;
  let rejected = false;

  const resolver = () => {
    if (!resolved) {
      defer.resolve();
      resolved = true;
    }
  };

  const rejector = (error) => {
    if (!rejected) {
      defer.reject(error);
      rejected = true;
    }
  };

  Promise.resolve()
    .then(() => {
      stream.once('end', resolver);
      stream.once('finish', resolver);

      stream.once('error', rejector);
    })
    .catch(rejector);

  return defer;
};

const ArrayStream = (array) => {
  let index = 0;
  return Reader(({push, end}) => {
    if (index < array.length) {
      push(array[index++])
    } else {
      end()
    }
  })
};


const COUNTER_NULL_SYMBOL = Symbol('COUNTER_NULL_SYMBOL');

const CounterStream = () => {
  let data = COUNTER_NULL_SYMBOL;
  let counter = 1;
  let first = true;

  const counterStream = new Transform({

    objectMode: true,
    decodeStrings: false,
    highWaterMark: 0,

    transform(chunk, encoding, callback) {
      if (data === COUNTER_NULL_SYMBOL) {
        data = chunk;
        return callback();
      } else {
        this.push({data, counter, last: false, first});
        first = false;

        counter++;
        data = chunk;

        return callback();
      }
    },
  });

  counterStream._flush = function (callback) {
    if (data === COUNTER_NULL_SYMBOL) {
      return callback();
    } else {
      this.push({data, counter, last: true, first});
      return callback();
    }
  };

  return counterStream;
};

const BatchTransformer = (transformer = null, config = {}) => {
  config = Object.assign({
    timeout: 100,
    batch: 1,
  }, config);

  const batchSize = config.batch || 1;

  transformer = transformer || ((data) => Promise.resolve(data));

  let batch = [];
  let pushingPromise = null;

  function resolvePushingPromise() {
    if (pushingPromise) {
      pushingPromise.resolve()
    }
  }

  let pushTimer = null;

  function resetPushTimer() {
    if (pushTimer) {
      clearTimeout(pushTimer)
    }
  }

  let pushBatch = function () {
    const transformBatch = batch;
    batch = [];

    return Promise.resolve()
      .then(() => pushingPromise)
      .then(() => {
        pushingPromise = Defer();

        if (transformBatch.length) {
          return transformer(transformBatch, {SKIP: BatchTransformer.SKIP})
        } else {
          return null;
        }
      })
      .then((results) => {
        if (Array.isArray(results)) {
          results
            .filter((result) => result !== BatchTransformer.SKIP)
            .map((result) => this.push(result))
        }
      })
      .then(() => resolvePushingPromise())
      .catch((error) => {
        resolvePushingPromise();
        return Promise.reject(error);
      })
  };

  const transformOptions = Object.assign({
    objectMode: true,
    decodeStrings: false,

    highWaterMark: batchSize,

    transform(message, encoding, callback) {
      Promise.resolve()
        .then(() => pushingPromise)
        .then(() => {
          batch.push(message);

          if (batch.length >= batchSize) {
            resetPushTimer();
            return pushBatch.call(this);
          }

          resetPushTimer();

          if (config.timeout) {
            pushTimer = setTimeout(() => {
              pushBatch.call(this)
                .catch((error) => this.emit('error', error));
            }, config.timeout)
          }
        })
        .then(() => callback())
        .catch((error) => callback(error));
    }
  }, config || {});

  const batchStream = new Transform(transformOptions);

  function execute(callback = null) {
    callback = callback || ((error) => error && Promise.reject(error));

    return Promise.resolve()
      .then(() => {
        resetPushTimer();

        if (batch.length) {
          return pushBatch.call(this)
        }
      })
      .then(() => callback())
      .catch((error) => callback(error))
  }

  batchStream._flush = function (callback) {
    execute.call(this, callback);
  };

  batchStream.execute = function (callback) {
    return execute.call(this, callback);
  };

  return batchStream;
};

BatchTransformer.SKIP = Symbol('SKIP');


const ParallelTransformer = (concurrency = 1, transformer = null, config = {}) => {
  transformer = transformer || ((data) => Promise.resolve(data));

  return BatchTransformer((batch) => {
    return Promise.all(batch.map((data) => {
      return Promise.resolve()
        .then(() => transformer(data, {SKIP: ParallelTransformer.SKIP}))
    }))
  }, Object.assign({
    batch: concurrency
  }, config))
};

ParallelTransformer.SKIP = BatchTransformer.SKIP;

const BatchWriter = (fn = null, config = {}) => {
  const transformer = BatchTransformer(fn, config);

  transformer
    .pipe(Writer());

  return transformer;
};

const ParallelWriter = (concurrency, fn = null, config = {}) => {
  const transformer = ParallelTransformer(concurrency, fn, config);

  transformer
    .pipe(Writer());

  return transformer;
};

function CloseStream(stream) {
  stream.emit('end');
  stream.emit('close');
}

class ReaderStream extends Readable {
  constructor(reader = null, config) {

    super(Object.assign({
      objectMode: true,
      decodeStrings: false,
      highWaterMark: 0
    }, config || {}));

    this.reader = reader || (({push, end, size, batch}) => null);

    this.consumerBuffer = [];
    this.consumerEnded = false;
  }

  getBufferLength() {
    return this.consumerBuffer.length;
  }

  resetBuffer() {
    this.consumerBuffer = [];
  }

  _read(size) {
    const hasBufferToConsume = () => {
      return !!this.consumerBuffer.length
    };

    const buffer = (data) => {
      this.consumerBuffer.push(data);
    };

    const bufferArray = (batch) => {
      if (Array.isArray(batch)) {
        this.consumerBuffer = this.consumerBuffer.concat(batch);
      }
    };

    const push = (data) => {
      buffer(data);
      return consume();
    };

    const batch = (batch) => {
      if (Array.isArray(batch)) {
        bufferArray(batch);
        return consume();
      }
    };

    const end = () => {
      this.consumerEnded = true;
      consume();
    };

    const doRead = () => {
      return Promise.resolve()
        .then(() => {
          const tools = {

            // aliases
            push,
            write: push,

            // same as push, expect array and push one by one
            batch,

            // nothing to read
            end,

            // optional usage
            close: () => this.emit('close'),

            size: size,

            // almost same that push and batch but just buffer data
            // and does not push to stream
            buffer,
            bufferArray
          };

          return Promise.resolve()
            .then(() => this.reader(tools))
            .catch((error) => this.emit('error', error));
        })
    };

    const originEnd = () => {
      CloseStream(this);
    };

    const consume = () => {
      return Promise.resolve()
        .then(() => {
          if (hasBufferToConsume()) {
            return this.push(this.consumerBuffer.shift())
          } else {
            if (this.consumerEnded) {
              return originEnd();
            }

            return doRead();
          }
        })
    };

    consume();

  }
}

const Reader = (fn = null, options = {}) => new ReaderStream(fn, options);

module.exports = {
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
};
