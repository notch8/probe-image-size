'use strict';
/*
Code adapted from image-size available under the MIT license
image-size Copyright © 2017 Aditya Yadav, http://netroy.in
https://github.com/image-size/image-size/blob/master/lib/types/jp2.ts
*/

var ParserStream = require('../common').ParserStream;

const BoxTypes = {
  ftyp: '66747970',
  ihdr: '69686472',
  jp2h: '6a703268',
  jp__: '6a502020',
  rreq: '72726571',
  xml_: '786d6c20'
}

const calculateRREQLength = box => {
  const unit = box.readUInt8(0)
  let offset = 1 + (2 * unit)
  const numStdFlags = box.readUInt16BE(offset)
  const flagsLength = numStdFlags * (2 + unit)
  offset = offset + 2 + flagsLength
  const numVendorFeatures = box.readUInt16BE(offset)
  const featuresLength = numVendorFeatures * (16 + unit)
  return offset + 2 + featuresLength
}

const parseIHDR = box => {
  return {
    height: box.readUInt32BE(4),
    width: box.readUInt32BE(8),
  }
}

const validate = buffer => {
  const signature = buffer.toString('hex', 4, 8)
  const signatureLength = buffer.readUInt32BE(0)
  if (signature !== BoxTypes.jp__ || signatureLength < 1) {
    return false
  }

  const ftypeBoxStart = signatureLength + 4
  const ftypBoxLength = buffer.readUInt32BE(signatureLength)
  const ftypBox = buffer.slice(ftypeBoxStart, ftypeBoxStart + ftypBoxLength)
  return ftypBox.toString('hex', 0, 4) === BoxTypes.ftyp
}

const calculate = buffer => {
  const signatureLength = buffer.readUInt32BE(0)
  const ftypBoxLength = buffer.readUInt16BE(signatureLength + 2)
  let offset = signatureLength + 4 + ftypBoxLength
  const nextBoxType = buffer.toString('hex', offset, offset + 4)
  switch (nextBoxType) {
    case BoxTypes.rreq:
      // WHAT ARE THESE 4 BYTES?????
      const MAGIC = 4
      offset = offset + 4 + MAGIC + calculateRREQLength(buffer.slice(offset + 4))
      return parseIHDR(buffer.slice(offset + 8, offset + 24))
    case BoxTypes.jp2h :
      return parseIHDR(buffer.slice(offset + 8, offset + 24))
    default:
      throw new TypeError('Unsupported header found: ' + buffer.toString('ascii', offset, offset + 4))
  }
}

module.exports = function () {
  var parser = new ParserStream();

  parser._bytes(128, function (data) {
    parser._skipBytes(Infinity);

    // check signature
    if (!validate(data)) {
      parser.push(null);
      return;
    }

    parser.push(
      Object.assign(calculate(data), 
        {
          type: 'jp2',
          mime: 'image/jp2',
          wUnits: 'px',
          hUnits: 'px'
        }
      )
    );

    parser.push(null);
  });

  return parser;
};