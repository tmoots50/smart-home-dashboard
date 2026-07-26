export const states = {
  locked: {
    lock: { id: 'lock.front_door', name: 'Front Door', state: 'locked', battery: 87 },
    plugs: [
      { id: 'switch.living_room_side_lamp', name: 'Side Lamp',  on: true,  custom: false },
      { id: 'switch.den_left_lamp',         name: 'Left Lamp',  on: true,  custom: false },
      { id: 'switch.den_right_lamp',        name: 'Right Lamp', on: false, custom: false },
    ],
  },
  unlocked: {
    lock: { id: 'lock.front_door', name: 'Front Door', state: 'unlocked', battery: 52 },
    plugs: [
      { id: 'switch.living_room_side_lamp', name: 'Side Lamp', on: true, custom: false },
    ],
  },
  jammed: {
    lock: { id: 'lock.front_door', name: 'Front Door', state: 'jammed', battery: 12 },
    plugs: [],
  },
  'no-battery': {
    lock: { id: 'lock.front_door', name: 'Front Door', state: 'locked', battery: null },
    plugs: [
      { id: 'switch.den_den_lamp', name: 'Den Lamp', on: true, custom: false },
    ],
  },
};
