'use strict'

const dns       = require('dns');
const express   = require('express');
const app       = express();
const Promise   = require('bluebird');
const events    = require('events');
const ethClass  = require('./eth');
const smtpClass = require('./smtp');

let me;
let self;
let coreConfig;
let plugin;
let eth;
let smtp;
let hostContractId;
let connections = [];
let hostsQueue = [];

let waitDestination = {
  hosts : [],
  events : new events.EventEmitter()
}

let denySign = 'delivery error';

exports.register = function () {

  plugin = this;

  let cfg = plugin.config.get('priority_delivery.ini', function () {
    plugin.register();
  });

  plugin.cfg = cfg;
  eth = ethClass(plugin);
  smtp = smtpClass(plugin);  
  
  me = this.config.get('me');

  hostContractId = cfg.main.hostContractId;

  this.register_hook('init_master', 'init_master');
  this.register_hook('queue_outbound', 'queue_outbound');

};

exports.init_master = function(next)
{
  app.listen(plugin.cfg.main.webServerPort, plugin.cfg.main.webServerHost, function () {
    plugin.loginfo(`Priority Delivery web listener: ${plugin.cfg.main.webServerHost}:${plugin.cfg.main.webServerPort}`);
  });
  return next(OK);
}

exports.queue_outbound = function (next, connection) {

  let self = this;
  let host = connection.transaction.rcpt_to[0].host;
  let txn = connection.transaction;

  dns.resolveTxt(host, function (err, txt_rrs) {

    if (err) {
      plugin.loginfo(err);
      return err;
    }

    let contractId = false

    for (let i = 0; i < txt_rrs.length; i++) {
      let record = txt_rrs[i][0].split(' ');
      if (record[0] == "etc") {
        contractId = record[1];
        break;
      }
    }

    eth.getChannel(me, contractId).then((result) => {

      if (result) {
        plugin.loginfo("Channel exist.");
        next(CONT);
      }
      else
      {

        let size = 100;
        
        plugin.loginfo(`size:${size}`);

        if (hostsQueue.indexOf(host) > -1)
        {

          waitDestination.events.once(host, (result) => {
            smtp.send(next, connection, txn, host);
          });

          return next(OK);
        }

        hostsQueue.push(host);

        eth.openChannel(contractId, size).then((result) => {

          waitDestination.events.emit(host, result);
          smtp.send(next, connection, txn, host);
          
        });

        return next(OK);
      }
    });
  });
};

exports.hook_ehlo = function (next, connection, ehlo) {
  connections[connection.toString()] = {
    host: ehlo
  }
  next(OK);
}

exports.hook_rcpt = function (next, connection, params) {

  let rcpt = params[0];
  let host = connections[connection.toString()].host;

  if (rcpt.host != me) // simple and wrong check of outgoing destination
  {
    return next(CONT);
  }

  eth.getChannel(host, hostContractId).then((result) => {

    plugin.loginfo(`channel ${host} size: ${result}`);

    if (!result) {
      return next(DENYSOFT, denySign);
    }

    result = parseInt(JSON.parse(result));

    if (result) {
      next(CONT);
    }
    else {
      next(DENYSOFT, denySign);
    }

  });
}

app.get('/lock', function (req, res) {

  plugin.loginfo("Lock channel:", req.query.host);

  eth.lockChannel(req.query.host).then((result) => {
    res.end(result);
  });
});
