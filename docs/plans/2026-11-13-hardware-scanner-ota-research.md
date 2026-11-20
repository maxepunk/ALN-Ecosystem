# Can the hardware scanner take firmware updates over the air?

Yes, on one condition. Each hardware scanner must be flashed over USB one more time before it can update itself. Today a scanner's 4 MB of built-in flash memory holds one copy of the firmware, and that firmware contains no code that can replace it. An over-the-air update needs room for two copies, so the scanner can write and check the new firmware while the old one keeps running. The chip supports that layout, with room for a firmware of 1,966,080 or 2,031,616 bytes, depending on the layout chosen. The last recorded size of our firmware is 1,214,487 bytes, from November 2025. Nobody has measured today's firmware, so one build on the Pi must confirm that it fits. After that USB flash, a scanner can fetch new firmware from the backend when it starts, the way it fetches pictures and sounds today. If the power fails during an update, the old firmware still starts. A scanner cannot scan while it updates, so an update belongs at start-up and never in a game.

Research by a helper, 2026-11-13, on branch `claude/nice-curie-hescfv`, for the owner's question recorded in `docs/plans/CURRENT-STATE.md:45-49`. It uses this repository, the Arduino-ESP32 core's own files, and Espressif's ESP-IDF documentation and source. The firmware could not be built in the research container, so its present size is the main open point.

How to read the source column:

- `scanner/` means `arduino-cyd-player-scanner/` in this repository, at submodule commit `f81aba5`.
- `core/` means the Arduino-ESP32 core at tag 3.3.2. The firmware was last verified on a real scanner with that core version (`scanner` commit `6d0c431`, 2026-06-26).
- `sdkconfig` means the settings file inside that core's prebuilt ESP32 libraries. It records how Espressif compiled the bootloader and the system libraries that every Arduino build links.
- `idf/` means the ESP-IDF source at tag v5.5.1. "IDF docs" means the ESP-IDF v5.5.1 documentation.
- "Not confirmed" marks what could not be checked against a source.
- Numbers in square brackets, such as [3.5], point to rows in this file.

Addresses and read dates are under Sources.

## What we found

### 1. The firmware today

| # | Fact | Source |
|---|---|---|
| 1.1 | The build uses the `no_ota` partition scheme. The guide describes it as "2MB app space, requires USB for firmware updates". | `scanner/CLAUDE.md:99`, `:276` |
| 1.2 | The last recorded firmware size is 1,214,487 bytes, on 2025-11-09. The record says "Flash usage: 57%", which is 57% of the 2,097,152-byte `no_ota` slot. | `scanner` commit `b58961e`, commit message |
| 1.3 | Two older records exist. 1,208,991 bytes on 2025-10-31, in the commit that moved the build to `no_ota`. 1,209,987 bytes for firmware v4.1 on 2025-10-22. Both are under 1,310,720 bytes, the limit of the default scheme, so the firmware fit the default scheme then. | `scanner` commit `49c8522`, commit message; `scanner/baseline_flash_v4.1.txt:2-4`; limit from `core/boards.txt:1645` |
| 1.4 | Nothing records the size after 2025-11-09. Since that commit the firmware source grew from 7,927 to 9,606 lines. The only library header added is `mbedtls/sha1.h`, which belongs to the core. | counted with `git` in `scanner/` on 2026-11-13: `.h` and `.ino` files under `ALNScanner_v5/` at `b58961e` and at `f81aba5` |
| 1.5 | The guide's row "Won't compile / Flash >95%" advises `no_ota`. No recorded build shows the firmware above the default scheme's limit. Whether today's firmware exceeds it is not confirmed. | `scanner/CLAUDE.md:471`; rows 1.2 and 1.3 |
| 1.6 | CI never compiles the firmware for the ESP32. It runs unit tests on the host machine only. | `scanner/.github/workflows/test.yml:12-28`; `.github/workflows/test.yml:149-155`; `scanner/platformio.ini:8-9`; `scanner` commit `6d0c431`, commit message |
| 1.7 | The size could not be measured for this note. The research container has no `arduino-cli`, no PlatformIO and no ESP32 toolchain, and the brief ruled out installing one. | checked 2026-11-13: `which arduino-cli pio platformio` finds nothing; `~/.arduino15` and `~/.platformio` do not exist |
| 1.8 | Libraries the firmware links. From the core: WiFi, WiFiClientSecure, HTTPClient, SD, SPI, mbedTLS SHA-1. From outside the core: TFT_eSPI 2.5.43, MFRC522 1.4.12, ESP8266Audio 2.0.0, ArduinoJson 7. | `scanner/ALNScanner_v5/services/OrchestratorService.h:28-34`; `scanner/ALNScanner_v5/hal/AudioDriver.h:3-5`, `RFIDReader.h:4`, `DisplayDriver.h:23`, `SDCard.h:19-20`; `scanner/libraries/*/library.properties`; `scanner/ALNScanner_v5/config.h:96-101` |
| 1.9 | The firmware uses no update library. A search of all of `scanner/`, vendored libraries included, finds no `Update.h`, `HTTPUpdate`, `ArduinoOTA`, `esp_ota` or `esp_https_ota`. | search run 2026-11-13 |
| 1.10 | The firmware already downloads files from the backend over HTTPS and checks them. It streams each file to `<name>.part` on the SD card in 4 KB pieces, compares the size and the SHA-1 with the manifest, then renames the file. A failed download leaves the old file in place. | `scanner/ALNScanner_v5/services/OrchestratorService.h:664-846`; `scanner/ALNScanner_v5/services/AssetService.h:17-20` |
| 1.11 | That download ran on a real scanner with core 3.3.2: 130 files, none failed. | `scanner` commit `6d0c431`, commit message |
| 1.12 | The firmware does not check the backend's certificate. Every HTTPS request calls `setInsecure()`, so today's self-signed certificate blocks nothing. The core's own header marks that call "VERY INSECURE". | `scanner/ALNScanner_v5/services/OrchestratorService.h:714`, `:917-919`, `:945`, `:979`; `core/libraries/NetworkClientSecure/src/NetworkClientSecure.h:70` |
| 1.13 | Config, token data, pictures, sounds and the offline queue are files on the SD card. | `scanner/ALNScanner_v5/config.h:63-84`; `scanner/ALNScanner_v5/services/ConfigService.h:104`, `:230` |
| 1.14 | The device id is the `DEVICE_ID` line in `config.txt`. Without that line, the firmware builds the id at every start from the MAC address the factory wrote into the chip. | `scanner/ALNScanner_v5/services/ConfigService.h:193-197`, `:446-457` |
| 1.15 | The firmware keeps nothing of its own in the chip's flash. It calls no Preferences, NVS, EEPROM, SPIFFS or LittleFS function. `config.h` names a file `/device_id.txt`, and no code reads or writes it. | search of `scanner/ALNScanner_v5/` run 2026-11-13; `scanner/ALNScanner_v5/config.h:76` |
| 1.16 | So a firmware update keeps the config and the device id, over the air and over USB alike. A USB upload writes the bootloader, the partition table, the record of which slot starts, and the firmware. It erases nothing else unless the upload sets the "Erase All Flash" option. The guide's upload command does not set it, and the core lists "Disabled" as that option's first choice. That the first choice is the default is not confirmed from Arduino's documentation. | rows 1.13 to 1.15; `core/platform.txt:297`; `core/boards.txt:1819-1822`; `scanner/CLAUDE.md:107` |
| 1.17 | The firmware has no version number. The start-up banner prints a fixed "v5.0", and no request tells the backend which build a scanner runs. | `scanner/ALNScanner_v5/Application.h:1557`; search run 2026-11-13 |
| 1.18 | At start-up the scanner syncs tokens, then pictures and sounds, before its background task starts. During a long sync it answers neither RFID nor serial. The guides accept that at start-up and forbid it during play. | `scanner/ALNScanner_v5/Application.h:1003-1046`, `:1616-1625`; `CLAUDE.md:438-443`; `scanner/CLAUDE.md:132` |
| 1.19 | The venue has three hardware scanners. | `docs/plans/CURRENT-STATE.md:322` |

One earlier statement in this repository needs a correction. `docs/plans/architecture-pass/rework/owner-questions.md:334` says "the board's partition leaves no room for an update over the air". That is true of the scheme we chose. It is not true of the board, as section 2 shows.

### 2. How the 4 MB of flash can be divided

The flash holds a bootloader, a partition table, a few small data areas and then the firmware. The partition table decides how many copies of the firmware fit. Each place for a copy is called a slot. The core ships ready-made tables, and the `PartitionScheme` word in the compile command picks one. These are the choices for our board, "ESP32 Dev Module" with 4 MB:

| Scheme | Firmware slots | Largest firmware | Over the air | Source |
|---|---|---|---|---|
| `no_ota`, ours today | one of 0x200000 | 2,097,152 bytes | no | `core/tools/partitions/no_ota.csv:4`; `core/boards.txt:1700-1702` |
| `huge_app` | one of 0x300000 | 3,145,728 bytes | no | `core/tools/partitions/huge_app.csv:4`; `core/boards.txt:1712-1714` |
| `default` | two of 0x140000 | 1,310,720 bytes | yes | `core/tools/partitions/default.csv:4-5`; `core/boards.txt:1645`, `:1688-1689` |
| `min_spiffs` | two of 0x1E0000 | 1,966,080 bytes | yes | `core/tools/partitions/min_spiffs.csv:4-5`; `core/boards.txt:1715-1717` |
| `no_fs` | two of 0x1F0000 | 2,031,616 bytes | yes | `core/tools/partitions/no_fs.csv:4-5`; `core/boards.txt:1697-1699` |

For 4 MB chips the same menu also lists `defaultffat`, `rainmaker` and `zigbee_zczr` with two slots no larger than `min_spiffs`, and `minimal`, `noota_3g`, `noota_ffat`, `noota_3gffat` and `rainmaker_4MB` with one slot (`core/boards.txt:1688-1741`). Its entries for larger chips do not apply to our board.

| # | Fact | Source |
|---|---|---|
| 2.1 | An over-the-air update needs at least two firmware slots, plus a small record that says which slot starts next. | IDF docs, Over The Air Updates, "OTA Process Overview"; `core/docs/en/tutorials/partition_table.rst:81` |
| 2.2 | `no_ota` and `huge_app` have one slot, so they cannot update over the air. The core's menu labels say so: "No OTA (2MB APP/2MB SPIFFS)" and "Huge APP (3MB No OTA/1MB SPIFFS)". | `core/boards.txt:1700`, `:1712` |
| 2.3 | `min_spiffs` has two slots of 1,966,080 bytes. That is 131,072 bytes less than `no_ota` allows today. The core labels it "Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)". `no_fs` has two slots of 2,031,616 bytes and no file-system area. Our firmware uses no file-system area [1.15]. | `core/boards.txt:1697`, `:1715`; table above |
| 2.4 | Two equal slots cannot exceed 2,031,616 bytes each on a 4 MB chip. The first slot starts at 0x10000, and every slot must start on a 64 KB boundary. | IDF docs, Partition Tables, "Offset & Size"; `core/docs/en/tutorials/partition_table.rst:93-94` |
| 2.5 | Against the last recorded size of 1,214,487 bytes, `min_spiffs` leaves 751,593 bytes spare and `default` leaves 96,233 bytes. Today's size is not confirmed. | arithmetic on row 1.2 and the table above |
| 2.6 | `no_ota`, `default`, `min_spiffs` and `no_fs` all put the chip's settings area, the record of which slot starts and the first firmware slot at the same addresses: 0x9000, 0xE000 and 0x10000. | lines 2 to 4 of each `.csv` file named above |
| 2.7 | A project can also supply its own table as a file `partitions.csv` in the sketch folder. | `core/platform.txt:113-116`; `core/docs/en/tutorials/partition_table.rst:119` |
| 2.8 | These five table files are identical at tags 3.3.2 and 3.3.12, the newest tag on 2026-11-13. | file comparison run 2026-11-13 |

### 3. How an over-the-air update works

Nothing in this process needs the internet. The scanner connects only to the backend.

| # | Fact | Source |
|---|---|---|
| 3.1 | An update writes the new firmware into the slot that is not running, checks it, and then changes a small record so that the next start uses the new slot. ESP-IDF calls this "safe update mode" and says that "even if the power is cut off during the update, the chip will remain operational and capable of booting the current application". | IDF docs, Over The Air Updates, "OTA Process Overview" |
| 3.2 | The small record is the "otadata" partition. It is two flash sectors that are written one after the other "to prevent problems if there is a power failure while it is being written". | IDF docs, Over The Air Updates, "OTA Data Partition" |
| 3.3 | At every start the bootloader reads otadata, picks the slot and checks the firmware image before it runs it. If the picked image is invalid, the bootloader tries the other slots. | IDF docs, Application Startup Flow, "Second Stage Bootloader"; `idf/components/bootloader_support/src/bootloader_utility.c:594-620`; `sdkconfig:348-350` |
| 3.4 | The Arduino core's `Update` library does the writing. It picks the next slot, refuses an image larger than the slot, and works through one 4,096-byte buffer. | `core/libraries/Update/src/Updater.cpp:149-155`, `:196-202`, `:205` |
| 3.5 | `Update` holds back the first 16 bytes of the image until the end, "so that partially written firmware will not be bootable". At the end it compares an MD5 if the caller gave one, writes those 16 bytes, and asks ESP-IDF to switch slots. ESP-IDF validates the whole image first and refuses a bad one. | `core/libraries/Update/src/Updater.cpp:416-425`, `:484-494`, `:540-546`; `idf/components/app_update/esp_ota_ops.c:599-607` |
| 3.6 | If the data stops arriving, `Update` waits up to 30 seconds and then abandons the update. Nothing is switched. | `core/libraries/Update/src/Updater.cpp:615-631` |
| 3.7 | The core's `HTTPUpdate` library downloads and flashes in one call. It needs a `Content-Length` from the server, reads an MD5 from an `x-MD5` response header, treats HTTP 304 as "nothing new", and restarts the chip after success. It accepts a TLS client. On every check it hashes the running firmware for its request headers. | `core/libraries/HTTPUpdate/src/HTTPUpdate.cpp:207-222`, `:253-282`, `:400-402`, `:409-419`; `core/libraries/HTTPUpdate/src/HTTPUpdate.h:95` |
| 3.8 | An Arduino sketch can call ESP-IDF's own `esp_https_ota` function through the core's `HttpsOTA` class. It refuses to run without a way to check the server's certificate. The setting that would let it skip the check is off in the prebuilt core. | `core/libraries/Update/src/HttpsOTAUpdate.cpp:90-94`; `idf/components/esp_https_ota/src/esp_https_ota.c:292-300`; `sdkconfig:1308`; IDF docs, ESP HTTPS OTA, "Server Verification" |
| 3.9 | The core's `ArduinoOTA` library lets a developer's computer push firmware to the chip. It listens on UDP port 3232 and fetches the data over plain TCP, with an optional password. It does not fetch from a server on its own. | `core/libraries/ArduinoOTA/src/ArduinoOTA.cpp:146-149`, `:321-322` |
| 3.10 | An update can come from a file on the SD card. `Update.writeStream()` takes any stream, and the core ships an example that flashes `/update.bin` from an SD card. | `core/libraries/Update/src/Update.h:93`; `core/libraries/Update/examples/SD_Update/SD_Update.ino:22-72` |
| 3.11 | Returning to the previous firmware by hand is supported. `Update.rollBack()` makes the other slot start next, if it holds firmware. | `core/libraries/Update/src/Updater.cpp:114-128` |
| 3.12 | Returning automatically is supported and switched on in the prebuilt core. A new firmware first starts in a trial state. If it does not confirm itself and the chip restarts, the bootloader returns to the previous firmware. A power cut during that first start has the same effect. | `sdkconfig:289`; IDF docs, Over The Air Updates, "App Rollback", "Rollback Process" and "Unexpected Reset" |
| 3.13 | The Arduino core confirms a new firmware by itself, before the sketch's `setup()` runs. So as shipped, a firmware that starts and then fails stays in place. The sketch can change that. It defines `verifyRollbackLater()` to return true and calls `esp_ota_mark_app_valid_cancel_rollback()` after its own checks. | `core/cores/esp32/esp32-hal-misc.c:237-246`, `:277-292`; the same two functions have explanatory comments at tag 3.3.12, `cores/esp32/esp32-hal-misc.c:242-293` |
| 3.14 | Automatic return needs a bootloader built for it, and an ordinary over-the-air update does not replace the bootloader. Every USB upload does replace it. | IDF docs, Bootloader, "Rollback" and "Bootloader Compatibility"; `core/platform.txt:297` |
| 3.15 | Every firmware image contains a checksum and a SHA-256 digest of itself. The build adds the digest. ESP-IDF checks the image before it switches slots, and the bootloader checks it at each start. This detects damage. It does not prove who made the image. | IDF docs, App Image Format; `core/platform.txt:167`; esptool docs, Basic Commands, "Convert ELF to Binary: elf2image"; `idf/components/app_update/esp_ota_ops.c:605` |
| 3.16 | In core 3.3.2 the only check the `Update` library adds is the optional MD5. It has no SHA-256 check and no signature check. `HTTPUpdate` contains the note "To do: the SHA256 could be checked if the server sends it". | `core/libraries/Update/src/Update.h:15-28`, `:149-155`; `core/libraries/HTTPUpdate/src/HTTPUpdate.cpp:474` |
| 3.17 | Newer cores add both. Signature checking with RSA or ECDSA keys first appears at tag 3.3.5. It is off unless the build sets `UPDATE_SIGN`, and the core ships a signing tool. Tag 3.3.12 also has SHA-256 and SHA-512 checks. | core at tag 3.3.12: `libraries/Update/README.md:5-16`, `:74-140`, `:442-466`; `libraries/Update/src/Updater_Signing.h` is absent at tags 3.3.3 and 3.3.4 and present from 3.3.5 |
| 3.18 | ESP-IDF's own signed-update check and Secure Boot are both switched off in the prebuilt core. They are compile-time settings of those libraries, so an `arduino-cli` build cannot switch them on. Secure Boot v2 also needs chip revision 3.0 or later, and it stores a key digest in memory that can be written only once. | `sdkconfig:359-362`; IDF docs, Secure Boot v2, opening section, "eFuse Usage" and "Signed App Verification Without Hardware Secure Boot"; IDF docs, Over The Air Updates, "Anti-rollback", for the write-once nature of that memory |
| 3.19 | The TLS client can check the server. `setCACert()` takes a certificate to trust. This core build ignores the validity dates in certificates, so a stored certificate keeps working without a clock and after its end date. The scanner has no clock source on a network without internet, because it asks public time servers. | `core/libraries/NetworkClientSecure/src/NetworkClientSecure.h:72`; `sdkconfig:2248`; `idf/components/mbedtls/Kconfig:679-693`; `scanner/ALNScanner_v5/services/OrchestratorService.h:116-121` |
| 3.20 | While the chip erases or writes its flash, everything else on it stops. ESP-IDF says the flash functions suspend "all the other tasks", and adds: "The other core will be polling in a busy loop." | IDF docs, Concurrency Constraints for Flash on SPI1, "When the Caches Are Disabled" |

### 4. Changing the partition table itself

| # | Fact | Source |
|---|---|---|
| 4.1 | The partition table is one 4 KB flash sector at address 0x8000. The bootloader reads it at every start. | IDF docs, Partition Tables, "Overview"; IDF docs, Application Startup Flow, "Second Stage Bootloader" |
| 4.2 | ESP-IDF 5.5 can replace a partition table over the air. It lists that under "unsafe update mode", where a power cut during the final copy "can cause issues that prevent the current application from loading, potentially leading to an unrecoverable state". | IDF docs, Over The Air Updates, "OTA Process Overview" and the entry for `esp_ota_set_final_partition()` |
| 4.3 | The Arduino `Update` library cannot do this. Its targets are a firmware slot or a file-system area. | `core/libraries/Update/src/Update.h:32-37`; `core/libraries/Update/src/Updater.cpp:149-194` |
| 4.4 | The prebuilt core blocks it as well. Its flash driver is compiled to abort the program on any write to the bootloader, to the partition table, or to the slot of the running firmware. | `sdkconfig:2461`; `idf/components/spi_flash/Kconfig:271-295`; `idf/components/spi_flash/esp_flash_api.c:44-62`, `:605-610`, `:1047-1057`; `idf/components/spi_flash/spi_flash_os_func_app.c:234-248`; `idf/components/esp_partition/partition_target.c:222-235` |
| 4.5 | Today's firmware has no update code [1.9]. So the first change to a scanner must arrive by cable, whatever the partition table allows. | row 1.9 |
| 4.6 | Update code would not work on the `no_ota` table either. With a single slot, ESP-IDF names the running slot as the next one to write, and the first erase of that slot aborts the program [4.4]. This comes from reading the source. It was not tested on a scanner. | `core/tools/partitions/no_ota.csv:4`; `idf/components/app_update/esp_ota_ops.c:737-783`; `core/libraries/Update/src/Updater.cpp:149-155`, `:431-443` |
| 4.7 | A normal USB upload writes the partition table every time, together with the bootloader and the firmware. So the move to two slots is an ordinary upload with a different `PartitionScheme` word. | `core/platform.txt:297`; `core/boards.txt:1697-1699`, `:1715-1717` |
| 4.8 | The move leaves the chip's settings area alone. It has the same address and size in all four schemes [2.6], and ESP-IDF notes that "updating the partition table does not erase data that may have been stored according to the old partition table". | row 2.6; IDF docs, Partition Tables, "Flashing the Partition Table" |

So moving a scanner from `no_ota` to a two-slot scheme needs one USB flash. It is the upload the guide already describes, with one word changed in the compile command.

### 5. Memory

| # | Fact | Source |
|---|---|---|
| 5.1 | Espressif measured the heap that one HTTPS request needs: about 42,196 bytes with default settings, and about 22,013 bytes with the "dynamic buffer" settings. | IDF docs, Mbed TLS, "Reducing Heap Usage" |
| 5.2 | The prebuilt core uses the default settings: a 16,384-byte TLS record size and no dynamic buffers. So the larger figure applies. The firmware's comment "TLS session ~22 KB" matches the smaller one. | `sdkconfig:2201-2202`, `:2212`; the file has no `CONFIG_MBEDTLS_DYNAMIC_BUFFER` entry, and that option cannot be set while DTLS is on (`sdkconfig:2280`; `idf/components/mbedtls/Kconfig:100-115`); `scanner/ALNScanner_v5/config.h:102-105` |
| 5.3 | The `Update` library allocates one 4,096-byte buffer and one 16-byte buffer. `HTTPUpdate` also hashes the running firmware through a temporary 4,096-byte buffer. | `core/libraries/Update/src/Updater.cpp:205`, `:419-425`; `core/cores/esp32/Esp.cpp:223-262` |
| 5.4 | The main loop's stack is 8,192 bytes. The firmware notes that the TLS set-up uses most of it, and that a 4 KB buffer on that stack crashed the first asset download. The `Update` library keeps its buffer on the heap. | `sdkconfig:452`; `scanner/ALNScanner_v5/services/OrchestratorService.h:769-775`; `scanner` commit `6d0c431`, commit message; `core/libraries/Update/src/Updater.cpp:205` |
| 5.5 | Recorded free heap: "~190 KB free at boot" in a code comment, and 171,852 bytes after start-up in a log from 2025-10-22. That log is older than HTTPS and asset sync. | `scanner/ALNScanner_v5/services/AssetService.h:119`; `scanner/REFACTOR_IMPLEMENTATION_GUIDE.md:1849-1861` |
| 5.6 | The firmware's own limits: it starts no download with less than 40,960 bytes free, and the asset sync sets aside 49,152 bytes for TLS, HTTP and streaming. | `scanner/ALNScanner_v5/config.h:113`; `scanner/ALNScanner_v5/services/OrchestratorService.h:700-705`; `scanner/ALNScanner_v5/services/AssetService.h:120-127` |
| 5.7 | The asset sync already runs a TLS download with SD writes inside these limits on a real scanner [1.11]. A firmware download is the same work plus the 4 KB update buffer. | rows 1.10, 1.11 and 5.3 |
| 5.8 | If the firmware file is on the SD card first, the flash step runs with no TLS connection open. It needs the 4 KB buffer and one open file. | rows 3.10 and 5.3 |
| 5.9 | Not confirmed: the free heap and the largest free block on today's firmware at the moment an update would start, and the stack left during a TLS download that also writes flash. | no source; see "What is still unknown" |

By the recorded numbers, a scanner at start-up has three to four times the heap an update needs: 171,852 to about 190,000 bytes free, against about 46,300 bytes for one TLS connection and the update buffers.

## Ways to do it

Options A and B both update over the air, and they share their first steps. Both run the update inside the start-up sync, where the scanner already accepts a wait and where its background task has not started [1.18]. Option C stays with USB.

### What options A and B both need

1. Measure the firmware. With update code added it must fit 1,966,080 bytes for `min_spiffs` or 2,031,616 bytes for `no_fs`.
2. Change `PartitionScheme=no_ota` in the compile command (`scanner/CLAUDE.md:99`) to the chosen scheme, and flash each of the three scanners once over USB [4.7]. The scanners also serve the production system (`docs/plans/CURRENT-STATE.md:333-335`), so the owner picks the day.
3. Give the firmware a version number, and have the backend's manifest name the version it offers [1.17].
4. Make the firmware confirm a new version only after its own start-up checks pass [3.13]. Without this step, the automatic return does not protect against a firmware that starts and then fails.
5. On the backend, store the firmware file, describe it with version, size and hash, and serve it. The asset manifest and the asset routes already do this for pictures and sounds (`backend/src/routes/resourceRoutes.js:71-78`, `:89-98`). The repository's rule is to change `backend/contracts/openapi.yaml` first (`CLAUDE.md:236-238`).
6. Decide when the backend offers an update. A scanner that restarts during a game would otherwise begin one. Offering firmware only while no game runs avoids that. This step is a design choice, not a finding.
7. Produce the firmware file from a build that ran on a real scanner. CI does not compile the firmware [1.6], so today that build happens on the Pi. `arduino-cli compile --export-binaries` writes the file into the sketch folder (Arduino CLI docs).

### Option A. Fetch and flash in one step, straight from the backend

The scanner opens an HTTPS download from the backend and writes the data into the spare slot as it arrives.

What it needs. The shared steps, then one of two code routes. The short route is the core's `HTTPUpdate` call with a TLS client [3.7]. The other route feeds the firmware's own streaming download [1.10] into `Update.write()` and compares the hash it already computes before it lets the update finish. A failed comparison calls `Update.abort()`, and the half-written slot stays unable to start [3.5]. The backend's file responses already include the `Content-Length` that `HTTPUpdate` requires (`scanner/ALNScanner_v5/services/OrchestratorService.h:677-679`).

What can go wrong at a show.

- The WiFi drops during the download. The core's library gives up after 30 seconds without data [3.6]. The old firmware runs, and the scanner starts late by that much.
- The power fails during the update. The old firmware starts [3.1].
- The new firmware starts and then fails. It might not read the SD card, for example. With shared step 4 the scanner returns to the previous firmware at its next restart [3.12]. Without it the scanner keeps the bad firmware until someone flashes it over USB [3.13].
- All three scanners take the same bad firmware on the same evening. Updating one scanner first limits this. So does publishing firmware only between events, which the roadmap already rules for engine updates (`docs/plans/ROADMAP.md:585-586`).
- Something other than the backend answers the request. With `setInsecure()` and an MD5 that comes from the same server, nothing proves that the firmware came from the backend [1.12, 3.16]. On the kit's own WiFi this risk is small. Checking the backend's certificate [3.19] or signing the firmware [3.17] removes it.
- A scanner on trial firmware loses power during its first start. It returns to the old firmware and updates again at the next start [3.12]. That costs time and nothing else.

What it costs. One USB flash for each of three scanners. Firmware work: the version number, the update call, the start-up self-check. Backend work: one file, one manifest entry, one route, the contract. A test on one scanner that cuts the power during an update and that loads a deliberately broken firmware. The firmware size limit drops from 2,097,152 bytes to 1,966,080 or 2,031,616. The short code route adds a second HTTP client beside the firmware's own, and in core 3.3.2 its only added check is MD5 [3.16].

### Option B. Download to the SD card first, then flash from the card

The scanner fetches the firmware file to its SD card like a picture or a sound. When the file is complete and checked, the scanner writes it into the spare slot from the card and restarts.

What it needs. The shared steps. Then the manifest lists the firmware file, and the existing download fetches it, with its size and SHA-1 checked before any flash is touched [1.10]. A short routine writes the file with `Update.writeStream()`, as the core's SD card example does [3.10]. The scanner records on the card which version it tried, so that a firmware that failed its trial is not flashed again at every start.

What can go wrong at a show.

- The WiFi drops during the download. The scanner discards the partial file, as it does for any asset today, and the next start tries again [1.10]. The flash is untouched.
- The power fails during the flash step. The old firmware starts [3.1]. The checked file is still on the card, so the next start finishes the job without the network.
- The SD card fails to read during the flash step. The update stops and the old firmware runs [3.6]. The scanner already depends on the card for everything else.
- The new firmware starts and then fails. Same as option A, with the same protection from shared step 4.
- All three scanners take the same bad firmware. Same as option A.
- An old firmware file stays on the card. The routine must delete it after success, as the core's example does (`core/libraries/Update/examples/SD_Update/SD_Update.ino:67-68`).

What it costs. The same one-time costs as option A. It takes more firmware code than one `HTTPUpdate` call, but it reuses the download that already ran on a real scanner [1.11], and its flash step needs less memory [5.8]. It takes about 1.3 MB of card space, on a card recorded as 7,618 MB (`scanner/REFACTOR_IMPLEMENTATION_GUIDE.md:1853`). It also has one advantage. If the routine accepts a file that a person copied onto the card, a scanner can be updated with no network at all.

### Option C. Stay with USB only

What it needs. Nothing new. Each firmware change needs a person, a computer with `arduino-cli` and the ESP32 core, a cable, and one upload per scanner (`scanner/CLAUDE.md:13`, `:99-107`).

What can go wrong at a show. A firmware fault found on the day can be fixed only by that person with that computer, one scanner at a time. A scanner that misses a flash keeps old firmware while the backend gets newer. `docs/plans/architecture-pass/rework/owner-questions.md:334` names that risk.

What it costs. Nothing now. Each firmware release costs one USB upload per scanner. That is three today, and more with a second kit (`docs/plans/ROADMAP.md:589-592`). The roadmap's principle keeps releases rare: designers change pack data, never firmware (`docs/plans/ROADMAP.md:146-148`).

A variant stays with USB and prepares for later. The next USB flash that happens anyway can use a two-slot scheme. With `min_spiffs` that costs 131,072 bytes of size limit and nothing else [2.3]. Options A and B then need no further USB flash to begin.

### The helper's reading

This paragraph is a judgment, not a finding. If the owner wants updates over the air, option B is the one to build. Its download is code that already works on our hardware, it checks the whole file before it touches the flash, and its flash step does not depend on the WiFi. Option A's short route is less code, but it adds a second HTTP client and a weaker check. Either way the measurement comes first, and the cheapest step today is the variant under option C.

## What is still unknown

| # | Unknown | Why it matters | How to find out |
|---|---|---|---|
| U1 | Today's firmware size, alone and with update code added. Also whether it still fits the `default` scheme. | It decides whether two slots are possible and which scheme to pick. | On the build Pi, in `scanner/ALNScanner_v5/`, run the guide's compile command with `PartitionScheme=min_spiffs`. Read the line "Sketch uses N bytes", which ends "Maximum is 1966080 bytes". Write N and the date into the scanner guide. |
| U2 | The core version on the build Pi, and the core version behind the 2025 size records. | The core version changes the firmware size, and signature checking needs 3.3.5 or later [3.17]. | `arduino-cli core list` prints the installed version (Arduino CLI docs). The 2025 versions are not recorded anywhere in the repository. |
| U3 | Free heap, largest free block and loop stack left when an update would start. | The recorded numbers are old or are comments [5.5]. | On one scanner, print `ESP.getFreeHeap()` and `ESP.getMaxAllocHeap()` right before the update (`core/cores/esp32/Esp.h:68-70`). The serial `MEM` command prints free heap today (`scanner/CLAUDE.md:116`). The firmware already reads a stack mark with `uxTaskGetStackHighWaterMark` (`scanner/ALNScanner_v5/services/OrchestratorService.h:1276`). |
| U4 | How our hardware behaves when the power is cut during an update, and when a new firmware is broken. | Sections 3 and 4 quote documentation and source. Nothing was run on a scanner. | Test on one scanner. Cut the power during the write. Then load a firmware that never confirms itself. Watch which firmware starts each time. |
| U5 | How long an update takes. | It sets how long a scanner is out of use at start-up. | This is an estimate only. The guide's asset sync figures, 30 to 40 MB in 5 to 15 minutes (`CLAUDE.md:438-439`), give 10 to 40 seconds for a 1.3 MB download, plus the flash writing. Time it during the test in U4. |
| U6 | Which certificate the venue's backend serves now. | It matters only if the firmware starts checking certificates [3.19]. The copy in this repository ended its validity on 2026-10-24. A certificate stored in the firmware stops matching when the backend's certificate is replaced. From then on the scanner would reject the backend, the update download included. | For the repository copy: `openssl x509 -in backend/ssl/cert.pem -noout -enddate`, run 2026-11-13. For the served one, ask the venue machine. |
| U7 | Whether all three scanners run the same firmware build today. | A scanner on an older build may behave differently. | The USB flash in shared step 2 answers it, because it writes bootloader, partition table and firmware together [4.7]. |
| U8 | The chip revision of each scanner. | Only Secure Boot v2 needs it [3.18], and no option here uses Secure Boot. | The scanner's workflow guide names the chip "ESP32-D0WD-V3" (`scanner/ARDUINO_CLI_WORKFLOW_GUIDE.md:26`). Not checked on the scanners themselves. |
| U9 | What to do if the firmware outgrows 2,031,616 bytes. | Two equal slots are then impossible on a 4 MB chip [2.4]. | Not researched. One possible layout is a small loader program plus one large slot that the loader fills from the SD card. The bootloader does start a lower slot when the chosen one is invalid (`idf/components/bootloader_support/src/bootloader_utility.c:594-606`), but the core ships no example of this layout. |

## Sources

All read on 2026-11-13.

This repository, branch `claude/nice-curie-hescfv`:

- `CLAUDE.md`, `docs/plans/CURRENT-STATE.md`, `docs/plans/ROADMAP.md`, `docs/plans/architecture-pass/rework/owner-questions.md`, `backend/src/routes/resourceRoutes.js`, `backend/ssl/cert.pem` (certificate dates only).
- `arduino-cyd-player-scanner/` at submodule commit `f81aba5737baf9e3697403c29eb0902ef12287fc`: `CLAUDE.md`, `ARDUINO_CLI_WORKFLOW_GUIDE.md`, `REFACTOR_IMPLEMENTATION_GUIDE.md`, `baseline_flash_v4.1.txt`, `platformio.ini`, `.github/workflows/test.yml`, `libraries/*/library.properties`, and under `ALNScanner_v5/`: `Application.h`, `config.h`, `services/AssetService.h`, `services/OrchestratorService.h`, `services/ConfigService.h`, `hal/*.h`.
- Commit messages in that submodule: `49c8522` (2025-10-31), `b58961e` (2025-11-09), `6d0c431` (2026-06-26).

Arduino-ESP32 core, tag 3.3.2, commit `ee98cf3ca1bccebcfb9e74ed906b51983e416202`, dated 2025-10-08. Address pattern: `https://github.com/espressif/arduino-esp32/blob/3.3.2/<path>`.

- `tools/partitions/default.csv`, `min_spiffs.csv`, `no_fs.csv`, `no_ota.csv`, `huge_app.csv`, and the other tables in that folder
- `boards.txt`, `platform.txt`, `package/package_esp32_index.template.json`
- `libraries/Update/src/Update.h`, `Updater.cpp`, `HttpsOTAUpdate.cpp`, and `libraries/Update/examples/SD_Update/SD_Update.ino`
- `libraries/HTTPUpdate/src/HTTPUpdate.cpp`, `HTTPUpdate.h`
- `libraries/ArduinoOTA/src/ArduinoOTA.cpp`
- `libraries/NetworkClientSecure/src/NetworkClientSecure.h`
- `cores/esp32/esp32-hal-misc.c`, `Esp.cpp`, `Esp.h`
- `docs/en/tutorials/partition_table.rst`, published at `https://docs.espressif.com/projects/arduino-esp32/en/latest/tutorials/partition_table.html`

Arduino-ESP32 core, later tags, from `https://raw.githubusercontent.com/espressif/arduino-esp32/<tag>/<path>`:

- tag 3.3.12: `boards.txt`, the five partition tables of section 2, `libraries/Update/README.md`, `libraries/Update/src/Update.h`, `cores/esp32/esp32-hal-misc.c`
- tags 3.3.3 to 3.3.8: presence of `libraries/Update/src/Updater_Signing.h`

Prebuilt libraries of core 3.3.2, the archive named in `package/package_esp32_index.template.json:106-111`:

- `https://github.com/espressif/esp32-arduino-lib-builder/releases/download/idf-release_v5.5/esp32-arduino-libs-idf-release_v5.5-07e9bf49-v1.zip`
- Files read from it: `esp32-arduino-libs/esp32/sdkconfig`, 3,647 lines, headed "ESP-IDF 5.5.1", and `esp32-arduino-libs/versions.txt`, which says "esp-idf: release/v5.5 07e9bf4970".
- The two files were read with HTTP range requests. The 449 MB archive was not downloaded whole.

ESP-IDF v5.5.1 documentation, under `https://docs.espressif.com/projects/esp-idf/en/v5.5.1/esp32/`:

- Over The Air Updates: `api-reference/system/ota.html`
- ESP HTTPS OTA: `api-reference/system/esp_https_ota.html`
- Partition Tables: `api-guides/partition-tables.html`
- Bootloader: `api-guides/bootloader.html`
- Application Startup Flow: `api-guides/startup.html`
- App Image Format: `api-reference/system/app_image_format.html`
- Secure Boot v2: `security/secure-boot-v2.html`
- Mbed TLS: `api-reference/protocols/mbedtls.html`
- Concurrency Constraints for Flash on SPI1: `api-reference/peripherals/spi_flash/spi_flash_concurrency.html`

ESP-IDF source, tag v5.5.1, from `https://raw.githubusercontent.com/espressif/esp-idf/v5.5.1/<path>`:

- `components/app_update/esp_ota_ops.c`
- `components/bootloader_support/src/bootloader_utility.c`
- `components/esp_https_ota/src/esp_https_ota.c`
- `components/spi_flash/Kconfig`, `esp_flash_api.c`, `spi_flash_os_func_app.c`
- `components/esp_partition/partition_target.c`
- `components/mbedtls/Kconfig`

Other tools:

- esptool, Basic Commands: `https://docs.espressif.com/projects/esptool/en/latest/esp32/esptool/basic-commands.html`
- Arduino CLI 1.5 command reference: `https://arduino.github.io/arduino-cli/1.5/commands/arduino-cli_core_list/` and `https://arduino.github.io/arduino-cli/1.5/commands/arduino-cli_compile/`

Limits of these sources:

- `github.com` web pages and `api.github.com` answered HTTP 403 from the research container. The same files were read with `git clone --branch 3.3.2` and from `raw.githubusercontent.com`. Every other source was reachable.
- The prebuilt libraries were built from ESP-IDF branch `release/v5.5` at commit `07e9bf4970`, which names itself 5.5.1. The documentation and source were read at the tag `v5.5.1`. The two may differ by a few commits.
- The core version on the build Pi today is not confirmed. If it is not 3.3.2, the line numbers under `core/` and `sdkconfig` may shift. The five partition tables do not change between 3.3.2 and 3.3.12 [2.8].
