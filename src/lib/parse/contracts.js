// @flow 
const fs = require('fs');
const drafter = require('drafter');

const endpointSorter = require('../middleware/endpoint-sorter');
const urlParser = require('./url');
const logger = require('../logger');
const specSchema = require('../spec-schema');
const http = require('./httpFetch');

export type Mappings = { [string]: string }

// any valid JSON-schema
type JsonSchema = any

type ResourceSchemas = {
    request: ?JsonSchema,
    response: ?JsonSchema
};

type Verb = string;
type Url = string;

export type Actions = {
    [Verb]: ResourceSchemas
};

export type Resources = {
    [Url]: Actions
};

export type Contract = {
    fixtureFolder: string,
    resources: Resources
}
export type Body = {
    schema?: string,
    body?: string
};

export type Example = {
    requests: Array<Body>,
    responses: Array<Body>
};

export type BlueprintAction = {
    method: string,
    examples: ?Array<Example>
}

export type SchemaValidationResult = {
    valid: boolean,
    niceErrors: Array<string>
}

export type BlueprintResource = {
    uriTemplate: string,
    actions: Array<BlueprintAction>,
    parameters?: Array<any>
};
export type ResourceGroup = {
    resources: Array<BlueprintResource>
};
export type Blueprint = {
    ast: {
        resourceGroups: Array<ResourceGroup>
    }
};
const readContractFixtureMap = (contractFixtureMapFile: string): Mappings => {
    let contents: string;
    try {
        contents = fs.readFileSync(contractFixtureMapFile, { encoding: 'utf8' });
    } catch (e) {
        const message = `Unable to read contract fixture map file "${contractFixtureMapFile}"`
        throw new Error(message);
    }

    let contractFixtureMap: Mappings;
    try {
        contractFixtureMap = JSON.parse(contents);
    } catch (e) {
        const message = `Unable to parse contract fixture map contents "${contractFixtureMapFile}"
            Cause: ${e}`;
        throw new Error(message);
    }

    return contractFixtureMap;
};

const parseContracts = async (mappings: Mappings): Promise<Array<Contract>> => {
    const contracts: Array<Contract> = [];
    for (const contractFile of Object.keys(mappings)) {

        let data: string
        try {
            if (/^http?s:\/\//.test(contractFile)) {
                data = await http.fetch(contractFile, {
                    headers: {
                        'Authorization': `token ${process.env.GIT_TOKEN || ''}`,
                    }
                });
            } else {
                data = fs.readFileSync(contractFile, { encoding: 'utf8' });
            }
        } catch (e) {
            const message = `Unable to read contract file "${contractFile}"`
            throw new Error(message);
        }
        const options = { type: 'ast' };
        let parsedContract: Blueprint;
        try {
            parsedContract = drafter.parseSync(data, options);
        } catch (e) {
            const message = `Error parsing contract contents "${contractFile}"
            Cause: ${e}`;
            throw new Error(message);
        }


        const resources: Resources = {};
        parsedContract.ast.resourceGroups.forEach(resourceGroup => {
            resourceGroup.resources.forEach(resourceExample => {
                var url: string = urlParser.parse(resourceExample.uriTemplate).url;

                const resource = resources[url] || {}
                resources[url] = resource;

                resourceExample.actions.forEach((action: BlueprintAction) => {
                    if (resource[action.method]) {
                        logger.error(`${action.method} "${url}" is defined more than once; ignoring additional schema`);

                    } else {
                        const schema: ?ResourceSchemas = createSchema(action, url);
                        if (schema) {
                            resource[action.method] = schema;
                        }
                    }
                });
            });
        });


        if (!Object.keys(resources).length) {
            throw new Error(`No resources found for "${contractFile}"`);
        }

        const contract: Contract = {
            fixtureFolder: mappings[contractFile],
            resources: endpointSorter.sortByMatchingPriority(resources)
        };

        contracts.push(contract);
    }


    return contracts;

};


const createSchema = (action: BlueprintAction, url: string): ?ResourceSchemas => {

    const httpVerb = action.method;

    const example: ?Example = action.examples && action.examples[0];
    if (!example) {
        logger.error(`No request/response pairs found for: ${httpVerb} "${url}"`);
        return;
    }

    const request = example.requests[0] && example.requests[0];
    const response = example.responses[0] && example.responses[0];

    return {
        request: getSchema(request),
        response: getSchema(response)
    };
};

const getSchema = (body: Body): ?JsonSchema => {
    if (!body) return;

    const validatedBody: Body = specSchema.validateAndParseSchema(body);
    return validatedBody.schema;
}

const removeInvalidActions = (resource: BlueprintResource, contractActions: ?Actions): BlueprintResource => {
    const validActions: Array<BlueprintAction> = []

    resource.actions.forEach((action) => {
        const contractAction = contractActions && contractActions[action.method];
        if (!contractAction) {
            logger.error(`${action.method} ${resource.uriTemplate} is not in the contract`);
            return;
        }
        if (!action.examples) return;
        const validExamples: Array<Example> = [];

        action.examples.forEach((example, exampleIndex) => {
            const validRequests: Array<Body> = [];
            const validResponses: Array<Body> = [];
            if (action.method === 'POST' || action.method === 'PUT') {
                if (example.requests.length !== example.responses.length) {
                    throw new Error('Number of requests and responses are not equal');
                }

                for (let requestIndex = 0;requestIndex < example.requests.length; requestIndex++) {
                    const request = example.requests[requestIndex];
                    const reqBody = JSON.parse(request.body || "");
                    const reqResult: SchemaValidationResult = specSchema.matchWithSchema(reqBody, contractAction.request);
                    if (!reqResult.valid) {
                        logger.error(`${action.method} ${resource.uriTemplate} example[${exampleIndex}] request[${requestIndex}] failed validation: \n\t${reqResult.niceErrors.join('\n\t')}`);
                    }

                    const response = example.responses[requestIndex];
                    const respBody = JSON.parse(response.body || "");
                    const respResult: SchemaValidationResult = specSchema.matchWithSchema(respBody, contractAction.response);
                    if (!respResult.valid) {
                        logger.error(`${action.method} ${resource.uriTemplate} example[${exampleIndex}] response[${requestIndex}] failed validation: \n\t${respResult.niceErrors.join('\n\t')}`);
                    }

                    if (reqResult.valid && respResult.valid) {
                        validRequests.push(request);
                        validResponses.push(response);
                    }
                }
            } else {
                example.responses.forEach((response, responseIndex) => {
                    const body = JSON.parse(response.body || "");
                    const result: SchemaValidationResult = specSchema.matchWithSchema(body, contractAction.response);
                    if (result.valid) {
                        validResponses.push(response);
                    } else {
                        logger.error(`${action.method} ${resource.uriTemplate} example[${exampleIndex}] response[${responseIndex}] failed validation: \n\t${result.niceErrors.join('\n\t')}`);
                    }
                });
            }
            if (validRequests.length || validResponses.length) {
                validExamples.push({
                    requests: validRequests,
                    responses: validResponses
                });
            }
        });

        if (validExamples.length) {
            const actionWithValidExamples: BlueprintAction = Object.assign({}, action, { examples: validExamples });
            validActions.push(actionWithValidExamples);
        } else {
            logger.error(`${action.method} ${resource.uriTemplate} has no valid examples and has been excluded`);

        }
    });
    return Object.assign({}, resource, { actions: validActions });
}

module.exports = {
    removeInvalidActions,
    parseContracts,
    readContractFixtureMap,
}