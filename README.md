#Comrade

This isn't done yet. The API will change in ways that will break stuff. If you use this, make sure you check the version before deploying to production.

##What is Comrade?
Comrade has the following features:
- Enable Node.js services in a cluster to find each other by saving their configurations to a common database (currently Google Cloud Datastore. More to come soon).
-  Enable Node.js servers to know when they should die and exit gracefully on their own.
-  Allow administrators to deploy/kill/restart Node.js services without having to access the machine in which it is running.

##Why?

Deploying web services is a pain. For a number of reasons, it would be nice if once you install your Node.js module or Docker container, you never had to access Docker or etcd or access the server to get updates and restart the service.

###Gracefulness
It's often hard to make services shutdown gracefully. I don't want to kill my node process without knowing for sure that doing so at that time is not going to put anything in a weird state, which can happen when clients are in the middle of making a request or a service is doing some long-running asynchronous process. From the outside it's hard to tell if a process can exit safely, so we often just kill it and hope for the best. 

###Security
I also hate SSHing into production machines. Even if we're not doing this directly from our terminals, many tools simply automate this process by uploading cookbooks and running them all in one command. This is great, but eliminating the need to use SSH altogether would save time and be a huge security improvement. Comrade enables this buy providing each server with the data it needs via GCD so they know what's going on.

Compartmentalizing sensitive information within teams is also hard to do properly. There's no reason someone working only on the frontend should have direct access to the database. With Comrade, one microservice can be part of two clusters - one public to the other services, and a private one that contains database configuration, API keys, etc.

###Statelessness
After we get all the servers we need up and running, we still need to make them talk to each other. The simplest way is to set everything in a config file or environment variable but with this method, each server needs to be restarted when we change its configuration. That makes using microservices and autoscaling very difficult. A good solution to this problem right now is etcd but just like anything else, we have to make sure it's running and troubleshoot it when it crashes or gets in a weird state (@TODO explain what I mean by "weird state"). Our application should be smart enough to figure out its own configuration without us having to maintain a separate service to hold that configuration. Since DBaaS is so cheap (in some cases comepletely free) we should outsource our "state" to the big guys (in this case Google).

###Convenience
The best alternative to Comrade right now is probably etcd. It works really well, but adopting it means keeping track of another service, and, if all of the servers are not in the same private network, figuring out how to secure communications between the servers in the cluster with TLS. Comrade is just another node module, and all you need to use it is a Google Cloud Platform account.

##API

This package contains two classes. `Member` and `Client`. `Member` reports one node's status to the rest of the cluster, and `Client` is used to get information about nodes in the cluster.

##comrade.Member

###new Member(options)

- `options` a set of configurable options to set on the Member
  - `role` (required) the role of this node (e.g. appserver, loadbalancer, etc.)
  - `options.googleDataset` (required) a `gcloud` Dataset instance. See [gcloud-node](https://github.com/GoogleCloudPlatform/gcloud-node/)
  - `options.googleDatasetNamespace` (optional) the GCD namespace. If not set, the default for the given dataset is used.
  - `options.googleDatasetKind` (optional) the GCD kind to use. Defaults to `ComradeServer`
  - `options.metadata` (optional) an object containing information about the server (IP, port, etc.)
  
By using different namespaces or kinds, you can separate nodes into different environments.

###member.start()

Every 10 seconds, updates the database to tell other comrades the server is running, and checks if it needs to exit.

##comrade.Client

###new Client(options)

- `options` a set of configurable options to set on the Client
  - `options.googleDataset` (required) a `gcloud` Dataset instance. See [gcloud-node](https://github.com/GoogleCloudPlatform/gcloud-node/).
  - `options.googleDatasetNamespace` (optional) the GCD namespace. If not set, the default for the given dataset is used.
  - `options.googleDatasetKind` (optional) the GCD kind to use. Defaults to `ComradeServer`
  
###getServers(options,callback)

- `options` a set of configurable options
  - `options.role` limit the results to contain only members with this a certain role. Fetches all members if undefined
  - `options.alive` if `true`, returns servers that have not started shutting down yet. If `false`, returns servers that have received the signal to shutdown. If undefined, returns all members.
- `callback` Function

      client.getServers({
        role: 'app',
        alive: true
      },function(err,entities){
        /*
          err: gcloud error or null if successful
          entities: gcloud entities
        */
        entities.forEach(function(entity){
          console.log(entity.metadata.ip+':'+entity.metadata.port)
        })
      })

##Examples

@TODO

##@TODO

- Finish documentation
- CLI
- Other datastores
