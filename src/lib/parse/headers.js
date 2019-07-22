"use strict"
//@flow

export type HeaderDef = {
    name: string,
    value: string,
    type?: string,
    required?: boolean,
};
type Match = {
    groups: MatchGroups
};

type MatchGroups = {
    required: string,
    value: string,
    type: string
};

const regExp = /`?(?<value>[^`]*?)`?\s*\((?<type>[^,]*),?\s?(?<required>.*)\)/;
const parseHeaderValue = (rawHeader: HeaderDef): HeaderDef => {
    // $FlowFixMe - flow does not support match group names
    let match: ?Match = regExp.exec(rawHeader.value);
    if (match) {
        let required: boolean;
        switch (match.groups.required) {
            case 'required':
            case '':
                required = true;
                break;
            case 'optional':
                required = false;
                break;
            default:
                throw new Error(`For header "${rawHeader.name}", unrecognized optionality: "${match.groups.required}"`);
        }
        return {
            name: rawHeader.name,
            value: match.groups.value,
            type: match.groups.type,
            required: required,
        };
    }

    return {
        name: rawHeader.name,
        value: rawHeader.value,
        required: true,
    };
};

module.exports = {
    parseHeaderValue,
};
