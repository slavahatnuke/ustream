const WaitPromise = (timeout) => {
  const defer = Defer();
  const timer = setTimeout(() => defer.resolve(), timeout);

  defer.cancel = () => timer && clearTimeout(timer);

  defer
    .then(() => defer.cancel())
    .catch(() => defer.cancel());

  return defer
};


const Defer = () => {
  const deferred = {
    promise: null,

    reject: null,
    resolve: null,

    rejected: undefined,
    resolved: undefined,
  };

  deferred.promise = new Promise((innerResolve, innerReject) => {
    deferred.resolve = innerResolve;
    deferred.reject = innerReject;
  });

  deferred.promise.resolve = (data) => {
    deferred.resolve(data);
    deferred.resolved = true;
    deferred.promise.resolve = () => data;
  };

  deferred.promise.reject = (error) => {
    deferred.reject(error);
    deferred.rejected = true;

    deferred.promise.reject = (error) => error;
  };

  deferred.promise.isResolved = () => deferred.resolved;
  deferred.promise.isRejected = () => deferred.rejected;

  return deferred.promise;
};


class PromiseBalanceClass {
  constructor() {
    this.counter = 0;
    this.promise = null;
  }

  increment(value = 1) {
    this.counter += value;
    this._notify();
  }

  decrement(value = 1) {
    this.increment(-value);
  }

  toPromise() {
    if (!this.promise) {
      this.promise = Defer();
    }

    this._notify();

    return this.promise;
  }

  getCounter() {
    return this.counter;
  }

  _notify() {
    if (this.promise && this.counter <= 0) {
      this.promise.resolve();
    }
  }
}

const PromiseBalance = () => new PromiseBalanceClass();

const PromiseAllSerial = function (promiseFunctions) {
  if (!Array.isArray(promiseFunctions)) {
    return Promise.reject(new TypeError('promise.series only accepts an array of functions'))
  }

  return promiseFunctions
    .reduce((currentPromise, nextFunction) => {
      return currentPromise.then(nextFunction)
    }, Promise.resolve())
};

module.exports = {
  WaitPromise,
  Defer,
  PromiseBalance,
  PromiseAllSerial
};