#include <Servo.h>
#include <toneAC2.h>

#define SERVO_PIN 7
#define VIBRATION_PIN 6
#define VIBRATION_DEBUG_LED_PIN 11

#define BUZZER_DURATION 250

Servo servo;

bool servoOpen = false;
uint64_t closeTime = 0;

bool buzzerEnabled;
uint64_t buzzerDisableTime;

int servoAngle = 0;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);

  pinMode(SERVO_PIN, OUTPUT);
  pinMode(VIBRATION_PIN, INPUT);
  pinMode(VIBRATION_DEBUG_LED_PIN, OUTPUT);

  servo.attach(SERVO_PIN);
  servo.write(0);

  servoAngle = 0;

  while (Serial.available() > 1) {
    Serial.read();
  }
}

void loop() {
  // for (int i = 0; i <= 90; i++) {
  //   servo.write(i);
  //   delay(8);
  // }

  // for (int i = 90; i >= 0; i--) {
  //   servo.write(i);
  //   delay(8);
  // }

  // return;

  if (Serial.available() >= 4) {
    uint8_t cmdid[4];

    Serial.readBytes(cmdid, 4);

    if (memcmp(cmdid, "open", 4) == 0) {
      closeTime = millis() + 3000;
      servoOpen = true;
      servoAngle = 0;
      Serial.println("Open");
    } else if (memcmp(cmdid, "clse", 4) == 0) {
      closeTime = 0;

      char buzzer;
      Serial.readBytes(&buzzer, 1);

      if (buzzer && !buzzerEnabled) {
        toneAC2(9, 10, 3000, BUZZER_DURATION);
        buzzerEnabled = true;
        buzzerDisableTime = millis() + BUZZER_DURATION;
      }
    }
  }

  if (buzzerEnabled && millis() >= buzzerDisableTime) {
    buzzerEnabled = false;
  }

  // int servoAngle = servo.read();

  // if (servoOpen) {
  //   int servoAngle = servo.read();

  //   for (int angle = servoAngle; angle < 90; angle++) {
  //     servo.write(angle);
  //     delay(10);
  //   }
  // }

  if (servoOpen && millis() >= closeTime) {
    // servo.write(0);
    servoOpen = false;
  }

  if (servoOpen) {
    if (servoAngle < 90) {
      servoAngle++;
      servo.write(servoAngle);
      delay(8);
    }
  } else {
    if (servoAngle > 0) {
      servoAngle--;
      servo.write(servoAngle);

      if (servoAngle == 0) {
        Serial.write("srvo");
        Serial.write(false);
      }

      delay(8);
    }
  }

  // unsigned long measurement = pulseIn(VIBRATION_PIN, HIGH);

  // if (measurement >= 2000) {
  //   toneAC2(9, 10, 3000, 250);
  // }

  // digitalWrite(VIBRATION_DEBUG_LED_PIN, measurement >= 2000);

  if (!servoOpen && digitalRead(VIBRATION_PIN) == 1) {
    toneAC2(9, 10, 3000, 3000);
  }
}
