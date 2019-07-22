"use strict"
//@flow

import type {HeaderDef} from "../../../lib/parse/headers";

const assert = require('assert');
const headers = require('../../../lib/parse/headers');

describe('parseHeaderValue', () => {
    describe('GIVEN a value that does not contain a pair of parenthesis', () => {
        const rawHeader: HeaderDef = {
            name: 'name',
            value: 'not parse-able)',
        };
        const expected: HeaderDef = {
            name: 'name',
            value: 'not parse-able)',
            required: true,
        };

        it('THEN it returns the value with required true', () => {
            assert.deepEqual(headers.parseHeaderValue(rawHeader), expected);
        });
    });

    describe('GIVEN a value that has a type and optionality is left out', () => {
        const rawHeader: HeaderDef = {
            name: 'name',
            value: 'value (type)',
        };

        const expected: HeaderDef = {
            name: 'name',
            value: 'value',
            type: 'type',
            required: true
        };

        it('THEN it returns the value parsed with required defaulting to true', () => {
            assert.deepEqual(headers.parseHeaderValue(rawHeader), expected);
        });
    });

    describe('GIVEN a value that has a type and optionality is `optional`', () => {
        const rawHeader: HeaderDef = {
            name: 'name',
            value: 'value (type, optional)',
        };

        const expected: HeaderDef = {
            name: 'name',
            value: 'value',
            type: 'type',
            required: false
        };

        it('THEN it returns the value parsed with required=false', () => {
            assert.deepEqual(headers.parseHeaderValue(rawHeader), expected);
        });
    });

    describe('GIVEN a value that has a type and optionality is not `optional` or `required`', () => {
        const rawHeader: HeaderDef = {
            name: 'name',
            value: 'value (type, some other value)',
        };

        it('THEN it throws', () => {
            assert.throws(() => headers.parseHeaderValue(rawHeader), /For header "name", unrecognized optionality: "some other value"/);
        });
    });

    describe('GIVEN value in back ticks', () => {
        const rawHeader: HeaderDef = {
            name: 'name',
            value: '`some value` (type)',
        };
        const expected: HeaderDef = {
            name: 'name',
            value: 'some value',
            type: 'type',
            required: true
        };

        it('THEN it returns only value without the back ticks', () => {
            assert.deepEqual(headers.parseHeaderValue(rawHeader), expected);
        });
    });

    describe('GIVEN value with trailing whitespace', () => {
        const rawHeader: HeaderDef = {
            name: 'name',
            value: 'some value          (type)',
        };
        const expected: HeaderDef = {
            name: 'name',
            value: 'some value',
            type: 'type',
            required: true
        };

        it('THEN it returns trimmed value', () => {
            assert.deepEqual(headers.parseHeaderValue(rawHeader), expected);
        });
    });
});
