'use strict';

const crypto = require('crypto');
const fs = require('fs');

function sha256OfFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function signMessage(message, privateKeyPem) {
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();
    const signature = sign.sign({
        key: privateKeyPem,
        dsaEncoding: 'der',
    });
    return signature.toString('base64');
}

function verifySignature(message, signatureBase64, certPem) {
    const verify = crypto.createVerify('SHA256');
    verify.update(message);
    verify.end();
    const signature = Buffer.from(signatureBase64, 'base64');
    return verify.verify(certPem, signature);
}

function certIDFromPem(certPem) {
    const certBody = certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\s+/g, '');
    const certDer = Buffer.from(certBody, 'base64');
    return crypto.createHash('sha256').update(certDer).digest('hex');
}

module.exports = { sha256OfFile, signMessage, verifySignature, certIDFromPem };
