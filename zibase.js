//heaviliy inpspired from Benjamin Garel's PHP SDK, located in
// http://bgarel.free.fr/Zibase/

var http = require("http");
var request = require("request");
var net = require("net");
var url = require("url");
var dgram = require("dgram");
var util = require("util");
var events = require("events");
var assert = require("assert");

var logger = require("tracer").colorConsole({
    dateformat : "dd/mm/yyyy HH:MM:ss.l",
    level : 3 //0:'test', 1:'trace', 2:'debug', 3:'info', 4:'warn', 5:'error'
});

/**
 * Enum des protocoles Zibase
 */
var ZbProtocol = new function () {
    this.PRESET = 0;
    this.VISONIC433 = 1;
    this.VISONIC868 = 2;
    this.CHACON = 3; 
    this.DOMIA = 4;
    this.X10 = 5;
    this.ZWAVE = 6;
    this.RFS10 = 7;
    this.X2D433 = 8;
    this.X2D433ALRM = 8;
    this.X2D868 = 9;
    this.X2D868ALRM = 9;
    this.X2D868INSH = 10;
    this.X2D868PIWI = 11;
    this.X2D868BOAC = 12;
};
exports.ZbProtocol = ZbProtocol;

/**
 * Enum des sondes virtuelles
 */
var ZbVirtualProbe = new function () {
    this.OREGON = 17;
    this.OWL = 20;

};

/**
 * Enum des actions possibles par la Zibase
 */
var ZbAction = new function () {
    this.OFF = 0;
    this.ON = 1;
    this.DIM_BRIGHT = 2;
    this.ALL_LIGHTS_ON = 4;
    this.ALL_LIGHTS_OFF = 5;
    this.ALL_OFF = 6;
    this.ASSOC = 7;
};
exports.ZbAction = ZbAction;

/**
 * Enum des états possibles des alertes de la Zibase

 var ZbEventType = new function () {
 this.OFF = 9;
 this.ON = 4;
 };
 exports.ZbEventType = ZbEventType;
*/
/**
 * Requête spécifique pour la Zibase
 */
function ZbRequest() {
    this.header = "ZSIG";
    this.command = 0;
    this.reserved1 = "";
    this.zibaseId = "";
    this.reserved2 = "";
    this.param1 = 0;
    this.param2 = 0;
    this.param3 = 0;
    this.param4 = 0;
    this.myCount = 0;
    this.yourCount = 0;
    this.message = null;
}

/**
 * Formate la requête en chaîne binaire compatible Zibase
 * @return la chaîne binaire
 */

ZbRequest.prototype.toBinaryArray = function() {

    var header = new Buffer(this.header);

    var command = new Buffer(2)
    command.writeUInt16BE(this.command, 0);

    var reserved1 = new Buffer(16);
    reserved1.fill(String.fromCharCode(0));
    reserved1.write(this.reserved1);

    var zibaseId = new Buffer(16);
    zibaseId.fill(String.fromCharCode(0));
    zibaseId.write(this.zibaseId);

    var reserved2 = new Buffer(12);
    reserved2.fill(String.fromCharCode(0));
    reserved2.write(this.reserved2);

    var param1 = new Buffer(4);
    param1.writeUInt32BE(this.param1, 0);

    var param2 = new Buffer(4);
    param2.writeUInt32BE(this.param2, 0);

    var param3 = new Buffer(4);
    param3.writeUInt32BE(this.param3, 0);

    var param4 = new Buffer(4);
    param4.writeUInt32BE(this.param4, 0);

    var myCount = new Buffer(2);
    myCount.writeUInt16BE(this.myCount, 0);

    var yourCount = new Buffer(2);
    yourCount.writeUInt16BE(this.yourCount, 0);

    var data;

    if (this.message != null) {

	var message = new Buffer(96);
	message.fill(String.fromCharCode(0));
	message.write(this.message);

	data = Buffer.concat([header, command, reserved1, zibaseId, reserved2, param1, param2, param3, param4, myCount, yourCount, message]);
    } else {
	data = Buffer.concat([header, command, reserved1, zibaseId, reserved2, param1, param2, param3, param4, myCount, yourCount]);
    }

    logger.debug(data)

    return data;
}

/**
 * Réponse spécifique de la Zibase
 */
function ZbResponse(buffer) {

    /**
     * Construit la réponse à partir des données binaires envoyées par la Zibase
     */

    var tempString = "";
    this.header = buffer.toString('utf8', 0, 4);
    this.command = buffer.readUInt16BE(4);
    tempString = buffer.toString('utf8', 6, 21);
    this.reserved1 = tempString.substr(0, tempString.indexOf('\u0000'));
    tempString = buffer.toString('utf8', 22, 37);
    this.zibaseId = tempString.substr(0, tempString.indexOf('\u0000'));
    tempString = buffer.toString('utf8', 38, 49);
    this.reserved2 = tempString.substr(0, tempString.indexOf('\u0000'));
    this.param1 = buffer.readUInt32BE(50);
    this.param2 = buffer.readUInt32BE(54);
    this.param3 = buffer.readUInt32BE(58);
    this.param4 = buffer.readUInt32BE(62);
    this.myCount = buffer.readUInt16BE(64);
    this.yourCount = buffer.readUInt16BE(66);
    tempString = buffer.toString('utf8', 70);
    this.message = tempString.substr(0, tempString.indexOf('\u0000'));

};

/**
 * Permet de manipuler la ZiBase.
 * Il est nécessaire de connaître l'adresse IP de sa zibase pour l'utiliser.
 * @param string $ipAddr Adresse IP de la zibase
 * @param string $deviceId Device de la zibase
 * @param string $token Token de la zibase
 */
function ZiBase(ipAddr, deviceId, token) {

    this.ip = ipAddr;
    this.port = 49999;
    this.localport = undefined;
    this.myip = require("ip").address();
    this.deregistered = false; // true if deregistration has been requested
    this.deviceId = deviceId;
    this.token = token;
    this.timeZone = "Europe/Paris";

    events.EventEmitter.call(this);

    this.emitEvent = function(event, id, arg) {
	this.emit(event + ":" + id, arg);
    }

    var self = this;
    this.loadDescriptors(function(err) {
	self.listenToZiBase(self.processZiBaseData);
    });
}

util.inherits(ZiBase, events.EventEmitter);

exports.ZiBase = ZiBase;

/*
 * Load the descriptors of declared devices and scenarios
 */
ZiBase.prototype.loadDescriptors = function(cb) {
    this.descriptors = [];
    this.descriptorsByID = [];
    var self = this;
    request.get("https://zibase.net/m/get_xml.php?device=" + this.deviceId + "&token=" + this.token,
		function(error, response, bodyString) {
		    var re = /<([m|e])\s+([^>]*)>\s*<n>([^<]*)<\/n>\s*<\/[m|e]>/g;

		    var match;
		    while (( match = re.exec(bodyString)) != undefined) {
			var type=match[1];
			var props=match[2];
			var name=match[3];
			var desc = {};
			switch(type) {
			case 'e': desc.type = "device"; break;
			case 'm': desc.type = "scenario"; break;
			default: desc.type = ""; 
			    logger.error("unexpected type '" + type + "' from zibase descriptors, 'e' or 'm' expected.");
			    break;
			}
			desc.name = name;

			var rep = /([^=]+)="([^"]*)"\s*/g;
			var matchp;
			while (( matchp = rep.exec(props)) != undefined) {
			    var id = matchp[1];
			    var value = matchp[2];
			    desc[id] = value;
			}
			self.descriptors.push(desc);

			var id = desc.type == "device"?"c":"id";
			assert.notEqual(desc[id], undefined);
			if (desc.type == "device" && desc.p == 6) {
			    // ZWave
			    self.descriptorsByID["Z" + desc[id]] = desc;
			} else
			    self.descriptorsByID[desc[id]] = desc;
		    }
		    cb(null);
		});
}

/*
 * retrieve the descriptor with a given id
 */
ZiBase.prototype.getDescriptor = function(id) 
{
    return this.descriptorsByID[id];
}

ZiBase.prototype.on = function(event, id, callback) {
    if (( typeof event === 'string') && ( typeof id === 'string') && ( typeof callback === 'function')) {
	// normal call
	event = event + ":" + id
    }
    if (( typeof event === 'string') && ( typeof id === 'function') && ( typeof callback === 'undefined')) {
	// probably a call to events.EventEmitter, with the original 'on' parameters
	callback = id
    }
    ZiBase.super_.prototype.on.call(this, event, callback);
}

ZiBase.prototype.once = function(event, id, callback) {
    ZiBase.super_.prototype.once.call(this, event + ":" + id, callback);
    //logger.error(this)
}

ZiBase.prototype.processZiBaseData = function(response) {
    //response.message = "Received radio ID (<rf>433Mhz</rf> Noise=<noise>2090</noise> Level=<lev>2.3</lev><id>OS3930858754</id>"
    if (response.reserved1 == "TEXTMSG") {

	function replaceid(zb, message, entire_string, id, before, id_modified, after){
	    var name;
	    var desc = zb.descriptorsByID[id];
	    if (desc != undefined)
		name = desc.name;
	    if (name != undefined) {
		return message.replace(entire_string, before+id_modified+" ("+name+")"+after);
	    }
	    return message;
	}

	var infos = {};
	//Received radio ID (<rf>ZWAVE ZA5</rf>  <dev>CMD/INTER</dev>  Batt=<bat>Ok</bat>): <id>ZA5_OFF</id>
	if (/Received radio ID \(.*CMD\/INTER/.test(response.message)) {
	    var re = /([^:]+:\s*<id>)(([^_]+)(_OFF)?)(<\/id>)/;
	    if (( match = re.exec(response.message)) != null) {
		logger.trace(match);
		infos.id = match[3];
		infos.value = (match[4] == undefined) ? "ON" : "OFF"
	    }
	    logger.info(replaceid(this, 
				  response.message, 
				  match[0], // entire string
				  match[3], // ID
				  match[1], // start
				  match[2], // "ID modified" to be replaced by "ID modified (name)"
				  match[5] // end
				 ));

	    logger.trace("infos=", infos)
  	    if (infos.id != undefined) {
		this.emitEvent("change", infos.id, infos)
	    }

	}
	//Received radio ID (<rf>433Mhz</rf> Noise=<noise>2175</noise> Level=<lev>2.3</lev>/5 <dev>Oregon  THWR288A-THN132N</dev> Ch=<ch>2</ch> T=<tem>+3.7</tem>°C (+38.6°F)  Batt=<bat>Ok</bat>): <id>OS3930858754</id>
	else if (/Received radio ID \(/.test(response.message)) {
	    var re = /<([^>]+)>([^<]*)<\/(\1)>/g
	    while (( match = re.exec(response.message)) != null) {
		logger.trace(match);
		infos[match[1]] = match[2];
	    }
	    var trace = replaceid(this, 
				  response.message, 
				  "<id>" + infos["id"] + "</id>", // entire string
				  infos["id"], // ID
				  "<id>", // start
				  infos["id"], // "ID modified" to be replaced by "ID modified (name)"
				  "</id>" // end
				 );
	    re = /(<rf>ZWAVE )([^<]+)(<\/rf>)/;
	    if ((match = re.exec(trace)) != null) {
		trace = replaceid(this, 
				  trace, 
				  match[0], // entire string
				  match[2], // ID
				  match[1], // start
				  match[2], // "ID modified" to be replaced by "ID modified (name)"
				  match[3] // end
				 );
	    }
	    logger.info(trace);
	    logger.trace("infos=", infos)
	    if (infos.id != undefined) {
		this.emitEvent("change", infos.id, infos)
	    }
	}
	//Sent radio ID (1 Burst(s), Protocols='Family http' ): I5_OFF
	else if (/Sent radio ID \(/.test(response.message)) {
	    var re = /([^:]+:\s*)(([^_]+)(_OFF|_ON)?)/
		if (( match = re.exec(response.message)) != null) {
		    logger.trace(match);
		    infos.id = match[3];
		    infos.value = (match[4] == "_OFF") ? "OFF" : "ON"
		    logger.info(replaceid(this, 
					  response.message, 
					  match[0], // entire string
					  match[3], // ID
					  match[1], // start
					  match[2], // "ID modified" to be replaced by "ID modified (name)"
					  "" // end
					 ));
		} else {
		    logger.error("Error, regexp " + re +  " not found in response.message!");
		    logger.info(response.message);

		}
	    logger.trace("infos=", infos)
	    if (infos.id != undefined) {
		this.emitEvent("change", infos.id, infos)
	    }
	}
	//ZWave warning - Device ZA8 is unreachable! : ERR_ZA8
	else if (/ZWave warning/.test(response.message)) {
	    var re = /([^:]+:\s*)(ERR_([^_]+))/;
	    if (( match = re.exec(response.message)) != null) {
		logger.trace(match);
		infos.id = match[3];
		infos.value = "ERR";
		logger.error(infos);
		logger.error(match);
		logger.info(replaceid(this, 
				      response.message, 
				      match[0], // entire string
				      match[3], // ID
				      match[1], // start
				      match[2], // "ID modified" to be replaced by "ID modified (name)"
				      "" // end
				     ));
	    } else {
		logger.error("Error, regexp " + re +  " not found in response.message!");
		logger.info(response.message);
	    }
	    
	    logger.error("infos=", infos)
	    if (infos.id != undefined) {
		logger.error(infos.id, infos)
		this.emitEvent("error", infos.id, infos)
		logger.error("after emitEvent")
	    }
	}
	// Completed SCENARIO: 45
	else if (/(Completed|Launch) SCENARIO:/.test(response.message)) {
	    var re = /(SCENARIO: )([0-9]+)/;
	    if (( match = re.exec(response.message)) != null) {
		logger.trace(match);
	    }
	    logger.info(replaceid(this, 
				  response.message, 
				  match[0], // entire string
				  match[2], // ID
				  match[1], // start
				  match[2], // "ID modified" to be replaced by "ID modified (name)"
				  "" // end
				 ));
	} else
	    logger.info(response.message);
    } else if (response.reserved1 == "SLAMSIG") {
	// zibase is restarting
	// let's reinit
	self = this;
	this.loadDescriptors(function (err) {
	    // deregister first, just in case
	    deregisterListener();
	    // then re-listen to zibase
	    self.deregistered = false;
	    self.listenToZiBase(self.processZiBaseData);
	});
    } else {
	logger.warn("Unsupported response:", response)
    }

};

var messageQueue = [];

function nextCallback() {
    logger.debug("nextCallback called")
    // removing previous request, which has been handled
    messageQueue.shift();
    // check if still a message to process
    if (messageQueue.length > 0) {
	logger.debug("queue not empty; processing")
	var callback = messageQueue[0];
	logger.debug(callback)
	callback();
    }
};

function pushRequest(requestFunc) {
    logger.debug("pushing request")
    messageQueue.push(requestFunc)
    if (messageQueue.length === 1) {
	logger.debug("queue was empty, processing")
	requestFunc()
    } else {
	logger.debug("queue not empty, waiting")
    }
}

/**
 * Envoie la requête à la Zibase sur le réseau
 * @param ZbRequest requête au format Zibase
 */
ZiBase.prototype.sendRequest = function(request, withResponse, callback) {

    logger.debug('request=', request);

    if (withResponse == undefined) {
	withResponse = true
    }

    var socket = dgram.createSocket('udp4');
    var self = this;

    pushRequest(function() {
	if (withResponse) {
	    var t = setTimeout(function() {
		var address = socket.address();
		var err = new Error("socket timeout while waiting for response on " + socket.address().port);
		socket.close();
		callback(err, undefined)
		nextCallback();
	    }, 10000);
	    // 10 seconds

	    socket.on("message", function(msg, rinfo) {
		clearTimeout(t);

		logger.trace("socket got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

		var response = null;
		if (msg.length > 0) {
		    response = new ZbResponse(msg);
		    logger.trace("response=", response)
		    callback(null, response);
		}
		logger.debug("socket closing " + socket.address().port);
		socket.close();
		nextCallback();
	    });

	    socket.on("listening", function() {
		var address = socket.address();
		logger.debug("socket listening from SendRequest on " + address.port);
	    });

	    socket.on("error", function() {
		var address = socket.address();
		logger.error("socket error on port " + address.port);
		nextCallback();
	    });
	    socket.bind();
	}

	var buffer = request.toBinaryArray();
	socket.send(buffer, 0, buffer.length, self.port, self.ip, function(err, bytes) {
	    logger.trace("buffer.length=", buffer.length);
	    logger.trace("err=", err);
	    logger.trace("bytes=", bytes);
	    logger.trace("fin");
	    if (!withResponse) {
		logger.debug("socket closing " + socket.address().port);
		socket.close();
		nextCallback();
	    }
	});
    });
};

/**
 * Lance la commande RF de l'actionneur spécifié par son adresse et son protocol
 * @param string $address Adresse au format X10 de l'actionneur (ex: B5)
 * @param int $action Action à réaliser (Utiliser l'enum ZbAction)
 * @param int $protocol Protocole RF (Utiliser l'enum ZbProtocol)
 * @param int $dimLevel Non supporté par la zibase pour l'instant
 * @param int $nbBurst Nombre d'émissions RF
 */
ZiBase.prototype.sendCommand = function(address, action, protocol, dimLevel, nbBurst) {
    logger.info("params:", address, action, protocol, dimLevel, nbBurst)
    if (protocol == undefined) {
	protocol = ZbProtocol.PRESET
    }
    if (dimLevel == undefined) {
	dimLevel = 0
    }
    if (nbBurst == undefined) {
	nbBurst = 1
    }
    if (address.length > 1) {
	if (address[0] == "Z") {
	    address = address.toUpperCase();
	    address = address.substr(1);
	    protocol = ZbProtocol.ZWAVE;
	}
    }
    if (address.length > 1) {
	var request = new ZbRequest();
	request.command = 11;

	if (action == ZbAction.DIM_BRIGHT && dimLevel == 0)
	    action = ZbAction.OFF;

	request.param2 = action;
	logger.debug("action = ", action)
	request.param2 |= (protocol & 0xFF) << 0x08;
	if (action == ZbAction.DIM_BRIGHT)
	    request.param2 |= (dimLevel & 0xFF) << 0x10;
	if (nbBurst > 1)
	    request.param2 |= (nbBurst & 0xFF) << 0x18;

	request.param3 = 0 + address.substr(1) - 1;
	request.param4 = address.charCodeAt(0) - 0x41;

	this.sendRequest(request, true, function(response) {
	    logger.info("response from Zibase = ", response);
	});
    }
};

/**
 * Lance le scenario spécifié par son numéro.
 * Le numéro du scenario est indiqué entre parenthèse
 * dans le suivi d'activité de la console de configuration.
 * @param int numScenario Le numéro du scenario
 */
ZiBase.prototype.runScenario = function(numScenario) {
    logger.info("runScenario", numScenario);
    var request = new ZbRequest();
    request.command = 11;
    request.param1 = 1;
    request.param2 = numScenario;
    this.sendRequest(request, true, function(response) {
	logger.info("response from Zibase = ", response);
    });
}

/**
 * Positionne une alerte à l’état ON / OFF ou simule
 * l’arrivée d’un ID détecteur.
 * dans le suivi d'activité de la console de configuration.
 * @param int action L'action: 0 - inactiver une alerte, 1 - activer une alerte, 2 - simuler l’arrivée d’un ID de détecteur (peut entraîner l’exécution de scénarios)
 * @param String address au format X10 de l'actionneur (ex: B5 ou ZA14)
 */
ZiBase.prototype.setEvent = function(action, address) {
    logger.info("setEvent", action, address);
    var request = new ZbRequest();
    request.command = 11;
    request.param1 = 4;
    request.param2 = action;

    var ev_type;
    if (action == 0) {
	ev_type = 9
    }
    if (action == 1 || action == 2) {
	ev_type = 4
    }
    var protocol;
    if (address.length > 1) {
	address = address.toUpperCase();
	if (address[0] == "Z") {
	    address = address.substr(1);
	    protocol = ZbProtocol.ZWAVE;
	}
	var letter = address.charCodeAt(0) - 0x41;
	var device = 0 + address.substr(1) - 1;
	var id = letter * 16 + device

    }

    request.param3 = id;

    if (protocol == ZbProtocol.ZWAVE) {
	if (ev_type == 4)
	    ev_type = 19
	if (ev_type == 9)
	    ev_type = 20
    }
    request.param4 = ev_type;
    this.sendRequest(request, false, function(response) {
	logger.info("response from Zibase = ", response);
    });
}

/**
 * Récupère la valeur d'une variable Vx de la Zibase
 * @param int $numVar le numéro de la variable (0 à 19)
 * @return int la valeur de la variable demandée
 */
ZiBase.prototype.getVariable = function(numVar, callback) {
    logger.trace("entering getVariable", numVar);

    var request = new ZbRequest();
    request.command = 11;
    request.param1 = 5;
    request.param3 = 0;
    request.param4 = numVar;

    this.sendRequest(request, true, function(err, response) {
	logger.info("getVariable", numVar, "=> err=", err, "value=", (response != null) ? response.param1 : null);
	callback(err, (response != null) ? response.param1 : null);
    });

}

/**
 * Enregistre une machine en tant qu'écouteur
 * @param string $ip l'adresse IP de l'écouteur
 * @param int $port le port sur lequel écouter
 */
ZiBase.prototype.registerListener = function(port) {
    this.localport = port;
    var ip = this.myip;

    logger.info("registerListener", ip, port);

    var request = new ZbRequest();
    request.command = 13;
    request.param1 = ip2long(ip);
    request.param2 = port;
    request.param3 = 0;
    request.param4 = 0;
    this.sendRequest(request, false);
};

/**
 * Désenregistre une machine en tant qu'écouteur
 */
ZiBase.prototype.deregisterListener = function() {
    logger.info("deregisterListener", this.myip, this.localport);
    this.deregistered = true;
    if (this.socket != undefined) {
	this.socket.close();
	this.socket = undefined;
    }
    var request = new ZbRequest();
    request.command = 22;
    request.param1 = ip2long(this.myip);
    request.param2 = this.localport;
    request.param3 = 0;
    request.param4 = 0;
    this.sendRequest(request, false);
};

/**
 * Récupère l'état d'un actionneur.
 * La zibase ne recoit que les ordres RF et non les ordres CPL X10,
 * donc l'état d'un actionneur X10 connu par la zibase peut être erronné.
 * @param string adresse au format X10 de l'actionneur
 * @return int l'état : 0=OFF, 1=ON
 */
ZiBase.prototype.getState = function(address, callback) {
    logger.trace("getState", address);

    var isZWave = false;
    if (address.length > 1) {
	address = address.toUpperCase();
	if (address[0] == "Z") {
	    isZWave = true;
	    address = address.substr(1);
	}
    }
    if (address.length > 1) {
	var request = new ZbRequest();
	request.command = 11;
	request.param1 = 5;
	request.param3 = 4;

	var houseCode = address.charCodeAt(0) - 0x41;
	var device = 0 + address.substr(1) - 1;
	request.param4 = device;
	request.param4 |= (houseCode & 0x0F) << 0x04;

	// Pour le zwave, il faut mettre le 9e bit à 1
	if (isZWave)
	    request.param4 |= 0x0100;

	this.sendRequest(request, true, function(err, response) {
	    logger.info("getState", address, "=> err=", err, "value=", (response != null) ? response.param1 : null);
	    callback(err, (response != null) ? response.param1 : null);
	});
    }

};

ZiBase.prototype.getSensorInfo = function(idSensor, callback) {

    var typeSensor = idSensor.substring(0, 2);
    var numberSensor = idSensor.substring(2, 10000);
    var zibaseIP = this.ip;

    request.get("http://" + zibaseIP + "/sensors.xml", function(err, bodyString, statusCode) {
	var re = new RegExp('<ev type="([^"]*)" +pro="' + typeSensor + '" +id="' + numberSensor + '" +gmt="([^"]*)" +v1="([^"]*)" +v2="([^"]*)" +lowbatt="([^"]*)"/>', "g");

	var match;
	if (( match = re.exec(bodyString)) != undefined) {
	    for ( i = 1; i < match.length; i++) {
		var to = match[i];
		logger.trace(to);
	    }
	    var type = match[1];
	    //			var pro = match[2];
	    //			var id = match[3];
	    var gmt = match[2];
	    var v1 = match[3];
	    var v2 = match[4];
	    var lowbat = match[5];

	    // create a new javascript Date object based on the timestamp
	    // multiplied by 1000 so that the argument is in milliseconds, not seconds
	    var date = new Date(gmt * 1000);
	    // hours part from the timestamp
	    var hours = date.getHours();
	    // minutes part from the timestamp
	    var minutes = date.getMinutes();
	    // seconds part from the timestamp
	    var seconds = date.getSeconds();

	    logger.trace("date=", date);
	    logger.trace("v1=", v1);
	    logger.trace("v2=", v2);

	    var results = new Object
	    results.date = date
	    results.v1 = v1
	    results.v2 = v2

	    callback(null, results);

	} else {
	    // found nothing
	    callback(new Error("idSensor '" + idSensor + "' not found in http://" + zibaseIP + "/sensors.xml"), {
		date : null,
		v1 : 0,
		v2 : 0
	    });
	}

    });
};

function ip2long(IP) {
    // http://kevin.vanzonneveld.net
    // +   original by: Waldo Malqui Silva
    // +   improved by: Victor
    // +    revised by: fearphage (http://http/my.opera.com/fearphage/)
    // +    revised by: Theriault
    // *     example 1: ip2long('192.0.34.166');
    // *     returns 1: 3221234342
    // *     example 2: ip2long('0.0xABCDEF');
    // *     returns 2: 11259375
    // *     example 3: ip2long('255.255.255.256');
    // *     returns 3: false
    var i = 0;
    // PHP allows decimal, octal, and hexadecimal IP components.
    // PHP allows between 1 (e.g. 127) to 4 (e.g 127.0.0.1) components.
    IP = IP.match(/^([1-9]\d*|0[0-7]*|0x[\da-f]+)(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?$/i);
    // Verify IP format.
    if (!IP) {
	return false;
	// Invalid format.
    }
    // Reuse IP variable for component counter.
    IP[0] = 0;
    for ( i = 1; i < 5; i += 1) {
	IP[0] += !!((IP[i] || '').length);
	IP[i] = parseInt(IP[i]) || 0;
    }
    // Continue to use IP for overflow values.
    // PHP does not allow any component to overflow.
    IP.push(256, 256, 256, 256);
    // Recalculate overflow of last component supplied to make up for missing components.
    IP[4 + IP[0]] *= Math.pow(256, 4 - IP[0]);
    if (IP[1] >= IP[5] || IP[2] >= IP[6] || IP[3] >= IP[7] || IP[4] >= IP[8]) {
	return false;
    }
    return IP[1] * (IP[0] === 1 || 16777216) + IP[2] * (IP[0] <= 2 || 65536) + IP[3] * (IP[0] <= 3 || 256) + IP[4] * 1;
}

ZiBase.prototype.listenToZiBase = function(processDataMethod) {

    var socket = dgram.createSocket('udp4');

    var self = this;
    self.socket = socket;

    socket.on("message", function(msg, rinfo) {

	if (msg.length > 0) {
	    var response = new ZbResponse(msg);
	    processDataMethod.call(self, response);
	}


    });

    socket.on("listening", function() {
	var address = socket.address();
	logger.info("socket listening from listenZiBase: " + address.port);

	if (self.deregistered == false) {
	    self.registerListener(address.port);
	} else {
	    socket.close();
	}
    });

    socket.bind();

};

