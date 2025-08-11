#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>

#define DOOR_PIN D1 // Pin connected to the door mechanism

const char* ssid = "YOUR_SSID"; // Replace with your Wi-Fi SSID
const char* password = "YOUR_PASSWORD"; // Replace with your Wi-Fi password
const char* firebaseHost = "YOUR_FIREBASE_HOST"; // Replace with your Firebase host
const char* firebaseAuth = "YOUR_FIREBASE_AUTH"; // Replace with your Firebase auth token

void setup() {
    Serial.begin(115200);
    pinMode(DOOR_PIN, OUTPUT);
    digitalWrite(DOOR_PIN, LOW); // Ensure door is closed initially

    // Connect to Wi-Fi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi");

    // Connect to Firebase
    Firebase.begin(firebaseHost, firebaseAuth);
}

void loop() {
    // Check for incoming requests from the backend
    if (Firebase.getInt("doorStatus") == 1) {
        openDoor();
        Firebase.setInt("doorStatus", 0); // Reset door status
    }
    delay(1000); // Check every second
}

void openDoor() {
    digitalWrite(DOOR_PIN, HIGH); // Open the door
    delay(5000); // Keep the door open for 5 seconds
    digitalWrite(DOOR_PIN, LOW); // Close the door
    Serial.println("Door opened and closed");
}