#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <esp_system.h>
#include <time.h>
#include "secrets.h"

static_assert(SENSOR_RX_PIN >= 0 && SENSOR_TX_PIN >= 0 && SENSOR_RX_PIN != SENSOR_TX_PIN,
              "Isi pin UART ESP32-C1 di secrets.h sesuai papan fisik.");
HardwareSerial sensorUart(1);
Adafruit_Fingerprint sensor(&sensorUart);
String pendingBody;
unsigned long scanAt = 0, nextAttempt = 0, nextHeartbeat = 0;
bool fingerHeld = false;
bool sensorReady = false;
String serialCommand;

bool deadline(unsigned long at) {
  return static_cast<int32_t>(millis() - at) >= 0;
}

String eventId() {
  uint8_t data[16];
  esp_fill_random(data, sizeof(data));
  data[6] = (data[6] & 0x0f) | 0x40;
  data[8] = (data[8] & 0x3f) | 0x80;
  char uuid[37];
  snprintf(uuid, sizeof(uuid),
           "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7],
           data[8], data[9], data[10], data[11], data[12], data[13], data[14], data[15]);
  return String(uuid);
}

int post(const char* path, const String& json, bool reportResult = false) {
  if (WiFi.status() != WL_CONNECTED || time(nullptr) < 1700000000) return -1;
  WiFiClientSecure connection;
  connection.setCACert(ROOT_CA);
  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(3500);
  if (!http.begin(connection, String(API_ORIGIN) + path)) return -1;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  int status = http.POST(json);
  if (status > 0 && reportResult) {
    if (status == 200) {
      const String body = http.getString();
      if (body.indexOf("\"OUT\"") >= 0) Serial.println("Absen pulang tercatat.");
      else if (body.indexOf("\"IN\"") >= 0) Serial.println("Absen masuk tercatat.");
      else Serial.println("Scan diterima; tidak ada perubahan presensi.");
    } else Serial.printf("Presensi HTTP %d\n", status);
  }
  http.end();
  return status;
}

bool waitForFinger(bool present) {
  const unsigned long started = millis();
  while (millis() - started < 15000) {
    const uint8_t result = sensor.getImage();
    if ((present && result == FINGERPRINT_OK) || (!present && result == FINGERPRINT_NOFINGER)) return true;
    delay(80);
  }
  return false;
}

void enroll(uint16_t slot) {
  const uint8_t loaded = sensor.loadModel(slot);
  // Empty slots must be confirmed by the sensor. Do not overwrite a valid template.
  if (loaded == FINGERPRINT_OK) {
    Serial.println("Slot sudah terisi. Pilih slot lain.");
    return;
  }
  if (loaded != FINGERPRINT_DBRANGEFAIL && loaded != FINGERPRINT_NOTFOUND) {
    Serial.println("Sensor tidak dapat memastikan slot kosong.");
    return;
  }
  Serial.println("Tempel jari; setelah terbaca lepaskan, lalu tempel jari yang sama lagi.");
  const bool success = waitForFinger(true) && sensor.image2Tz(1) == FINGERPRINT_OK &&
    waitForFinger(false) && waitForFinger(true) && sensor.image2Tz(2) == FINGERPRINT_OK &&
    sensor.createModel() == FINGERPRINT_OK && sensor.storeModel(slot) == FINGERPRINT_OK;
  fingerHeld = true;
  Serial.println(success ? "Pendaftaran lokal berhasil. Tautkan ID slot di Panel Admin." : "Pendaftaran gagal atau waktu habis.");
}

void operatorInput() {
  if (!Serial.available()) return;
  const char key = Serial.read();
  if (key == '\r') return;
  if (key != '\n') {
    if (serialCommand.length() < 64) serialCommand += key;
    return;
  }
  if (serialCommand.startsWith("ENROLL ") && pendingBody.isEmpty() && sensorReady) {
    const String argument = serialCommand.substring(7);
    char* end;
    const long slot = strtol(argument.c_str(), &end, 10);
    if (argument.length() && *end == '\0' && slot > 0 && slot < sensor.capacity) enroll(slot);
    else Serial.println("Gunakan ENROLL <nomor slot dalam kapasitas sensor>.");
  }
  serialCommand = "";
}

void setup() {
  Serial.begin(115200);
  sensor.begin(SENSOR_BAUD);
  sensorUart.end();
  sensorUart.begin(SENSOR_BAUD, SERIAL_8N1, SENSOR_RX_PIN, SENSOR_TX_PIN);
  sensorReady = sensor.verifyPassword() && sensor.getParameters() == FINGERPRINT_OK;
  if (!sensorReady) Serial.println("Sensor fingerprint belum siap. Periksa UART dan catu daya.");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void loop() {
  operatorInput();
  if (!pendingBody.isEmpty() && millis() - scanAt >= 30000) {
    pendingBody = "";
    Serial.println("Scan kedaluwarsa. Periksa koneksi lalu tempel ulang.");
  }
  if (!pendingBody.isEmpty() && deadline(nextAttempt)) {
    const int status = post("/api/iot/fingerprint-attendance", pendingBody, true);
    if ((status >= 200 && status < 300) || (status >= 400 && status < 500 && status != 429)) pendingBody = "";
    nextAttempt = millis() + 2500;
  }
  if (sensorReady && deadline(nextHeartbeat)) {
    post("/api/iot/heartbeat", String("{\"device_id\":\"") + DEVICE_ID + "\"}");
    nextHeartbeat = millis() + 30000;
  }
  if (sensorReady && pendingBody.isEmpty()) {
    const uint8_t image = sensor.getImage();
    if (image == FINGERPRINT_NOFINGER) fingerHeld = false;
    if (image == FINGERPRINT_OK && !fingerHeld) {
      fingerHeld = true;
      if (sensor.image2Tz() == FINGERPRINT_OK && sensor.fingerFastSearch() == FINGERPRINT_OK) {
        const String uuid = eventId();
        pendingBody = String("{\"device_id\":\"") + DEVICE_ID + "\",\"fingerprint_id\":" +
          sensor.fingerID + ",\"event_id\":\"" + uuid + "\"}";
        scanAt = nextAttempt = millis();
      } else Serial.println("Jari tidak cocok atau kualitas scan rendah.");
    }
  }
  delay(45);
}
