[![Build Status](https://travis-ci.org/bchabrier/zibase.svg?branch=master)](https://travis-ci.org/bchabrier/zibase) [![NPM version](http://img.shields.io/npm/v/zibase.svg)](https://www.npmjs.org/package/zibase) [![Dependency Status](https://david-dm.org/bchabrier/zibase.svg)](https://david-dm.org/bchabrier/zibase) [![Coverage Status](https://coveralls.io/repos/github/bchabrier/zibase/badge.svg?branch=master)](https://coveralls.io/github/bchabrier/zibase?branch=master)

[![NPM](https://nodei.co/npm/zibase.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/zibase/)

zibase
======

A NodeJS API to ZiBase

Introduction
------------

This module is a SDK to connect to a Zibase. Most of it should be working fine, as it is currently used in a real home automation installation. However, it has been tested so far only against a [Zibase Classic](http://www.zodianet.com/en/toolbox-zibase/zibase-classic.html).

This SDK is strongly inspired from the [PHP SDK](http://bgarel.free.fr/Zibase/) written by Benjamin Garel.

Installation
------------

Install as a npm module:
```npm
npm install zibase
```

Usage
-----

Use as a npm module:

```javascript
var zibase = require('zibase');
```

Connection to a Zibase
----------------------

In order to communicate with a Zibase it is necessary to connect to it by instanciating the `ZiBase` class. For this, the IP address `zibaseIP` and the credentials  `deviceId` and `token` of the Zibase are needed.

```javascript
var Zibase = new zibase.ZiBase(
                   zibaseIP,
                   deviceId,
                   token);
```
An optional `callback` parameter can be used to be notified once the Zibase has been recognized.

```javascript
var Zibase = new zibase.ZiBase(
                   zibaseIP,
                   deviceId,
                   token,
                   function (err) {
                       if (err)
                           console.log(err);
                       else
                           console.log("Connection established.");
                   });
```

It will initialize a connexion to the Zibase, register the calling application as a client of the Zibase, letting the Zibase send its activity information to the client. The first message sent by the Zibase indicates that the registration was successful:
```
21/02/2016 20:32:51.929 <info> zibase.js:424 (ZiBase.processZiBaseData) Zapi linked to host IP=<zip>192.168.0.10</zip> UDP Port=<zudp>60580</zudp>
```

Descriptors
-----------
The descriptors of the Zibase are loaded when the `ZiBase` class is instanciated. They can be accessed through:

 - the `ZiBase.descriptors` member:
```javascript
console.log(Zibase.descriptors);
```
will produce:
```
 [ { type: 'device',
    name: 'Ventilation SdB',
    t: 'receiverXDom',
    i: 'logotype_airfan.png',
    c: 'C3' },
  { type: 'device',
    name: 'Conso Wall Plug',
    t: 'power',
    i: 'logotype_power.png',
    c: 'PZA3' },
  { type: 'device',
    name: 'Pompe à Chaleur',
    t: 'receiverXDom',
    i: 'logotype_heatpomp.png',
    c: 'P7',
    p: '5' },
  { type: 'scenario',
    name: 'simulation intrusion',
    id: '9',
    icon: 'logoMacro_Portes.png' },
  { type: 'scenario',
    name: 'Notification iOS',
    id: '16',
    icon: 'logoMacro_Scenario.png' }
 ]
```
 - the `ZiBase.getDescriptor(id)` method:
```javascript
console.log(Zibase.getDescriptor("P7"));
```
will produce:
```
{ type: 'device',
  name: 'Pompe à Chaleur',
  t: 'receiverXDom',
  i: 'logotype_heatpomp.png',
  c: 'P7',
  p: '5' }
```

Variables
---------
The variables `V0` to `V31` can be read through  `ZiBase.getVariable`:
```javascript
Zibase.getVariable(10, function(err, value) {
    if (err)
        console.log(err);
    console.log("V10=" + value);
});
```

Devices
-------
The state of devices can be retrieved through  `ZiBase.getState`:
```javascript
Zibase.getState("ZB5", function(err, value) {
    if (err)
        console.log(err);
    console.log("ZB5 state =" + value);
});
```

Sensors
-------
The information about a sensor can be retrieved through  `ZiBase.getSensorInfo`:
```javascript
Zibase.getSensorInfo("OS439157578", function(err, value) {
    if (err)
        console.log(err);
    console.log("Infos =" + value);
});
```

Events
------

The activity of the Zibase is logged through [tracer](https://www.npmjs.com/package/tracer/) messages:
```
21/02/2016 22:00:48.955 <info> zibase.js:352 (ZiBase.processZiBaseData) Received radio ID (<rf>ZWAVE ZB5</rf> <dev>Low-Power Measure</dev> Total Energy=<kwh>121.4</kwh>kWh Power=<w>00</w>W Batt=<bat>Ok</bat>): <id>PZB5</id>
```
The `ZiBase` object is an event emitter that can call registered callbacks when receiving a given activity message. The supported events are:

 - `message`: this event is emitted each time the Zibase sends a message
 - `change`: this event is emitted each time the Zibase sends a message about a device
 - `error`: this event is emitted when a ZWAVE error message is sent by the Zibase
 - `restart`: this event is emitted when the Zibase is restarting
 - `restarted`: this event is emitted once the Zibase has restarted

Listening to events is done with `on(event, id, callback)`, or `once(event, id, callback)` in which case the event is triggered only once.

The following code:
```javascript
Zibase.on('change', "PZB5", function(msg){
     console.log(msg);
});
```
will produce the following output:
```
21/02/2016 21:36:20.553 <info> zibase.js:352 (ZiBase.processZiBaseData) Received radio ID (<rf>ZWAVE ZB5</rf> <dev>Low-Power Measure</dev> Total Energy=<kwh>121.4</kwh>kWh Power=<w>00</w>W Batt=<bat>Ok</bat>): <id>PZB5</id>
{ rf: 'ZWAVE ZB5',
  dev: 'Low-Power Measure',
  kwh: '121.4',
  w: '00',
  bat: 'Ok',
  id: 'PZB5' }
```

Deconnexion
-----------

When no more interaction with the Zibase is needed, it is recommended to deconnect from it thanks to `deregisterListener()`.

```javascript
Zibase.deregisterListener();
```

The effect of this call is to ask the Zibase to stop sending its information. It seems the Zibase can keep track of 4 clients only. When a fifth client is registered, it will replace the oldest one, hence causing a forced deregistration of the first client. When using a single client, it usually not a problem to not call `deregisterListener()`. However, when using several clients connected to a single Zibase, it is highly recommended to make the call, to avoid the others from being disconnected. A good practice is to use the following code:
```javascript
function exitHandler() {
    Zibase.deregisterListener();
    console.log("Deregistered from Zibase.");
}

process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);
process.on('uncaughtException', exitHandler);
```

Documentation
-------------

A more detailed JSDoc generated documentation can be found [here](http://bchabrier.github.io/zibase/).


