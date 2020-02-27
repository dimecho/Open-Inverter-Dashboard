#!/bin/bash

rm -rf ./spiffs
cp -rf  ../Web ./spiffs
rm ./spiffs/img/screenshot.png

if [ ! -f tools/mkspiffs ]; then
    curl -L -o tools/mkspiffs-0.2.3-arduino-esp8266-osx.tar.gz -k -C - https://github.com/igrr/mkspiffs/releases/download/0.2.3/mkspiffs-0.2.3-arduino-esp8266-osx.tar.gz
    cd tools
    gunzip -c mkspiffs-0.2.3-arduino-esp8266-osx.tar.gz | tar xopf -
    mv mkspiffs-0.2.3-arduino-esp8266-osx/mkspiffs ./
    rm -rf mkspiffs-0.2.3-arduino-esp8266-osx
    rm -rf mkspiffs-0.2.3-arduino-esp8266-osx.tar.gz
    cd ../
fi

for f in $(find spiffs -type f -name '*.*' ! -name '*.php'); do
    gzip "$f"
    mv "$f.gz" "$f"
done

./tools/mkspiffs -c ./spiffs/ -b 8192 -p 256 -s 500000 flash-spiffs.bin