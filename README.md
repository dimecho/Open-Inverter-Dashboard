<p align="center">
<img src="https://github.com/poofik/huebner-inverter-raspberrydash/raw/master/img/icon.png">
</p>

# Hubner Inverter Raspberry Dash

This is a Raspberry Pi Dashboard designed for Huebner [Inverter Project](http://johanneshuebner.com/quickcms/index.html%3Fde_electric-car-conversion-site,14.html)

<p align="center">
<img src="https://github.com/poofik/huebner-inverter-raspberrydash/raw/master/img/screenshot.jpg">
</p>

## Getting Started

* Raspberry Pi 2/3
* microSD card (4GB+)
* LCD screen (SPI)
* 5V power (microUSB)
* USB-TTL adapter

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

* Plug USB-TTL adapter to Raspberry Pi
* Connect TTL RX/TX into Inverter board (3.3V only - do not plug 5V)

## Author

Dima Dykhman

## License

<a href="http://creativecommons.org/publicdomain/zero/1.0/" rel="license" target="_blank"> <img alt="CC0" border="0" src="http://i.creativecommons.org/l/zero/1.0/88x31.png" title="CC0" /></a>