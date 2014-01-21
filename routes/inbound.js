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
	//simulate receipt of email: 
	curl -d "to=receiver@imkev.in&from=im.kevin@icloud.com" btcashio.herokuapp.com/newtrans
	var to = req.body.to
	, from = req.body.from;

	to = getEmail(new String(to));
	from = getEmail(new String(from));
	console.log("POST REQUEST RECEIVED" + to + from);
	request.post('https://h.imkev.in:22556/newtrans').form({from:from, to: to});
	res.end();
	//request.post('http://localhost:3001/newtrans').form({from:'im.kevin@me.com', to: 'plaintshirt@icloud.com'});

	res.redirect('/');
}
