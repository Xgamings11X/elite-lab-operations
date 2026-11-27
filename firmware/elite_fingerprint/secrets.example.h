#pragma once
// Salin ke secrets.h dan isi untuk papan ESP32-C1 serta sensor fisik Anda.
constexpr char WIFI_SSID[] = "LAB_WIFI";
constexpr char WIFI_PASSWORD[] = "CHANGE_ME";
constexpr char API_ORIGIN[] = "https://portal.example.org";
constexpr char DEVICE_ID[] = "ESP32-C1-LAB-01";
constexpr char DEVICE_TOKEN[] = "CHANGE_ME";
constexpr int SENSOR_RX_PIN = -1;  // GPIO RX papan, terhubung TX sensor
constexpr int SENSOR_TX_PIN = -1;  // GPIO TX papan, terhubung RX sensor
constexpr unsigned long SENSOR_BAUD = 57600;
constexpr char ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
PASTE_THE_TRUSTED_ROOT_CA_HERE
-----END CERTIFICATE-----
)PEM";
