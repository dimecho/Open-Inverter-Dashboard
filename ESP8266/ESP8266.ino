#ifdef ESP32
#include <WiFi.h>
#include <SPIFFS.h>
#else
#include <ESP8266WiFi.h>
#include <FS.h>
#endif

#include <EEPROM.h>
#include <AESLib.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPUpdateServer.h>

ESP8266WebServer server(80);
ESP8266HTTPUpdateServer updater;

int WIFI_PHY_MODE = 1; //WIFI_PHY_MODE_11B = 1, WIFI_PHY_MODE_11G = 2, WIFI_PHY_MODE_11N = 3
float WIFI_PHY_POWER = 20.5; //Max = 20.5dbm
int ACCESS_POINT_MODE = 0;
char ACCESS_POINT_SSID[] = "Dashboard";
char ACCESS_POINT_PASSWORD[] = "dashboard123";
int ACCESS_POINT_CHANNEL = 11;
int ACCESS_POINT_HIDE = 0;
int DATA_LOG = 0; //Enable data logger
int LOG_INTERVAL = 5; //seconds between data collection and write to SPIFFS

bool phpTag[] = { false, false, false };
const char text_html[] = "text/html";
const char text_plain[] = "text/plain";
const char text_json[] = "application/json";

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
byte aes_iv[N_BLOCK] = { 0x04, 0x0B, 0x04, 0x05, 0x05, 0x09, 0x04, 0x07, 0x05, 0x05, 0x05, 0x02, 0x05, 0x05, 0x01, 0x00 };

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

void print_key_iv() {
  Serial.println("AES IV: ");
  for (unsigned int i = 0; i < sizeof(aes_iv); i++) {
    Serial.print(aes_iv[i], DEC);
    if ((i + 1) < sizeof(aes_iv)) {
      Serial.print(",");
    }
  }

  Serial.println("");
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
  EEPROM.begin(512);
  int e = EEPROM.read(0);

  if (e == 255) { //if (NVRAM_Read(0) == "") {
    NVRAM_Erase();
    NVRAM_Write(0, String(ACCESS_POINT_MODE));
    NVRAM_Write(1, String(ACCESS_POINT_HIDE));
    NVRAM_Write(2, String(ACCESS_POINT_CHANNEL));
    NVRAM_Write(3, ACCESS_POINT_SSID);
    NVRAM_Write(4, encrypt(ACCESS_POINT_PASSWORD, aes_iv));
    NVRAM_Write(5, String(DATA_LOG));
    NVRAM_Write(6, String(LOG_INTERVAL));
    SPIFFS.format();
    //aes_init(); //Generate random IV
  } else {
    ACCESS_POINT_MODE = NVRAM_Read(0).toInt();
    ACCESS_POINT_HIDE = NVRAM_Read(1).toInt();
    ACCESS_POINT_CHANNEL = NVRAM_Read(2).toInt();
    String s = NVRAM_Read(3);
    s.toCharArray(ACCESS_POINT_SSID, s.length() + 1);
    String p = NVRAM_Read(4);
    String d = p.substring(p.length() - 2, p.length()); //last two chars
    if(d == "==") { //check if encrypted
        p = decrypt(string2char(p), aes_iv); //decrypt
    }
    p.toCharArray(ACCESS_POINT_PASSWORD, p.length() + 1);
    DATA_LOG = NVRAM_Read(5).toInt();
    LOG_INTERVAL = NVRAM_Read(6).toInt();
  }
  //EEPROM.end();

  WiFi.setPhyMode((WiFiPhyMode_t)WIFI_PHY_MODE);
  WiFi.setOutputPower(WIFI_PHY_POWER);

  if (ACCESS_POINT_MODE == 0) {
    //=====================
    //WiFi Access Point Mode
    //=====================
    WiFi.mode(WIFI_AP);
    IPAddress ip(192, 168, 4, 1);
    IPAddress gateway(192, 168, 4, 1);
    IPAddress subnet(255, 255, 255, 0);
    IPAddress dns0(192, 168, 4, 1);
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
  //Web OTA Updater
  //===============
  //updater.setup(&server, "/firmware", update_username, update_password);
  updater.setup(&server);

  //===============
  //Web Server
  //===============

  server.on("/can/read", []() {

    server.sendHeader("Cache-Control", "no-cache");
    server.setContentLength(CONTENT_LENGTH_UNKNOWN);
    server.send(200, text_plain, "");

    if (CAN0.checkReceive() == CAN_MSGAVAIL)
    {
      unsigned char len = 0;
      unsigned char rxBuf[8];

      CAN0.readMsgBuf(&len, rxBuf);

      server.sendContent(String(CAN0.getCanId()));
      server.sendContent(":");

      for (byte i = 0; i < len; i++) {
        server.sendContent(String(rxBuf[i]));
        server.sendContent(",");
      }
    }
  });
  server.on("/can/write", []() {
    unsigned char stmp[8] = {0, 1, 2, 3, 4, 5, 6, 7};
    CAN0.sendMsgBuf(0x00, 0, 8, stmp);

    server.send(200, text_plain, "OK");
  });
  server.on("/can/sleep", []() {
    CAN0.sleep();
    server.send(200, text_plain, "OK");
  });
  server.on("/can/wake", []() {
    CAN0.wake();
    server.send(200, text_plain, "OK");
  });
  server.on("/format", HTTP_GET, []() {
    String result = SPIFFS.format() ? "OK" : "Error";
    FSInfo fs_info;
    SPIFFS.info(fs_info);
    server.send(200, text_plain, "<b>Format " + result + "</b><br/>Total Flash Size: " + String(ESP.getFlashChipSize()) + "<br>SPIFFS Size: " + String(fs_info.totalBytes) + "<br>SPIFFS Used: " + String(fs_info.usedBytes));
  });
  server.on("/reset", HTTP_GET, []() {
    server.send(200, text_plain, "...");
    delay(500);
    ESP.restart();
  });
  server.on("/nvram", HTTP_GET, []() {
    NVRAM();
  });
  server.on("/nvram", HTTP_POST, []() {

    if (server.argName(0) == "WiFiMode") {
      //skip confirm password (5)
      NVRAMUpload(0, 7, 5);
    } else if (server.argName(0) == "WiFiDHCP") {
      NVRAMUpload(7, 11, -1);
    } else if (server.argName(0) == "WiFiNotify") {
      NVRAMUpload(12, 15, -1);
    } else {
      NVRAM_Erase();
    }

    SPIFFS.remove("/data.txt"); //Clean old logs
  });
  server.on("/serial.php", HTTP_GET, []() {
    if (server.hasArg("init"))
    {
      Serial.end();
      Serial.begin(server.arg("serial").toInt(), SERIAL_8N1);

      if (CAN0.checkReceive() == CAN_MSGAVAIL) //if (CAN0.begin(server.arg("canbus").toInt()) == CAN_OK)
      {
        server.send(200, text_plain, "CAN");
      } else {
        server.send(200, text_plain, "Serial");
      }
    }
    else if (server.hasArg("read"))
    {
      String out = "";
      if (Serial.available()) {
        out = Serial.readString();
      }
      server.send(200, text_plain, out);
    }
    else if (server.hasArg("get"))
    {
      String sz = server.arg("get");
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
      server.send(200, text_plain, out);
    }
    else if (server.hasArg("command"))
    {
      server.send(200, text_plain, readSerial(server.arg("command")));
    }
    else if (server.hasArg("stream"))
    {
      String l = server.arg("loop");
      String d = server.arg("delay");
      readStream("get " + server.arg("stream"), l.toInt(), d.toInt());
    }
  });
  server.on("/views/save.php", HTTP_POST, []() {

    //Serial.print(server.arg("json"));

    File file = SPIFFS.open("/views/" + server.arg("view"), "w");
    file.print(server.arg("json"));
    file.close();

    server.send(200, text_plain, "");
  });
  server.on("/", []() {
    if (SPIFFS.exists("/index.html")) {
      server.sendHeader("Location", "/index.html");
      server.send(303);
    } else {
      server.sendHeader("Refresh", "6; url=/update");
      server.send(200, text_html, "File System Not Found ...Upload SPIFFS");
    }
  });
  server.onNotFound([]() {
    if (!HTTPServer(server.uri()))
      server.send(404, text_plain, "404: Not Found");
  });
  server.begin();

  //====================
  //CAN-Bus
  //====================
  if (CAN0.begin(CAN_250KBPS) == CAN_OK)
  {
    Serial.println("MCP2515 Initialized Successfully!");
    //CAN0.setMode(MODE_LOOPBACK);
    CAN0.setMode(MODE_NORMAL);
  } else {
    Serial.println("Error Initializing MCP2515...");
  }
}

void loop()
{
  server.handleClient();

  //====================
  //CAN-Bus
  //====================
  /*
    if (CAN0.checkReceive() == CAN_MSGAVAIL)
    {
    unsigned int rxId;
    unsigned char len = 0;
    unsigned char rxBuf[8];

    CAN0.readMsgBuf(&len, rxBuf);      // Read data: len = data length, buf = data byte(s)

    rxId = CAN0.getCanId();

    //Serial.print(canMessage);

    if ((rxId & 0x80000000) == 0x80000000) {
      Serial.printf("Extended ID: 0x%.8lX DLC: %1d  Data:", (rxId & 0x1FFFFFFF), len);
    } else {
      Serial.printf("Standard ID: 0x%.3lX DLC: %1d  Data:", rxId, len);
    }

    Serial.print("<"); Serial.print(rxId); Serial.print(",");

    for (byte i = 0; i < len; i++) {
      Serial.print(rxBuf[i]); Serial.print(",");
    }
    Serial.print(">"); Serial.println();
    }
  */
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
void NVRAM()
{
  String out = "{\n";
  for (uint8_t i = 0; i <= 3; i++) {
    out += "\t\"nvram" + String(i) + "\": \"" + NVRAM_Read(i) + "\",\n";
  }

  //skip plaintext password (4)

  for (uint8_t i = 5; i <= 6; i++) {
    out += "\t\"nvram" + String(i) + "\": \"" + NVRAM_Read(i) + "\",\n";
  }

  out = out.substring(0, (out.length() - 2));
  out += "\n}";

  server.send(200, text_json, out);
}

void NVRAMUpload(uint8_t from, uint8_t to, uint8_t skip)
{
  //NVRAM_Erase();

  String out = "<pre>";

  for (uint8_t i = from; i <= to; i++) {

    String v = server.arg(i);

    //Catch and encrypt passwords
    if (server.argName(i) == "WiFiPassword" || server.argName(i) == "EmailPassword") {
      v = encrypt(string2char(v), aes_iv);
      //Serial.println(server.arg(i) + ">" + v);
    }
    
    if (skip == -1 || i < skip) {
      out += server.argName(i) + ": ";
      NVRAM_Write(i, v);
      out += NVRAM_Read(i) + "\n";
    } else if (i > skip) {
      out += server.argName(i) + ": ";
      NVRAM_Write(i - 1, v);
      out += NVRAM_Read(i - 1) + "\n";
    }
  }

  out += "\n...Rebooting";
  out += "</pre>";

  server.sendHeader("Refresh", "8; url=/index.html");
  server.send(200, text_html, out);

  WiFi.disconnect(true);  //Erases SSID/password
  //ESP.eraseConfig();

  delay(4000);
  ESP.restart();
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

bool HTTPServer(String file)
{
  //Serial.println((server.method() == HTTP_GET) ? "GET" : "POST");
  //Serial.println(file);

  if (SPIFFS.exists(file))
  {
    File f = SPIFFS.open(file, "r");
    if (f)
    {
      //Serial.println(f.size());

      String contentType = getContentType(file);

      if (contentType != text_json)
      {
        server.sendHeader("Content-Encoding", "gzip");
      }
      server.streamFile(f, contentType);

      f.close();

      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

String getContentType(String filename)
{
  if (server.hasArg("download")) return "application/octet-stream";
  else if (filename.endsWith(".htm")) return text_html;
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
  char b[255];
  String output;

  flushSerial();

  Serial.print(cmd);
  Serial.print("\n");
  Serial.readStringUntil('\n'); //consume echo
  //for (uint16_t i = 0; i <= cmd.length() + 1; i++)
  //  Serial.read();

  output = Serial.readString(); //Faster than binary read
  /*
    size_t len = 0;
    do {
    memset(b, 0, sizeof(b));
    len = Serial.readBytes(b, sizeof(b) - 1);
    output += b;
    } while (len > 0);
  */
  return output;
}

String readStream(String cmd, int _loop, int _delay)
{
  char b[255];
  String output;

  //server.sendHeader("Expires", "-1");
  server.sendHeader("Cache-Control", "no-cache");
  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, text_plain, "");
  //server.send(200, text_html, "");

  flushSerial();

  Serial.print(cmd);
  Serial.print("\n");
  Serial.readStringUntil('\n'); //consume echo

  //WiFiClient client = server.client();
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
      //client.write((const char*)b, len);
      output += b;
    } while (len > 0);

    server.sendContent(output);
    //client.print(output);
    //client.flush();

    //Serial.println(output);
    delay(_delay);
  }

  //client.stop(); // Stop is needed because we sent no content length
}
