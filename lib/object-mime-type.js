'use strict'

const mime = require('mime-types')

exports.validate = function validateMimeType (key, object) {
  let contentType = object.ContentType
  return mime.lookup(key) === contentType.trim()
}

exports.type = function mimeType (key) {
  return mime.lookup(key)
}
