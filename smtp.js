'use strict'

const dns = require('dns');

const smtpClient = require('../../smtp_client');

let plugin;
let me;

function smtp(pl) {
  if (!(this instanceof smtp)) {
    return new smtp(pl);
  }

  plugin = pl;
  me = plugin.config.get('me');
};

smtp.prototype.send = function (next, connection, txn, host) {

  dns.resolveMx(host, function (err, addresses) {
    if (err) throw err;

    let exchangeHost = addresses[0].exchange;

    dns.resolve4(exchangeHost, function (err, addresses) {

      let hostIp = addresses[0];

      var cfg = {
        host : hostIp,
        port : "25"
      }

      smtpClient.get_client_plugin(plugin, connection, cfg, function (err, smtp_client) {

        smtp_client.next = next;

        let rcpt = 0;

        connection.loginfo(plugin, 'forwarding to ' + (cfg.forwarding_host_pool ? "host_pool" : cfg.host + ':' + cfg.port));

        const dead_sender = function () {
          if (smtp_client.is_dead_sender(plugin, connection)) {
            var rs = connection.transaction ?
                connection.transaction.results :
                connection.results;
            rs.add(plugin, { err: 'dead sender' });
            return true;
          }
          return false;
        };

        const send_rcpt = function () {
          smtp_client.send_command('RCPT', 'TO:' + txn.rcpt_to[rcpt]);
        };

        smtp_client.on('mail', send_rcpt);

        let rcptCount = 0;

        smtp_client.on('rcpt', function(){

          rcptCount++;

          if (rcptCount == 3) // magic
          {
            smtp_client.send_command('DATA');
          }
        });

        smtp_client.on('rset', function () {
          smtp_client.send_command('MAIL', 'FROM:' + txn.mail_from);
        });

        smtp_client.send_command('EHLO', me);

        smtp_client.send_command('MAIL');

        smtp_client.on('data', function () {
          //if (dead_sender()) return;
          smtp_client.start_data(txn.message_stream);
        });

        smtp_client.on('dot', function () {
          /*if (dead_sender()) return;
          if (rcpt < txn.rcpt_to.length) {
            smtp_client.send_command('RSET');
            return;
          }*/
          smtp_client.release();
        });

        smtp_client.on('bad_code', function (code, msg) {
          if (dead_sender()) return;
          smtp_client.call_next(((code && code[0] === '5') ? DENY : DENYSOFT), msg);
          smtp_client.release();
        });
      });
    });
  });
}

module.exports = smtp;