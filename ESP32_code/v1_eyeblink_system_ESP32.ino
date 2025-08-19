/* Eye‑blink → Morse demo on ESP32
   Dot = blink < 300 ms
   Dash = blink ≥ 300 ms
   Short beep plays for feedback.
*/

const int IR_PIN      = 34;   // TCRT5000 D0
const int BUZZER_PIN  = 25;   // passive buzzer +

const unsigned DOT_MS   = 100;   // beep length for dot feedback
const unsigned DASH_MS  = 300;   // beep length for dash feedback
const unsigned CHAR_GAP = 2000;  // idle time that ends one Morse character

unsigned long blinkStart = 0;
bool  inBlink       = false;
String morseBuffer  = "";

void setup() {
  pinMode(IR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(9600);
}

void playBeep(unsigned dur) {
  tone(BUZZER_PIN, 2000, dur);     // 2 kHz tone (tone() works on ESP32 core)
  delay(dur + 50);                 // wait so tones don’t overlap
}

void loop() {
  int eye = digitalRead(IR_PIN);        // HIGH = eye open; LOW = eyelid blocks IR
  unsigned long now = millis();

  // ­­­—Blink starts—­
  if (!inBlink && eye == LOW) {
    inBlink    = true;
    blinkStart = now;
  }

  // ­­­—Blink ends—­
  if (inBlink && eye == HIGH) {
    inBlink = false;
    unsigned long dur = now - blinkStart;

    if (dur < 300) {          // DOT
      morseBuffer += '.';
      playBeep(DOT_MS);
    } else {                  // DASH
      morseBuffer += '-';
      playBeep(DASH_MS);
    }
    Serial.print("Morse so far: ");
    Serial.println(morseBuffer);
  }

  // ­­­—Timeout => character finished—­
  if (!inBlink && morseBuffer.length() && (now - blinkStart) > CHAR_GAP) {
    Serial.print("Character done → ");
    Serial.println(morseBuffer);
    morseBuffer = "";
  }
}
