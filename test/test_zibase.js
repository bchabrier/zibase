var assert = require("assert");
var request = require("request");
var zibase = require("../zibase.js");

describe('Module zibase', function() {

    function initFakeZibase () {
	// Credentials are from the demo account, 
	// retrieved from the following URL:
	// https://zibase.net/m/get_iphone.php?login=demo&password=demo
	var ziBase = {
	    deviceId : "ZiBASE005748",
	    token : "1821ffcf5a",
	};
	ziBase.emitEvent = function () {};
	ziBase.loadDescriptors = zibase.ZiBase.prototype.loadDescriptors;
	ziBase.getDescriptor = zibase.ZiBase.prototype.getDescriptor;
	ziBase.processZiBaseData = zibase.ZiBase.prototype.processZiBaseData;

	return ziBase;
    }

    function initDemoZibase () {
	// Credentials are from the demo account, 
	// retrieved from the following URL:
	// https://zibase.net/m/get_iphone.php?login=demo&password=demo
	var ziBase = new zibase.ZiBase("", 
				       "ZiBASE005748",
				       "1821ffcf5a"
				      );

	return ziBase;
    }

    describe('#loadDescriptors(cb)', function () {
	var ziBase;
	var demoXML = "";
	var expectedDemoXML = '<?xml version="1.0" encoding="UTF-8"?>\n\t\t<r><start/><e t="receiverXDom" i="logotype_airfan.png" c="C3" ><n>Ventilation SdB</n></e><e t="power" i="logotype_power.png" c="PZA3" ><n>Conso Wall Plug</n></e><e t="receiverXDom" i="logotype_heatpomp.png" c="P7" p="5" ><n>Pompe à Chaleur</n></e><e t="receiverXDom" i="logotype_boiler.png" c="P5" p="5" ><n>Chaudière</n></e><e t="receiverXDom" i="logotype_PorteGarage.png" c="P4" p="5" ><n>Garage</n></e><e t="receiverXDom" i="logotype_Portails.png" c="P3" p="5" ><n>Portail</n></e><e t="receiverXDom" i="logotype_VoletsRoulants.png" c="P2" p="5" o1="MONTEE" o2="DESCENTE" o3="" ><n>Volets Salon</n></e><e t="receiverXDom" i="logotype_Arrosage.png" c="P1" p="5" ><n>Arrosage</n></e><e t="transmitter" i="logotype_Presence.png" c="VS614725410" ><n>Intrusion</n></e><e t="transmitter" i="logotype_Fumee.png" c="XS3643391298" ><n>Incendie</n></e><e t="transmitter" i="logotype_Portes.png" c="XS1234" ><n>Véranda ouverte</n></e><e t="transmitter" i="logotype_Gaz.png" c="XS3643391553" ><n>fuite de gaz cuisine</n></e><e t="transmitter" i="logotype_Eau.png" c="XS3643390788" ><n>Fuite Eau</n></e><e t="receiverXDom" i="logotype_LampesPlafond.png" c="O3" ><n>Plafonnier</n></e><e t="receiverXDom" i="logotype_LampesMurales.png" c="O1" ><n>Lampe murale</n></e><e t="transmitter" i="logotype_Portes.png" c="VS1961418098" ><n>Porte principale</n></e><e t="temperature" i="logotype_temperature.png" c="OS439156737" ><n>Salon</n></e><e t="power" i="logotype_general_yellow.png" c="WS131149" ><n>Conso au compteur</n></e><m id="9" icon="logoMacro_Portes.png" ><n>simulation intrusion</n></m><m id="16" icon="logoMacro_Scenario.png" ><n>Notification iOS</n></m><m id="17" icon="logoMacro_Presence.png" ><n>Notif Android1</n></m><m id="18" icon="logoMacro_General.png" ><n>Notif Android2</n></m><thermostat1 data="Thermostat:1:0:0:15:17:16:1:0:1:3:12"/><end/></r>';
	var nbDescriptors = (expectedDemoXML.match(/<n>/g) || []).length;
	before("Initialize the demo zibase", function () {
	    // use the demo zibase
	    ziBase = initDemoZibase();
	});
	after("Release the demo zibase", function () {
	    ziBase.deregisterListener();
	});
/*
	before("Load zibase descriptors", function (done) {
	    ziBase.loadDescriptors(function (err) {
		assert.equal(err, null);
		done(err);
	    });
	});
*/
	before("Initialize demo XML", function (done) {
	    this.timeout(10000);
	    request.get(
		"https://zibase.net/m/get_xml.php?" +
		    "device=" + ziBase.deviceId + 
		    "&token=" + ziBase.token,
		function(err, res, bodyString) {
		    demoXML = bodyString;
		    done();
		}
	    );
	});
	it('should get a well formatted XML from the zibase', function () {
	    // do some formatting to ease the diff
	    // presentation by mocha, if needed
	    var fDemoXML = demoXML.replace(/>/g,'>\n');
	    var fExpectedDemoXML = expectedDemoXML.replace(/>/g,'>\n');;
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
	var ziBase;
	before("Initialize a fake zibase", function () {
	    // fake a zibase
	    ziBase = initFakeZibase();
	});
	before("Load zibase descriptors", function (done) {
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
	var ziBase;
	before("Initialize a fake zibase", function () {
	    // fake a zibase
	    ziBase = initFakeZibase();
	});
	before("Load zibase descriptors", function (done) {
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
	    ziBase.processZiBaseData(response);
	});
	it('should replace id_OFF by id_OFF (name) in response', function () {
	    var response = {
		reserved1 : "TEXTMSG",
		message : "Sent radio ID (1 Burst(s), Protocols='Family http' ): P4_OFF"

	    }
	    ziBase.processZiBaseData(response);
	});
	it('should replace <rf>ZWAVE id<rf> by name id (name) in response', function () {
	    var response = {
		reserved1 : "TEXTMSG",
		message : "Received radio ID (<rf>ZWAVE P4</rf> <dev>Low-Power Measure</dev> Total Energy=<kwh>39.8</kwh>kWh Power=<w>00</w>W Batt=<bat>Ok</bat>): <id>PZP4</id>"

	    }
	    ziBase.processZiBaseData(response);
	});
    });

    describe('#riptors(cb)', function () {
    	this.timeout(20000);
	it('asdfadfd', function (done) {
	    var ziBase = new zibase.ZiBase("192.168.0.15", 
				    "whatever id",
				    "whatever token");
	    ziBase.getVariable(16, function(err, value) {
		if (err) console.log(err);
		else {
		    console.log(value);
		}
	//	ziBase.deregisterListener();
		ziBase.deregisterListener();
		done();
	    });
	    function dereg () {
		ziBase.deregisterListener();
		done();
	    }
//	    setTimeout(dereg, 6000);
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
			runExample("demoZibase", done);
	});
    });

});
