# Install runbook

How to take a fresh CanaKit Pi 5 (with the pre-loaded NVMe) from a box on the desk to a dashboard on the wall. Stub — fill in as we go.

## Prereqs
- CanaKit Pi 5 8GB bundle, NVMe pre-loaded with Raspberry Pi OS 64-bit Bookworm
- cocopar 15.6" touchscreen
- Dev laptop on the same network
- A GitHub personal access token if cloning a private repo (this one is public, so no)

## 1. First boot (one-time, with keyboard + monitor)
- [ ] Boot Pi, walk through Raspberry Pi OS first-run wizard
- [ ] Set username, hostname (`dashboard`), WiFi
- [ ] Enable SSH (`sudo raspi-config`)
- [ ] Set router DHCP reservation for the Pi's MAC

## 2. From the laptop, over SSH
- [ ] Copy SSH public key: `ssh-copy-id pi@dashboard.local`
- [ ] Disable password auth in `/etc/ssh/sshd_config`
- [ ] Install Tailscale: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`

## 3. Clone + run the install script
- [ ] `sudo mkdir -p /opt && sudo chown pi /opt`
- [ ] `git clone https://github.com/tmoots50/smart-home-dashboard.git /opt/dashboard`
- [ ] `cd /opt/dashboard && pi/install.sh`

## 4. Verify
- [ ] Reboot, dashboard comes up unattended
- [ ] Display is portrait
- [ ] Touch input works
- [ ] Pull WiFi for 30s, dashboard recovers
