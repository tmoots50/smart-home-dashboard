// Mock smart-home state. Single source of mock truth for the Home overlay, used
// when the live HA backend isn't wired yet (VITE_HOME_LIVE unset) or a fetch fails.
//
// Shape mirrors what /api/home returns once Home Assistant is connected:
//   lock  — the Aqara U100 deadbolt
//   plugs — the smart plugs we've allowlisted as safe to toggle from the wall
//
// state values match HA's lock domain: 'locked' | 'unlocked' | 'jammed' | 'unknown'.

// Mirrors the real Home Assistant surface (verified 2026-07-25 off the live HA):
// the Aqara U100 deadbolt (entity lock.aqara_smart_lock_u100, shown as "Front
// Door") and four lamp switches. HA doesn't expose a battery level for the lock,
// so battery is null. Keep this in sync with HA_ENTITIES_JSON when devices change.
export function getMockHome() {
  return {
    lock: {
      id: 'lock.aqara_smart_lock_u100',
      name: 'Front Door',
      state: 'locked',
      battery: 97,
    },
    plugs: [
      { id: 'switch.living_room_side_lamp', name: 'Side Lamp',  on: true },
      { id: 'switch.den_left_lamp',         name: 'Left Lamp',  on: true },
      { id: 'switch.den_right_lamp',        name: 'Right Lamp', on: true },
      { id: 'switch.den_den_lamp',          name: 'Den Lamp',   on: true },
    ],
  };
}
