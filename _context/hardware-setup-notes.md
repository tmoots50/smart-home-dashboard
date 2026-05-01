# Hardware setup — gotchas and runbook

Lessons learned during the first physical setup of the Pi 5 + cocopar 15.6" combo (2026-04-30 / 2026-05-01). Most of these are not intuitive and cost real time to discover the first time. Captured here so the install doc (`docs/install.md`) can be assembled cleanly later, and so a future rebuild doesn't re-learn the same lessons.

---

## The Pi 5 itself

### HDMI0 vs HDMI1 is not a coin flip
The Pi 5 has two micro-HDMI ports right next to each other. Only **HDMI0 — the one closer to the USB-C power input** — outputs by default at first boot. If the cable is in HDMI1 you get "no signal" until you reconfigure boot args. Easy to get wrong because the ports are unlabeled on the case opening.

**Symptom:** monitor shows "no signal" after Pi boots; activity LED on Pi is normal; trying different cables / monitors doesn't help.
**Fix:** move the micro-HDMI cable to the port closer to USB-C, then **power-cycle the Pi** (HDMI is detected at boot, not hot-plugged reliably).

### USB-C port is power-input only
Pi 5's single USB-C port carries **power only**. No USB data, no DisplayPort alt-mode, no HID. So:
- You cannot drive the display over USB-C from the Pi.
- You cannot receive touch input over USB-C into the Pi.
- The cocopar pushing power upstream over USB-C "works" (the Pi gets power) but typically undervolts both devices and gives you nothing else.

Touch input has to come over a USB-A port. The micro-HDMI ports do all the video work.

### Active cooler is in the kit
CanaKit Turbine Black case ships with the active cooler installed. This is a deviation from the original passive-cooling-for-humidity preference in `spec.md`. Accepted for v1; revisit if corrosion shows up. Fan is audible but not loud.

---

## The cocopar 15.6" portable monitor

### Two USB-C cables ship in the box, not interchangeable
One is full data+power+display; the other has a paper tag reading **"USB Power Cable — Display NOT Supported."** That second one is power-only. If you accidentally use it for the touch link, you get no touch input even though the cable physically fits.

### Touch needs a data-capable USB-C → USB-A cable
The flow is: cocopar TOUCH port (USB-C) → USB-A on Pi. Any data-capable USB-C ↔ USB-A cable works (most phone-sync cables qualify). Charge-only cables fail silently.

### Cocopar wants its own wall adapter
Powering it from the Pi's USB-A is borderline (USB-A puts out ~500mA–1A; cocopar wants 2A+). Symptom is intermittent display, no signal, or backlight flicker. Use the small white wall adapter from the cocopar box for monitor power. Pi gets power from its own 45W kit PSU. Two adapters, two devices — keep the power planes separate.

### Input source defaults vary
The cocopar's OSD may default to USB-C input even if HDMI is connected. Use the OSD buttons (back/side of monitor) to select **Input Source → HDMI** explicitly.

---

## Apple Magic Keyboard

### Lightning cable is charging only
Tethering a Magic Keyboard to the Pi via its Lightning-to-USB-A cable does nothing useful — the cable doesn't carry HID data, only power. The Pi sees no keyboard.

### But it pairs fine over Bluetooth
Pi 5 has built-in BT, and Pi OS Bookworm's welcome wizard has a "pair Bluetooth keyboard" option from the start. Magic Keyboard pairs cleanly. Two prep steps to avoid surprises:

1. **Turn off Bluetooth on your Mac first** — otherwise the Mac grabs the keyboard before the Pi can.
2. **Power-cycle the keyboard** (slider switch on the back edge: off, then on) — that puts it in discoverable mode.

The wizard offers a 4-digit pairing code; type it on the Magic Keyboard followed by Enter.

---

## First-boot wizard (Pi OS Bookworm)

A condensed run of the choices we made / would make again:

| Screen | Choice |
|---|---|
| Country | United States |
| Language | English (US) |
| Timezone | America/New_York |
| Keyboard layout | English (US) |
| Username | `tmoots` (matches Mac local user — keeps SSH commands ergonomic) |
| Password | strong, written down — used for sudo and initial SSH |
| WiFi | home network |
| Default browser | Chromium (matches kiosk runtime) |
| Update software | skip; do via SSH later |
| Restart | yes |

### Hostname change is post-wizard
The on-device welcome wizard does not include a hostname field. Default after wizard is `raspberrypi`. Change to `dashboard` later via:

```
sudo raspi-config nonint do_hostname dashboard
sudo reboot
```

After reboot the device is reachable as `dashboard.local` from any Mac on the same LAN (mDNS works out of the box on Bookworm).

### SSH is not enabled in the wizard either
Enable post-wizard from a terminal on the Pi:

```
sudo systemctl enable --now ssh
hostname -I    # to find the Pi's IPv4 address
```

Then from the Mac:

```
ssh-copy-id <user>@<ip>     # pushes laptop's public key to Pi
ssh <user>@<ip>             # password-less SSH from now on
```

---

## What's next once SSH works

Phase 1 goes entirely remote from here. From the Mac SSH session:
- Set hostname (above)
- Static IP via the router's DHCP reservation (router admin UI; not on the Pi)
- Install Tailscale (`curl -fsSL https://tailscale.com/install.sh | sh`)
- Wayland screen rotation (`wlr-randr`) and persistence (`kanshi`)
- Touch input mapping to the rotated display
- Disable display blanking
- Install `log2ram`
- Disable password SSH auth once key auth is confirmed working

Don't re-touch the Pi physically unless something is broken.
