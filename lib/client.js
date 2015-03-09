var extend = require('util')._extend
var Queue = require('queue')
var Member = require('./member')

var Client = function(options){
  this.googleDataset = options.googleDataset
  this.googleNamespace = options.googleNamespace
  this.googleDatasetKind = options.googleDatasetKind || 'ComradeServer'
  if(options.healthCheck){
    this.healthCheck = options.healthCheck
  }
}

Client.prototype.createMember = function(_options){
  var options = {}
  extend(options,_options)
  extend(options,{
    googleDataset: this.googleDataset,
    googleNamespace: this.googleNamespace,
    gootleDatasetKind: this.googleDatasetKind
  })
  return new Member(options)
}

Client.prototype.getMembers = function(options,callback){
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
    if(err){
      callback(err)
      return;
    }
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

Client.prototype.zombifyMember = function(id,callback){
  var member = this.createMember({id:id})
  member.fetch(function(err,data){
    if(err || !data){
      callback(err)
      return;
    }
    member.reportDead(function(err){
      callback(err)
    })
  })
}

Client.prototype.killMember = function(id,callback){
  var self = this
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
      console.log(entity)
      if(entity){
        entity.data.shutdownDate = Date.now()
        transaction.save(entity)
      }
      
      
      done();
    });
  }, function(err) {
    if(err){
      console.log(err.message)
      setTimeout(function(){
        self.killMember(id,callback)
      },1000)
      return;
    }
    callback && callback(err)
  });
}

Client.prototype.killOldestMember = function(options,callback){
  var self = this
  self.getMembers(options,function(err,servers){
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
      self.killMember(id,function(err){
        callback(err)
      })
    }
    else{
      callback(err)
    }
  })
}

Client.prototype.clearStaleMembers = function(callback){
  var self = this;
  self.getMembers({stale:true,healthy:false},function(err,servers){
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
    queue.on('end',function(){
      callback()
    })
    queue.start()
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