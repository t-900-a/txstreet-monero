var zmq = require("zeromq/v5-compat"),
sock = zmq.socket("sub"),
monerojs = require('monero-javascript'),
express = require('express'),
socket = require('socket.io');

var app = express();
var server = app.listen(3001, function(){
    console.log('Listening on 3001...');
});
var io = socket(server);

io.on('connection', (socket) => {
	//console.log('new connection');
});


var rpc = monerojs.connectToDaemonRpc("http://localhost:28081");
var maxRpcCallsPerSecond = 30;
var rpcCallsLastSecond = 0;
var resetRpcCalls = setInterval(() => {
	rpcCallsLastSecond = 0;
}, 1000);

sock.connect("tcp://127.0.0.1:28083")
sock.subscribe('json-full-txpool_add');
sock.subscribe('json-full-chain_main');
sock.on('message', function(message) {
	const decoded = message.toString('ascii');
  if (decoded.substring(0, decoded.indexOf(":")) === "json-full-txpool_add") {
  	var tx_str = '{"tx":' + decoded.substring(decoded.indexOf(":")+1, decoded.length) + '}';
  	let tx = JSON.parse(tx_str).tx[0];
	console.log('tx id');
	console.log(tx.extra);
	console.log('tx fee');
	  // convert piconero to monero
	  console.log(tx.ringct.fee*.000000000001);

	for(i=0; i<tx.outputs.length; i++){
		console.log('Output: '+i.toString())
		console.log(tx.outputs[i].to_key.key)
	}
	for(i=0; i<tx.inputs.length; i++){
		console.log('Input: '+i.toString())
		console.log(tx.inputs[i].to_key.key_image);
	}

	// convert piconero to monero
	tx.fee = tx.ringct.fee*.000000000001;

	obj = tx

	  // unsure why we would verify that the tx is in the mem pool
	// let entryPromise = new Promise((resolve, reject) => {
	// 	if(rpcCallsLastSecond > maxRpcCallsPerSecond){
	// 		//console.log('rate limited');
	// 		resolve({nomempool:true});
	// 	}
	// 	else{
	// 		rpcCallsLastSecond++;
	// 		try{
	// 			mem_pool = rpc.getTxPool();
	// 			for (i=0; i<mem_pool.length; i++){
	// 				if (mem_pool[i].getHash() === tx.extra) {
	// 					resolve(tx);
	// 				} else{
	// 					resolve({nomempool:true});
	// 				}
	// 			}
	//
	// 		} catch(error) {
	// 			console.log(error);
	// 			resolve({nomempool:true});
	// 		}
	// 	}
	// });

	entryPromise.then((result) => {
		try{
			obj = {...obj, ...result};
			io.emit('tx', JSON.stringify(obj));
		}catch(error) {
 			console.error(error);
		}
	});
	
  } else if (decoded.substring(0, decoded.indexOf(":")) === "json-full-chain_main") {
	//just notify that theres a new block, so we can look up on rpc with height
	  var new_block_str = '{"new_block":' + decoded.substring(decoded.indexOf(":")+1, decoded.length) + '}';
	  let new_block = JSON.parse(new_block_str).new_block[0];
    io.emit("block", new_block.miner_tx.inputs[0].gen.height);
  }
})


app.get('/', (request, response) => response.json({message: 'Hello, welcome to my server'}));

app.get('/getBlock', function(request, response){
	let height = request.query.height;
	try{
		rpc.getBlockByHeight(height, (err, resp) => {
			if(typeof resp === "undefined") return false;
			let hash = resp.result;
			if(typeof hash !== 'string') return false;
			response.json(resp.result)
		});
	} catch (error){
		console.log(error);
		return false;
	}
});

app.get('/getRawMempool', function(request, response){
	try{
		rpc.getTxPool((err, resp) => {
			if(typeof resp === "undefined") return false;
			response.json(resp.result);
		});
	} catch (error){
		console.log(error);
		return false;
	}
});

app.get('/getMempoolInfo', function(request, response){
	try{
		rpc.getTxPoolStats((err, resp) => {
			if(typeof resp === "undefined") return false;
			response.json(resp.result);
		});
	} catch (error){
		console.log(error);
		return false;
	}
});

app.get('/getInfo', function(request, response){
	try{
		rpc.getInfo((err, resp) => {
			if(typeof resp === "undefined") return false;
			response.json(resp.result);
		});
	} catch (error){
		console.log(error);
		return false;
	}
});
