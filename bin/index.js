#! /usr/bin/env node

const program = require('commander')
const chalk = require('chalk')
const packageSettings = require('../package.json')
const ContentTypeFixer = require('../lib')

program
  .version(packageSettings.version)
  .option('-a, --access <accessKey>', 'AWS Access Key')
  .option('-s, --secret <secretKey>', 'AWS Secret Key')
  .option('-r --region <region>', 'AWS Region')
  .option('-b, --bucket <s3Bucket>', 'S3 Bucket')
  .option('-p, --prefix [prefix]', 'Prefix for files (optional)')
  .parse(process.argv)

const validCommand = !!(program.access && program.secret && program.bucket)

if (validCommand) {
  const executor = new ContentTypeFixer(program.access, program.secret, program.region, {
    bucket: program.bucket,
    prefix: program.prefix
  })
  executor.on('error', (type, err) => {
    console.log(chalk.bold.red(type))
    console.log(chalk.red(err))
    process.exit(1)
  })
  executor.on('connected', (opts) => {
    console.log('Connected to:', chalk.bold.blue(opts.bucket))
    console.log('Within region:', chalk.blue(opts.region))
    executor.transform()
  })
  executor.on('batchFinished', (data) => {
    console.log(chalk.bold.cyan('Batch'), 'number:', chalk.cyan(data.batch), 'retrieved:', chalk.cyan(data.retrieved), 'total:', chalk.cyan(data.total))
  })
  executor.on('allBatchesFinished', (data) => {
    console.log(chalk.bold.green('Finished Retrieving Lists'))
    console.log(chalk.bold.cyan('Batches:'), chalk.cyan(data.batch))
    console.log(chalk.bold.cyan('Objects:'), chalk.cyan(data.total))
  })
  executor.on('transformed', (key, data) => {
    let totalString = (executor.totals.transforms) ? 'of ' + chalk.yellow(executor.totals.transforms) : ''
    console.log('transformed', chalk.yellow(key), 'number', chalk.yellow(data.number), totalString)
  })
  executor.on('end', (data) => {
    console.log(chalk.green('DONE DEAL'))
    console.log(data)
    process.exit(0)
  })
  executor.connect()
} else {
  console.log(chalk.bold.red('initiationFailed'))
  console.log(chalk.red('Ensure all arguments are given'))
  program.help()
  process.exit(1)
}
