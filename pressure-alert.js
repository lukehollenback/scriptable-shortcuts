const inHg = hPa => hPa * 0.02953;
const location = await Location.current();
const lat = location.latitude.toFixed(3);
const lon = location.longitude.toFixed(3);

// Format today's date
const now = new Date();
const today = now.toISOString().split("T")[0];
const currentHour = now.getHours();

// Fetch weather data
const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=pressure_msl&timezone=auto`;
const req = new Request(url);
const res = await req.loadJSON();

// Extract today’s hourly pressures
const times = res.hourly.time;
const pressures = res.hourly.pressure_msl;
const todayPressures = [];

for (let i = 0; i < times.length; i++) {
  if (times[i].startsWith(today)) {
    const hour = parseInt(times[i].substring(11, 13));
    todayPressures.push({
      time: times[i].substring(11, 16), // HH:MM
      hour,
      pressure: inHg(pressures[i])
    });
  }
}

const pressureValues = todayPressures.map(p => p.pressure);
const minPressure = Math.min(...pressureValues);
const maxPressure = Math.max(...pressureValues);
const dropEntry = todayPressures.find(p => p.pressure <= 29.8);
const dropDetected = !!dropEntry;
const rangeExceeded = (maxPressure - minPressure) > 0.2;

if (dropDetected || rangeExceeded) {
  const body = [];

  if (dropDetected) {
    if (dropEntry.hour < currentHour) {
      body.push(`Pressure is already below 29.8 inHg today`);
    } else {
      body.push(`Pressure will drop to ≤ 29.8 inHg around ${dropEntry.time}`);
    }
  }

  if (rangeExceeded) {
    body.push(`Pressure changes more than 0.2 inHg:\nHigh: ${maxPressure.toFixed(2)}\nLow: ${minPressure.toFixed(2)}`);
  }

  //
  //
  //
  const output = {
    notification: {
      title: "Pressure Alert",
      body: body.join("\n"),
      attachment: `https://www.windy.com/-Pressure-pressure?pressure,${lat},${lon},6`
    }
  };
  
  Script.setShortcutOutput(JSON.stringify(output));
}
