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
  this.googleDataset.runQuery(query,function(err,entities,endCursor){
    callback(err,entities)
  })
}

module.exports = Client