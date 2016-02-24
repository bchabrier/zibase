var assert = require("assert");
var request = require("request");
var zibase = require("../zibase.js");

var validZibaseIP = "192.168.0.15";

describe('Module zibase', function() {

    var validZibaseUnreachable = false;

    before("Checking valid Zibase", function(done) {
	this.timeout(5000);
	request.get("http://" + validZibaseIP + "/sensors.xml", 
		    {timeout: 2000}, 
		    function(err, response, bodyString) {
	    if (err || bodyString == undefined) {
		console.log("Valid Zibase '" 
			    + validZibaseIP 
			    + "' unreachable. Some tests will be skipped.");
		validZibaseUnreachable = true;
	    }
	    done();
	});
    });
	    

    var ziBase; // singleton to have only 1 connected zibase

    function releasePreviousZibase() {
	if (ziBase && ziBase.localport && ziBase.deregisterListener) 
	{
	    ziBase.deregisterListener();
	}
	ziBase = undefined;
    }

    function initFakeZibase () {
	// Credentials are from the demo account, 
	// retrieved from the following URL:
	// https://zibase.net/m/get_iphone.php?login=demo&password=demo
	ziBase = {
	    deviceId : "ZiBASE005748",
	    token : "1821ffcf5a",
	};
	ziBase.emitEvent = function () {};
	ziBase.loadDescriptors = zibase.ZiBase.prototype.loadDescriptors;
	ziBase.getDescriptor = zibase.ZiBase.prototype.getDescriptor;
	ziBase.processZiBaseData = zibase.ZiBase.prototype.processZiBaseData;
	
    }
    
    function initDemoZibase (done) {
	// Credentials are from the demo account, 
	// retrieved from the following URL:
	// https://zibase.net/m/get_iphone.php?login=demo&password=demo
	ziBase = new zibase.ZiBase("", 
				    "ZiBASE005748",
				    "1821ffcf5a",
				    done
				   );
    }

    function initValidZibase (done) {
	ziBase = new zibase.ZiBase(validZibaseIP,
				    "whatever id",
				    "whatever token",
				    done
				   );
    }

    function initUnreachableZibase (done) {
	ziBase = new zibase.ZiBase("1.1.1.1",
				    "whatever id",
				    "whatever token",
				    done
				   );
    }

    afterEach("Release the zibase", releasePreviousZibase);

    describe('#loadDescriptors(cb)', function () {
	var demoXML = "";
	var expectedDemoXML = '<?xml version="1.0" encoding="UTF-8"?>\n\t\t<r><start/><e t="receiverXDom" i="logotype_airfan.png" c="C3" ><n>Ventilation SdB</n></e><e t="power" i="logotype_power.png" c="PZA3" ><n>Conso Wall Plug</n></e><e t="receiverXDom" i="logotype_heatpomp.png" c="P7" p="5" ><n>Pompe à Chaleur</n></e><e t="receiverXDom" i="logotype_boiler.png" c="P5" p="5" ><n>Chaudière</n></e><e t="receiverXDom" i="logotype_PorteGarage.png" c="P4" p="5" ><n>Garage</n></e><e t="receiverXDom" i="logotype_Portails.png" c="P3" p="5" ><n>Portail</n></e><e t="receiverXDom" i="logotype_VoletsRoulants.png" c="P2" p="5" o1="MONTEE" o2="DESCENTE" o3="" ><n>Volets Salon</n></e><e t="receiverXDom" i="logotype_Arrosage.png" c="P1" p="5" ><n>Arrosage</n></e><e t="transmitter" i="logotype_Presence.png" c="VS614725410" ><n>Intrusion</n></e><e t="transmitter" i="logotype_Fumee.png" c="XS3643391298" ><n>Incendie</n></e><e t="transmitter" i="logotype_Portes.png" c="XS1234" ><n>Véranda ouverte</n></e><e t="transmitter" i="logotype_Gaz.png" c="XS3643391553" ><n>fuite de gaz cuisine</n></e><e t="transmitter" i="logotype_Eau.png" c="XS3643390788" ><n>Fuite Eau</n></e><e t="receiverXDom" i="logotype_LampesPlafond.png" c="O3" ><n>Plafonnier</n></e><e t="receiverXDom" i="logotype_LampesMurales.png" c="O1" ><n>Lampe murale</n></e><e t="transmitter" i="logotype_Portes.png" c="VS1961418098" ><n>Porte principale</n></e><e t="temperature" i="logotype_temperature.png" c="OS439156737" ><n>Salon</n></e><e t="power" i="logotype_general_yellow.png" c="WS131149" ><n>Conso au compteur</n></e><m id="9" icon="logoMacro_Portes.png" ><n>simulation intrusion</n></m><m id="16" icon="logoMacro_Scenario.png" ><n>Notification iOS</n></m><m id="17" icon="logoMacro_Presence.png" ><n>Notif Android1</n></m><m id="18" icon="logoMacro_General.png" ><n>Notif Android2</n></m><thermostat1 data="Thermostat:1:0:0:15:17:16:1:0:1:3:12"/><end/></r>';
	var nbDescriptors = (expectedDemoXML.match(/<n>/g) || []).length;
	beforeEach("Initialize the demo zibase", function (done) {
	    // use the demo zibase
	    initDemoZibase(done);
	});

	beforeEach("Initialize demo XML", function (done) {
	    this.timeout(10000);
	    request.get(
		"https://zibase.net/m/get_xml.php?" +
		    "device=" + ziBase.deviceId + 
		    "&token=" + ziBase.token,
		function(err, res, bodyString) {
		    if (err)
			console.log(err);
		    demoXML = bodyString;
		    done(err);
		}
	    );
	});

	it('should get a well formatted XML from the zibase', function () {
	    // do some formatting to ease the diff
	    // presentation by mocha, if needed
	    var fDemoXML = demoXML.replace(/>/g,'>\n');
	    var fExpectedDemoXML = expectedDemoXML.replace(/>/g,'>\n');
	    assert.equal(fDemoXML, fExpectedDemoXML);
	});
	it('should create ' + nbDescriptors + ' descriptors', function () {
	    assert.notEqual(ziBase.descriptors, undefined);
	    assert.equal(ziBase.descriptors.length, nbDescriptors);
	});
	it('descriptors should be well formed', function () {
	    for (var d in ziBase.descriptors) {
		var desc = ziBase.descriptors[d];
		assert.notEqual(desc.name, undefined);
		assert(desc.type == "device" || desc.type == "scenario",
		      "'desc.type' should be 'device' or 'scenario'");
		if (desc.type == "device") {
		    ["t", "c", "i"].forEach(function(p) {
			assert.notEqual(
			    desc[p], undefined,
			    "desc should have '" + p + "' property");
		    });
		} else {
		    assert.equal(desc.type, "scenario");
		    ["id", "icon"].forEach(function(p) {
			assert.notEqual(
			    desc[p], undefined,
			    "desc should have '" + p + "' property");
		    });
		}
	    }
	});
    });

    describe('#getDescriptor(id)', function () {
	beforeEach("Initialize a fake zibase", function () {
	    // fake a zibase
	    initFakeZibase();
	});
	beforeEach("Load zibase descriptors", function (done) {
	    ziBase.loadDescriptors(function (err) {
		assert.equal(err, null);
		done(err);
	    });
	});
	it('should return a descriptor', function () {
	    var desc = ziBase.getDescriptor("P4");

	    assert.notEqual(desc, undefined);
	    assert.equal(desc["name"], "Garage");
	    assert.equal(desc["i"], "logotype_PorteGarage.png");
	    assert.equal(desc["t"], "receiverXDom");
	    assert.equal(desc["c"], "P4");
	});
	it('should return null if unexisting descriptor', function () {
	    var desc = ziBase.getDescriptor("foo");

	    assert.equal(desc, undefined);
	});
    });
    describe('#processZibaseData(response)', function () {
	beforeEach("Initialize a fake zibase", function () {
	    // fake a zibase
	    initFakeZibase();
	});
	beforeEach("Load zibase descriptors", function (done) {
	    ziBase.loadDescriptors(function (err) {
		assert.equal(err, null);
		done(err);
	    });
	});
	it('should replace P4 by P4 (name) in response', function () {
	    var response = {
		reserved1 : "TEXTMSG",
		message : "ZWave warning: ERR_P4"

	    }
	    zibase.test_logger = true;
	    ziBase.processZiBaseData(response);
	    assert.equal(zibase.test_logger_data.message, response.message + " (Garage)");
	});
	it('should replace id_OFF by id_OFF (name) in response', function () {
	    var response = {
		reserved1 : "TEXTMSG",
		message : "Sent radio ID (1 Burst(s), Protocols='Family http' ): P4_OFF"

	    }
	    zibase.test_logger = true;
	    ziBase.processZiBaseData(response);
	    assert.equal(zibase.test_logger_data.message, response.message + " (Garage)");
	});
	it('should replace <rf>ZWAVE id<rf> by name id (name) in response', function () {
	    var response = {
		reserved1 : "TEXTMSG",
		message : "Received radio ID (<rf>ZWAVE P4</rf> <dev>Low-Power Measure</dev> Total Energy=<kwh>39.8</kwh>kWh Power=<w>00</w>W Batt=<bat>Ok</bat>): <id>PZP4</id>"

	    }
	    zibase.test_logger = true;
	    ziBase.processZiBaseData(response);
	    assert.equal(zibase.test_logger_data.message, response.message.replace(/ P4/g, " P4 (Garage)"));
	});
    });

    describe('#getVariable(var, cb)', function () {
	it('should return an int value', function (done) {
	    if (validZibaseUnreachable) {
		console.log("Valid Zibase not reachable. Skipping test.");
		this.skip();
		done();
		return;
	    }
	    this.timeout(20000);
	    initValidZibase(function() {
		ziBase.getVariable(16, function(err, value) {
		    if (err) {
			done(err);
		    } else {
			assert.equal(typeof value, 'number');
			done();
		    }
		});
	    });
	});
	it('should return an error if not reachable', function (done) {
	    this.timeout(20000);
	    initUnreachableZibase(function() {
		ziBase.getVariable(16, function(err, value) {
		    if (err) 
			done();
		    else 
			done("Error not thrown");
		});
	    });
	});
    });

    describe('#getState(var, cb)', function () {
	it('should return an int value', function (done) {
	    if (validZibaseUnreachable) {
		console.log("Valid Zibase not reachable. Skipping test.");
		this.skip();
		done();
		return;
	    }
	    this.timeout(20000);
	    initValidZibase(function() {
		ziBase.getState("ZB5", function(err, value) {
		    if (err) {
			done(err);
		    } else {
			assert.equal(typeof value, 'number');
			done();
		    }
		});
	    });
	});
	it('should return an error if not reachable', function (done) {
	    this.timeout(20000);
	    initUnreachableZibase(function() {
		ziBase.getState("ZB5", function(err, value) {
		    if (err) 
			done();
		    else 
			done("Error not thrown");
		});
	    });
	});
    });

    describe('#sendCommand(address, action, protocol, dimLevel, nbBurst)', function () {
	it('should send a request', function (done) {
	    if (validZibaseUnreachable) {
		console.log("Valid Zibase not reachable. Skipping test.");
		this.skip();
		done();
		return;
	    }
	    this.timeout(20000);
	    var target="P16";
	    initValidZibase(function() {
		ziBase.on("message", function(msg) {
		    var re=new RegExp("Sent radio ID .*: " + target + "_ON");

		    if (re.test(msg.message)) {
			done();
		    }
		});
		ziBase.sendCommand(target, zibase.ZbAction.ON);
	    });
	});
	it.skip('should return an error if not reachable', function (done) {
	    this.timeout(20000);
	    initUnreachableZibase(function() {
		ziBase.getSensorInfo("OS439157539", function(err, value) {
		    if (err) 
			done();
		    else 
			done("Error not thrown");
		});
	    });
	});
    });

    describe('#getSensorInfo(var, cb)', function () {
	it('should return two values', function (done) {
	    if (validZibaseUnreachable) {
		console.log("Valid Zibase not reachable. Skipping test.");
		this.skip();
		done();
		return;
	    }
	    this.timeout(20000);
	    initValidZibase(function() {
		ziBase.getSensorInfo("OS439157539", function(err, value) {
		    if (err) {
			done(err);
		    } else {
			assert.notEqual(value, undefined);
			assert.equal(typeof value, 'object');
			assert.equal(typeof value.v1, 'string');
			assert.equal(typeof value.v2, 'string');
			done();
		    }
		});
	    });
	});
	it('should return an error if not reachable', function (done) {
	    this.timeout(20000);
	    initUnreachableZibase(function() {
		ziBase.getSensorInfo("OS439157539", function(err, value) {
		    if (err) 
			done();
		    else 
			done("Error not thrown");
		});
	    });
	});
    });

    describe('Run examples', function() {
	var exampleDir = "../zibase_examples";

	function runExample(example, done) {
	    var child_process = require("child_process");
	    child_process.exec("node " + example,
			       {
				   cwd : exampleDir,
				   timeout : 7000,
				   killSignal : 'SIGTERM'
			       },
			       function callback(error, stdout, stderr){
				   console.log(stdout);
				   console.log(stderr);
				   done();
			       });
	}
	this.timeout(10000);
	it('should run demoZibase successfully', function(done) {
	    var fs = require('fs');
	    try {
		fs.stat(exampleDir, function(err, stats) {
		    if (err) {
			console.log("Cannot find example directory '" + exampleDir + "'. Skipping...");
			done();
		    } else {
			if (stats.isDirectory()) {
			    runExample("demoZibase", done);
			} else {
			    done();
			}
		    }
		});
	    } catch(e) {
		throw e;
	    }
	});
    });

});
