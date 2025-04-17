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

///////
// Create a chart image from today's pressure values
const context = new DrawContext();
const width = 600;
const height = 300;
context.size = new Size(width, height);
context.opaque = false;
context.setTextAlignedCenter();
context.setFont(Font.mediumSystemFont(12));

// Background
context.setFillColor(Color.white());
context.fillRect(new Rect(0, 0, width, height));

// Axes
context.setStrokeColor(Color.black());
context.setLineWidth(1);
context.strokeLine(new Point(40, 20), new Point(40, height - 30)); // y-axis
context.strokeLine(new Point(40, height - 30), new Point(width - 10, height - 30)); // x-axis

// Plot pressure points
const marginX = 40;
const marginY = 30;
const graphWidth = width - marginX - 10;
const graphHeight = height - marginY - 20;

const scaleX = graphWidth / (todayPressures.length - 1);
const scaleY = graphHeight / (maxPressure - minPressure);

context.setStrokeColor(Color.blue());
context.setLineWidth(2);

for (let i = 0; i < todayPressures.length - 1; i++) {
  const x1 = marginX + i * scaleX;
  const y1 = height - marginY - (todayPressures[i].pressure - minPressure) * scaleY;
  const x2 = marginX + (i + 1) * scaleX;
  const y2 = height - marginY - (todayPressures[i + 1].pressure - minPressure) * scaleY;
  context.strokeLine(new Point(x1, y1), new Point(x2, y2));
}

// Save image to file
const image = context.getImage();
const fm = FileManager.local();
const filename = "pressure-graph.png";
const filepath = fm.joinPath(fm.temporaryDirectory(), filename);
fm.writeImage(filepath, image);
//////

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
      title: "Critical Pressure Drops Today",
      body: body.join("\n"),
      attachment: filepath
    }
  };
  
  Script.setShortcutOutput(JSON.stringify(output));
}
