# mfw-cli
Console utility for @microservice-framework

# Setup

```
# npm install @microservice-framework/mfw-cli -g
```

## Setup new project 

```
# mfw setup [dir]
```

Will generate directory structure in [dir] or in current directory and create package.json for project.

You can run it on already exists directory with exists package.json
In this case it will download and configure silently all services based on default or saved in package.json file settings per service.

## Install service 

```
# mfw install [service]
```

Example:

```
# mfw install @microservice-framework/microservice-router --save
```

Will install and ask for configurations of microservice-router.
With `--save` option all settings and service will be added to package.json file of the project.

`[service]` - could be:
  - npm package name. Will be downloaded from npm registry
  - local path to directory with package (will be copied)
  - github:owner/repo - will be downloaded from github.

Basically support all formats as `npm pack` supports.
  
## Uninstall service 

```
# mfw uninstall [service]
```

Example:

```
# mfw uninstall @microservice-framework/microservice-router --save
```

Will remove microservice-router from services and clean up directories.
With `--save` option all settings and service will be removed from package.json file of the project.


## Update service 

```
# mfw update [service]
```

Example:

```
# mfw update @microservice-framework/microservice-router
```

Will download latest microservice-router and overwrite it.

```
# mfw update all
```

Will update all services to latest version


### Switch enviroment

mfw supports enviroments. So you can keep your local, stage, dev, production info in one package.

Each ENV data contain in `[envName.]package.json`. `default` env is equal to `package.json`

```
# mfw env [env]
```

Will switch to exists one or generate new one.

## Start service 

```
# mfw start [service]
```

Will start service. IF `all` provided - all services will be started.


## Stop service 

```
# mfw stop [service]
```

Will stop service. IF `all` provided - all services will be stopped.



## Status service 

```
# mfw status <service>
```

Display status for specified service or for all services without option.
Status include CPU, MEMORY usage and up/down + version and pid information

## Microservice client integration

 - `C`reate (POST): `mfw client-create [options] <service> <JSONDATA>` - send create request to microservice.
 - `R`ead (GET): `mfw client-read [options] <service> <id>` - read record by ID.
 - `U`pdate (PUT): `mfw client-update [options] <service> <id> <JSONDATA>` - update record by ID.
 - `D`elete (DELETE): `mfw client-delete [options] <service> <id>` - delete record from microservice by ID.
 - `S`earch (SEARCH): `mfw client-search [options] <service> <JSONDATA>` - search records by query.

## CHANGELOG

- `1.2.6` - Windows compatibility bugfix for install and update.