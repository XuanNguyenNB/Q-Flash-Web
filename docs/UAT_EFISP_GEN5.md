# UAT EFISP 8E Gen 5

Checklist kiá»ƒm thá»­ trÃªn mÃ¡y tháº­t cho Xiaomi 17 Series vÃ  Redmi K90 Pro Max / POCO F8 Ultra.

## Äiá»u kiá»‡n trÆ°á»›c khi cháº¡y

- DÃ¹ng Chrome hoáº·c Edge desktop qua HTTPS/localhost, WebUSB hoáº¡t Ä‘á»™ng.
- ÄÃºng má»™t trong cÃ¡c codename: `pudding`, `pandora`, `popsicle`, `nezha`, `myron`.
- Báº­t Gá»¡ lá»—i USB vÃ  chá»n **LuÃ´n cho phÃ©p tá»« mÃ¡y tÃ­nh nÃ y** khi Android há»i RSA.
- Security patch Ä‘á»c tá»« ADB pháº£i cÃ³ dáº¡ng `YYYY-MM-DD` vÃ  khÃ´ng má»›i hÆ¡n `2026-02-01`.
- ÄÃ£ sao lÆ°u dá»¯ liá»‡u vÃ  chuáº©n bá»‹ phÆ°Æ¡ng Ã¡n khÃ´i phá»¥c/ROM gá»‘c Ä‘Ãºng model.
- KhÃ´ng dÃ¹ng EDL_Standard cho workflow EFISP.

## TrÃ¬nh tá»± kiá»ƒm thá»­

1. **ADB-first**
   - Káº¿t ná»‘i khi mÃ¡y Ä‘ang á»Ÿ Android.
   - XÃ¡c nháº­n app Ä‘á»c Ä‘Ãºng codename vÃ  security patch.
   - Pass khi app tá»± reboot bootloader; fail náº¿u cho vÃ o Fastboot trá»±c tiáº¿p hoáº·c bá» qua ADB.

2. **Security patch gate**
   - Vá»›i patch `2026-02-01` hoáº·c cÅ© hÆ¡n: cho phÃ©p tiáº¿p tá»¥c.
   - Vá»›i patch `2026-02-02` hoáº·c má»›i hÆ¡n: hard-block trÆ°á»›c má»i lá»‡nh Fastboot permissive.
   - Patch trá»‘ng/sai Ä‘á»‹nh dáº¡ng: hard-block.

3. **Fastboot permissive vÃ  continue**
   - Káº¿t ná»‘i láº¡i Fastboot, xÃ¡c nháº­n product khá»›p codename ADB.
   - Log pháº£i cÃ³:
     - `fastboot oem set-gpu-preemption-value 0 androidboot.selinux=permissive`
     - `fastboot continue`
   - Pass khi mÃ¡y boot láº¡i Android; dá»«ng náº¿u Fastboot tráº£ lá»—i.

4. **ADB reconnect**
   - Káº¿t ná»‘i láº¡i ADB sau khi Android lÃªn.
   - XÃ¡c nháº­n codename vÃ  security patch váº«n khá»›p target Ä‘Ã£ khÃ³a.
   - Dá»«ng náº¿u RSA chÆ°a Ä‘Æ°á»£c cáº¥p, product sai hoáº·c patch khÃ´ng cÃ²n qua gate.

5. **Push EFI**
   - Asset pháº£i lÃ  `efisp/gbl_efi_unlock.efi` tá»« cache Ä‘Ã£ kiá»ƒm tra SHA-256.
   - Hash chuáº©n: `88918dd212fefe9d51c584513cbb7babebf395879d9edc2a02acd4246b5bcf5d`.
   - Log pháº£i cÃ³ push tá»›i `/data/local/tmp/gbl_efi_unlock.efi`.

6. **MQSAS write efisp**
   - Log pháº£i cÃ³ `service call miui.mqsas.IMQSNative 21 ... dd ... of=/dev/block/by-name/efisp`.
   - Pass khi ADB tráº£ `Result:` vÃ  khÃ´ng cÃ³ `Permission denied`/`not permitted`.
   - Dá»«ng ngay náº¿u káº¿t quáº£ khÃ´ng há»£p lá»‡.

7. **Reboot Fastboot**
   - App cháº¡y `adb reboot bootloader`.
   - Káº¿t ná»‘i láº¡i Ä‘Ãºng thiáº¿t bá»‹ Fastboot vÃ  xÃ¡c minh product.

8. **Verify unlocked**
   - App cháº¡y `fastboot getvar unlocked`.
   - Chá»‰ pass vá»›i giÃ¡ trá»‹ chÃ­nh xÃ¡c `yes`.
   - Vá»›i má»i giÃ¡ trá»‹ khÃ¡c, cleanup pháº£i bá»‹ khÃ³a.

9. **Cleanup**
   - App kiá»ƒm tra láº¡i `unlocked: yes` ngay trÆ°á»›c khi xÃ³a.
   - Thá»© tá»± lá»‡nh:
     - `fastboot erase efisp`
     - `fastboot erase metadata`
     - `fastboot erase userdata`
   - Pass khi cáº£ ba lá»‡nh hoÃ n táº¥t vÃ  log táº£i xuá»‘ng Ä‘Æ°á»£c.

## Báº±ng chá»©ng cáº§n lÆ°u

- File nháº­t kÃ½ táº£i tá»« Q Flash Web.
- áº¢nh mÃ n hÃ¬nh compatibility panel cÃ³ model, codename vÃ  security patch.
- DÃ²ng Fastboot `unlocked: yes`.
- Káº¿t quáº£ tá»«ng lá»‡nh cleanup.
