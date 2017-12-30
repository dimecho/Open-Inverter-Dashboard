<p align="center"><img src="https://github.com/poofik/huebner-inverter-raspberrydash/raw/master/img/icon.png"></p>

# Hubner Inverter - Raspberry Dash

This is a Raspberry Pi Dashboard designed for Huebner [Inverter Project](http://johanneshuebner.com/quickcms/index.html%3Fde_electric-car-conversion-site,14.html)

![Screenshot](img/screenshot.jpg?raw=true)

* Motor Sound Generator
* RFID Unlocker (MFRC522)
* WiFi Alarm with Accelerometer (ADXL345)

## Getting Started

* Raspberry Pi 2/3
* microSD card (4GB+)
* LCD screen (SPI)
* 5V power (microUSB)

### Prerequisites (Computer)

* [Download Boot Image](https://www.raspberrypi.org/downloads/raspbian/) (Desktop Edition)
* [Flash Boot Image](https://www.raspberrypi.org/documentation/installation/installing-images/) to your SD card
* Put SD into your Raspberry Pi and Turn it ON

### Installing (Raspberry Pi)

* Open Terminal
```
git clone git://github.com/poofik/huebner-inverter-raspberrydash.git
cd huebner-inverter-raspberrydash
chmod +x setup
./setup
```

### Connecting Inverter

* Connect Inverter CPU to Raspberry Pi directly without USB-TTL converter

![Connect](img/connect.png?raw=true)
![Pin Layout](img/pi2_gpio.png?raw=true)

## Author

Dima Dykhman

## License

[![CC0](http://i.creativecommons.org/l/zero/1.0/88x31.png)](http://creativecommons.org/publicdomain/zero/1.0/)