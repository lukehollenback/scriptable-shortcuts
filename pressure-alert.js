function formatCompactTime(isoString) {
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'p' : 'a';

  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  return `${hours}:${minutes}${ampm}`;
}

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

//
// Determine if today's pressure is sporadic (a.k.a. 4+ direction changes).
//
let directionChanges = 0;
let lastDirection = null;

for (let i = 1; i < todayPressures.length; i++) {
  const delta = todayPressures[i].pressure - todayPressures[i - 1].pressure;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : lastDirection;

  if (direction && lastDirection && direction !== lastDirection) {
    directionChanges++;
  }

  if (direction) lastDirection = direction;
}

const pressureIsSporadic = directionChanges >= 4;

if (dropDetected || rangeExceeded || pressureIsSporadic) {
  const body = [];

  if (dropDetected) {
    if (dropEntry.hour < currentHour) {
      const recentEntry = [...todayPressures].reverse().find(p => p.hour <= currentHour && p.pressure <= 29.8);
      const aoTime = formatLocalTime(`${today}T${recentEntry ? recentEntry.time : dropEntry.time}`);
      
      body.push(`Pressure is already ≤ 29.8 inHg today (a/o ${aoTime}).`);
    } else {
      dropTime = formatLocalTime(`${today}T${dropEntry.time}`);
      
      body.push(`Pressure will drop ≤ 29.8 inHg around ${dropTime}.`);
    }
  }

  if (rangeExceeded) {
    body.push(`Expect changes ≥ 0.2 inHg (H: ${maxPressure.toFixed(2)}, L: ${minPressure.toFixed(2)}).`);
  }

  if (pressureIsSporadic) {
    body.push(`Pressure will change direction ${directionChanges} times today.`)
  }

  body.push(`\nSee more at https://www.windy.com/-Pressure-pressure?pressure,${lat},${lon},6.`);

  //
  // Determine a good title and output content for a notification.
  //
  const title = pressureIsSporadic
    ? "😵‍💫 Pressure is All Over the Place Today"
    : "📉 Pressure Dropping Critically Today";
  
  const output = {
    notification: {
      title: title,
      body: body.join("\n"),
      attachment: null
    },
    meta: {
      dropDetected,
      rangeExceeded,
      pressureIsSporadic
    }
  };
  
  Script.setShortcutOutput(JSON.stringify(output));
}
