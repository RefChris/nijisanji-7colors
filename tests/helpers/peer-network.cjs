const {EventEmitter}=require('node:events');
module.exports=function network(){
  const peers=new Map();let serial=0;
  class Connection extends EventEmitter{
    constructor(peer,metadata){super();this.peer=peer;this.metadata=metadata;this.open=false;this.closed=false}
    send(data){if(this.open)queueMicrotask(()=>{if(this.other.open)this.other.emit('data',JSON.parse(JSON.stringify(data)))})}
    close(){if(this.closed)return;this.closed=true;this.open=false;if(this.other){this.other.closed=true;this.other.open=false;queueMicrotask(()=>this.other.emit('close'))}queueMicrotask(()=>this.emit('close'))}
  }
  class Peer extends EventEmitter{
    constructor(id){super();this.id=id||'test-client-'+(++serial);this.open=false;this.links=new Set();const collision=peers.has(this.id);if(!collision)peers.set(this.id,this);queueMicrotask(()=>{if(this.destroyed)return;if(collision)this.emit('error',{type:'unavailable-id'});else{this.open=true;this.emit('open',this.id)}})}
    connect(id,options={}){const a=new Connection(id,options.metadata),b=new Connection(this.id,options.metadata);a.other=b;b.other=a;this.links.add(a);queueMicrotask(()=>{if(this.destroyed||a.closed)return;const target=peers.get(id);if(!target?.open){this.emit('error',{type:'peer-unavailable'});return}target.links.add(b);target.emit('connection',b);if(a.closed)return;a.open=b.open=true;b.emit('open');a.emit('open')});return a}
    destroy(){this.destroyed=true;this.open=false;if(peers.get(this.id)===this)peers.delete(this.id);for(const c of this.links)c.close()}
    reconnect(){this.open=true;this.emit('open',this.id)}
  }
  return Peer;
};
