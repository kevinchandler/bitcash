/*

h.imkev.in:22556 Will be my home server running Kibble (bitcoin testnet) for now, 
until we can push the bitcoind to the cloud (not a priority)

Running btcash-server on your local machine: once node is installed on your local machine, you can cd to the dir, and node app.js
edit the .env with your sendgrid account. I'll talk to Scotte about hooking us up with a central account so we wouldn't need to worry
about not being able to send more than 200 per day I'll comment the code and what it does as well as a lot of cleaning up

*/

// all requires
var express = require('express');
var http = require('http');
var path = require('path');
var inbound = require('./routes/inbound.js');
var app = express();
var request = require('request');

// all environments, configure a bunch of express stuffs
app.set('port', process.env.PORT || 3001);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.urlencoded());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// load environment vars from .env
var dotenv = require('dotenv');
dotenv.load();

// refer to current module, in development mode
var e = module.exports;
e.ENV = process.env.NODE_ENV || 'development';

// set up mongo database and connect
var databaseUrl = process.env.DATABASE_URL;
// set up database that keeps track of information about the transaction, including the sender, receiver, and bitcoin addres we generated
var transactionDB = require("mongojs").connect(databaseUrl, ['transactioninfo']);
// set up databse of all the payments we've made, so the receiver & amount
var paymentsDB = require("mongojs").connect(databaseUrl, ['record']);

// set up sendgrid module
var sendgrid_username = process.env.SENDGRID_USERNAME;
var sendgrid_password = process.env.SENDGRID_PASSWORD;
var sendgrid = require('sendgrid')(sendgrid_username, sendgrid_password);

// email function that takes in various parameters to send a message out using sendgrid's API
function email(to, from, subject, message, generated_address){

    console.log("to: " + to + " from: " + from);

    // don't think this line of code is necessary cause it's listed above
    // var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
    sendgrid.send({
        to: to,
        from: 'payments@bitcash.herokuapp.com',
        subject: subject,
        html: message
    },

    function(err, message) {
        if (!err) {
            console.log(message);
        }
    });
};

// render the jade file
app.get('/', function(req, res) {
    res.render('index.jade')
});


app.get('/withdrawl/:key', function(req, res) {
    res.render('withdrawl', {title: req.params.key})
})

app.post('/withdrawl/:key', function(req, res) {
        //pay
        // console.log(req.body.user_address);       
        request.post(process.env.APP_URL+'/payout').form({key:req.params.key, address: req.body.user_address}, function(err, response, body) {
          console.log(body);
          res.send(body);
        }); 
})

//Incoming emails will hit this route.
app.post('/inbound', inbound.index);


//send email from web
app.post('/initiate', function(req, res) {
    email(req.body.to, req.body.from, req.body.subject, req.body.text, '*generate_address_here*');        
    res.redirect('/');
});

app.post('/newtrans', function(req, res) {
	request(process.env.KIBBLE_URL+'/so/get_new_address', function (error, response, body) {
	    var generated_address = eval("(" + body + ")").data;
	  	if (!error && response.statusCode == 200) {
		    tempHash = generated_address + req.body.from + req.body.to;
		    key = tempHash.split('').sort(function(){return 0.5-Math.random()}).join('').substring(0,20);
	        transaction = {
	            'key' : key,
	            'sender' : req.body.from, 
	            'receiver' : req.body.to,
	            'i_address' : generated_address
	    	};
	        transactionDB.transactioninfo.insert(transaction);
	        
	        //set variables to send to both the recipient, and the sender. 
	       	var recipient_subject = 'You\'ve got coins!'
	       	,	recipient_message = 'Somebody has sent you Bitcoins. Click here to redeem: ' + process.env.APP_URL + '/withdrawl/'+key + '<br /><br />Find out more about BitCash <a href="http://joyceyan.github.io/bitcash">here</a><br /><br /><img src="http://i.imgur.com/mRKYxwz.png"></img><br />'
	        ,	recipient_email = req.body.to
	        ,	sender_subject = 'BitCash - Action needed'
	        ,	sender_message = 'Hello, <br /> We\'ve received your request to send Bitcoins to: <a>' + recipient_email + '</a><br /> You will first need to send funds to: <b style="background-color: #eee;">' + generated_address + '</b>\n <br /> <br />Find out more about BitCash <a href="http://joyceyan.github.io/bitcash">here</a><br /><br />--BitCash team, <br /><img src="http://i.imgur.com/mRKYxwz.png"></img><br />'
	        ,	sender_email = req.body.from;


	        //email sender
            email(sender_email, 'payments@bitcash.herokuapp.com', sender_subject, sender_message, generated_address)

	        //emails receiver
            email(recipient_email, 'payments@bitcash.herokuapp.com', recipient_subject, recipient_message, generated_address)
            

            res.redirect('/')
	        res.send(200);
	        res.end();
		}
	})
	
});

function sendPayment(address, amount, parent_Response){
	//headers
	request(process.env.KIBBLE_URL+'/so/send_address?args='+address+","+amount, function (error, response, body) {
		var eval_body = eval("(" + body + ")");

		//record some metrics after sending
		paymentsDB.record.insert({'receiver' : address, 'amount' : amount, 'code' : eval_body.code});
		parent_Response.send('Your funds are on the way!');

		console.log(eval_body);
	})
}

app.post('/payout', function(req, res){
	console.log(req.body);
	var reqKey = req.body.key;
	var s_address = req.body.address; 
    console.log("reqKey: " + reqKey + " address: " + s_address);
	if(reqKey == "-1"){
		res.end(500);
	}
	
	//make sure our address is ok
	request(process.env.KIBBLE_URL+'/so/validate_address?args='+s_address, function (e_1, r_1, b_1) {
		b_1 = eval("(" + b_1 + ")");
		console.log(b_1);
		if(typeof b_1.data != "undefined" && b_1.data.isvalid){
			//try to match the key
			transactionDB.transactioninfo.findOne({key:reqKey}, function(err, doc){
				if(doc != null){
					if(doc.i_address == "-1"){
						res.send("You have already withdrawn your bitcoins.");
					} else {
						request(process.env.KIBBLE_URL+'/so/list_received_by_address?args=0', function (error, response, body) {
							var payed = false;
							list_addresses = eval("(" + body + ")");
							list_addresses = list_addresses.data;
							for(var i = 0; i < list_addresses.length; i++){
								console.log("Comparing: " + list_addresses[i].address + " to " + doc.i_address);
						    	if(list_addresses[i].address == doc.i_address){
						    		var amount = list_addresses[i].amount;

						    		//disable account after sending
									transactionDB.transactioninfo.findAndModify({
									    query: { key: reqKey },
									    update: { $set: { i_address: "-1" } },
									    new: true
									}, function(err, doc, lastErrorObject) {
									    sendPayment(s_address, amount, res);


									//fix me 	vv
									    // email('im.kevin@me.com', 'Payments@btcash.herokuapp.com','Your ' + amount + ' bitcoin have been delivered to ' + s_address,  'Thanks for using BitCash!');
									    // email('its.samweinberg@gmail.com', 'Payments@btcash.herokuapp.com','You have received ' + amount + ' bitcoin.',  'Thanks for using BitCash!');
									    console.log('email sent!');
						  
									});
						    		payed = true;
						    		break;
						    	}
						    }
							if(!payed){
								res.send("The funds have not been transferred yet. You may want to check with the person who's trying to send you funds");
	                            console.log('no funds yet');
							}
						});
					}
				} else {
					res.send("You're trying to do something weird.");
                    console.log('doc not found');
				}
			});
		}
		else {
			res.send("Invalid Bitcoin address");
		}

	});

});

// create http server and launch it
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});