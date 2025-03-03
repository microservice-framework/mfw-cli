# mfw-cli

[![Gitter](https://img.shields.io/gitter/room/microservice-framework/chat.svg?style=flat-square)](https://gitter.im/microservice-framework/chat)
[![npm](https://img.shields.io/npm/dt/@microservice-framework/mfw-cli.svg?style=flat-square)](https://www.npmjs.com/~microservice-framework)
[![microservice-frame.work](https://img.shields.io/badge/online%20docs-200-green.svg?style=flat-square)](http://microservice-frame.work)


Console utility for [@microservice-framework](https://github.com/microservice-framework).

# Installation

```
# npm install @microservice-framework/mfw-cli -g
```

## Setup new project

```
# mfw setup [dir]
```

Running `setup` will generate a directory structure in `[dir]` or the current directory and create a `package.json` for the project.

You can run it within an already existing directory that contains a `package.json` file. If you choose to do so `mfw-cli` will download and silently configure all services based on either the default or what you have saved for each service within your `package.json` file.

## Install service

Once your project has been configured, the next step is to add services. Each dservice represents one end-point.

A `[service]` can be a...
  - npm package name.
    - Downloaded from the [npm](https://www.npmjs.com) registry. See 
  - Repository, like: git@github.com:owner/repo
    - Downloaded from git.
  - Local path to a directory containing a package.
    - Package will be copied.

It supports all of the formats that `npm pack` supports: a package folder, tarball, tarball url, name@tag, name@version, name, or scoped name, etc.

```
# mfw install [service]
```

Example:

```
# mfw install @microservice-framework/microservice-router --save
```

The installation will begin, then ask for `microservice-router` configuration details. Using the `--save` option will export all the configuration details to the `package.json` file of the project.


## Uninstall service

If you'd like to uninstall a package, simply:

```
# mfw uninstall [service]
```

Example:

```
# mfw uninstall microservice-router --save
```


The `microservice-router` package will be removed from services. The directories will be cleaned up. Using the `--save` option will remove the service and all of the setting from the `package.json` file of the project.


## Update service

If you need to update the service to coincide with changes to the root package, you can update.

```
# mfw update [service]
```

Example:

```
# mfw update microservice-router
```

Updating will download the latest `microservice-router`, overwriting the old package.

```
# mfw update all
```

You can update all services to the latest version.


### Switch enviroment

mfw supports different environments. You can keep your local, stage, dev, production information within one package.

Each ENV data can be written using this pattern:

`[envName.]package.json`

Example:

`dev.package.json`

The `default` env is `package.json`

```
# mfw env [env]
```

You can switch to existing environments, or generate new one.

Example:

```
# mfw env dev
```

## Start service

Once your services have been installed, you can start them.

```
# mfw start [service]
```

 If `all` is provided, then all services will be started.


## Stop service

You can stop them, too!

```
# mfw stop [service]
```

If `all` provided, all services will be stopped.

## Restart service

You can restart service(s) as well

```
# mfw restart [service]
```

If `all` provided, all services will be restarted.


## Status service

You can display the status for specified services or for all service.

```
# mfw status <service>
```
![status](https://user-images.githubusercontent.com/5018896/36957629-aa8187b2-2003-11e8-8e33-6a42f1b7af1d.png)

The status report will include CPU, MEMORY usage and up/down + version and pid information

## Microservice client integration

 - `C`reate (POST): `mfw client-create [options] <service> <JSONDATA>` - send create request to microservice.
 - `R`ead (GET): `mfw client-read [options] <service> <id>` - read record by ID.
 - `U`pdate (PUT): `mfw client-update [options] <service> <id> <JSONDATA>` - update record by ID.
 - `D`elete (DELETE): `mfw client-delete [options] <service> <id>` - delete record from microservice by ID.
 - `S`earch (SEARCH): `mfw client-search [options] <service> <JSONDATA>` - search records by query.

## CHANGELOG

- `1.2.6` - Windows compatibility bugfix for install and update.
- `1.3.0`
  - fixed issue with service stop on WIN platform
  - added restart command
  - fixed setup on WIN platform
  - added `--json` option to get json output for all commands
  - tests are covering all commands
- `1.3.1`
  - fix issue with PID is not string
- `1.3.2`
  - fix issue with PID is null
