
var email = function(to, from, subject, message){
    var sendgrid = require('sendgrid')(sendgrid_username, sendgrid_password);
    console.log("to: " + to + " from: " + from);

    sendgrid.send({
        to: to,
        from: process.env.APP_EMAIL,
        subject: subject,
        html: message
    },

    function(err, message) {
        if (!err) {
            console.log(message);
        }
    });
};

module.exports.email = email;