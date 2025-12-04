const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION
// ==========================================
const INPUT_FILENAME = 'input.json';
const OUTPUT_FILENAME = 'output.tcx';

/**
 * Helper to convert Unix timestamp (ms) to TCX ISO string
 * Example: 1764766932000 -> 2025-12-03T13:02:12.000Z
 */
function formatTimestamp(tsMs) {
    return new Date(tsMs).toISOString();
}

/**
 * Main function to create the TCX file
 */
function createTcx() {
    const inputPath = path.join(__dirname, INPUT_FILENAME);
    const outputPath = path.join(__dirname, OUTPUT_FILENAME);

    // 1. Read and Parse JSON
    let data;
    try {
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        data = JSON.parse(fileContent);
    } catch (err) {
        console.error(`Error: Could not read or parse ${INPUT_FILENAME}`);
        console.error(err.message);
        return;
    }

    // 2. Extract Basic Metadata
    // Note: 'start_time' in the JSON is in seconds, we need milliseconds for JS Date
    const startTsSec = data.start_time || 0;
    const endTsSec = data.end_time || 0;
    
    // Calculate total duration in seconds
    const totalSeconds = endTsSec - startTsSec;
    
    // Format start time for the Activity ID (ISO format)
    const startTimeIso = new Date(startTsSec * 1000).toISOString();

    // 3. Extract Heart Rate Samples
    const biometrics = data.biometrics || {};
    const hrSamples = biometrics.heart_rate_samples || [];

    if (hrSamples.length === 0) {
        console.warn("Warning: No heart rate samples found in 'biometrics.heart_rate_samples'.");
    }

    // Sort samples by timestamp just in case
    hrSamples.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    // 4. Build XML String
    let tcxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Activities>
    <Activity Sport="Other">
      <Id>${startTimeIso}</Id>
      <Lap StartTime>${startTimeIso}">
        <TotalTimeSeconds>${totalSeconds}</TotalTimeSeconds>
        <DistanceMeters>0.0</DistanceMeters>
        <Calories>${biometrics.total_calories || 0}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
`;

    // 5. Loop through samples and add Trackpoints
    let count = 0;
    hrSamples.forEach(sample => {
        const tsMs = sample.timestamp_ms;
        const bpm = sample.bpm;

        if (tsMs && bpm) {
            const timeIso = formatTimestamp(tsMs);
            tcxContent += `          <Trackpoint>
            <Time>${timeIso}</Time>
            <HeartRateBpm>
              <Value>${Math.round(bpm)}</Value>
            </HeartRateBpm>
          </Trackpoint>
`;
            count++;
        }
    });

    // 6. Close Tags
    tcxContent += `        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;

    // 7. Write File
    try {
        fs.writeFileSync(outputPath, tcxContent);
        console.log(`Success! Created '${OUTPUT_FILENAME}'`);
        console.log(`Converted ${count} heart rate samples.`);
        console.log(`Workout Date: ${startTimeIso}`);
    } catch (err) {
        console.error(`Error writing file: ${err.message}`);
    }
}

// Run the function
createTcx();
