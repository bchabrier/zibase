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
	transport: function (data) {
		console.log(data.output);
		if (exports.test_logger == true) {
			exports.test_logger_data = data;
		}
	},
	dateformat: "dd/mm/yyyy HH:MM:ss.l",
	level: 3 //0:'test', 1:'trace', 2:'debug', 3:'info', 4:'warn', 5:'error'
});

/**
 * Zibase protocols
 * @namespace
 */
var ZbProtocol = new function () {
	/** * @constant */
	this.PRESET = 0;
	/** * @constant */
	this.VISONIC433 = 1;
	/** * @constant */
	this.VISONIC868 = 2;
	/** * @constant */
	this.CHACON = 3;
	/** * @constant */
	this.DOMIA = 4;
	/** * @constant */
	this.X10 = 5;
	/** * @constant */
	this.ZWAVE = 6;
	/** * @constant */
	this.RFS10 = 7;
	/** * @constant */
	this.X2D433 = 8;
	/** * @constant */
	this.X2D433ALRM = 8;
	/** * @constant */
	this.X2D868 = 9;
	/** * @constant */
	this.X2D868ALRM = 9;
	/** * @constant */
	this.X2D868INSH = 10;
	/** * @constant */
	this.X2D868PIWI = 11;
	/** * @constant */
	this.X2D868BOAC = 12;
};
exports.ZbProtocol = ZbProtocol;

/**
 * Virtual probes
 * @namespace
 */
var ZbVirtualProbe = new function () {
	/** * @constant */
	this.OREGON = 17;
	/** * @constant */
	this.OWL = 20;

};

/**
 * Possible actions of the Zibase
 * @namespace
 */
var ZbAction = new function () {
	/** * @constant */
	this.OFF = 0;
	/** * @constant */
	this.ON = 1;
	/** * @constant */
	this.DIM_BRIGHT = 2;
	/** * @constant */
	this.ALL_LIGHTS_ON = 4;
	/** * @constant */
	this.ALL_LIGHTS_OFF = 5;
	/** * @constant */
	this.ALL_OFF = 6;
	/** * @constant */
	this.ASSOC = 7;
};
exports.ZbAction = ZbAction;

/*
 * Possible states of alerts in the Zibase
 * @namespace
var ZbEventType = new function () {
    this.OFF = 9;
    this.ON = 4;
};
exports.ZbEventType = ZbEventType;
*/

/**
 * Creates an empty request.
 * @param {string} description Description of the request, which is useful for error tracking and debugging.
 * @class Handles requests to the Zibase
 */
function ZbRequest(description) {
	this.description = description;
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
 * Formats the request into a binary array understandable by the Zibase.
 * @return {Buffer} Binary array
 */

ZbRequest.prototype.toBinaryArray = function () {

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
 * Creates a response from the binary data sent by the Zibase
 * @class Handles responses from the Zibase
 * @param {Buffer} buffer Binary data
 */
function ZbResponse(buffer) {

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
 * 
 * @class Allows to manipulate the zibase. The IP of the zibase is needed.
 * @param {string} ipAddr  IP address of the zibase
 * @param {string} deviceId Device ID of the zibase
 * @param {string} token Token of the zibase
 * @param {function} callback Callback to call when the connection to the zibase is established.
 * @extends events.EventEmitter
 */
function ZiBase(ipAddr, deviceId, token, callback) {

	this.ip = ipAddr;
	this.port = 49999;
	this.localport = undefined;
	this.myip = require("ip").address();
	this.deregistered = false; // true if deregistration has been requested
	this.deviceId = deviceId;
	this.token = token;
	this.timeZone = "Europe/Paris";

	events.EventEmitter.call(this);

	this.emitEvent = function (event, arg1, arg2) {
		if (arg2) {
			var id = arg1;
			var arg = arg2;
			this.emit(event + ":" + id, arg);
		} else {
			this.emit(event, arg1);
		}
	}

	var self = this;
	this.loadDescriptors(function (err) {
		self.listenToZiBase(self.processZiBaseData);
		/* istanbul ignore else */
		if (callback)
			callback(err);
	});
}

util.inherits(ZiBase, events.EventEmitter);

exports.ZiBase = ZiBase;

/**
  * Loads the descriptors of declared devices and scenarios
  * @param {function} cb Callback to be called when the descriptors are loaded
  */
ZiBase.prototype.loadDescriptors = function (cb) {
	this.descriptors = [];
	this.descriptorsByID = [];
	var self = this;
	// zibase.net having been decommissionned, let's not go through it anymore
	return cb(null);
	request.get("https://zibase.net/m/get_xml.php?device=" + this.deviceId + "&token=" + this.token,
		function (error, response, bodyString) {
			if (error) {
				logger.error(error);
			}
			if (bodyString == "") {
				cb(new Error("Cannot load descriptors, empty response from https://zibase.net/m/get_xml.php?device=XXX&token=XXX"));
				return;
			}
			var re = /<([m|e])\s+([^>]*)>\s*<n>([^<]*)<\/n>\s*<\/[m|e]>/g;

			var match;
			while ((match = re.exec(bodyString)) != undefined) {
				var type = match[1];
				var props = match[2];
				var name = match[3];
				var desc = {};
				switch (type) {
					case 'e': desc.type = "device"; break;
					case 'm': desc.type = "scenario"; break;
					/* istanbul ignore next */
					default: desc.type = "";
						logger.error("unexpected type '" + type + "' from zibase descriptors, 'e' or 'm' expected.");
						break;
				}
				desc.name = name;

				var rep = /([^=]+)="([^"]*)"\s*/g;
				var matchp;
				while ((matchp = rep.exec(props)) != undefined) {
					var id = matchp[1];
					var value = matchp[2];
					desc[id] = value;
				}
				self.descriptors.push(desc);

				var id = desc.type == "device" ? "c" : "id";
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

/**
 * retrieves the descriptor with a given id
 * @param {string} id ID of the descriptor to retrieve
 */
ZiBase.prototype.getDescriptor = function (id) {
	return this.descriptorsByID[id];
}

/**
 * listens to events
 * @param {string} event Event to be listened to
 * @param {string} [id] The ID of the device that triggers the event. Don't specify any when the event is triggered by the zibase
 * @param {function} callback Callback to be called when the event is triggered. The parameters of the callback depend on the event
 */
ZiBase.prototype.on = function (event, id, callback) {
	/* istanbul ignore else */
	if ((typeof event === 'string') && (typeof id === 'string') && (typeof callback === 'function')) {
		event = event + ":" + id
	}
	/* istanbul ignore else */
	if ((typeof event === 'string') && (typeof id === 'function') && (typeof callback === 'undefined')) {
		callback = id
	}
	ZiBase.super_.prototype.on.call(this, event, callback);
}

/**
 * same as method <tt>on</tt> but only for one event
 * @see Zibase#on
 * @param {string} event Event to be listened to
 * @param {string} [id] The ID of the device that triggers the event. Don't specify any when the event is triggered by the zibase
 * @param {function} callback Callback to be called when the event is triggered. The parameters of the callback depend on the event
 */
ZiBase.prototype.once = function (event, id, callback) {
	/* istanbul ignore else */
	if ((typeof event === 'string') && (typeof id === 'string') && (typeof callback === 'function')) {
		// normal call
		event = event + ":" + id
	}
	/* istanbul ignore else */
	if ((typeof event === 'string') && (typeof id === 'function') && (typeof callback === 'undefined')) {
		callback = id
	}
	ZiBase.super_.prototype.once.call(this, event, callback);
	//logger.error(this)
}

/**
 * process the information messages sent by the zibase.
 * Emits events depending on the content of the response.
 * @param {Response} response A response to process, as sent by the zibase
 */
ZiBase.prototype.processZiBaseData = function (response) {

	//response.message = "Received radio ID (<rf>433Mhz</rf> Noise=<noise>2090</noise> Level=<lev>2.3</lev><id>OS3930858754</id>"
	if (response.reserved1 == "TEXTMSG") {

		function replaceid(zb, message, entire_string, id, before, id_modified, after) {
			var name;
			var desc = zb.descriptorsByID[id];
			/* istanbul ignore else */
			if (desc != undefined)
				name = desc.name;
			/* istanbul ignore else */
			if (name != undefined) {
				return message.replace(entire_string, before + id_modified + " (" + name + ")" + after);
			}
			return message;
		}

		var infos = {};
		//Received radio ID (<rf>ZWAVE ZA5</rf>  <dev>CMD/INTER</dev>  Batt=<bat>Ok</bat>): <id>ZA5_OFF</id>
		if (/Received radio ID \(.*CMD\/INTER/.test(response.message)) {
			var re = /([^:]+:\s*<id>)(([^_]+)(_OFF)?)(<\/id>)/;
			if ((match = re.exec(response.message)) != null) {
				logger.trace(match);
				infos.id = match[3];
				infos.value = (match[4] == undefined) ? "ON" : "OFF";
				infos.dev = 'CMD/INTER';
			}
			var msg = replaceid(this,
				response.message,
				match[0], // entire string
				match[3], // ID
				match[1], // start
				match[2], // "ID modified" to be replaced by "ID modified (name)"
				match[5] // end
			);
			logger.info(msg);
			this.emitEvent("message", { message: msg, raw_message: response.message });

			logger.trace("infos=", infos)
			/* istanbul ignore else */
			if (infos.id != undefined) {
				this.emitEvent("change", infos.id, infos)
			}

		}
		//Received radio ID (<rf>433Mhz</rf> Noise=<noise>2175</noise> Level=<lev>2.3</lev>/5 <dev>Oregon  THWR288A-THN132N</dev> Ch=<ch>2</ch> T=<tem>+3.7</tem>°C (+38.6°F)  Batt=<bat>Ok</bat>): <id>OS3930858754</id>
		else if (/Received radio ID \(/.test(response.message)) {
			var re = /<([^>]+)>([^<]*)<\/(\1)>/g
			while ((match = re.exec(response.message)) != null) {
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
			/* istanbul ignore else */
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
			this.emitEvent("message", { message: trace, raw_message: response.reserved1 });
			logger.trace("infos=", infos)
			/* istanbul ignore else */
			if (infos.id != undefined) {
				this.emitEvent("change", infos.id, infos)
			}
		}
		//Sent radio ID (1 Burst(s), Protocols='Family http' ): I5_OFF
		else if (/Sent radio ID \(/.test(response.message)) {
			var msg;
			var re = /([^:]+:\s*)(([^_]+)(_OFF|_ON)?)/
			if ((match = re.exec(response.message)) != null) {
				logger.trace(match);
				infos.id = match[3];
				infos.value = (match[4] == "_OFF") ? "OFF" : "ON"
				msg = replaceid(this,
					response.message,
					match[0], // entire string
					match[3], // ID
					match[1], // start
					match[2], // "ID modified" to be replaced by "ID modified (name)"
					"" // end
				);
				logger.info(msg);
			} else {
				msg = response.message;
				logger.error("Error, regexp " + re + " not found in response.message!");
				logger.info(response.message);

			}
			this.emitEvent("message", { message: msg, raw_message: response.message });
			logger.trace("infos=", infos)
			/* istanbul ignore else */
			if (infos.id != undefined) {
				this.emitEvent("change", infos.id, infos)
			}
		}
		//ZWave warning - Device ZA8 is unreachable! : ERR_ZA8
		else /* istanbul ignore else */ if (/ZWave warning.*ERR_/.test(response.message)) {
			var re = /([^:]+:\s*)(ERR_([^_]+))/;
			var msg;
			if ((match = re.exec(response.message)) != null) {
				logger.trace(match);
				infos.id = match[3];
				infos.value = "ERR";
				logger.debug(infos);
				logger.debug(match);
				msg = replaceid(this,
					response.message,
					match[0], // entire string
					match[3], // ID
					match[1], // start
					match[2], // "ID modified" to be replaced by "ID modified (name)"
					"" // end
				);
			} else {
				msg = response.message;
				logger.error("Error, regexp " + re + " not found in response.message!");
			}

			logger.info(msg);
			this.emitEvent("message", { message: msg, raw_message: response.message });
			/* istanbul ignore else */
			if (infos.id != undefined) {
				this.emitEvent("error", infos.id, infos)
			}
		}
		// ZWave warning -  Device ZP16 is unknown!
		else if (/ZWave warning.*unknown/.test(response.message)) {
			var re = /(.*Device\s*)([A-Z]+[0-9]+)/;
			var msg;
			if ((match = re.exec(response.message)) != null) {
				logger.trace(match);
				infos.id = match[2];
				infos.value = "ERR";
				logger.debug(infos);
				logger.debug(match);
				msg = replaceid(this,
					response.message,
					match[0], // entire string
					match[2], // ID
					match[1], // start
					match[2], // "ID modified" to be replaced by "ID modified (name)"
					"" // end
				);
			} else {
				msg = response.message;
				logger.error("Error, regexp " + re + " not found in response.message!");
			}

			logger.info(msg);
			this.emitEvent("message", { message: msg, raw_message: response.message });
			/* istanbul ignore else */
			if (infos.id != undefined) {
				this.emitEvent("error", infos.id, infos)
			}
		}
		// Completed SCENARIO: 45
		else if (/(Completed|Launch) SCENARIO:/.test(response.message)) {
			var re = /(SCENARIO: )([0-9]+)/;
			/* istanbul ignore else */
			if ((match = re.exec(response.message)) != null) {
				logger.trace(match);
			}
			var msg = replaceid(this,
				response.message,
				match[0], // entire string
				match[2], // ID
				match[1], // start
				match[2], // "ID modified" to be replaced by "ID modified (name)"
				"" // end
			);
			logger.info(msg);
			this.emitEvent("message", { message: msg, raw_message: response.message });
		} else {
			logger.info(response.message);
			this.emitEvent("message", { message: response.message, raw_message: response.message });
		}
	} else if (response.reserved1 == "SLAMSIG") {
		this.emitEvent("restart");
		// zibase is restarting
		// let's reinit
		self = this;
		this.loadDescriptors(function (err) {
			// deregister first, just in case
			self.deregisterListener();
			// then re-listen to zibase
			self.deregistered = false;
			self.listenToZiBase(self.processZiBaseData);
			self.emitEvent("restarted");
		});
	} else {
		logger.warn("Unsupported response:", response)
	}
};

var messageQueue = [];

function nextCallback() {
	logger.debug("nextCallback called, %d to process", messageQueue.length)
	// removing previous request, which has been handled
	//messageQueue.shift();
	// check if still a message to process
	/* istanbul ignore else */
	if (messageQueue.length > 0) {
		var callback = messageQueue[0];
		logger.debug("queue not empty, processing", util.inspect(callback))
		callback();
		messageQueue.shift();
		nextCallback();
	}
};

function pushRequest(requestFunc) {
	logger.debug("pushing request", util.inspect(requestFunc))
	messageQueue.push(requestFunc);
	nextCallback();
}

/**
 * Sends a request to the zibase
 * @param {ZbRequest} request Request to be sent
 * @param {boolean} withResponse Indicates if a response is to be expected
 * @param {function} callback Callback to be called when the response is received
 */
ZiBase.prototype.sendRequest = function (request, withResponse, callback) {

	logger.debug('request=', request);

	/* istanbul ignore else */
	if (withResponse == undefined) {
		withResponse = true
	}

	var self = this;

	pushRequest(function executeRequest() {
		var socket = dgram.createSocket('udp4');

		var time_sent; // time at which request is sent
		var time_received; // time at which response is received
		if (withResponse) {
			var t = setTimeout(function () {
				var address = socket.address();
				logger.debug("socket closing " + socket.address().port);
				socket.close();

				if (!request.inRetryMode) {
					request.inRetryMode = true;
					logger.warn("socket timeout for request '" + request.description + "'. Retrying...");
					//		    nextCallback(); // unpile the current call
					// and try again
					//		    self.sendRequest(request, withResponse, callback);
					executeRequest();
				} else {
					var err = new Error("socket timeout while waiting for response on " + address.port + ", request was: '" + request.description + "'.");
					callback(err, undefined)
				}
				nextCallback();
			}, 5 * 1000);
			// 5 seconds x 2 retries = 10 s

			socket.on("message", function (msg, rinfo) {
				clearTimeout(t);

				logger.trace("socket got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

				var response = null;
				/* istanbul ignore else */
				if (msg.length > 0) {
					time_received = new Date();
					response = new ZbResponse(msg);
					logger.trace("response to request '" + request.description + "' received after " + ((time_received - time_sent) / 1000) + "s=", response)
					callback(null, response);
				}
				logger.debug("socket closing " + socket.address().port);
				socket.close();
				nextCallback();
			});

			socket.on("listening", function () {
				var address = socket.address();
				logger.debug("socket listening from SendRequest on " + address.port);
			});

			socket.on("error", function () {
				var address = socket.address();
				logger.error("socket error on port " + address.port);
				nextCallback();
			});
			socket.bind();
		}

		var buffer = request.toBinaryArray();
		time_sent = new Date();
		socket.send(buffer, 0, buffer.length, self.port, self.ip, function (err, bytes) {
			logger.trace("buffer.length=", buffer.length);
			logger.trace("err=", err);
			logger.trace("bytes=", bytes);
			logger.trace("fin");
			/* istanbul ignore else */
			if (!withResponse) {
				logger.debug("socket closing " + socket.address().port);
				socket.close();
				nextCallback();
			}
		});
	});
};

/**
 * Ask the zibase to send a command to an activator specified by its ID and protocol
 * @param {string} address Address of the activator in X10 format (e.g. B5)
 * @param {ZbAction} action Action to execute
 * @param {ZbProtocol} protocol Protocol RF to be used
 * @param {int} dimLevel Not supported by the Zibase for now
 * @param {int} nbBurst Number of RF emissions
 */
ZiBase.prototype.sendCommand = function (address, action, protocol, dimLevel, nbBurst) {
	logger.debug("params:", address, action, protocol, dimLevel, nbBurst)
	/* istanbul ignore else */
	if (protocol == undefined) {
		protocol = ZbProtocol.PRESET
	}
	/* istanbul ignore else */
	if (dimLevel == undefined) {
		dimLevel = 0
	}
	/* istanbul ignore else */
	if (nbBurst == undefined) {
		nbBurst = 1
	}
	var description = "sendCommand(" + address + " " + action + "...)";
	if (/^[zZ]?[a-pA-P]([1-9]|1[0-6])$/.test(address)) {
		address = address.toUpperCase();
		/* istanbul ignore else */
		if (address[0] == "Z") {
			address = address.substr(1);
			protocol = ZbProtocol.ZWAVE;
		}

		var request = new ZbRequest(description);
		request.command = 11;

		/* istanbul ignore else */
		if (action == ZbAction.DIM_BRIGHT && dimLevel == 0)
			action = ZbAction.OFF;

		request.param2 = action;
		logger.debug("action = ", action)
		request.param2 |= (protocol & 0xFF) << 0x08;
		/* istanbul ignore else */
		if (action == ZbAction.DIM_BRIGHT)
			request.param2 |= (dimLevel & 0xFF) << 0x10;
		/* istanbul ignore else */
		if (nbBurst > 1)
			request.param2 |= (nbBurst & 0xFF) << 0x18;

		request.param3 = 0 + address.substr(1) - 1;
		request.param4 = address.charCodeAt(0) - 0x41;

		this.sendRequest(request, true, function (response) {
			logger.debug("response from Zibase = ", response);
		});
	} else {
		throw new Error("address must be (Z)[A-P]1-16.")
	}
};

/**
 * Asks the zibase to run the scenario specified by its number
 * @param {int|string} scenario the scenario number or name
 * @returns {boolean} false if scenario doesn't resolve to a scenario number
 */
ZiBase.prototype.runScenario = function (scenario) {
	logger.info("runScenario", scenario);
	var request = new ZbRequest("runScenario(" + scenario + ")");
	request.command = 11;
	request.param1 = 1;
	var numScenario;
	if (typeof scenario == 'number') {
		numScenario = scenario;
	} else {
		for (var d in this.descriptors) {
			/* istanbul ignore else */
			if (this.descriptors[d].type == "scenario" &&
				this.descriptors[d].name == scenario) {
				numScenario = parseInt(this.descriptors[d].id);
				break;
			}
		}
	}
	/* istanbul ignore else */
	if (typeof numScenario != 'number') {
		logger.error("Error: unknown scenario '" +
			JSON.stringify(scenario) +
			"'. Maybe the scenario is not visible in Zibase?");
		return false;
	}
	request.param2 = numScenario;
	this.sendRequest(request, true, function (response) {
		logger.info("response from Zibase = ", response);
	});
	return true;
}

/**
 * Positions a Zibase alert to the state ON or OFF, or simulates a sensor ID message in the activity log of the Zibase
 * @param {int} action The action: 0 - deactivate an alert, 1 - activate an alert, 2 - simulate a sensor ID message (can trigger the execution of a scenario)
 * @param {string} address Address of the activator in X10 format (e.g. B5 or ZA14)
 */
ZiBase.prototype.setEvent = function (action, address) {
	logger.info("setEvent", action, address);
	var request = new ZbRequest("setEvent(" + address + " " + action + ")");
	request.command = 11;
	request.param1 = 4;
	request.param2 = action;

	var ev_type;
	/* istanbul ignore else */
	if (action == 0) {
		ev_type = 9
	}
	/* istanbul ignore else */
	if (action == 1 || action == 2) {
		ev_type = 4
	}
	var protocol;
	/* istanbul ignore else */
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

	/* istanbul ignore else */
	if (protocol == ZbProtocol.ZWAVE) {
		if (ev_type == 4)
			ev_type = 19
		if (ev_type == 9)
			ev_type = 20
	}
	request.param4 = ev_type;
	this.sendRequest(request, false, function (response) {
		logger.info("response from Zibase = ", response);
	});
}

/**
 * Get the value of a Vx variable of the Zibase
 * @param {int} numVar number of the variable (0 to 31)
 * @param {function} callback Callback to be called when the value is retrieved
 */
ZiBase.prototype.getVariable = function (numVar, callback) {
	logger.trace("entering getVariable", numVar);

	var request = new ZbRequest("getVariable(" + numVar + ")");
	request.command = 11;
	request.param1 = 5;
	request.param3 = 0;
	request.param4 = numVar;

	this.sendRequest(request, true, function (err, response) {
		logger.debug("getVariable", numVar, "=> err=", err, "value=", (response != null) ? response.param1 : null);
		callback(err, (response != null) ? response.param1 : null);
	});

}

/**
 * Asks the Zibase to register the caller client as a listener. 
 * After this call, the Zibase will send its activity log to the caller, on the given port.
 * @param {int} port The port to listen in order to receive the messages
 */
ZiBase.prototype.registerListener = function (port) {
	this.localport = port;
	var ip = this.myip;

	logger.debug("registerListener", ip, port);

	var request = new ZbRequest("registerListener(" + ip + " " + port + ")");
	request.command = 13;
	request.param1 = ip2long(ip);
	request.param2 = port;
	request.param3 = 0;
	request.param4 = 0;
	this.sendRequest(request, false);
};

/**
 * Asks the Zibase to unregister the caller client
 */
ZiBase.prototype.deregisterListener = function () {
	logger.debug("deregisterListener", this.myip, this.localport);
	this.deregistered = true;
	/* istanbul ignore else */
	if (this.socket != undefined) {
		var a = undefined;
		try {
			a = this.socket.address()
		} catch (e) { a = '<unbound socket>'}
		logger.debug("socket closing " + a);
		this.socket.close();
		this.socket = undefined;
	}
	var request = new ZbRequest("deregisterListener(" + this.myip + " " + this.localport + ")");
	request.command = 22;
	request.param1 = ip2long(this.myip);
	request.param2 = this.localport;
	request.param3 = 0;
	request.param4 = 0;
	this.sendRequest(request, false);
};

/**
 * Gets the state of an activator from the Zibase
 * @param {string} adress X10 formatted address of the activator
 * @param {function} callback Callback to be called when the state is received
 */
ZiBase.prototype.getState = function (address, callback) {
	logger.trace("getState", address);

	var description = "getState(" + address + ")";

	var isZWave = false;
	/* istanbul ignore else */
	if (address.length > 1) {
		address = address.toUpperCase();
		/* istanbul ignore else */
		if (address[0] == "Z") {
			isZWave = true;
			address = address.substr(1);
		}
	}
	/* istanbul ignore else */
	if (address.length > 1) {
		var request = new ZbRequest(description);
		request.command = 11;
		request.param1 = 5;
		request.param3 = 4;

		var houseCode = address.charCodeAt(0) - 0x41;
		var device = 0 + address.substr(1) - 1;
		request.param4 = device;
		request.param4 |= (houseCode & 0x0F) << 0x04;

		// Pour le zwave, il faut mettre le 9e bit à 1
		/* istanbul ignore else */
		if (isZWave)
			request.param4 |= 0x0100;

		this.sendRequest(request, true, function (err, response) {
			logger.debug("getState", address, "=> err=", err, "value=", (response != null) ? response.param1 : null);
			callback(err, (response != null) ? response.param1 : null);
		});
	}

};

/**
 * retrieves the information about a given sensor
 * @param {string} idSensor ID of the sensor
 * @param {function} callback Callback to be called when the info is retrieved
*/
ZiBase.prototype.getSensorInfo = function (idSensor, callback) {

	var typeSensor = idSensor.substring(0, 2);
	var numberSensor = idSensor.substring(2, 10000);
	var zibaseIP = this.ip;
	var self = this;

	var singleTimeout = 1000; // timeout of a single request

	var timeout = 15000; // global timeout
	var start = Date.now();

	function getAndProcess() {

		var singleStart = Date.now();
		request.get("http://" + zibaseIP + "/sensors.xml", { timeout: singleTimeout }, function (err, response, bodyString) {

			/* istanbul ignore else */
			if (err) {
				if (Date.now() - start > timeout) {
					logger.error(err);
					callback(err);
				} else {
					var delay = singleTimeout - (Date.now() - singleStart);
					if (delay <= 0) {
						getAndProcess();
					} else {
						setTimeout(function () {
							getAndProcess();
						}, delay);
					}
				}
				return;
			}
			var re = new RegExp('<ev type="([^"]*)" +pro="' + typeSensor + '" +id="' + numberSensor + '" +gmt="([^"]*)" +v1="([^"]*)" +v2="([^"]*)" +lowbatt="([^"]*)"/>', "g");
			var match;
			if ((match = re.exec(bodyString)) != undefined) {
				for (i = 1; i < match.length; i++) {
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
					date: null,
					v1: 0,
					v2: 0
				});
			}
		});
	}

	getAndProcess();
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
	/* istanbul ignore else */
	if (!IP) {
		return false;
		// Invalid format.
	}
	// Reuse IP variable for component counter.
	IP[0] = 0;
	for (i = 1; i < 5; i += 1) {
		IP[0] += !!((IP[i] || '').length);
		IP[i] = parseInt(IP[i]) || 0;
	}
	// Continue to use IP for overflow values.
	// PHP does not allow any component to overflow.
	IP.push(256, 256, 256, 256);
	// Recalculate overflow of last component supplied to make up for missing components.
	IP[4 + IP[0]] *= Math.pow(256, 4 - IP[0]);
	/* istanbul ignore else */
	if (IP[1] >= IP[5] || IP[2] >= IP[6] || IP[3] >= IP[7] || IP[4] >= IP[8]) {
		return false;
	}
	return IP[1] * (IP[0] === 1 || 16777216) + IP[2] * (IP[0] <= 2 || 65536) + IP[3] * (IP[0] <= 3 || 256) + IP[4] * 1;
}

ZiBase.prototype.listenToZiBase = function (processDataMethod) {

	var socket = dgram.createSocket('udp4');

	var self = this;
	if (self.socket) {
		logger.debug("socket closing " + self.socket.address().port);
		self.socket.close();
	}
	self.socket = socket;

	socket.on("message", function (msg, rinfo) {

		if (msg.length > 0) {
			var response = new ZbResponse(msg);
			processDataMethod.call(self, response);
		}


	});

	socket.on("listening", function () {
		var address = socket.address();
		logger.debug("socket listening on: " + address.port);

		if (self.deregistered == false) {
			self.registerListener(address.port);
		} else {
			logger.debug("socket closing: " + address.port);
			socket.close();
			self.socket = undefined;
		}
	});

	socket.bind();
};

ZiBase.prototype.executeRemote = function (id, action) {
	request.get("https://zibase.net/api/get/ZAPI.php?zibase=" + this.deviceId + "&token=" + this.token + "&service=execute&target=remote&id=" + id + "&action=" + action,
		function (error, response, bodyString) {
			if (error)
				logger.error(error);
			if (!/"head" : "success"/.test(bodyString)) {
				logger.error("executeRemote(" + id + ") failed. Response=" + bodyString);
			}
		});
}
