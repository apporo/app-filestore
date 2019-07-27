# app-filestore test/example

## Usage

### Run the example server

Build the module:

```shell
npm run build
```

Start the example:

```shell
export DEBUG=app*
export LOGOLITE_DEBUGLOG_ENABLED=true
node test/example
```

### How to upload files

You can upload a file using the __curl__ utility:

```shell
$ curl -i -X POST -H "Content-Type: multipart/form-data" \
    -F "data=@./test/lab/images/logbeat.png;fileId=0987654321" \
    "http://localhost:7979/example/upload"
```
