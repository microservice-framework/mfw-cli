'use strict';

const colors    = require('colors/safe');

function Message() {

}

Message.prototype.warning = function(message) {
  console.log(colors.yellow('\t[war]\t') + colors.gray(message));
}

Message.prototype.error = function(message) {
  console.log(colors.red('\t[err]\t') + colors.gray(message));
}

Message.prototype.unknown = function(message) {
  console.log(colors.red('\t[unknown]\t') + colors.gray(message));
}

Message.prototype.ok = function(message) {
  console.log(colors.green('\t[ok]\t') + colors.gray(message));
}

Message.prototype.message = function(message) {
  console.log('\t' + colors.gray(message));
}

Message.prototype.progress = function(message) {
  console.log(colors.gray('\t-\t' + message));
}

exports = module.exports = new Message();
