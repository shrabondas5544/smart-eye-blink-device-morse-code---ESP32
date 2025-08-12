Eye-Blink Morse Communicator — README

How to run locally:
1. Save this folder somewhere on your computer.
2. Run a local web server in the folder (required for some browser APIs):
   - Python 3: python -m http.server 8000
   - Then open: http://localhost:8000

Pairing the ESP32:
1. On Windows: Settings -> Bluetooth & devices -> Add device -> select your ESP32.
2. Make sure a COM port appears in Device Manager (e.g. COM9).
3. Close Arduino Serial Monitor (it uses the COM port).

Connecting in the web app:
- Open Communication -> Connect Serial -> choose the COM port and baud 115200.
- Blink to input Morse. The app expects the ESP32 firmware to send lines containing letter morse, for example:
  - "." or "-" or ".-" for letters
  - "/" to indicate a word gap
- The app decodes incoming morse lines into letters and builds the message.

Translation:
- Translation to Bangla uses the LibreTranslate public instance at https://libretranslate.de.
- This is a public service for quick testing; for production you should run your own instance or use a paid API.

Export:
- Messages page can export saved messages as a PDF (uses jsPDF library).

Files in this folder:
- index.html, communication.html, messages.html, settings.html
- style.css
- morse.js, communication.js, messages.js, settings.js
- README.txt

Notes:
- Speech voices depend on your browser/OS. Choose preferred voice gender in Settings.
- If Web Serial doesn't list your Bluetooth serial port, use a Node.js bridge (instructions available on request).
