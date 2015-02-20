var extend = require('util')._extend

var Client = function(options){
  this.googleDataset = options.googleDataset
  this.googleNamespace = options.googleNamespace
  this.googleDatasetKind = options.googleDatasetKind || 'ComradeServer'  
}

Client.prototype.getServers = function(options,callback){
  var query = this.googleDataset.createQuery(this.googleNamespace,[this.googleDatasetKind])
  if(options.role){
    query = query.filter('role =',options.role)
  }
  if(typeof options.alive != 'undefined'){
    query = query.filter('alive =',options.alive)
  }
  var retval = []
  this.googleDataset.runQuery(query,function(err,entities,endCursor){
    entities.forEach(function(entity){
      var member = {}
      member.id = entity.key.path[1]
      extend(member, entity.data)
      retval.push(member)
    })
    callback(err,retval)
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

module.exports = Client