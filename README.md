#Comrade

This isn't done yet. The API will change in ways that will break stuff. If you use this, make sure you check the version before deploying to production.

##What is Comrade?
Comrade has the following features:
- Enable Node.js services in a cluster to find each other by saving their configurations to a common database (currently Google Cloud Datastore. More to come soon).
-  Enable Node.js servers to know when they should die and exit gracefully on their own.
-  Allow administrators to deploy/kill/restart Node.js services without having to access the machine in which it is running.

##Why?

See the [Motivation](https://github.com/richardkazuomiller/comrade/wiki/Motivation) page in the wiki

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

        var http = require('http')
        var Member = require('comrade').Member
        var member = new Member({
          googleDataset: require('./my-google-dataset'),
          role: process.env.SERVER_ROLE,
          metadata: {
            ip: process.env.PUBLIC_IPV4,
            port: process.env.LISTEN_PORT
          }
        })
        var server = http.createServer(function(){/*do something*/})
        server.listen(process.env.LISTEN_PORT)
        member.start()

###member.start()

Every 10 seconds, updates the database to tell other comrades the server is running, and checks if it needs to exit.


###Event: 'shutdown'

Emitted when the member has been told to shutdown.

        var http = require('http')
        var Member = require('comrade').Member
        var member = new Member({
          googleDataset: require('./my-google-dataset'),
          role: process.env.SERVER_ROLE,
          metadata: {
            ip: process.env.PUBLIC_IPV4,
            port: process.env.LISTEN_PORT
          }
        })
        var server = http.createServer(function(){/*do something*/})
        server.listen(process.env.LISTEN_PORT)
        member.once('shutdown',function(){
          console.log('Closing server in 30 seconds...')
          setTimeout(function(){
            var interval = setInterval(function(){
              server.getConnections(function(err,connections){
                console.log('Open connections: '+connections)
              })
            },1000)
            server.close(function(){
              clearInterval(interval)
              console.log('Server closed')
              cache.clear()
            })
          },30000)
        })

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
