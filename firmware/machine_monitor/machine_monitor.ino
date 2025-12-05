// firmware/machine_monitor/machine_monitor.ino
// ESP32 Machine Status Monitor
// Reads stack light signals and reports to central server

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============== CONFIGURATION ==============
// Change these for each machine!

const int MACHINE_ID = 1;                    // Unique ID (1-18)
const char* MACHINE_NAME = "IM01";           // Display name

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SERVER_URL = "http://192.168.1.100:3000/api/status";
const char* API_KEY = "your-secure-esp32-api-key-change-in-prod";  // Must match server

// ============== PIN DEFINITIONS ==============
// Optocoupler outputs (active LOW when light is ON)

const int PIN_GREEN = 34;   // GPIO34 - Running indicator
const int PIN_RED = 35;     // GPIO35 - Fault indicator

// ============== TIMING ==============

const unsigned long SEND_INTERVAL_MS = 5000;      // Report every 5 seconds
const unsigned long DEBOUNCE_MS = 50;             // Debounce for cycle counting
const unsigned long WIFI_RETRY_INTERVAL = 30000;  // Retry WiFi every 30s if disconnected

// ============== STATE ==============

unsigned long lastSendTime = 0;
unsigned long lastCycleTime = 0;
unsigned long lastWifiRetry = 0;
unsigned long cycleCount = 0;
bool lastGreen = false;
bool wifiConnected = false;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Machine Monitor ===");
  Serial.printf("Machine: %s (ID: %d)\n", MACHINE_NAME, MACHINE_ID);
  
  // Configure input pins (no pull-up needed - optocoupler module has them)
  pinMode(PIN_GREEN, INPUT);
  pinMode(PIN_RED, INPUT);
  
  connectWiFi();
}

void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("\nWiFi connection failed. Will retry...");
  }
}

void loop() {
  unsigned long now = millis();
  
  // Read current state (inverted - optocoupler pulls LOW when active)
  bool green = digitalRead(PIN_GREEN) == LOW;
  bool red = digitalRead(PIN_RED) == LOW;
  
  // Detect rising edge on green (cycle complete)
  if (green && !lastGreen && (now - lastCycleTime > DEBOUNCE_MS)) {
    cycleCount++;
    lastCycleTime = now;
    Serial.printf("Cycle detected! Total: %lu\n", cycleCount);
  }
  lastGreen = green;
  
  // Retry WiFi if disconnected
  if (!wifiConnected && (now - lastWifiRetry > WIFI_RETRY_INTERVAL)) {
    lastWifiRetry = now;
    connectWiFi();
  }
  
  // Send status at regular intervals
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    sendStatus(green, red);
  }
  
  // Small delay to prevent tight loop
  delay(10);
}

void sendStatus(bool green, bool red) {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    Serial.println("WiFi disconnected, skipping send");
    return;
  }
  
  // Determine status from light states
  const char* status;
  if (red) {
    status = "fault";
  } else if (green) {
    status = "running";
  } else {
    status = "idle";
  }
  
  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["machineId"] = MACHINE_ID;
  doc["machineName"] = MACHINE_NAME;
  doc["status"] = status;
  doc["green"] = green;
  doc["red"] = red;
  doc["cycleCount"] = cycleCount;
  doc["uptimeSec"] = millis() / 1000;
  
  String json;
  serializeJson(doc, json);
  
  // Send HTTP POST
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);  // Authentication
  
  int responseCode = http.POST(json);
  
  if (responseCode > 0) {
    Serial.printf("[%s] Sent: %s -> %d\n", status, MACHINE_NAME, responseCode);
  } else {
    Serial.printf("HTTP Error: %s\n", http.errorToString(responseCode).c_str());
  }
  
  http.end();
}
