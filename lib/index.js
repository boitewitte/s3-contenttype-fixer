'use strict'

const Aws = require('aws-sdk')
const EventEmitter = require('events')
const objectMimeType = require('./object-mime-type')
const merge = require('lodash.merge')

class ContentTypeFixer extends EventEmitter {
  constructor (accessKey, secretKey, region, options) {
    super()
    this._settings = {
      access: accessKey,
      secret: secretKey,
      region: region
    }
    this._options = options
    this.maxKeys = options.maxKeys || 1000
    this.limitAmount = options.limitAmount || false

    this.s3 = false

    this.totals = {
      objects: false,
      batches: false,
      transforms: 0
    }

    this.handled = {
      objects: 0,
      transformed: 0,
      updated: 0
    }

    this.on('batchFinished', this.nextBatch)

    this.on('allBatchesFinished', (data) => {
      this.totals.objects = data.total
      this.totals.batches = data.batch
      this.__allDone()
    })

    this.on('object', this.handleObject)
    this.on('data', this.changeContentType)
  }
  connect () {
    if (!this.s3) {
      let settings = this._settings
      let options = this._options
      this.s3 = new Aws.S3({
        apiVersion: '2006-03-01',
        accessKeyId: settings.access,
        secretAccessKey: settings.secret,
        region: settings.region
      })
      this._list(false, 1, (err, data) => {
        if (err) {
          return this.emit('error', 'ConnectionFailed', err.message)
        } else {
          return this.emit('connected', {region: settings.region, bucket: options.bucket})
        }
      })
    }
  }
  _list (start, limit, cb) {
    if (this.s3 && typeof cb === 'function') {
      limit = limit || this.maxKeys

      let options = this._options
      let params = {
        Bucket: options.bucket,
        MaxKeys: limit,
        Delimiter: ','
      }
      if (start && typeof start === 'string') {
        params.Marker = start
      }
      if (options.prefix && typeof options.prefix === 'string') {
        params.Prefix = options.prefix
      }
      return this.s3.listObjects(params, cb)
    } else {
      let err = (!this.s3) ? new Error('noConnection') : new Error('noCallbackGiven')
      return this.emit('error', 'getListFailed', err)
    }
  }
  _getObjectMetaData (key, cb) {
    if (this.s3 && key && typeof cb === 'function') {
      let options = this._options
      let params = {
        Bucket: options.bucket,
        Key: key
      }
      return this.s3.headObject(params, cb)
    } else {
      let err = (!this.s3) ? new Error('noConnection') : new Error('noCallbackGiven')
      return this.emit('error', 'getListFailed', err)
    }
  }
  _changeObjectMetaData (key, params, cb) {
    if (this.s3 && key && typeof params === 'object' && typeof cb === 'function') {
      let options = this._options
      merge(params, {
        Bucket: options.bucket,
        Key: key,
        CopySource: encodeURIComponent(options.bucket + '/' + key),
        MetadataDirective: 'REPLACE'
      })
      return this.s3.copyObject(params, cb)
    }
  }
  transform (start, batch, total) {
    total = total || 0
    batch = batch || 0
    let limit = (this.limitAmount && this.maxKeys > this.limitAmount)
      ? this.limitAmount
      : this.maxKeys

    return this._list(start, limit, (err, data) => {
      if (err) {
        return this.emit('error', 'retrieveListFailed', err)
      } else if (data.Contents && data.Contents instanceof Array) {
        let contents = data.Contents
        let nextMarker = data.IsTruncated && data.NextMarker

        let amount = contents.length
        let retrieved = 0

        for (let i = 0; i < amount; i++) {
          if (!this.limitAmount || total < this.limitAmount) {
            total++
            retrieved++
            this.emit('object', contents[i])
          } else {
            break
          }
        }
        nextMarker = nextMarker || contents[(amount - 1)].Key
        batch++
        let event = (amount < limit || (this.limitAmount && total >= this.limitAmount))
          ? 'allBatchesFinished'
          : 'batchFinished'

        this.emit(event, {
          retrieved,
          total,
          batch,
          nextMarker
        })
      }
    })
  }
  nextBatch (data) {
    this.transform(data.nextMarker, data.batch, data.total)
  }
  handleObject (data) {
    let key = data.Key
    this._getObjectMetaData(key, (err, metaData) => {
      if (err) {
        return this.emit('error', 'objectRetrieveFailed', err)
      } else {
        this.handled.objects++
        if (objectMimeType.validate(key, metaData) === false) {
          this.totals.transforms++
          this.emit('data', key, metaData)
        }
        this.__allDone()
      }
    })
  }
  changeContentType (key, data) {
    let metaData = {
      ContentType: objectMimeType.type(key),
      Metadata: data.Metadata
    }
    this._changeObjectMetaData(key, metaData, (err, data) => {
      if (err) {
        this.emit('error', 'changeContentTypeFailed', err)
      } else {
        let number = ++this.handled.transformed
        this.emit('transformed', key, {
          number: number,
          data
        })
        this.__allDone()
      }
    })
  }
  __allDone () {
    let allObjectsHandled = this.handled.objects === this.totals.objects
    let allTransformsDone = this.handled.transformed === this.totals.transforms

    if (allObjectsHandled && allTransformsDone) {
      this.emit('end', {handled: this.handled, totals: this.totals})
      return true
    }
    return false
  }
}

module.exports = ContentTypeFixer
