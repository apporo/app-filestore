# app-filestore

> Devebot application filestore layerware

## How to upload files

You can upload a file using the __curl__ utility:

``` bash
$ curl -i -X POST -H "Content-Type: multipart/form-data" 
    -F "data=@/home/devebot/test.png;fileId=0987654321" 
    "http://localhost:7979/filestore/upload"
```