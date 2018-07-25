var assert = require ('assert');
var sinon = require('sinon');
var tv4 = require('tv4');
var logger = require('../../lib/logger');
var specSchema = require('../../lib/spec-schema');

afterEach(function() {
    sinon.restore();
});

var schema =  {
    type: 'object',
    required: ['id'],
    properties: {
        id: {type: 'number'},
        title: {type: 'string' }
    }
};

describe('Spec Schema', function() {

    describe('hasSchema', function() {
        it('Should return true when the spec object has a schema property', function () {
            assert.equal(specSchema.hasSchema({schema: {}}), true);
        });

        it('Should return false when the spec object has a schema property', function () {
            assert.equal(specSchema.hasSchema({}), false);
        });
    });

    describe('matchWithSchema', function() {
        var valid = {id: 1};
        var invalid = {
            valid: false,
            errors: [{
                dataPath: 'Do',
                message: 'you feel lucky, punk?'
            }]
        };

        var validateMultiple;
        var logSpy;

        beforeEach(function() {
            validateMultiple = sinon.stub(tv4, 'validateMultiple');
            validateMultiple.withArgs(valid, schema).returns({valid: true});
            validateMultiple.returns(invalid);

            logSpy = sinon.spy(logger, 'log');
        });

        describe('when the body matches the schema', function() {

            it('Should return a valid response', function () {
                assert.deepEqual(specSchema.matchWithSchema({id: 1}, schema), {valid: true});
            });
        });

        describe('when the body does not match schema', function() {
            var expected = Object.assign({niceErrors: ['Do you feel lucky, punk?']}, invalid);
            it('Should return false when json is not validated against schema and log ERROR', function () {
                assert.deepEqual(specSchema.matchWithSchema({idea: 1}, schema), expected);

                assert.ok(logSpy.calledWithExactly('ERROR'.red, ['Do you feel lucky, punk?']), 'Incorrect logging');
            });
        });
    });

    describe ('validateAndParseSchema', function() {
        it('Should parse and validate schema', function () {
            var spec = specSchema.validateAndParseSchema({schema: JSON.stringify(schema)});
            assert.deepEqual(spec.schema, schema);
        });

        it('Should throw error when spec schema is not a valid JSON Schema V4 Schema', function () {
            assert.throws(function(){
                specSchema.validateAndParseSchema({schema: JSON.stringify({type: 'passionfruit'})});
            }, Error);
        });
    });

});
