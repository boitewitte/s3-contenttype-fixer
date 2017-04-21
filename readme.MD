# S3 ContentType Fixer

This CLI script fixes the content types of the files in your S3 bucket.

## Installation

```sh
npm i -g s3-contenttype-fixer
```

## Usage

Usage is simple, run:
```sh
s3-contenttype-fixer -a <AccessKey> -s <Secret> -b <Bucket> -r <Region>
```

You can also prefix using the option:
```sh
-p <Prefix>
```

## How it works

The script loops through all your keys within the bucket (or all the keys with the chosen prefix) and checks which content/mime type is expected for file extension within the key. If this is the same as the content type of the file, no action is taken, otherwise, the content type is changed to the expected content type.
