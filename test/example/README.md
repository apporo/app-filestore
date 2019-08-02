# app-filestore test/example

## Usage

### Run the example server

Build the module:

```shell
npm run build
```

Start the example:

```shell
export DEBUG=devebot*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
node test/example
```

### How to upload files

You can upload a file using the __curl__ utility:

```shell
$ curl -i -X POST -H "Content-Type: multipart/form-data" \
-F "data=@./test/lab/images/logbeat.png" \
-F "fileId=612d388f-0569-427f-88ad-257e52a3b1a5" \
"http://localhost:7979/example/upload"
```
