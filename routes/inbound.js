var request = require('request');

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
	var to = req.body.to
	,   from = req.body.from;
	to = getEmail(new String(to));
	from = getEmail(new String(from));
	console.log("Inbound email: " + to + ' ' + from);
	request.post(process.env.APP_URL+'/newtrans').form({from:from, to: to});
	res.end();
}
