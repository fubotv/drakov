# Drakov API Blueprint Mock Server - **Fubo Fork**

![Drakov](drakov.png)

Mock server that implements the [API Blueprint](http://apiblueprint.org/) specification

## Installation instructions

`npm install -g --no-optional git://github.com/fubotv/drakov`

## Fubo differences

This fork works differently than the original in the following ways:
- When both a schema and example body are present on a request/response pair, the example will
be ignored for matching. 
    - The header `X-Matched-By` has been added and will indicate whether a successful request was matched by a schema or body
- When the header `reject-unknown-props: true` is added to a request, any properties not specified in the spec will cause the request to be rejected
- When request validation fails, a message listing issues will be returned in the response body

## Logging
To enable stackdriver logging, provide a service name as an env variable `STACKDRIVER_SERVICE_NAME`; otherwise, drakov will default to plain text console logging.

### Using fixtures with contracts

The server now has an additional running mode where it will read a json config mapping contract
files to a folder of fixtures. All fixtures will be validated against the schema in the contract file, matching by http verb and url (not and parameters or headers).
Any failures will be logged and the invalid test fixture will not be added to the server. 
All fixture files are expected to be local, but contracts can be local or on github; files that start with http(s) are assumed to be on github. 
To access files on github, you must provide a `GIT_TOKEN` as an environmental variable, and ensure the full link to the raw file, for example `"https://raw.githubusercontent.com/fubotv/contract-testing/master/demo/simple_post.apib"`

This mode is mutually exclusive with the existing mode; either a source file glob (`-f`) or a path to the mapping file (`-m`) must be provided.

## Endpoint matching
 
### Query and path parameters
The original drakov had no support for actually checking path or query parameter types; additionally, required query parameters were not checked 
(assuming all path parameters are required). These validations listed in the apib are now being enforced for primitive types and shallowly for arrays and objects; 
drakov will check that the parameters can be properly coerced into the listed type. For path and required query parameters, non-matching values
cause the endpoint to not be found.

### Header matching
The original drakov, and indeed the apib format, has no concept of a header variable, but we found this problematic in matching requests and enforcing headers.
The format is based on the MSON format that apib uses: 
```
    <header name>: `<example value>` (<type>, required | optional) - <description>
```
Validation order:
1. when header has a type in the spec the value is ignored and only type is compared with the request.
```
    x-user-id: 12345 (string) - matches x-user-id=whatever
```
2. when header has only value in the spec, and the value is a parsable json object, the resulting json is used for matching.
Json matching allows backward compatible changes like field reordering and addition.
```
    x-user: {"id":"123"} - matches x-user={"new_field":"new_val","id":"123"}
```
3. when header has only value and is not a parsable json object the value is used for matching
```
    x-country-code: USA - matches x-country-code=USA
```

The headers still need to be in a pre-formatted block, with one header per line
and must **not** have a list item marker (+ or -) in front, unlike parameters. This is to allow
continued use of the existing parsing library which does not recognize this format.
 
### Running fixtures with parameters in validation mode
All headers and parameters must have the same strictness or be stricter in how they deal with parameter and
must have matching types. Thus the following changes are valid:
+ A header or param that is optional in the contract can be required in a fixture
+ A header or param that has a type in the contract can be a value (of appropriate type) 
+ Additional headers can be added to the fixture to allow users to pick specific examples to return that might otherwise have identical requests.
Any fixtures that do not match the requirements of the contract will not be served, with a log message 
emitted during startup explaining the reason that particular example is excluded.

### Note on optionality
For all parameters above, *required is the default optionality*.

### Endpoint matching priorities
In the case that multiple version of an endpoint satisfy the required attributes, drakov picks the best match in the following order:
1. Highest number of matching headers 
2. Query parameters that match literal values in the fixture url
3. Highest number of total matching query parameters (including optional)
4. Lowest number of missing optional query parameters

After this the behavior is undefined.

## Community

We have setup a google group to assist with the answering of questions any users of Drakov may have.

It can be found at [https://groups.google.com/forum/?hl=en#!forum/drakov-api-server](https://groups.google.com/forum/?hl=en#!forum/drakov-api-server)


## Notes on the Node.js compatibility

Since version 1.0.2, a version of the Drafter package is being used, which attempts to install the version with C bindings (faster), but falls back if compilation of this package fails to Drafter.js.


## MSON Support via Attribute elements

Since version 0.1.12 MSON support is now provided.


## Logging to assist with debugging request matching

Drakov provide some logging in the following situations:

 - When request's path does not match any documented endpoints
 - When request's headers does not match headers schema
 - When request's body does not match body schema (corresponding to request's content-type)

### Debug Mode

When flag `--debugMode` is set on Drakov's start up all mismatching requests will be dumped on logs. Also Drakov will send a detail payload within the 404 response.



## Running

`drakov -f <glob expression to your md files> -s <comma delimited list of static file paths> -p <server port>`


**Argument Notes:**

- Glob expression is required
- If a list of static file paths are provided, then Drakov will proxy the static files
- Server port is optional and defaults to **3000**
- CORS headers are sent by default, you need to use the --disableCORS switch/property


## Running with configuration file

`drakov --config config.js`

**Important**

This mode of operation will load your configuration from a Javascript file that must export an object of arguments as
supported in the [arguments module](https://github.com/Aconex/drakov/blob/master/lib/arguments/arguments.js).

All command line arguments aside from `--config` will be ignored, and the defaults will be merged in.

## Running with .drakovrc configuration file

`drakov`

Similar to utilities such as JSHint, drakov will look for a `.drakovrc` file in the current path where `drakov` is executed
and walk up the path until `/` is reached.

The `.drakovrc` file should be a valid Node.js module that exports a valid Drakov configuration object such as would be
used with the `--config` switch.


## API discovery

`drakov -f <glob expression to your md files> --discover`

Enables the `/drakov` endpoint, which lists all the available endpoints currently being served by Drakov


## Examples with command line arguments

With only a glob expression

`drakov -f "../com/foo/contracts/*.md"`

With glob expression and single static path

`drakov -f "../com/foo/contracts/*.md" -s "../path/to/static/files"`

With glob expression and multiple static paths (must be comma delimited with no spaces)

`drakov -f "../com/foo/contracts/*.md" -s "../path/to/static/files" -s "../second/path/to/static/files"`

With glob expression and static path that has a specific mount point

`drakov -f "../com/foo/contracts/*.md" -s "../path/to/static/files=/www/path"`

With glob expression and static path that has a specific mount point with different path mount delimiter

`drakov -f "../com/foo/contracts/*.md" -s "../path/to/static/files:/www/path" -d ":"`

With glob expression and specified server port

`drakov -f "../com/foo/contracts/*.md" -p 4007`

When running drakov and binding to a public IP

`drakov -f "../com/foo/contracts/*.md" --public`

## Reload Drakov when loaded specification files change

You can tell Drakov to watch for changes in the spec files that are loaded. When changes are detected, Drakov will reload.

`drakov -f "../com/foo/contracts/*.md" --watch`

## CORS Header

By default a CORS header is sent, you can disable it with the --disableCORS switch.

`drakov -f "../com/foo/contracts/*.md" --disableCORS`

## Automatic response to OPTIONS requests

When you run server for testing API on different port than your app it's handy to allow cross origin resource sharing (CORS).
For this to work you need also to listen on every route for OPTIONS requests.

`drakov -f "../com/foo/contracts/*.md" --autoOptions`

## Run on Public Interface

By default Drakov only binds to localhost, to run on all public IP interfaces use the --public switch.

`drakov -f "../com/foo/contracts/*.md" --public`

## SSL Support

To enable SSL you must provide both key and certificate. Use parameters --sslKeyFile and --sslCrtFile to specify the path to your key and certificate files.
Once SSL is enabled Drakov will only respond to HTTPS requests.

`drakov -f "../com/foo/contracts/*.md" --sslKeyFile="./ssl/server.key" --sslCrtFile="./ssl/server.crt"`

## Stealth Mode

In some cases you may wish to suppress the logging output of Drakov. To do so, run is with the `--stealthmode` options.

`drakov -f "../com/foo/contracts/*.md" --stealthmode`

## Response Delay

In some case you may want to force Drakov to delay sending a response. To do this simple use the `--delay` argument followed by a number (ms).

`drakov -f "../com/foo/contracts/*.md" --delay 2000`

## Allow Methods Header

For HTTP methods such as DELETE, you may want Drakov to return them in the appropriate methods allow header. You can do this using the `--method` argument

`drakov -f "../com/foo/contracts/*.md" --method DELETE`

`drakov -f "../com/foo/contracts/*.md" --method DELETE --method OPTIONS`

## Allow Headers Header

For HTTP headers such as Authorization, you may want Drakov to return them in the appropriate methods allow header. You can do this using the `--header` argument

`drakov -f "../com/foo/contracts/*.md" --header Authorization`

`drakov -f "../com/foo/contracts/*.md" --header Authorization --header X-Csrf-Token`

Drakov includes many headers by default: `Origin, X-Requested-With, Content-Type, Accept` when CORS is enabled.

## Ignore Headers

In cases where strict HTTP headers matching against API blueprints is not necessary, you can use the `--ignoreHeader` argument:

`drakov -f "../com/foo/contracts/*.md" --ignoreHeader Cookie --ignoreHeader Authorization`

## Using as a Node.js module

    var drakov = require('drakov');

    var argv = {
        sourceFiles: 'path/to/files/**.md',
        serverPort: 3000,
        staticPaths: [
            '/path/to/static/files',
            '/another/path/to/static/files',
            '/path/to/more/files=/mount/it/here'
        ],
        stealthmode: true,
        disableCORS: true,
        sslKeyFile: '/path/to/ssl/key.key',
        sslCrtFile: '/path/to/ssl/cert.crt',
        delay: 2000,
        method: ['DELETE','OPTIONS']
    };

    drakov.run(argv, function(){
        // started Drakov
        drakov.stop(function() {
            // stopped Drakov
        });
    });


## Using as an Express middleware

Due to protagonist parsing being async, we need to setup the middleware with an init function

    var drakovMiddleware = require('drakov').middleware;

    var argv = {
        sourceFiles: 'path/to/files/**.md',
        serverPort: 3000,
        staticPaths: [
            '/path/to/static/files',
            '/another/path/to/static/files',
            '/path/to/more/files=/mount/it/here'
        ],
        stealthmode: true,
        disableCORS: true,
        sslKeyFile: '/path/to/ssl/key.key',
        sslCrtFile: '/path/to/ssl/cert.crt',
        delay: 2000,
        method: ['DELETE','OPTIONS']
    };

    var app = express();
    drakovMiddleware.init(app, argv, function(err, middlewareFunction) {
        if (err) {
            throw err;
        }
        app.use(middlewareFunction);
        app.listen(argv.serverPort);
    });

## FAQ

**Q:** If I have multiple requests/responses on the same API endpoint, which response will I get?

**A:** Drakov will respond first with any responses that have a JSON schema with the first response matching the request body for that API endpoint. You can request a specific response by adding a `Prefer` header to the request in the form `Prefer:status=XXX` where `XXX` is the status code of the desired response.  See [issue #88](https://github.com/Aconex/drakov/issues/88) for details.


**Q:** If I have multiple responses on a single request, which response will I get?

**A:** Drakov will respond with the first response.


**Q:** Drakov is too loud (outputting too much logging), can I turn off request and API responses?

**A:** You can suppress all but the startup output of Drakov with `--stealthmode`.


## CONTRIBUTING

Pull requests with patches for fixes and enhancements are very welcome. We have a few requirements that will help us to quickly assess your contributions.

If you have any ideas or questions you are welcome to post an issue.

### Code conventions
* Setup your editor to use the `.editorconfig` and `.jshintrc` files included in the project
* We use 4 spaces for tabs
* Most of the style issues should be resolve as long as you run `npm test` and run against the jshinting rules
* We prefer readability over compact code

### Logging in your code
* Include the `lib/logger` module. This includes a function for each of the 4 standard log levels. Levels 

### Functionality that adds CLI arguments
* Make sure you add the new argument property to the `yargsConfigOptions` object in the [arguments module](https://github.com/Aconex/drakov/blob/master/lib/arguments.js#L3)

### Middleware functionality
* For functionality that does something with the request object add code to the [request module](https://github.com/Aconex/drakov/blob/master/lib/middleware/request.js)
* For functionality that does something with the response object add code to the [response module](https://github.com/Aconex/drakov/blob/master/lib/middleware/response.js)

### Testing
* If your contribution deals with API Blueprint request/response behaviour add an example into an existing or new markdown file in the `test/example/md` directory
* Always add a test in `test/api` for request/response behaviour tests, or `test/unit` if it is a unit test
* All test specification files must end in `-test.js`
* Always run `npm test` before you submit your build request

## CHANGELOG

A history of changes with a list of contributors can be found at https://github.com/Aconex/drakov/blob/master/CHANGELOG.md

## MAINTAINERS

Yakov Khalinsky <yakov@therocketsurgeon.com>

Marcelo Garcia de Oliveira <moliveira@aconex.com>

## Drakov Logo

*Huge thanks to Eva Mansk for the funky logo!*

You are welcome to use the Drakov logo as long it is to refer to this project and you provide acknowledgement and a link back to our project.
