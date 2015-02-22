var extend = require('util')._extend
var Queue = require('queue')

var Client = function(options){
  this.googleDataset = options.googleDataset
  this.googleNamespace = options.googleNamespace
  this.googleDatasetKind = options.googleDatasetKind || 'ComradeServer'  
}

Client.prototype.getServers = function(options,callback){
  var self = this
  var query = this.googleDataset.createQuery(this.googleNamespace,[this.googleDatasetKind])
  if(options.role){
    query = query.filter('role =',options.role)
  }
  if(typeof options.alive != 'undefined'){
    query = query.filter('alive =',options.alive)
  }
  var retval = []
  this.googleDataset.runQuery(query,function(err,entities,endCursor){
    var queue = Queue()
    entities.forEach(function(entity){
      var member = {}
      member.id = entity.key.path[1]
      extend(member, entity.data)
      retval.push(member)
      queue.push(function(next){
        self.healthCheck(member,function(healthy){
          member.healthy = healthy
          if(!healthy && options.healthy == true
            || healthy && options.healthy === false){
            var index = retval.indexOf(member)
            if(index != -1){
              retval.splice(index,1)
            }
          }
          next()
        })
      })
      queue.push(function(next){
        self.staleCheck(member,function(stale){
          member.stale = stale
          if(!stale && options.stale == true
            || stale && options.stale === false){
            var index = retval.indexOf(member)
            if(index != -1){
              retval.splice(index,1)
            }
          }
          next()
        })
      })
    })
    queue.on('end',function(){
      callback(err,retval)
    })
    queue.start()
  })
}

Client.prototype.killServer = function(id,callback){
  var key = this.googleDataset.key({
    namspace: this.googleNamespace,
    path: [this.googleDatasetKind,id]
  })
  this.googleDataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        try {
          transaction.rollback(done);
        }
        catch(e){
          callback(err)
        }
        return;
      }
      
      if(entity){
        entity.data.shutdownDate = Date.now()
        transaction.save({
          key: key,
          data : entity.data
        })
      }
      
      
      done();
    });
  }, function(err) {
    callback && callback(err)
  });
}

Client.prototype.killOldestServer = function(options,callback){
  var self = this
  self.getServers(options,function(err,servers){
    if(err){
      callback(err)
      return;
    }
    var oldestServer
    var livingCount = 0
    servers.forEach(function(server){
      //check if it's actually alive
      var timeDiff = Date.now()-server.updated
      if(!server.shutdownDate){
        livingCount++
        if(!oldestServer || oldestServer.created > server.created){
          oldestServer = server
        }
      }
    })
    console.log('Living servers: '+livingCount)
    if(oldestServer && livingCount > 1){
      var server = oldestServer
      var id = server.id
      var createdDiff = Date.now()-server.created
      var timeDiff = Date.now()-server.updated
      console.log('ID: '+id)
      console.log('Created: '+(createdDiff/1000)+'s ago')
      console.log('Updated: '+(timeDiff/1000)+'s ago')
      self.killServer(id,function(err){
        callback(err)
      })
    }
  })
}

Client.prototype.clearStaleServers = function(callback){
  var self = this;
  self.getServers({stale:true},function(err,servers){
    if(err){
      callback(err);
      return;
    }
    var now = Date.now()
    var queue = Queue()
    queue.concurrency = 1
    servers.forEach(function(server){
      var createdDiff = Date.now()-server.created
      var timeDiff = Date.now()-server.updated
      queue.push(function(next){
        console.log('ID: '+server.id)
        console.log('Created: '+(createdDiff/1000)+'s ago')
        console.log('Updated: '+(timeDiff/1000)+'s ago')
        var key = self.googleDataset.key({
          namspace: self.googleNamespace,
          path: [self.googleDatasetKind,server.id]
        })
        self.googleDataset.delete(key,function(err){
          next()
        })
      })
    })
    queue.start()
    queue.on('end',function(){
      callback()
    })
  })
}

Client.prototype.staleCheck = function(memberData,callback){
  var timediff = Date.now() - memberData.updated
  callback(timediff > 3600000)
}

Client.prototype.healthCheck = function(memberData,callback){
  var timediff = Date.now() - memberData.updated
  callback(timediff < 60000)
}

module.exports = Client