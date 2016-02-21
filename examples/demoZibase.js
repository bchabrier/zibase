// This example connects to a Zibase
// and displays various information
var zibase = require("zibase");

function displayVariable(index) {
    demoZibase.getVariable(index, function(err, value) {
	if (err)
	    console.log(err);
	console.log("V" + index + "=" + value);
    });
}

function doStuff() {
    // display the descriptors of the Zibase
    console.log(demoZibase.descriptors);

    // display a given descriptor
    console.log(demoZibase.getDescriptor("P7"));

    // dumps all variables
    for (var v = 0; v < 31; v++) {
	displayVariable(v);
    }

    // listen to change events
    demoZibase.on('change', "ZB10", function(msg){
	console.log(msg);
    });
    demoZibase.on('change', "PZB5", function(msg){
	console.log(msg);
    });
}


// Here we use the credentials of the demo Zibase provided by Zodianet
// As we do not have the IP address,
// we will not be able to process any message
// nor send any command
// Replace with the IP, deviceId and token of a valid accessible zibase
var demoZibase = new zibase.ZiBase("192.168.0.15", 
				   "ZiBASE005748",
				   "1821ffcf5a",
				   doStuff);

// Make sure to deregister the client from the Zibase in all cases.
// Indeed it seems the Zibase keeps 4 clients, and when registering
// a fifth client, the Zibase automatically forgets the first one.
function exitHandler() {
    demoZibase.deregisterListener();
    console.log("Deregistered from Zibase.");
}

process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);
process.on('uncaughtException', exitHandler);

