var uuid = require('uuid').v4
var extend = require('util')._extend

var Member = function(options){
  this.role = options.role
  this.metadata = options.metadata
  this.created = Date.now()
  this.alive = true
  this.id = uuid()
  this.googleDataset = options.googleDataset
  this.googleNamespace = options.googleNamespace
  this.googleDatasetKind = options.googleDatasetKind || 'ComradeServer'
  if(!this.role){
    throw new Error('Members need a role (app/loadbalancer/etc.)')
  }
}

/*
  get the datastore key
*/
Member.prototype.getKey = function(){
  return this.googleDataset.key({
    namspace: this.googleNamespace,
    path: [this.googleDatasetKind,this.id]
  })
}

/*
  extend the data of the datastore object in a transaction
*/
Member.prototype.updateDatastoreObject = function(data,callback){
  var self = this;
  var key = self.getKey()
  self.googleDataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        try{
          transaction.rollback(done);
        }
        catch(e){
          callback(err)
        }
        return;
      }
      
      if(entity && entity.data){
        extend(entity.data,data)
      }
      else{
        entity = {
          key: key,
          data : data
        }
      }
      
      transaction.save(entity)
      
      done();
    });
  }, function(err) {
    callback && callback(err)
  });
}

/*
  this is run just once to save the initial data
*/
Member.prototype.save = function(callback){
  var self = this
  var key = self.getKey()
  
  self.updated = Date.now()
      
  var data = {
    role: self.role,
    alive: self.alive,
    created: self.created,
    updated: self.updated
  }
  
  if(self.metadata){
    var metadataKeys = Object.keys(self.metadata)
    if(metadataKeys.length > 0){
      data.metadata = self.metadata
    }
  }
  
  self.updateDatastoreObject(data,function(err){
    callback(err)
  })
  
}

/*
  get my own info
*/
Member.prototype.fetch = function(callback){
  var self = this
  var key = self.getKey()
  
  self.googleDataset.get(key,function(err,entity){
    callback && callback(err,entity && entity.data)
  })
}

/*
  check if it's time to die
*/
Member.prototype.checkShutdownDate = function(){
  var self = this
  self.fetch(function(err,data){
    if(data){
      self.alive = data.alive
      var shutdownDate = data.shutdownDate
      if(shutdownDate){
        self.reportDead(function(){
          var timeSince = Date.now()-shutdownDate
          console.log('Shutting down in '+(60-timeSince/1000)+'s')
          if(timeSince > 60000){
            process.exit()
          }
        })
      }
      self.update()
    }
  })
}

/*
  tell everyone i'm dead after i receive the shutdown signal
*/
Member.prototype.reportDead = function(callback){
  var self = this
  self.alive = false
  var data = {
    alive: false
  }
  self.updateDatastoreObject(data,function(err){
    callback(err)
  })
}

/*
  tell everyone i'm still alive
*/
Member.prototype.update = function(callback){
  var self = this
  self.updated = Date.now()
  var data = {
    updated: self.updated
  }
  self.updateDatastoreObject(data,function(err){
    callback && callback(err)
  })
}

/*
  start polling the database for my own status
*/
Member.prototype.start = function(){
  var self = this
  
  //it's important this happens once, so retry
  function attempt(){
    self.save(function(err){
      if(err){
        console.log(err)
        setTimeout(function(){
          attempt()
        },1000)
      }
    })
  }
  attempt()
  
  self.interval = setInterval(function(){
    self.checkShutdownDate()
  },10000)
}

module.exports = Member