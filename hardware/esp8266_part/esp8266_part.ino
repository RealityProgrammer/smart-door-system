#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <Servo.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

#define WIFI_PROBLEM_PIN        D1
#define DOOR_LED_PIN            D2
#define RFID_READER_SS_PIN      D8
#define RFID_READER_RST_PIN     D3

#define DOOR_OPEN_DURATION_MS   3000

const char* ssid = "DESKTOP-5B623ID 9507";
const char* password = "1j63{11X";

void connectToWifi();

bool websocketConnected;
WebSocketsClient wsClient;

void onWebsocketEvent(WStype_t type, uint8_t * payload, size_t length);

MFRC522 mfrc522(RFID_READER_SS_PIN, RFID_READER_RST_PIN);

const uint8_t authenticatedCardUidsSize4[][4] = {
  { 0x51, 0x4C, 0xDD, 0x00 }
};

const uint8_t authenticatedCardUidsSize7[][7] = {};

const uint8_t authenticatedCardUidsSize10[][10] = {};

const String deviceId = "smart_door_002";

void setup() {
  Serial.begin(115200);

  pinMode(WIFI_PROBLEM_PIN, OUTPUT);
  digitalWrite(WIFI_PROBLEM_PIN, HIGH);

  connectToWifi();

  // Serial.println("\nConnecting websocket...");

  wsClient.begin("10.176.175.7", 8000, "/ws"); // ipconfig -> Look for IPv4 of 'Wireless LAN adapter Wi-Fi'
  wsClient.onEvent(onWebsocketEvent);
  wsClient.enableHeartbeat(15000, 3000, 2);
  wsClient.setReconnectInterval(2000);

  // doorServo.attach(SERVO_PIN, 500, 2300);
  // doorServo.write(0);

  pinMode(DOOR_LED_PIN, OUTPUT);
  digitalWrite(DOOR_LED_PIN, LOW);

  SPI.begin();
	mfrc522.PCD_Init();
  // mfrc522.PCD_DumpVersionToSerial();	// Show details of PCD - MFRC522 Card Reader details
}

void loop() {
  wsClient.loop();

  if (mfrc522.PICC_IsNewCardPresent()) {
    if (mfrc522.PICC_ReadCardSerial()) {
      // mfrc522.PICC_DumpToSerial(&mfrc522.uid); // Dump card information
      bool open = false;

      switch (mfrc522.uid.size) {
        case 4:
          for (int i = 0; i < sizeof(authenticatedCardUidsSize4) / sizeof(void*); i++) {
            if (memcmp(mfrc522.uid.uidByte, authenticatedCardUidsSize4[i], 4) == 0) {
              open = true;
              break;
            }
          }
          break;

        case 7:
          for (int i = 0; i < sizeof(authenticatedCardUidsSize7) / sizeof(void*); i++) {
            if (memcmp(mfrc522.uid.uidByte, authenticatedCardUidsSize4[i], 7) == 0) {
              open = true;
              break;
            }
          }
          break;

        case 10:
          for (int i = 0; i < sizeof(authenticatedCardUidsSize4) / sizeof(void*); i++) {
            if (memcmp(mfrc522.uid.uidByte, authenticatedCardUidsSize4[i], 10) == 0) {
              open = true;
              break;
            }
          }
          break;

        default: open = false;
      }

      if (open) {
        openDoor();
      } else {
        closeDoor(true);
      }
    }
  }

  while (Serial.available() >= 4) {
    char cmdid[4];

    Serial.readBytes(cmdid, 4);

    if (memcmp(cmdid, "srvo", 4) == 0) {
      bool status;

      Serial.readBytes((char*)&status, 1);

      digitalWrite(DOOR_LED_PIN, status ? HIGH : LOW);
    } else if (memcmp(cmdid, "atck", 4) == 0) {
      sendAttackStatus();
    }
  }

  // if (millis() >= doorCloseTime) {
  //   closeDoor();
  // }
}

void connectToWifi() {
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
  }
  
  digitalWrite(WIFI_PROBLEM_PIN, LOW);
}

void onWebsocketEvent(WStype_t type, uint8_t* data, size_t len) {
  switch (type) {
    case WStype_CONNECTED:
        // Serial.printf("Websocket connected to %s.\n", data);
        websocketConnected = true;
        registerDevice();
      break;

    case WStype_DISCONNECTED:
      // Serial.printf("Websocket disconnected!\n");
      websocketConnected = false;
      break;

    case WStype_TEXT:
      data[len] = 0;  // Null-terminated.

      JsonDocument json;
      deserializeJson(json, (const uint8_t*)data);

      const char* payloadType = json["type"];

      if (memcmp(payloadType, "door_command", 12) == 0) {
        const char* payloadDeviceId = json["device_id"];
        const char* command = json["command"];

        if (memcmp(payloadDeviceId, deviceId.c_str(), deviceId.length()) == 0) {
          if (memcmp(command, "open_door", 9) == 0) {
            openDoor();
          }
        }
      }
      break;
  }
}

void updateDoorStatus(const char* status) {
  if (!websocketConnected) return;

  JsonDocument doc;
  doc["type"] = "update_door_status";
  doc["device_id"] = deviceId;
  doc["door_status"] = status;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);

  wsClient.sendTXT(payload);
}

void sendAttackStatus() {
  JsonDocument doc;
  doc["type"] = "door_attacked";
  doc["device_id"] = deviceId;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);

  wsClient.sendTXT(payload);
}

void registerDevice() {
  if (!websocketConnected) return;
  
  JsonDocument doc;
  doc["type"] = "device_register";
  doc["device_id"] = deviceId;
  doc["device_type"] = "smart_door";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["status"] = "online";

  String payload;
  serializeJson(doc, payload);

  wsClient.sendTXT(payload);
}

void openDoor() {
  Serial.write("open");
  
  digitalWrite(DOOR_LED_PIN, HIGH);
  updateDoorStatus("open");
}

void closeDoor(bool buzzer) {
  Serial.write("clse");
  Serial.write(buzzer);

  // doorServo.write(0);
  updateDoorStatus("closed");
}

// #include <ESP8266WiFi.h>
// #include <ESP8266HTTPClient.h>
// #include <WiFiClient.h>

// // WiFi credentials
// const char* ssid = "DESKTOP-5B623ID 9507";
// const char* password = "1j63{11X";

// // Server settings
// const char* serverURL = "http://10.209.222.243:8000"; // IP máy chạy backend
// const String deviceId = "smart_door_002";

// // Hardware pins
// const int DOOR_LED_PIN = 2;  // Built-in LED (GPIO2)
// const int RELAY_PIN = D1;    // Relay pin for actual door
// const int STATUS_LED_PIN = D2; // Status LED

// // Timing
// unsigned long lastCheck = 0;
// const unsigned long checkInterval = 2000; // Check every 2 seconds

// // Door state
// bool doorIsOpen = false;
// unsigned long doorOpenedAt = 0;
// const unsigned long doorOpenDuration = 5000; // 5 seconds

// void setup() {
//   Serial.begin(115200);
  
//   // Initialize pins
//   pinMode(DOOR_LED_PIN, OUTPUT);
//   pinMode(RELAY_PIN, OUTPUT);
//   pinMode(STATUS_LED_PIN, OUTPUT);
  
//   // Initial state - door closed
//   digitalWrite(DOOR_LED_PIN, HIGH);  // LED off (inverted)
//   digitalWrite(RELAY_PIN, LOW);      // Relay off
//   digitalWrite(STATUS_LED_PIN, LOW); // Status LED off
  
//   // Connect to WiFi
//   connectToWiFi();
  
//   Serial.println("Smart Door Controller Ready!");
//   Serial.print("Server URL: ");
//   Serial.println(serverURL);
// }

// void loop() {
//   // Check WiFi connection
//   if (WiFi.status() != WL_CONNECTED) {
//     connectToWiFi();
//     return;
//   }
  
//   // Check for door commands
//   if (millis() - lastCheck >= checkInterval) {
//     checkDoorCommand();
//     lastCheck = millis();
//   }
  
//   // Handle door auto-close
//   if (doorIsOpen && (millis() - doorOpenedAt >= doorOpenDuration)) {
//     closeDoor();
//   }
  
//   // Blink status LED to show alive
//   static unsigned long lastBlink = 0;
//   if (millis() - lastBlink >= 1000) {
//     digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
//     lastBlink = millis();
//   }
  
//   delay(100);
// }

// void connectToWiFi() {
//   Serial.print("Connecting to WiFi: ");
//   Serial.println(ssid);
  
//   WiFi.begin(ssid, password);
  
//   int attempts = 0;
//   while (WiFi.status() != WL_CONNECTED && attempts < 20) {
//     delay(500);
//     Serial.print(".");
//     attempts++;
//   }
  
//   if (WiFi.status() == WL_CONNECTED) {
//     Serial.println("\nWiFi connected!");
//     Serial.print("IP address: ");
//     Serial.println(WiFi.localIP());
    
//     // Register device with server
//     registerDevice();
//   } else {
//     Serial.println("\nWiFi connection failed!");
//   }
// }

// void checkDoorCommand() {
//   if (WiFi.status() != WL_CONNECTED) return;
  
//   WiFiClient client;
//   HTTPClient http;
  
//   String url = String(serverURL) + "/api/door/command/" + deviceId;
//   http.begin(client, url);
//   http.addHeader("Content-Type", "application/json");
  
//   int httpCode = http.GET();
  
//   if (httpCode == 200) {
//     String response = http.getString();
    
//     // Parse JSON response
//     StaticJsonDocument<300> doc;
//     DeserializationError error = deserializeJson(doc, response);
    
//     if (!error) {
//       bool hasCommand = doc["has_command"];
//       String command = doc["command"];
//       String recognizedName = doc["recognized_name"];
      
//       if (hasCommand && command == "open_door") {
//         Serial.println("Door open command received!");
//         Serial.println("Recognized: " + recognizedName);
//         openDoor();
        
//         // Acknowledge command
//         acknowledgeCommand();
//       }
//     } else {
//       Serial.println("JSON parse error: " + String(error.c_str()));
//     }
//   } else if (httpCode != 404) {
//     Serial.println("HTTP error: " + String(httpCode));
//   }
  
//   http.end();
// }

// void openDoor() {
//   if (doorIsOpen) return; // Already open
  
//   Serial.println("🔓 Opening door...");
  
//   // Turn on LED and relay
//   digitalWrite(DOOR_LED_PIN, LOW);   // LED on (inverted)
//   digitalWrite(RELAY_PIN, HIGH);     // Relay on
  
//   doorIsOpen = true;
//   doorOpenedAt = millis();
  
//   // Send status update to server
//   updateDoorStatus("open");
// }

// void closeDoor() {
//   if (!doorIsOpen) return; // Already closed
  
//   Serial.println("🔒 Closing door...");
  
//   // Turn off LED and relay
//   digitalWrite(DOOR_LED_PIN, HIGH);  // LED off (inverted)
//   digitalWrite(RELAY_PIN, LOW);      // Relay off
  
//   doorIsOpen = false;
  
//   // Send status update to server
//   updateDoorStatus("closed");
// }

// void acknowledgeCommand() {
//   if (WiFi.status() != WL_CONNECTED) return;
  
//   WiFiClient client;
//   HTTPClient http;
  
//   String url = String(serverURL) + "/api/door/acknowledge";
//   http.begin(client, url);
//   http.addHeader("Content-Type", "application/json");
  
//   StaticJsonDocument<200> doc;
//   doc["device_id"] = deviceId;
//   doc["timestamp"] = millis();
//   doc["status"] = "command_executed";
  
//   String payload;
//   serializeJson(doc, payload);
  
//   int httpCode = http.POST(payload);
  
//   if (httpCode > 0) {
//     Serial.println("Command acknowledged");
//   }
  
//   http.end();
// }

// void updateDoorStatus(String status) {
//   if (WiFi.status() != WL_CONNECTED) return;
  
//   WiFiClient client;
//   HTTPClient http;
  
//   String url = String(serverURL) + "/api/door/status";
//   http.begin(client, url);
//   http.addHeader("Content-Type", "application/json");
  
//   StaticJsonDocument<200> doc;
//   doc["device_id"] = deviceId;
//   doc["door_status"] = status;
//   doc["timestamp"] = millis();
  
//   String payload;
//   serializeJson(doc, payload);
  
//   int httpCode = http.POST(payload);
  
//   if (httpCode > 0) {
//     Serial.println("Status updated: " + status);
//   }
  
//   http.end();
// }
// // #include <ESP8266WiFi.h>
// // // #include <FirebaseArduino.h>

// // #define DOOR_PIN D1 // Pin connected to the door mechanism

// // const char* ssid = "YOUR_SSID"; // Replace with your Wi-Fi SSID
// // const char* password = "YOUR_PASSWORD"; // Replace with your Wi-Fi password
// // // const char* firebaseHost = "YOUR_FIREBASE_HOST"; // Replace with your Firebase host
// // // const char* firebaseAuth = "YOUR_FIREBASE_AUTH"; // Replace with your Firebase auth token

// // void setup() {
// //     Serial.begin(115200);
// //     pinMode(DOOR_PIN, OUTPUT);
// //     digitalWrite(DOOR_PIN, LOW); // Ensure door is closed initially

// //     // Connect to Wi-Fi
// //     WiFi.begin(ssid, password);
// //     while (WiFi.status() != WL_CONNECTED) {
// //         delay(1000);
// //         Serial.println("Connecting to WiFi...");
// //     }
// //     Serial.println("Connected to WiFi");

// //     // Connect to Firebase
// //     Firebase.begin(firebaseHost, firebaseAuth);
// // }

// // void loop() {
// //     // Check for incoming requests from the backend
// //     if (Firebase.getInt("doorStatus") == 1) {
// //         openDoor();
// //         Firebase.setInt("doorStatus", 0); // Reset door status
// //     }
// //     delay(1000); // Check every second
// // }

// // void openDoor() {
// //     digitalWrite(DOOR_PIN, HIGH); // Open the door
// //     delay(5000); // Keep the door open for 5 seconds
// //     digitalWrite(DOOR_PIN, LOW); // Close the door
// //     Serial.println("Door opened and closed");
// // }