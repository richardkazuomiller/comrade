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
  - `options.id` (optional) the unique ID of the member. If not set, a UUID is created.
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
  - `options.healthCheck` (optional) custom health check function to see if each server is healthy. If not set, checks if `member.updated` is less than 60 seconds in the past.
  
          /*
            This example uses the default GCD namespace and kind options, with a
            custom health check that polls an endpoint on each member. If the 
            member responds with the correct ID it is healthy.
          */
          var comrade = require('comrade')
          var request = require('request')
          var client = new comrade.Client({
            googleDataset: require('./google-dataset'),
            healthCheck: function(memberData,callback){
              if(memberData.role == 'loadbalancer'){
                var timediff = Date.now() - memberData.updated
                callback(timediff < 60000)
              }
              else{
                var url = ['http://',memberData.metadata.ip,':',
                  memberData.metadata.port,'/comrade_health_check'].join('')
                request.get({
                  url: url
                },function(e,r,b){
                  try{
                    var data = JSON.parse(b)
                    callback(!e && data.id == memberData.id)
                  }
                  catch(e){
                    callback(false)
                  }
                })
              }
            }
          })
  
###client.getMembers(options,callback)

- `options` a set of configurable options
  - `options.role` limit the results to contain only members with this a certain role.
  - `options.alive` if `true`, returns servers that have not started shutting down yet. If `false`, returns servers that have received the signal to shutdown.
  - `options.healthy` if `true`, returns servers that have passed the health check. If `false`, returns servers that have failed the health check.
  - `options.stale` if `true`, return servers that have been dead or unhealthy for more than an hour. If `false`, returns servers that have not been dead or unhealthy for more than an hour.
- `callback` Function

        client.getMembers({
          role: 'app',
          alive: true
        },function(err,servers){
          /*
            err: gcloud error or null if successful
            servers: array of server data
          */
          servers.forEach(function(server){
            console.log(server.metadata.ip+':'+server.metadata.port)
          })
        })
      
###client.killMember(id,callback)
  - `id` the ID of the server to shut down.
  - `callback` Function

Tells the specified server to start shutting down.

###client.killOldestMember(options,callback)

 - `options` configurable set of options (same as `client.getServer`)
 - `callback` Function
 
Kills the server with the earliest creation date.

###client.clearStaleMembers(callback)
 - `callback` Function

Deletes entities for servers which have been dead or unhealthy from GCD. Run this periodically to lower the number of read operations when using the client.

##Examples

@TODO

##@TODO

- Finish documentation
- CLI
- Other datastores
