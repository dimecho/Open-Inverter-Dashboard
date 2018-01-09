#!/bin/bash

sudo sh -c "sudo echo 'deb http://mirrordirector.raspbian.org/raspbian/ jessie main contrib non-free rpi' >> /etc/apt/sources.list"

echo "...Refreshing Package List"
sudo aptitude -y update

echo "> Upgrade Raspberry Pi? (y/n)"
read yn
if [ $yn = y ]; then
	#============================
    #Don't Update kernel (LCD driver requirement)
	sudo apt-mark hold raspberrypi-bootloader
	sudo apt-mark hold raspberrypi-kernel
		#----------------------------
		#System Updates
		sudo aptitude -y upgrade
		#----------------------------
	sudo apt-mark unhold raspberrypi-bootloader
	sudo apt-mark unhold raspberrypi-kernel
	#============================
fi

echo "...Installing Web Server"
sudo aptitude -y install php5-common php5-cgi php5

htmlLocation="/var/www/html"
echo "...Installing Web Files ${htmlLocation}"
if [ $(dirname "$0") != $htmlLocation ]; then
	sudo mkdir -p $htmlLocation
	sudo cp -rf ./* $htmlLocation
fi

echo "...Configuring Web Files (config.inc.php)"
echo " > Enter Serial (Example: /dev/ttyAMA0)"
read dev_serial
sudo cp -R $htmlLocation/config.inc $htmlLocation/config.inc.php
sudo sed -i -e "s~/dev/cu.usbserial~$dev_serial~g" $htmlLocation/config.inc.php

echo "...Configuring PHP Autostart"
rclocal="/etc/rc.local"
sudo sh -c "sudo echo '#!/bin/bash
sudo ifup wlan0
sudo -u www-data php -S 0.0.0.0:8080 -t /var/www/html/ &
sudo -u www-data php -S 0.0.0.0:8081 -t /var/www/html/ &
exit 0' > ${rclocal}"
sudo chmod 755 $rclocal

echo "...Setting Web Server Permissions"
sudo mkdir -p /var/www/html
sudo adduser www-data www-data
sudo chown -R www-data:www-data /var/www
sudo chmod -R 755 /var/www
sudo chmod 777 /var/www/html/views/*.json
sudo usermod -a -G www-data pi

echo "...Backing up config"
configLocation="/boot/config.txt"
if [ ! -f "${configLocation}.bak" ]; then
    sudo cp "${configLocation}" "${configLocation}.bak"
fi

echo "...Setting TTY Permissions"
sudo aptitude -y install minicom
ls -la /dev/ttyAMA0
sudo systemctl enable serial-getty@ttyAMA0.service
sudo usermod -a -G dialout www-data
sudo usermod -a -G tty www-data
#UART on the Pi-3 you will need to disable bluetooth
sudo sh -c "sudo echo '
enable_uart=1
dtoverlay=pi3-miniuart-bt' >> /boot/config.txt"

echo "> Auto-Start Full Screen Kiosk Mode? (y/n)"
read yn
if [ $yn = y ]; then

    sudo aptitude -y install xutils
	sudo aptitude -y install x11-xserver-utils

    echo "${red}...Installing Web Browser${reset}"
    sudo aptitude -y install chromium-browser
    #sudo aptitude install iceweasel -y

	autostart="/home/pi/.config/lxsession/LXDE-pi/autostart"
	sudo sh -c "sudo echo '#@xscreensaver -no-splash' > ${autostart}"
	sudo sh -c "sudo echo '@xset -dpms # disable DPMS (Energy Star) features' >> ${autostart}"
	sudo sh -c "sudo echo '@xset s off # disable screen saver' >> ${autostart}"
	sudo sh -c "sudo echo '@xset s noblank # dont blank the video device' >> ${autostart}"
	sudo sh -c "sudo echo 'chromium-browser --noerrdialogs --kiosk http://127.0.0.1:8080 --incognito' >> ${autostart}"
 	sudo chmod 755 $autostart

 	kernel_version_current=`uname -a|awk '{print $3}'`
	kernel_version_needed="4.4.50-v7"

	echo "> Install CH340 Driver for Kernel ${kernel_version_needed}? (y/n)"
	read yn
	if [ $yn = y ]; then
		#cd /lib/modules/$(uname -r)/kernel/drivers/usb/serial
		sudo cp -f ./drivers/CH340/ch34x.ko "/lib/modules/${kernel_version_needed}/kernel/drivers/usb/serial"
		sudo modprobe ./drivers/CH340/ch34x.ko
		:'
		#https://github.com/aperepel/raspberrypi-ch340-driver
		sudo apt-get -y install gcc-4.8 g++-4.8
		sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-4.8 50
		sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-4.8 50
		sudo apt-get -y install linux-headers-rpi
		sudo wget https://raw.githubusercontent.com/notro/rpi-source/master/rpi-source -O /usr/bin/rpi-source && sudo chmod +x /usr/bin/rpi-source && /usr/bin/rpi-source -q --tag-update
		sudo apt-get -y install bc
		sudo apt-get -y install libncurses5-dev
		rpi-source
		cd ./drivers/CH340
		make
		make load
		'
	fi

	echo "> Install LCD Drivers? (y/n)"
	cd ~/Downloads
	read yn
	if [ $yn = y ]; then
		if [ $kernel_version_current != $kernel_version_needed ]; then
		    echo "Your kernel version is ${kernel_version_current}"
		    echo "LCD works with kernel ${kernel_version_needed}"
		    echo "...Installing kernel ${kernel_version_needed}"
			sudo aptitude -y install rpi-update
			sudo rpi-update 5224108
		fi
		if [ ! -f LCD_show_v6_1_3.tar.gz ]; then
		    echo "...Downloading LCD Driver"
			wget http://kedei.net/raspberry/v6_1/LCD_show_v6_1_3.tar.gz
		fi
	    echo "...Extracting TAR"
		tar -xzvf LCD_show_v6_1_3.tar.gz
		
		echo "...Switching to LCD"
	    cd LCD_show_v6_1_3
		sudo ./LCD35_v
	fi
else
	sudo cp -f /etc/xdg/lxsession/LXDE-pi/autostart /home/pi/.config/lxsession/LXDE-pi/autostart
fi

echo "> Enable SSH? (y/n)"
read yn
if [ $yn = y ]; then
    sudo systemctl enable ssh
    sudo systemctl start ssh
fi

echo "> Enable VNC? (y/n)"
read yn
if [ $yn = y ]; then
	sudo vncinitconfig -service-daemon
	sudo systemctl enable vncserver-x11-serviced.service
	sudo systemctl start vncserver-x11-serviced.service
fi

echo "> Install RFID Drivers? (y/n)"
cd ~/Downloads
read yn
if [ $yn = y ]; then
	wget http://www.airspayce.com/mikem/bcm2835/bcm2835-1.52.tar.gz
	tar zxvf bcm2835-1.52.tar.gz
	cd bcm2835-1.52
	./configure
	make
	sudo make check
	sudo make install
	
	cd "$(dirname "$0")/drivers/RPi-RFID"
	make
	:'
	+ ---------------- + ------- + ------------ +
	| Name/Signal      | MFRC522 | Raspberry Pi |
	+ ================ + ======= + ============ +
	| VCC              | 3.3V    | 1 (3V3)      |
	+ ---------------- + ------- + ------------ +
	| RST/Reset        | RST     | 22 (GPIO25)  |
	+ ---------------- + ------- + ------------ +
	| GND              | GND     | Any ground   |
	+ ---------------- + ------- + ------------ +
	| SPI MISO         | MISO    | 21 (GPIO9)   |
	+ ---------------- + ------- + ------------ +
	| SPI MOSI         | MOSI    | 19 (GPIO10)  |
	+ ---------------- + ------- + ------------ +
	| SPI SCK          | SCK     | 23 (GPIO11)  |
	+ ---------------- + ------- + ------------ +
	| SPI SS (SOA/NSS) | SDA     | 24 (GPIO8)   |
	+ ---------------- + ------- + ------------ +
	| IRQ              | IRQ     | None         |
	+ ---------------- + ------- + ------------ +
	MISO = Master Input, Slave Output
	MOSI = Master Output, Slave Input
	'
	
	if [ ! grep -q "dtoverlay=spi0-hw-cs" $configLocation ]; then
  		sudo sh -c "sudo echo 'dtparam=spi=on' >> ${configLocation}"
  		sudo sh -c "sudo echo 'dtoverlay=spi0-hw-cs' >> ${configLocation}"
 	fi
fi

echo " > Enable WiFi Access Point? (y/n)"
read yn
if [ $yn = y ]; then

    sudo aptitude install -y hostapd dnsmasq
    sudo systemctl stop dnsmasq
    sudo systemctl stop hostapd

    echo "Enter WiFi SSID (Example: Inverter)"
    read wifi_ssid

    echo "Enter WiFi WPA Password (Example: inverter123)"
    read wifi_password

    echo "Enter WiFi IP (Example: 192.168.42.1)"
    read wifi_ip

    echo "...Configuring Static IP Address [$wifi_ip]"
    sudo sh -c "sudo echo 'denyinterfaces wlan0' >> /etc/dhcpcd.conf"

    sudo sh -c "sudo echo 'allow-hotplug wlan0
    iface wlan0 inet static
    address $wifi_ip
    netmask 255.255.255.0' > /etc/network/interfaces.d/wlan0"

    #sudo service dhcpcd restart
    sudo ifdown wlan0
    sudo ifup wlan0

    echo "...Configuring DHCP Server"
    IFS=. read -ra ary <<<"$wifi_ip"
    sudo sh -c "sudo echo 'interface=wlan0
dhcp-range=${ary[0]}.${ary[1]}.${ary[2]}.2,${ary[0]}.${ary[1]}.${ary[2]}.200,255.255.255.0,24h' >> /etc/dnsmasq.conf"

    echo "...Configuring Access Point"
    sudo sh -c "sudo echo 'interface=wlan0
driver=nl80211
ssid=$wifi_ssid
hw_mode=g
channel=2
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$wifi_password
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP' > /etc/hostapd/hostapd.conf"

    #Raspberry Pi 3 Wi-Fi module seems to require the following additional parameters:
    #sudo sh -c "sudo echo 'ieee80211n=1' >> /etc/hostapd/hostapd.conf"

    echo "...Auto-Start Access Point"
    sudo sh -c "sudo echo 'DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"' > /etc/default/hostapd"

    sudo service hostapd start
    sudo service dnsmasq start
fi

echo "> Reboot now? (y/n)"
read yn
if [ $yn = y ]; then
	sudo reboot
fi