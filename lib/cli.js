var readline = require('readline')
var cliff = require('cliff')
require('date-utils')

var CLI = function(options){
  this.client = options.client
}

CLI.prototype.start = function(){
  var self = this
  this.rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: function(line,callback){
      self.completer(line,callback)
    }
  });
  this.rl.setPrompt('>')
  this.getAction()
}

CLI.prototype.completer = function(line,callback){
  callback(null,[[],line])
}

CLI.prototype.actionCompleter = function(line,callback){
  var completions = this.actions
  var hits = completions.filter(function(c) { return c.indexOf(line) == 0 })
  callback(null,[hits.length ? hits : completions,line])
}

CLI.prototype.actions = [
  'list',
  'kill',
  'zombify',
  'killOldestMember',
  'clearStaleMembers',
  'rollingKill'
]

CLI.prototype.getAction = function(){
  var self = this
  console.log('Functions:')
  console.log(this.actions.join('\n'))
  this.completer = this.actionCompleter
  this.rl.question('What would you like to do?\n',function(answer){
    self.doAction(answer)
  })
}

CLI.prototype.doAction = function(answer){
  var self = this
  var segs = answer.split(' ')
  var command = self.parseAnswer(answer)
  var action = command.action
  if(this.actions.indexOf(action) == -1){
    this.getAction()
  }
  else{
    switch(action){
      case "list":
        console.log('Fetching sever list...')
        var options = self.getMembersOptions(answer)
        self.client.getMembers(options,function(err,servers){
          var table = [
            ['ID','Role','Created','Alive','Healthy','Stale','Updated','Shutdown Date','Metadata']
          ]
          servers.forEach(function(server){
            var row = [
              server.id.toString(),
              server.role.toString(),
              new Date(server.created).toFormat('YYYY/MM/DD HH24:MI'),
              server.alive.toString(),
              server.healthy.toString(),
              server.stale.toString(),
              (server.updated && new Date(server.updated).toFormat('YYYY/MM/DD HH24:MI')) || '-',
              (server.shutdownDate && new Date(server.shutdownDate).toFormat('YYYY/MM/DD HH24:MI')) || '-',
              JSON.stringify(server.metadata)
            ]
            table.push(row)
          })
          console.log(cliff.stringifyRows(table));
          self.getAction()
        });
        break;
      case "killOldestMember":  
        var options = self.getMembersOptions(answer)
        self.client.killOldestMember(options,function(err){
          err && console.log(err.message)
          self.getAction()
        })
        break;
      case "rollingKill":
        var options = self.getMembersOptions(answer)
        self.client.rollingKill(options,function(){
          self.getAction()
        })
        break;
      case "clearStaleMembers":  
        self.client.clearStaleMembers(function(){
          self.getAction()
        })
        break;
      case "kill":  
        var id = command.args[0]
        self.client.killMember(id,function(){
          self.getAction()
        })
        break;
      case "zombify":  
        var id = command.args[0]
        self.client.zombifyMember(id,function(){
          self.getAction()
        })
        break;
    }
  }
}

CLI.prototype.getMembersOptions = function(answer){
  var command = this.parseAnswer(answer)
  var options = {}
  if(typeof command.options.alive != 'undefined'){
    options.alive = true
  }
  if(typeof command.options.dead != 'undefined'){
    options.alive = false
  }
  if(typeof command.options.healthy != 'undefined'){
    options.healthy = true
  }
  if(typeof command.options.unhealthy != 'undefined'){
    options.healthy = false
  }
  if(typeof command.options.stale != 'undefined'){
    options.stale = true
  }
  if(typeof command.options.role != 'undefined'){
    options.role = command.options.role
  }
  return options
}

CLI.prototype.parseAnswer = function(answer){
  var segs = answer.split(' ').filter(function(c){
    return c.length > 0
  })
  var action = segs[0]
  var options = {}
  var args = segs.slice(1)
  for(var i = 1; i < segs.length; i++){
    var seg = segs[i]
    if(seg.substr(0,2) == '--'){
      var opt = seg.substr(2)
      options[opt] = null
      var nextSeg = segs[i+1]
      if(nextSeg && nextSeg.indexOf('--') != 0){
        options[opt] = nextSeg
        i++
      }
    }
  }
  var retval = {
    action: action,
    options: options,
    args: args
  }
  return retval
}

module.exports = CLI