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

## Wayland on Pi OS Bookworm: labwc, not Wayfire

Pi OS Bookworm 64-bit on Pi 5 uses **`labwc`** as the default Wayland compositor as of late 2024. Most blog posts and forum threads online still describe Wayfire — they're stale. Confirm via `ps -ef | grep labwc`. The compositor difference matters because config paths and conventions diverge: Wayfire uses `~/.config/wayfire.ini`; labwc uses `~/.config/labwc/{autostart,rc.xml,environment}`.

## Screen rotation (Wayland / labwc)

Live rotation, run from any SSH session that exports the active user's Wayland env:

```
export XDG_RUNTIME_DIR=/run/user/$(id -u)
export WAYLAND_DISPLAY=wayland-0
wlr-randr --output HDMI-A-1 --transform 270
```

Transform values: `0` (normal landscape), `90`, `180`, `270`. For our cocopar mounting (USB-C ports facing down on the wall), **`270` is the correct portrait orientation**. `90` rotates the wrong way.

**Persist across reboots** by adding the command to labwc's autostart hook:

```
mkdir -p ~/.config/labwc
cat > ~/.config/labwc/autostart <<'EOF'
wlr-randr --output HDMI-A-1 --transform 270 &
EOF
chmod +x ~/.config/labwc/autostart
```

The `&` is important — autostart waits for each line, and `wlr-randr` doesn't always exit cleanly. Forking it lets the rest of session startup proceed.

## Touch input rotation (libinput calibration matrix via udev)

Rotating the display does **not** automatically rotate touch coordinates on labwc. You'll see the desktop in portrait but taps land at the wrong location. The fix is a libinput calibration matrix delivered via udev.

The cocopar's touch controller advertises as a Wacom-branded HID — vendor `056a`, product `0529`, with two device entries: `Wacom TouchScreen Finger` (the one that matters) and `Wacom TouchScreen Pen`. Match both:

```
sudo tee /etc/udev/rules.d/90-cocopar-touch.rules <<'EOF'
ATTRS{name}=="Wacom TouchScreen Finger", ENV{LIBINPUT_CALIBRATION_MATRIX}="0 1 0 -1 0 1"
ATTRS{name}=="Wacom TouchScreen Pen",    ENV{LIBINPUT_CALIBRATION_MATRIX}="0 1 0 -1 0 1"
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input
```

The matrix `0 1 0 -1 0 1` is the correct one for `transform 270`. (For `transform 90` you'd want `0 -1 1 1 0 0`. For `180`, `-1 0 1 0 -1 1`.)

`udevadm trigger` re-fires events for already-attached devices, but libinput may have already opened the touch device with the old config. If taps still land wrong after the reload, **unplug the cocopar's touch USB cable and re-plug it** to force libinput to re-read.

## Phase 1 ladder (in case of rebuild)

In execution order, with what's locally manual vs. SSH-doable:

1. **First-boot wizard on the Pi** (manual, requires display + keyboard) — locale/user/WiFi/password
2. **Enable SSH** (local terminal): `sudo systemctl enable --now ssh`
3. **SSH key auth from laptop** (Mac terminal): `ssh-copy-id <user>@<ip>`
4. **Hostname change** (over SSH): `sudo raspi-config nonint do_hostname dashboard && sudo reboot`
5. **Tailscale** (over SSH): install script + `sudo tailscale up --ssh --hostname dashboard`, browser auth from any device
6. **log2ram + display blanking off + SSH password auth disable** (over SSH, parallel)
7. **Screen rotation + touch matrix** (over SSH, but cocopar must be physically connected so you can verify visually)
8. (Deferred) Static IP DHCP reservation — Tailscale already provides a stable address (`dashboard` / `100.x.x.x`); revisit only if it actually bites

After step 5, every remaining step is SSH-only and works from anywhere on the tailnet. Don't re-touch the Pi physically unless something is broken or you're swapping displays.
