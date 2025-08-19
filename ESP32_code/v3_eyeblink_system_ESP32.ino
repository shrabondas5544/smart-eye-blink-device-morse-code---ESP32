/*
  Eye-Blink → Morse → Bluetooth SPP (with word-gap token)
  Hardware:
    TCRT5000  D0  → GPIO34 (input-only)
    Buzzer    +   → GPIO25, – → GND
  Upload speed: 115200
*/

#include <BluetoothSerial.h>
BluetoothSerial BT;          // Classic SPP

// -------- Pin map --------
constexpr int IR_PIN     = 34;   // TCRT5000 digital out (LOW on blink)
constexpr int BUZZER_PIN = 25;   // passive buzzer

// -------- Timing constants (ms) --------
constexpr unsigned DOT_TH    = 300;   // < 300 ms   = dot
constexpr unsigned CHAR_GAP  = 2000;  // silence gap that ends one character
constexpr unsigned WORD_GAP  = 5000;  // gap that marks a word boundary -> send "/"
constexpr unsigned DOT_BEEP  = 100;   // beep feedback lengths
constexpr unsigned DASH_BEEP = 300;

unsigned long blinkStart = 0;
unsigned long lastEdge   = 0;
bool  inBlink            = false;
String morseBuffer       = "";
bool  wordTokenSent      = false;

void setup() {
  pinMode(IR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(115200);

  // ---------- Bluetooth ----------
  if (!BT.begin("EyeBlink-ESP32")) {   // device name advertized
    Serial.println("Bluetooth init failed");
    while (true) delay(100);
  }
  Serial.println("Bluetooth ready. Pair & open serial.");
}

void playBeep(unsigned dur) {
  tone(BUZZER_PIN, 2000, dur);
  delay(dur + 20);
}

void loop() {
  int eye = digitalRead(IR_PIN);          // HIGH=open, LOW=blink
  unsigned long now = millis();

  // ---- Blink starts ----
  if (!inBlink && eye == LOW) {
    inBlink = true;
    blinkStart = now;
    // reset word token because a new character is starting
    wordTokenSent = false;
  }

  // ---- Blink ends ----
  if (inBlink && eye == HIGH) {
    inBlink = false;
    lastEdge = now;
    unsigned long dur = now - blinkStart;

    if (dur < DOT_TH) {            // DOT
      morseBuffer += '.';
      playBeep(DOT_BEEP);
    } else {                       // DASH
      morseBuffer += '-';
      playBeep(DASH_BEEP);
    }
    Serial.print("Morse so far: ");
    Serial.println(morseBuffer);
  }

  // ---- Character finished (gap timed-out) ----
  if (!inBlink && morseBuffer.length() &&
      (now - lastEdge) > CHAR_GAP) {

    Serial.print("TX over BT (char): ");
    Serial.println(morseBuffer);

    BT.println(morseBuffer);       // send letter's morse (ends with newline)
    morseBuffer = "";
    // reset the timer for word detection
    lastEdge = now;
    wordTokenSent = false;
  }

  // ---- Word gap detection (send "/" token once) ----
  if (!inBlink && morseBuffer.length() == 0 &&
      (now - lastEdge) > WORD_GAP && !wordTokenSent) {

    Serial.println("TX over BT: / (word gap)");
    BT.println("/");   // receiver will interpret this as a space
    wordTokenSent = true;
    // lastEdge = now; // optional
  }
}

