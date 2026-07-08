// Mock smart-home state. Single source of mock truth for the Home overlay, used
// when the live HA backend isn't wired yet (VITE_HOME_LIVE unset) or a fetch fails.
//
// Shape mirrors what /api/home returns once Home Assistant is connected:
//   lock  — the Aqara U100 deadbolt
//   plugs — the smart plugs we've allowlisted as safe to toggle from the wall
//
// state values match HA's lock domain: 'locked' | 'unlocked' | 'jammed' | 'unknown'.

export function getMockHome() {
  return {
    lock: {
      id: 'lock.front_door',
      name: 'Front Door',
      state: 'locked',
      battery: 87,
    },
    plugs: [
      { id: 'switch.living_room_lamp',      name: 'Living Room Lamp',      on: true },
      { id: 'switch.nursery_sound_machine', name: 'Nursery Sound Machine', on: false },
      { id: 'switch.coffee_maker',          name: 'Coffee Maker',          on: false },
    ],
  };
}
