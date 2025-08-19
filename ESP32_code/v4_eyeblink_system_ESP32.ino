/*
  Eye-Blink → Morse → Dual Bluetooth (Classic + BLE)
  Works with both PC (Classic BT) and Android Web Bluetooth (BLE)
  MATCHES YOUR WEBSITE UUIDs
  
  Hardware: NodeMCU 32S
    TCRT5000  D0  → GPIO34 (input-only)
    Buzzer    +   → GPIO25, – → GND
  Upload speed: 115200
*/

#include "BluetoothSerial.h"
#include "BLEDevice.h"
#include "BLEServer.h"
#include "BLEUtils.h"
#include "BLE2902.h"

// Classic Bluetooth for PC
BluetoothSerial SerialBT;

// BLE for Web Bluetooth (Android/iOS)
BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
BLECharacteristic* pRxCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// UUIDs MATCHING YOUR WEBSITE
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_TX   "87654321-4321-4321-4321-cba987654321"  // ESP32 sends data
#define CHARACTERISTIC_RX   "11111111-2222-3333-4444-555555555555"  // ESP32 receives data

// Pin definitions
const int IR_PIN     = 34;
const int BUZZER_PIN = 25;

// Timing constants
const unsigned DOT_TH    = 300;
const unsigned CHAR_GAP  = 2000;
const unsigned WORD_GAP  = 5000;
const unsigned DOT_BEEP  = 100;
const unsigned DASH_BEEP = 300;

// Global variables
unsigned long blinkStart = 0;
unsigned long lastEdge   = 0;
bool inBlink = false;
String morseBuffer = "";
bool wordTokenSent = false;

// Function prototypes
void playBeep(unsigned dur);
void sendData(String data);
void processCommand(String command);
void setupBLE();

// Audio functions
void playBeep(unsigned dur) {
  tone(BUZZER_PIN, 2000, dur);
  delay(dur + 20);
}

void playStartupSound() {
  playBeep(100); 
  delay(100);
  playBeep(100);
  delay(100);
  playBeep(200);
}

void playConnectedSound() {
  playBeep(200);
  delay(100);
  playBeep(200);
}

void playDisconnectedSound() {
  for(int i = 0; i < 3; i++) {
    playBeep(100);
    delay(50);
  }
}

// Send data to both Classic BT and BLE
void sendData(String data) {
  // Send via Classic Bluetooth (PC)
  if (SerialBT.hasClient()) {
    SerialBT.println(data);
    Serial.println("Classic BT TX: " + data);
  }
  
  // Send via BLE (Web Bluetooth)
  if (deviceConnected && pTxCharacteristic) {
    pTxCharacteristic->setValue(data.c_str());
    pTxCharacteristic->notify();
    Serial.println("BLE TX: " + data);
  }
  
  // Always send to Serial for debugging
  Serial.println("DATA: " + data);
}

void processCommand(String command) {
  command.trim();
  Serial.println("Command: " + command);
  
  if (command == "TEST") {
    sendData("TEST_OK");
    playBeep(200);
  } 
  else if (command == "RESET") {
    morseBuffer = "";
    lastEdge = 0;
    wordTokenSent = false;
    sendData("RESET_OK");
  }
  else if (command == "STATUS") {
    sendData("STATUS_READY");
  }
  else if (command == "PING") {
    sendData("PONG");
  }
}

// BLE Server Callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("BLE connected");
      playConnectedSound();
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("BLE disconnected");
      playDisconnectedSound();
      
      // Auto-restart advertising
      delay(500);
      pServer->startAdvertising();
      Serial.println("BLE advertising restarted");
    }
};

// BLE RX Callback
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue().c_str();
      if (rxValue.length() > 0) {
        processCommand(rxValue);
      }
    }
};

void setupBLE() {
  // Initialize BLE with clear device name
  BLEDevice::init("EyeBlink-ESP32");
  
  // Create server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  // Create service with YOUR website's UUID
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // TX Characteristic (ESP32 → Website) - matches your CHARACTERISTIC_TX
  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_TX,
                        BLECharacteristic::PROPERTY_READ |
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());
  
  // RX Characteristic (Website → ESP32) - matches your CHARACTERISTIC_RX
  pRxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_RX,
                        BLECharacteristic::PROPERTY_WRITE |
                        BLECharacteristic::PROPERTY_WRITE_NR
                      );
  pRxCharacteristic->setCallbacks(new MyCallbacks());
  
  // Start service
  pService->start();
  
  // Configure advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  
  // Start advertising
  BLEDevice::startAdvertising();
  
  Serial.println("BLE ready with UUIDs matching website");
  Serial.println("Service: " + String(SERVICE_UUID));
}

void setup() {
  pinMode(IR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(115200);
  
  Serial.println("=== Eye-Blink Morse Device ===");
  Serial.println("NodeMCU 32S - Dual Mode");
  
  // Initialize Classic Bluetooth for PC
  Serial.println("Starting Classic Bluetooth...");
  if (!SerialBT.begin("EyeBlink-ESP32")) {
    Serial.println("Classic BT failed!");
  } else {
    Serial.println("Classic BT OK: EyeBlink-ESP32");
  }
  
  // Initialize BLE for Web Bluetooth
  Serial.println("Starting BLE...");
  setupBLE();
  
  playStartupSound();
  
  Serial.println("=== DEVICE READY ===");
  Serial.println("PC: Pair 'EyeBlink-ESP32' via Bluetooth settings");
  Serial.println("Android: Use Web Bluetooth on your website");
  Serial.println("Waiting for eye blinks...");
  
  delay(1000);
}

void loop() {
  // Handle BLE reconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    sendData("DEVICE_READY");
  }
  
  // Handle incoming commands from Classic Bluetooth (PC)
  if (SerialBT.available()) {
    String command = SerialBT.readStringUntil('\n');
    processCommand(command);
  }
  
  // Handle incoming commands from Serial Monitor
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    processCommand(command);
  }
  
  // Eye blink detection
  int eye = digitalRead(IR_PIN);
  unsigned long now = millis();
  
  // Blink starts
  if (!inBlink && eye == LOW) {
    inBlink = true;
    blinkStart = now;
    wordTokenSent = false;
    Serial.println("👁️ Blink START");
  }
  
  // Blink ends
  if (inBlink && eye == HIGH) {
    inBlink = false;
    lastEdge = now;
    unsigned long dur = now - blinkStart;
    
    Serial.print("Duration: ");
    Serial.print(dur);
    Serial.println("ms");
    
    if (dur < DOT_TH) {
      morseBuffer += '.';
      playBeep(DOT_BEEP);
      Serial.println("• DOT added");
    } else {
      morseBuffer += '-';
      playBeep(DASH_BEEP);
      Serial.println("— DASH added");
    }
    
    Serial.println("Building: " + morseBuffer);
  }
  
  // Character complete (send morse pattern)
  if (!inBlink && morseBuffer.length() > 0 &&
      (now - lastEdge) > CHAR_GAP) {
    
    Serial.println("✓ Character complete: " + morseBuffer);
    sendData(morseBuffer);  // Send exactly what your website expects
    
    morseBuffer = "";
    lastEdge = now;
    wordTokenSent = false;
  }
  
  // Word gap (send space token)
  if (!inBlink && morseBuffer.length() == 0 &&
      (now - lastEdge) > WORD_GAP && lastEdge > 0 && !wordTokenSent) {
    
    Serial.println("📝 Word gap - sending space");
    sendData("/");  // Send exactly what your website expects
    wordTokenSent = true;
    
    // Audio feedback for word separation
    playBeep(100);
    delay(50);
    playBeep(100);
  }
  
  delay(10);
}
