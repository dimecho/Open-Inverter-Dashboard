//#include <ArduinoOTA.h>
#ifdef ESP32
#include <WiFi.h>
#include <AsyncTCP.h>
#include <SPIFFS.h>
#include <Update.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <FS.h>
#endif

#include <EEPROM.h>
#include <AESLib.h>
#include <ESPAsyncWebServer.h>
#include <flash_hal.h>
#include <StreamString.h>

AsyncWebServer server(80);

int WIFI_PHY_MODE = 1; //WIFI_PHY_MODE_11B = 1, WIFI_PHY_MODE_11G = 2, WIFI_PHY_MODE_11N = 3
float WIFI_PHY_POWER = 20.5; //Max = 20.5dbm
int ACCESS_POINT_MODE = 0;
char ACCESS_POINT_SSID[] = "Dashboard";
char ACCESS_POINT_PASSWORD[] = "dashboard123";
int ACCESS_POINT_CHANNEL = 11;
int ACCESS_POINT_HIDE = 0;
int DATA_LOG = 0; //Enable data logger
int LOG_INTERVAL = 5; //seconds between data collection and write to SPIFFS
int NETWORK_DHCP = 0;
char NETWORK_IP[] = "192.168.4.1";
char NETWORK_SUBNET[] = "255.255.255.0";
char NETWORK_GATEWAY[] = "192.168.4.1";
char NETWORK_DNS[] = "8.8.8.8";
int NOTIFY_ENABLED = 0;
char NOTIFY_EMAIL[] = "";
char NOTIFY_EMAIL_SMTP[] = "";
char NOTIFY_EMAIL_USERNAME[] = "";
char NOTIFY_EMAIL_PASSWORD[] = "";

const char text_html[] = "text/html";
const char text_plain[] = "text/plain";
const char text_json[] = "application/json";
static const char serverIndex[] PROGMEM =
  R"(<!DOCTYPE html>
<html lang='en'>
<head>
   <meta charset='utf-8'>
   <meta name='viewport' content='width=device-width,initial-scale=1'/>
</head>
<body>
<form method='POST' action='' enctype='multipart/form-data'>
   Firmware:<br>
   <input type='file' accept='.bin' name='firmware'>
   <input type='submit' value='Update Firmware'>
</form>
<form method='POST' action='' enctype='multipart/form-data'>
   FileSystem:<br>
   <input type='file' accept='.bin' name='filesystem'>
   <input type='submit' value='Update FileSystem'>
</form>
</body>
</html>)";
bool restartRequired = false;  // Set this flag in the callbacks to restart ESP in the main loop

//====================
//CAN-Bus
//====================
/* http://scottsnowden.co.uk/esp8266-mcp2515-can-bus-to-wifi-gateway/
   http://www.canhack.org/board/viewtopic.php?f=1&t=1041
   http://forum.arduino.cc/index.php?topic=152145.0
   https://github.com/Metaln00b/NodeMCU-BlackBox
*/
#include <mcp_can.h> //CAN-BUS Shield library by Seeed Studio
#include <SPI.h>
/*
  #define MCP_8MHz_250kBPS_CFG1 (0x40)
  #define MCP_8MHz_250kBPS_CFG2 (0xF1)
  #define MCP_8MHz_250kBPS_CFG3 (0x85)
*/
/*
  MISO=D7(GPIO12),MOSI=D6(GPIO13),SCLK=D5(GPIO14),CS=D2(GPIO4),INT=D4(GPIO2)
  https://arduino-esp8266.readthedocs.io/en/2.4.0-rc1/libraries.html#spi

  There’s an extended mode where you can swap the normal pins to the SPI0 hardware pins.
  This is enabled by calling SPI.pins(6, 7, 8, 0) before the call to SPI.begin().

  The pins would change to: MOSI=SD1,MISO=SD0,SCLK=CLK,HWCS=GPIO0
*/
#define CAN_INT 2    // Set INT to pin GPIO2 (D4)
MCP_CAN CAN0(4);      // Set CS to pin GPIO4 (D2)
//=============================

AESLib aesLib;

char cleartext[256];
char ciphertext[512];

// AES Encryption Key
byte aes_key[] = { 0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6, 0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C };

// Initialization Vector
byte aes_iv[N_BLOCK] = { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 };

// Generate IV (once)
void aes_init() {
  aesLib.gen_iv(aes_iv);
}

String encrypt(char * msg, byte iv[]) {
  int msgLen = strlen(msg);
  char encrypted[2 * msgLen];
  aesLib.encrypt64(msg, msgLen, encrypted, aes_key, sizeof(aes_key), iv);
  return String(encrypted);
}

String decrypt(char * msg, byte iv[]) {
  int msgLen = strlen(msg);
  char decrypted[msgLen]; // half may be enough
  aesLib.decrypt64(msg, msgLen, decrypted, aes_key, sizeof(aes_key), iv);
  return String(decrypted);
}

void setup()
{
  Serial.begin(115200, SERIAL_8N1);
  //Serial.setTimeout(1000);
  //Serial.setDebugOutput(true);

  //===========
  //File system
  //===========
  SPIFFS.begin();

  //======================
  //NVRAM type of Settings
  //======================
  EEPROM.begin(1024);
  int e = EEPROM.read(0);
  String nvram = "";

  if (e == 255) { //if (NVRAM_Read(0) == "") {
    //aes_init(); //Generate random IV
    NVRAM_Erase();
    NVRAM_Write(0, String(ACCESS_POINT_MODE));
    NVRAM_Write(1, String(ACCESS_POINT_HIDE));
    NVRAM_Write(2, String(ACCESS_POINT_CHANNEL));
    NVRAM_Write(3, ACCESS_POINT_SSID);
    NVRAM_Write(4, ACCESS_POINT_PASSWORD);
    NVRAM_Write(5, String(DATA_LOG));
    NVRAM_Write(6, String(LOG_INTERVAL));
    //==========
    NVRAM_Write(7, String(NETWORK_DHCP));
    NVRAM_Write(8, NETWORK_IP);
    NVRAM_Write(9, NETWORK_SUBNET);
    NVRAM_Write(10, NETWORK_GATEWAY);
    NVRAM_Write(11, NETWORK_DNS);
    //==========
    NVRAM_Write(12, String(NOTIFY_ENABLED));
    NVRAM_Write(13, NOTIFY_EMAIL);
    NVRAM_Write(14, NOTIFY_EMAIL_SMTP);
    NVRAM_Write(15, NOTIFY_EMAIL_USERNAME);
    nvram = encrypt(NOTIFY_EMAIL_PASSWORD, aes_iv); //Serial.println(nvram); //DEBUG
    NVRAM_Write(16, nvram);

    SPIFFS.format();
  } else {
    ACCESS_POINT_MODE = NVRAM_Read(0).toInt();
    ACCESS_POINT_HIDE = NVRAM_Read(1).toInt();
    ACCESS_POINT_CHANNEL = NVRAM_Read(2).toInt();
    nvram = NVRAM_Read(3);
    nvram.toCharArray(ACCESS_POINT_SSID, nvram.length() + 1);
    nvram = NVRAM_Read(4);
    nvram.toCharArray(ACCESS_POINT_PASSWORD, nvram.length() + 1);
    DATA_LOG = NVRAM_Read(5).toInt();
    LOG_INTERVAL = NVRAM_Read(6).toInt();
    //==========
    NETWORK_DHCP = NVRAM_Read(7).toInt();
    nvram = NVRAM_Read(8);
    nvram.toCharArray(NETWORK_IP, nvram.length() + 1);
    nvram = NVRAM_Read(9);
    nvram.toCharArray(NETWORK_SUBNET, nvram.length() + 1);
    nvram = NVRAM_Read(10);
    nvram.toCharArray(NETWORK_GATEWAY, nvram.length() + 1);
    nvram = NVRAM_Read(11);
    nvram.toCharArray(NETWORK_DNS, nvram.length() + 1);
    //==========
    NOTIFY_ENABLED = NVRAM_Read(12).toInt();
    nvram = NVRAM_Read(13);
    nvram.toCharArray(NOTIFY_EMAIL, nvram.length() + 1);
    nvram = NVRAM_Read(14);
    nvram.toCharArray(NOTIFY_EMAIL_SMTP, nvram.length() + 1);
    nvram = NVRAM_Read(15);
    nvram.toCharArray(NOTIFY_EMAIL_USERNAME, nvram.length() + 1);
    nvram = NVRAM_Read(16);
    //nvram = decrypt(string2char(nvram), aes_iv); //Serial.println(p); //DEBUG
    nvram.toCharArray(NOTIFY_EMAIL_PASSWORD, nvram.length() + 1);
  }
  //EEPROM.end();

  WiFi.setPhyMode((WiFiPhyMode_t)WIFI_PHY_MODE);
  WiFi.setOutputPower(WIFI_PHY_POWER);

  if (ACCESS_POINT_MODE == 0) {
    //=====================
    //WiFi Access Point Mode
    //=====================
    WiFi.mode(WIFI_AP);
    IPAddress ip, gateway, subnet, dns;
    ip.fromString(NETWORK_IP);
    subnet.fromString(NETWORK_SUBNET);
    gateway.fromString(NETWORK_GATEWAY);
    dns.fromString(NETWORK_DNS);
    WiFi.softAPConfig(ip, gateway, subnet);
    WiFi.softAP(ACCESS_POINT_SSID, ACCESS_POINT_PASSWORD, ACCESS_POINT_CHANNEL, ACCESS_POINT_HIDE);
    //Serial.println(WiFi.softAPIP());
  } else {
    //================
    //WiFi Client Mode
    //================
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.disconnect(true);
    WiFi.begin(ACCESS_POINT_SSID, ACCESS_POINT_PASSWORD);  //Connect to the WiFi network
    //WiFi.enableAP(0);
    while (WiFi.waitForConnectResult() != WL_CONNECTED) {
      //Serial.println("Connection Failed! Rebooting...");
      delay(5000);
      ESP.restart();
    }
    //Serial.println(WiFi.localIP());
  }

  //===============
  //Async Web Server
  //===============

  server.on("/can/read", [](AsyncWebServerRequest * request) {

    AsyncResponseStream *response = request->beginResponseStream(text_plain);
    response->addHeader("Cache-Control", "no-cache");
    response->addHeader("Content-Length", "*");

    if (CAN0.checkReceive() == CAN_MSGAVAIL)
    {
      unsigned char len = 0;
      unsigned char rxBuf[8];

      CAN0.readMsgBuf(&len, rxBuf);

      response->printf("%s:", CAN0.getCanId());

      for (byte i = 0; i < len; i++) {
        response->printf("%s,", rxBuf[i]);
      }
      request->send(response);
    }
  });
  server.on("/can/write", [](AsyncWebServerRequest * request) {
    unsigned char stmp[8] = {0, 1, 2, 3, 4, 5, 6, 7};
    CAN0.sendMsgBuf(0x00, 0, 8, stmp);

    request->send(200, text_plain, "OK");
  });
  /*
    server.on("/can/sleep", [](AsyncWebServerRequest * request) {
    CAN0.sleep();  //MCP2515 will NOT wake up on incoming messages
    request->send(200, text_plain, "OK");
    });
    server.on("/can/wake", [](AsyncWebServerRequest * request){
    CAN0.wakeup(); //MCP2515 will wake up on incoming messages
    request->send(200, text_plain, "OK");
    });
  */
  server.on("/format", HTTP_GET, [](AsyncWebServerRequest * request) {
    String result = SPIFFS.format() ? "OK" : "Error";
    FSInfo fs_info;
    SPIFFS.info(fs_info);
    request->send(200, text_plain, "<b>Format " + result + "</b><br/>Total Flash Size: " + String(ESP.getFlashChipSize()) + "<br>SPIFFS Size: " + String(fs_info.totalBytes) + "<br>SPIFFS Used: " + String(fs_info.usedBytes));
  });
  server.on("/reset", HTTP_GET, [](AsyncWebServerRequest * request) {
    request->send(200, text_plain, "...");
    delay(500);
    ESP.restart();
  });
  server.on("/aes", HTTP_GET, [](AsyncWebServerRequest * request) {

    aes_init(); //Generate random IV

    String out = "AES IV: ";
    for (int i = 0; i < sizeof(aes_iv); i++) {
      out += String(aes_iv[i], DEC);
      if ((i + 1) < sizeof(aes_iv)) {
        out += ",";
      }
    }
    request->send(200, text_plain, out);
  });
  server.on("/nvram", HTTP_GET, [](AsyncWebServerRequest * request) {

    String out = "{}";

    if (request->hasParam("network")) {
      out = NVRAM(7, 11, -1);
    } else if (request->hasParam("email")) {
      out = NVRAM(12, 15, -1);
    } else {
      out = NVRAM(0, 6, 4);
    }
    request->send(200, text_json, out);
  });
  server.on("/nvram", HTTP_POST, [](AsyncWebServerRequest * request) {

    String out = "<pre>";
    uint8_t c, from, to = 0;
    uint8_t skip = -1;

    if (request->hasParam("WiFiMode")) {
      //skip confirm password (5)
      from = 0, to = 7, skip = 5;
    } else if (request->hasParam("WiFiDHCP")) {
      from = 7, to = 11;
    } else if (request->hasParam("WiFiNotify")) {
      from = 12, to = 16;
    }

    for (uint8_t i = from; i <= to; i++) {

      String v = request->getParam(c)->value();

      //Catch and encrypt passwords
      if (request->getParam(c)->name() == "EmailPassword") {
        v = encrypt(string2char(v), aes_iv);
        //Serial.println(v);
      }

      if (skip == -1 || i < skip) {
        out += request->getParam(c)->name() + ": ";
        NVRAM_Write(i, v);
        out += NVRAM_Read(i) + "\n";
      } else if (i > skip) {
        out += request->getParam(c)->name() + ": ";
        NVRAM_Write(i - 1, v);
        out += NVRAM_Read(i - 1) + "\n";
      }
      c++;
    }

    out += "\n...Rebooting";
    out += "</pre>";

    //SPIFFS.remove("/data.txt"); //Clean old logs

    AsyncWebServerResponse *response = request->beginResponse(200,  text_html, out);

    if (request->hasParam("WiFiIP")) { //IP has changed
      response->addHeader("Refresh", "10; url=http://" + request->getParam("WiFiIP")->value() + "/index.html");
    } else {
      response->addHeader("Refresh", "8; url=/index.html");
    }
    request->send(response);

    WiFi.disconnect(true);  //Erases SSID/password
    //ESP.eraseConfig();

    delay(4000);
    ESP.restart();
  });

  server.on("/update", HTTP_GET, [](AsyncWebServerRequest * request) {
    request->send(200, text_html, serverIndex);
  });

  server.on("/update", HTTP_POST, [](AsyncWebServerRequest * request) {
    if (Update.hasError()) {
      StreamString str;
      Update.printError(str);
      request->send(200,  text_plain, String("Update error: ") + str.c_str());
    } else {
      AsyncWebServerResponse *response = request->beginResponse(200,  text_html, "Update Success! Rebooting...");
      response->addHeader("Refresh", "15; url=/");
      restartRequired = true;
      request->send(response);
      //ESP.restart();
    }
  }, WebUpload);

  server.on("/snapshot.php", HTTP_POST, [](AsyncWebServerRequest * request) {
    request->send(200,  text_plain, "OK");
  }, SnapshotUpload);

  /*
    server.onFileUpload([](AsyncWebServerRequest *request, const String& filename, size_t index, uint8_t *data, size_t len, bool final){
      if(!index) // if index == 0 then this is the first frame of data
        Serial.printf("UploadStart: %s\n", filename.c_str());
        Serial.printf("%s", (const char*)data);
      if(final) // if the final flag is set then this is the last frame of data
        Serial.printf("UploadEnd: %s (%u)\n", filename.c_str(), index+len);
    });
  */
  server.on("/serial.php", HTTP_GET, [](AsyncWebServerRequest * request) {
    if (request->hasParam("init")) {
      Serial.end();
      Serial.begin(request->getParam("serial")->value().toInt(), SERIAL_8N1);

      String com = "";
      if (CAN0.checkReceive() == CAN_MSGAVAIL) { //if (CAN0.begin(request->getParam("canbus")->value().toInt()) == CAN_OK)
        com  += "CAN";
      }
      if (Serial) {
        com  += "Serial";
      }
      request->send(200, text_plain, com);

    } else if (request->hasParam("get")) {
      String sz =  request->getParam("get")->value();
      String out;

      if (sz.indexOf(",") != -1 )
      {
        char buf[sz.length() + 1];
        sz.toCharArray(buf, sizeof(buf));
        char *p = buf;
        char *str;
        while ((str = strtok_r(p, ",", &p)) != NULL) //split
        {
          out += readSerial("get " + String(str));
        }
      } else {
        out = readSerial("get " + sz);
      }
      request->send(200, text_plain, out);

    } else if (request->hasParam("command")) {

      request->send(200, text_plain, readSerial(request->getParam("command")->value()));

    } else if (request->hasParam("stream")) {

      AsyncResponseStream *response = request->beginResponseStream(text_plain);
      response->addHeader("Cache-Control", "no-cache");
      response->addHeader("Content-Length", "*");

      //String output;
      char b[255];
      uint16_t _loop = request->getParam("loop")->value().toInt();
      uint16_t _delay = request->getParam("delay")->value().toInt();

      flushSerial();

      Serial.print("get " + request->getParam("stream")->value());
      Serial.print("\n");
      Serial.readStringUntil('\n'); //consume echo

      for (uint16_t i = 0; i < _loop; i++) {
        String output = "";
        size_t len = 0;
        if (i != 0)
        {
          Serial.print("!");
          Serial.readBytes(b, 1); //consume "!"
        }
        do {
          memset(b, 0, sizeof(b));
          len = Serial.readBytes(b, sizeof(b) - 1);
          response->print(b);
          //output += b;
        } while (len > 0);

        //response->print(output);
        //Serial.println(output);

        delay(_delay);
      }
      request->send(response);
    }else{
      //DEBUG
      //request->send(200, text_plain, "v:8,b:8,n:8,i:8,p:10,ah:10,kwh:10,t:30*");

      if (Serial.available()) {
        request->send(200, text_plain, Serial.readStringUntil('\n'));
      } else {
        request->send(500);
      }
    }
  });
  server.on("/opendbc/index.json", HTTP_GET, [](AsyncWebServerRequest * request) {
    String ext[]={".dbc"};
    String out = indexJSON("/opendbc", ext);
    request->send(200, text_json, out);
  });
  server.on("/opendbc/delete", HTTP_GET, [](AsyncWebServerRequest * request) {
    SPIFFS.remove("/opendbc/" + request->getParam("file")->value());

    AsyncWebServerResponse *response = request->beginResponse(200, text_html, request->getParam("file")->value() + " file deleted from SPIFFS");
    response->addHeader("Refresh", "3; url=/index.html");
    request->send(response);
  });
  server.on("/views/index.json", HTTP_GET, [](AsyncWebServerRequest * request) {
    String ext[]={".json"};
    String out = indexJSON("/views", ext);
    request->send(200, text_json, out);
  });
  server.on("/views/bg/index.json", HTTP_GET, [](AsyncWebServerRequest * request) {
    String ext[]={".jpg",".png"};
    String out = indexJSON("/views/bg", ext);
    request->send(200, text_json, out);
  });
  server.on("/views/save.php", HTTP_POST, [](AsyncWebServerRequest * request) {

    File file = SPIFFS.open("/views/" + request->getParam("view")->value(), "w");
    file.print(request->getParam("json")->value());
    file.close();
    request->send(200, text_plain, "");
  });

  server.on("/", [](AsyncWebServerRequest * request) {
    if (SPIFFS.exists("/index.html")) {
      request->redirect("/index.html");
    } else {
      AsyncWebServerResponse *response = request->beginResponse(200, text_html, "File System Not Found ...Upload SPIFFS");
      response->addHeader("Refresh", "6; url=/update");
      request->send(response);
    }
  });

  //server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");
  server.onNotFound([](AsyncWebServerRequest * request) {

    //Serial.println((request->method() == HTTP_GET) ? "GET" : "POST");

    String file = request->url(); //Serial.println("Request:" + file);

    if (SPIFFS.exists(file))
    {
      String contentType = getContentType(file);

      AsyncWebServerResponse *response = request->beginResponse(SPIFFS, request->url(), contentType, request->hasParam("download"));

      if (contentType != text_json) {
        response->addHeader("Content-Encoding", "gzip");
      }
      request->send(response);

    } else {
      request->send(404, text_plain, "404: Not Found");
    }
  });
  server.begin();

  //ArduinoOTA.begin();

  //====================
  //CAN-Bus
  //====================
  if (CAN0.begin(CAN_250KBPS) == CAN_OK)
  {
    Serial.println("MCP2515 Initialized Successfully!");
    //CAN0.setMode(MODE_LOOPBACK);
    //CAN0.setMode(MODE_NORMAL);
  } else {
    Serial.println("Error Initializing MCP2515...");
  }
}

void loop()
{
  if (restartRequired) {
    //Serial.println("Restarting ESP");
    restartRequired = false;
    ESP.restart();
  }
  //server.handleClient();
  //ArduinoOTA.handle();
  //yield();
}

char* string2char(String command) {
  if (command.length() != 0) {
    char *p = const_cast<char*>(command.c_str());
    return p;
  }
}

//=============
// NVRAM CONFIG
//=============
String NVRAM(uint8_t from, uint8_t to, uint8_t skip)
{
  String out = "{\n";

  for (uint8_t i = from; i <= to; i++) {
    if (skip == -1 || i != skip) {
      out += "\t\"nvram" + String(i) + "\": \"" + NVRAM_Read(i) + "\",\n";
    }
  }

  out = out.substring(0, (out.length() - 2));
  out += "\n}";

  return out;
}

void NVRAM_Erase()
{
  for (uint16_t i = 0 ; i < EEPROM.length() ; i++) {
    EEPROM.write(i, 255);
  }
}

void NVRAM_Write(uint32_t address, String txt)
{
  char arrayToStore[32];
  memset(arrayToStore, 0, sizeof(arrayToStore));
  txt.toCharArray(arrayToStore, sizeof(arrayToStore)); // Convert string to array.

  EEPROM.put(address * sizeof(arrayToStore), arrayToStore);
  EEPROM.commit();
}

String NVRAM_Read(uint32_t address)
{
  char arrayToStore[32];
  EEPROM.get(address * sizeof(arrayToStore), arrayToStore);

  return String(arrayToStore);
}

String indexJSON(String dir, String ext[])
{
  String out = "{\n\t\"index\": [\n";

  Dir files = SPIFFS.openDir(dir);
  while (files.next()) {
    for (int i=0; i<sizeof(ext); i++) {
        if (files.fileName().endsWith(ext[i])) {
          out += "\t\t\"" + files.fileName() + "\",\n";
        }
    }
  }
  
  out = out.substring(0, (out.length() - 2));
  out += "\t]\n}";

  return out;
}

String getContentType(String filename)
{
  if (filename.endsWith(".htm")) return text_html;
  else if (filename.endsWith(".html")) return text_html;
  else if (filename.endsWith(".css")) return "text/css";
  else if (filename.endsWith(".js")) return "application/javascript";
  else if (filename.endsWith(".json")) return text_json;
  else if (filename.endsWith(".png")) return "image/png";
  else if (filename.endsWith(".jpg")) return "image/jpeg";
  else if (filename.endsWith(".ico")) return "image/x-icon";
  else if (filename.endsWith(".svg")) return "image/svg+xml";
  else if (filename.endsWith(".csv")) return "text/csv";
  else if (filename.endsWith(".ttf")) return "font/ttf";
  else if (filename.endsWith(".woff")) return "font/woff";
  else if (filename.endsWith(".woff2")) return "font/woff2";
  return text_plain;
}

//===============
//Web OTA Updater
//===============
void WebUpload(AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final)
{
  if (!index) {
    //Serial.print(request->params());

    if (filename == "flash-spiffs.bin") {
      //if (request->hasParam("filesystem")) {
      //SPIFFS.format();
      size_t fsSize = ((size_t) &_FS_end - (size_t) &_FS_start);
      //Serial.printf("Free SPIFFS Space: %u\n", fsSize);
      //Serial.printf("SPIFFS Flash Offset: %u\n", U_FS);
      close_all_fs();
      if (!Update.begin(fsSize, U_FS)) { //start with max available size
        Update.printError(Serial);
      }
    } else {
      uint32_t maxSketchSpace = (ESP.getFreeSketchSpace() - 0x1000) & 0xFFFFF000; //calculate sketch space required for the update
      //Serial.printf("Free Scketch Space: %u\n", maxSketchSpace);
      if (!Update.begin(maxSketchSpace, U_FLASH)) { //start with max available size
        Update.printError(Serial);
      }
    }
    Update.runAsync(true); // tell the updaterClass to run in async mode
  }

  if (Update.write(data, len) != len) {
    Update.printError(Serial);
  }

  if (final) {
    if (!Update.end(true)) {
      Update.printError(Serial);
    }
  }
}

void SnapshotUpload(AsyncWebServerRequest * request, String filename, size_t index, uint8_t *data, size_t len, bool final)
{
  if (!index) {
    SPIFFS.remove("/views/" + filename);
  }

  File fsUpload = SPIFFS.open("/views/" + filename, "a");
  fsUpload.write(data, len);
  fsUpload.close();
}

//===================
// SERIAL PROCESSING
//===================
String flushSerial()
{
  String output;
  uint8_t timeout = 4;

  while (Serial.available() && timeout > 0) {
    output = Serial.readString(); //flush all previous output
    timeout--;
  }
  return output;
}

String readSerial(String cmd)
{
  flushSerial();

  Serial.print(cmd);
  Serial.print('\n');
  Serial.readStringUntil('\n'); //consume echo

  String output = Serial.readString(); //Faster than binary read
  /*
    char b[255];
    size_t len = 0;
    do {
    memset(b, 0, sizeof(b));
    len = Serial.readBytes(b, sizeof(b) - 1);
    output += b;
    } while (len > 0);
  */
  return output;
}
