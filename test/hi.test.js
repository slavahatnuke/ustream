const { expect } = require('chai');

const {
  describe, it
} = require('mocha');

const rewire = require('rewire');
const hiModule = require('../src/hi');

const sinon = require('sinon');

describe('hi', () => {
  it('should hi', () => {
    const { hi } = hiModule;
    expect(hi()).equal('hi');
  });

  it('should rewire / hi', () => {
    const module = rewire('../src/hi');

    module.__set__({
      hello: () => 'hey'
    });

    const { hi } = module;
    expect(hi()).equal('hey');
  });

  it('should rewire / hi / sinoned', () => {
    const module = rewire('../src/hi');

    const hello = sinon.fake.returns('fake-hello');
    module.__set__({ hello });

    const { hi } = module;
    expect(hi()).equal('fake-hello');

    sinon.assert.calledOnce(hello);
    sinon.assert.calledWith(hello);
  });
});
