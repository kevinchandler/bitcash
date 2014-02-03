var request = require('request');
var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

function getEmail(msg){
	var pattern = /<.*>/;
	var regex = msg.match(pattern);
	if(regex != null){
	    msg = new String(regex[0]);
	    msg = msg.replace(/>/,"");
	    msg = msg.replace(/</,"");
	    msg = msg.replace(/ /g,"");
	}
	return msg;
}

exports.index = function(req, res) {
	
		var to = getEmail(new String(req.body.to))
		,	from = getEmail(new String(req.body.from))
		,	cc = getEmail(new String(req.body.cc));

		console.log("\n Inbound email: \n To: " + to + '\n From: ' + from + '\n CC: ' + cc + '\n');


		// if email is sent TO the app, will email sender letting them know how to use coinloom
		if (to == process.env.APP_PARSE_EMAIL) {
			request.post(process.env.APP_URL+'/email').form({to: from, message: 'You are using ' + process.env.APP_NAME + ' wrong! Please cc: ' + process.env.APP_PARSE_EMAIL + '<br /><br />', subject: process.env.APP_NAME + ': - Action Needed' });
		}
		else {
			request.post(process.env.APP_URL+'/newtrans').form({from:from, to: to});
		}
		res.end();
}
