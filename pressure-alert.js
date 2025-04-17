/**
 * Pressure Alert
 * © 2025 Luke Hollenback — All rights reserved.
 * 
 * Fetches hourly atmospheric pressure data and determines if changes are occuring that might impact sensitive individuals.
 */

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
  const currentEntry = todayPressures.find(p => p.hour === currentHour);

  if (dropDetected) {
    if (dropEntry.hour < currentHour) {
      // Find when it first dropped below threshold
      const firstLowEntry = todayPressures.find(p => p.pressure <= 29.8);
      const firstLowTime = firstLowEntry ? formatCompactTime(`${today}T${firstLowEntry.time}`) : null;
      
      // Find most recent entry at or before now
      
      const isCurrentlyLow = currentEntry && currentEntry.pressure <= 29.8;
      
      // Find last time it was still low
      const lastLowEntry = [...todayPressures].reverse().find(p => p.hour <= currentHour && p.pressure <= 29.8);
      const lastLowTime = lastLowEntry ? formatCompactTime(`${today}T${lastLowEntry.time}`) : null;
      
      // Format current time
      const currentTimeFormatted = currentEntry ? formatCompactTime(`${today}T${currentEntry.time}`) : null;
      
      if (isCurrentlyLow) {
        body.push(`Pressure is currently ≤ 29.8 inHg (a/o ${lastLowTime || firstLowTime}).`);
      } else if (lastLowEntry) {
        body.push(`Pressure dropped ≤ 29.8 inHg earlier (a/o ${firstLowTime}), but is now above that (a/o ${currentTimeFormatted}).`);
      } else {
        body.push(`Pressure will drop ≤ 29.8 inHg around ${firstLowTime}.`);
      }
    } else {
      dropTime = formatCompactTime(`${today}T${dropEntry.time}`);
      
      body.push(`Pressure will drop ≤ 29.8 inHg around ${dropTime}.`);
    }
  }

  if (rangeExceeded) {
    body.push(`Expect changes ≥ 0.2 inHg (H: ${maxPressure.toFixed(2)}, L: ${minPressure.toFixed(2)}).`);
  }

  if (pressureIsSporadic) {
    body.push(`Pressure will change direction ${directionChanges} times today.`)
  }

  body.push(`\nCurrent pressure is ${currentEntry.pressure} inHg.`);

  body.push(`\nSee more at https://www.windy.com/-Pressure-pressure?pressure,${lat},${lon},6.`);

  body.push(`\nData retrieved from https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=pressure_msl&timezone=auto. Current hour is ${currentHour}.`);

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
