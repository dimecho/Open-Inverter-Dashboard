#include <RemoteDebug.h>
#include <FS.h>
#include <EEPROM.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPUpdateServer.h>

RemoteDebug Debug;
ESP8266WebServer server(80);
ESP8266HTTPUpdateServer updater;

int WIFI_PHY_MODE = 1; //WIFI_PHY_MODE_11B = 1, WIFI_PHY_MODE_11G = 2, WIFI_PHY_MODE_11N = 3
float WIFI_PHY_POWER = 20.5; //Max = 20.5dbm
int ACCESS_POINT_MODE = 0;
char ACCESS_POINT_SSID[] = "Dasboard";
char ACCESS_POINT_PASSWORD[] = "dashboard123";
int ACCESS_POINT_CHANNEL = 7;
int ACCESS_POINT_HIDE = 0;
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
#include <mcp_can.h>
#include <SPI.h>
/*
  #define MCP_8MHz_250kBPS_CFG1 (0x40)
  #define MCP_8MHz_250kBPS_CFG2 (0xF1)
  #define MCP_8MHz_250kBPS_CFG3 (0x85)
*/
char canMessage[128];  // Array to store serial string
/*
  MISO=D7(GPIO12),MOSI=D6(GPIO13),SCLK=D5(GPIO14),CS=D2(GPIO4),INT=D4(GPIO2)
  https://arduino-esp8266.readthedocs.io/en/2.4.0-rc1/libraries.html#spi

  There’s an extended mode where you can swap the normal pins to the SPI0 hardware pins.
  This is enabled by calling SPI.pins(6, 7, 8, 0) before the call to SPI.begin().

  The pins would change to: MOSI=SD1,MISO=SD0,SCLK=CLK,HWCS=GPIO0
*/
#define CAN_INT 2    // Set INT to pin GPIO2 (D4)
MCP_CAN CAN(4);      // Set CS to pin GPIO4 (D2)
//=============================

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
    NVRAM_Write(4, ACCESS_POINT_PASSWORD);
    SPIFFS.format();
  } else {
    ACCESS_POINT_MODE = NVRAM_Read(0).toInt();
    ACCESS_POINT_HIDE = NVRAM_Read(1).toInt();
    ACCESS_POINT_CHANNEL = NVRAM_Read(2).toInt();
    String s = NVRAM_Read(3);
    s.toCharArray(ACCESS_POINT_SSID, s.length() + 1);
    String p = NVRAM_Read(4);
    p.toCharArray(ACCESS_POINT_PASSWORD, p.length() + 1);
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
    server.send(200, text_plain, canMessage);
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
    NVRAMUpload();
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

  //===================
  //Remote Telnet Debug
  //===================
  Debug.begin("dashboard"); // Telnet server
  Debug.setResetCmdEnabled(true); // Enable the reset command

  //====================
  //CAN-Bus
  //====================
  //if (CAN.begin(MCP_ANY, CAN_250KBPS, MCP_8MHZ) == CAN_OK)
  if (CAN.begin(CAN_250KBPS) == CAN_OK)
  {
    Serial.println("MCP2515 Initialized Successfully!");
    //CAN.setMode(MODE_NORMAL);
    //CAN.setMode(MODE_LOOPBACK);
    //pinMode(CAN_INT, INPUT);
  } else {
    Serial.println("Error Initializing MCP2515...");
  }
}

void loop()
{
  Debug.handle();
  server.handleClient();

  //====================
  //CAN-Bus
  //====================

  //if (!digitalRead(CAN0_INT))
  if (CAN.checkReceive() == CAN_MSGAVAIL)
  {
    unsigned int rxId;
    unsigned char len = 0;
    unsigned char rxBuf[8];

    CAN.readMsgBuf(&len, rxBuf);      // Read data: len = data length, buf = data byte(s)

    rxId = CAN.getCanId();

    Debug.print("<"); Debug.print(rxId); Debug.print(",");

    if ((rxId & 0x80000000) == 0x80000000)
      sprintf(canMessage, "Extended ID: 0x%.8lX  DLC: %1d  Data:", (rxId & 0x1FFFFFFF), len);
    else
      sprintf(canMessage, "Standard ID: 0x%.3lX       DLC: %1d  Data:", rxId, len);

    //Debug.print(canMessage);

    if ((rxId & 0x40000000) == 0x40000000) {
      sprintf(canMessage, " REMOTE REQUEST FRAME");
      //Debug.print(canMessage);
    } else {
      for (byte i = 0; i < len; i++) {
        //sprintf(canMessage, " 0x%.2X", rxBuf[i]);
        //Debug.println(canMessage);
        Debug.print(rxBuf[i]); Debug.print(",");
      }
      Debug.print(">");
    }
    Debug.println();

  }
  /*
    if (CAN.checkError() == CAN_CTRLERROR) {
    Serial.print("Error register value: ");
    byte tempErr = CAN.getError() & MCP_EFLG_ERRORMASK; // We are only interested in errors, not warnings.
    Debug.println(tempErr, BIN);

    Debug.print("Transmit error counter register value: ");
    tempErr = CAN.errorCountTX();
    Debug.println(tempErr, DEC);

    Debug.print("Receive error counter register value: ");
    tempErr = CAN.errorCountRX();
    Debug.println(tempErr, DEC);
    }
  */
  /*
    unsigned char stmp[8] = {0, 1, 2, 3, 4, 5, 6, 7};
    if (Serial.available()) {
    stmp[0] = Serial.read();
    if (stmp[0] == 'l') {
      CAN.setMode(MCP_LOOPBACK);
    }
    if (stmp[0] == 'n') {
      CAN.setMode(MCP_NORMAL);
    }
    }
  */
  //CAN0.sendMsgBuf(0x00, 0, 8, stmp);
  //delay(100);                       // send data per 100ms
  //====================
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

void NVRAMUpload()
{
  NVRAM_Erase();

  String out = "<pre>";

  for (uint8_t i = 0; i <= 4; i++) {
    out += server.argName(i) + ": ";
    NVRAM_Write(i, server.arg(i));
    out += NVRAM_Read(i) + "\n";
  }

  //skip confirm password (5)

  for (uint8_t i = 6; i <= 7; i++) {
    out += server.argName(i) + ": ";
    NVRAM_Write(i - 1, server.arg(i));
    out += NVRAM_Read(i - 1) + "\n";
  }
  out += "\n...Rebooting";
  out += "</pre>";

  server.sendHeader("Refresh", "8; url=/esp8266.php");
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
  Debug.println((server.method() == HTTP_GET) ? "GET" : "POST");
  Debug.println(file);

  if (SPIFFS.exists(file))
  {
    File f = SPIFFS.open(file, "r");
    if (f)
    {
      //Debug.println(f.size());

      String contentType = getContentType(file);

      server.sendHeader("Content-Encoding", "gzip");
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
  uint8_t timeout = 8;

  while (Serial.available() && timeout > 0) {
    output = Serial.readString(); //flush all previous output
    timeout--;
  }
  return output;
}

String readSerial(String cmd)
{
  char b[255];
  String output = flushSerial();

  //Debug.println(cmd);
  if (output.substring(0, 2) != "2D") //Empty Bootloader detection
  {
    Serial.print(cmd);
    Serial.print("\n");
    Serial.readStringUntil('\n'); //consume echo
    //for (uint16_t i = 0; i <= cmd.length() + 1; i++)
    //  Serial.read();
    size_t len = 0;
    do {
      memset(b, 0, sizeof(b));
      len = Serial.readBytes(b, sizeof(b) - 1);
      output += b;
    } while (len > 0);
  }
  //Debug.println(output);

  return output;
}

String readStream(String cmd, int _loop, int _delay)
{
  char b[255];
  String output = flushSerial();

  //server.sendHeader("Expires", "-1");
  server.sendHeader("Cache-Control", "no-cache");
  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, text_plain, "");
  //server.send(200, text_html, "");

  //Debug.println(cmd);
  if (output.substring(0, 2) != "2D") //Empty Bootloader detection
  {
    server.sendContent(output);
  } else {
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

      //Debug.println(output);
      delay(_delay);
    }
  }
  //client.stop(); // Stop is needed because we sent no content length
}