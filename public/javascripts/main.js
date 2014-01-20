$(document).ready(function() {
	var key = $('#key').val();
	
	$('#send').on('click', function() {
		var userAddress = $('input.user_address').val();
		$.ajax({
		  type: "POST",
		  url: "../../payout",
		  data: { "address": userAddress , "key": key}
		})
		  .done(function( msg ) {
		   alert(msg);
		  });
	})
});