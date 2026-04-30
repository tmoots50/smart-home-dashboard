// Mock traffic. Real source: Google Maps Distance Matrix or Apple Maps.
// Status derives from delta vs typical: 'clear' | 'slow' | 'heavy'.

export function getMockTraffic() {
  return {
    destination: "Carter’s HQ",
    durationMin: 23,
    typicalMin: 18,
    via: 'I-75 N',
    status: 'slow',
  };
}
