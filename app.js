
var express = require('express');
var http = require('http');
var path = require('path');
var inbound = require('./routes/inbound.js');
var app = express();
var bcrypt = require('bcrypt-nodejs');
var request = require('request');
// all environments
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', process.env.PORT || 3001);

var dotenv      = require('dotenv');
dotenv.load();

var e           = module.exports;
e.ENV           = process.env.NODE_ENV || 'development';

var databaseUrl = process.env.DATABASE_URL;
var db = require("mongojs").connect(databaseUrl, ['hackla']);
var db2 = require("mongojs").connect(databaseUrl, ['hackla_record']);

var sendgrid_username   = process.env.SENDGRID_USERNAME;
var sendgrid_password   = process.env.SENDGRID_PASSWORD;
sendgrid                = require('sendgrid')(sendgrid_username, sendgrid_password);

function email(to, from, subject, text, generated_address){
        console.log("to: " + to + " from: " + from);
        var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
        sendgrid.send({
          to: from,
          from: 'payments@btcash.herokuapp.com',
          subject: 'BitCash - Action needed',
          html: 'Hello, <br /> We\'ve received your request to send Bitcoins to: <a>' + to + '</a><br /> You will first need to send funds to: <b style="background-color: #eee;">' + generated_address + '</b>\n <br /> <br />Find out more about BitCash <a href="http://joyceyan.github.io/bitcash">here</a><br /><br />--BitCash team, <br /><img src="http://i.imgur.com/mRKYxwz.png"></img>'
        }, function(success, message) {
          if (!success) {
              console.log(message);
          }
        });
        sendgrid.send({
          to: to,
          from: 'payments@btcash.herokuapp.com',
          subject: subject,
          html: text + '\n <br /> <br />  Find out more about BitCash <a href="http://joyceyan.github.io/bitcash">here</a><br /><br /><img src="http://i.imgur.com/mRKYxwz.png"></img>'
        }, function(success, message) {
          if (!success) {
              console.log(message);  
          }
        });

        
};

app.get('/', function(req, res) {
    res.render('index.jade')
});

app.get('/submitaddress/:key', function(req, res) {
        res.render('submitaddress', {title: req.params.key})
})

app.post('/submitaddress/:key', function(req, res) {
        //pay
        // console.log(req.body.user_address);       
        request.post('http://localhost:3001/payout').form({key:req.params.key, address: req.body.user_address}, function(err, response, body) {
          console.log(body);
          res.send(body);
        }); 
})

// app.get('/inbound', inbound.index);
app.post('/inbound', inbound.index);

//from web
app.post('/initiate', function(req, res) {
        email(req.body.to, req.body.from, req.body.subject, req.body.text);        
        // res.redirect('http://joyceyan.github.io/BitCash/');
});

app.post('/newTrans', function(req, res) {
	request('http://h.imkev.in:22555/so/get_new_address', function (error, response, body) {
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
	        db.hackla.insert(transaction);
	        
	        //send email with a key
            //send email to person who started to say they need to send btc to x address
            email(req.body.to, req.body.from, 'You\'ve got coins!', 'Somebody has sent you Bitcoins. Click here to redeem: http://10.0.1.187:3001/submitaddress/'+key, generated_address)

	        res.send(200);
	  	}
	})
	
});

function sendPayment(address, amount, parent_Response){
	//headers
	request('http://h.imkev.in:22555/so/send_to_address?args='+address+","+amount, function (error, response, body) {
		var eval_body = eval("(" + body + ")");

		//record some metrics after sending
		db2.hackla_record.insert({'receiver' : address, 'amount' : amount, 'code' : eval_body.code});
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
	request('http://h.imkev.in:22555/so/validate_address?args='+s_address, function (e_1, r_1, b_1) {
		b_1 = eval("(" + b_1 + ")");
		console.log(b_1);
		if(typeof b_1.data != "undefined" && b_1.data.isvalid){
			//try to match the key
			db.hackla.findOne({key:reqKey}, function(err, doc){
				if(doc != null){
					if(doc.i_address == "-1"){
						res.send("You have already withdrawn your bitcoins.");
					} else {
						request('http://h.imkev.in:22555/so/list_received_by_address?args=0', function (error, response, body) {
							var payed = false;
							list_addresses = eval("(" + body + ")");
							list_addresses = list_addresses.data;
							for(var i = 0; i < list_addresses.length; i++){
								console.log("Comparing: " + list_addresses[i].address + " to " + doc.i_address);
						    	if(list_addresses[i].address == doc.i_address){
						    		var amount = list_addresses[i].amount;

						    		//disable account after sending
									db.hackla.findAndModify({
									    query: { key: reqKey },
									    update: { $set: { i_address: "-1" } },
									    new: true
									}, function(err, doc, lastErrorObject) {
									    sendPayment(s_address, amount, res);


									//fix me 	vv
									    email('im.kevin@me.com', 'Payments@btcash.herokuapp.com','Your ' + amount + ' bitcoin have been delivered to ' + s_address,  'Thanks for using BitCash!');
									    email('its.samweinberg@gmail.com', 'Payments@btcash.herokuapp.com','You have received ' + amount + ' bitcoin.',  'Thanks for using BitCash!');
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

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
