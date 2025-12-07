// Variable to store the captured JSON
let capturedWorkoutData = null;

// ==================================================
// 0. URL WATCHER (Handle Single Page App Navigation)
// ==================================================
let currentUrl = location.href;

// Check URL every second to see if user navigated
setInterval(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        checkVisibility();
    }
}, 1000);

function checkVisibility() {
    const isWorkoutPage = location.href.includes('hevy.com/workout/');
    const btn = document.getElementById('hevy-workout-tcx-btn');

    if (isWorkoutPage && capturedWorkoutData) {
        if (!btn) createButton(); // Re-create if missing
        else btn.style.display = 'block';
    } else {
        if (btn) btn.style.display = 'none';
    }
}

checkVisibility();

// ==================================================
// 1. INJECT THE INTERCEPTOR SCRIPT
// ==================================================
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove(); // Clean up the tag after injection
};
(document.head || document.documentElement).appendChild(script);

// ==================================================
// 2. LISTEN FOR DATA
// ==================================================
window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window || !event.data || event.data.type !== 'HEVY_WORKOUT_DATA_FOUND') {
        return;
    }

    console.log("[matthewhuie/hevy-workout-tcx] Workout data captured!", event.data.payload);
    capturedWorkoutData = event.data.payload;
    
    // Optional: Visual cue that data is ready
    const btn = document.getElementById('hevy-workout-tcx-btn');
    if (btn) {
        btn.innerText = 'Export TCX';
    }
});

// ==================================================
// 3. CREATE UI
// ==================================================
function createButton() {
    if (document.getElementById('hevy-workout-tcx-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'hevy-workout-tcx-btn';
    btn.innerText = 'Export TCX';
    
    btn.addEventListener('click', handleExport);
    document.body.appendChild(btn);
}

createButton();

// ==================================================
// 4. EXPORT HANDLER
// ==================================================
function handleExport() {
    const btn = document.getElementById('hevy-workout-tcx-btn');

    if (!capturedWorkoutData) {
        alert('[matthewhuie/hevy-workout-tcx] No workout data captured yet.\n\nPlease REFRESH the page so the extension can intercept the network request.');
        return;
    }

    try {
        const tcxString = convertToTCX(capturedWorkoutData);
	const workoutId = capturedWorkoutData.short_id || 'UNKNOWN-ID';
	const filename = `hevy-workout-${workoutId}.tcx`;
        
        downloadFile(tcxString, filename);
    } catch (error) {
        console.error(error);
        alert('[matthewhuie/hevy-workout-tcx] Error converting data: ' + error.message);
    }
}

// ==================================================
// 5. CONVERSION LOGIC (Same as before)
// ==================================================
function convertToTCX(data) {
    const startTsSec = data.start_time || 0;
    const endTsSec = data.end_time || 0;
    const totalSeconds = endTsSec - startTsSec;
    const startTimeIso = new Date(startTsSec * 1000).toISOString();
    const endTimeIso = new Date(endTsSec * 1000).toISOString();

    const biometrics = data.biometrics || {};
    const calories = biometrics.total_calories || 0;
    const hrSamples = biometrics.heart_rate_samples || [];

    // Sort samples
    hrSamples.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    let tcxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:x="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Activities>
    <Activity Sport="Other">
      <Id>${startTimeIso}</Id>
      <Lap StartTime="${startTimeIso}">
        <TotalTimeSeconds>${totalSeconds}</TotalTimeSeconds>
        <DistanceMeters>0.0</DistanceMeters>
        <Calories>${calories}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
`;

    tcxContent += `          <Trackpoint>
            <Time>${startTimeIso}</Time>
            <HeartRateBpm>
              <Value>${Math.round(hrSamples.at(0).bpm)}</Value>
            </HeartRateBpm>
          </Trackpoint>
`;

    hrSamples.forEach(sample => {
        if (sample.timestamp_ms && sample.bpm) {
            tcxContent += `          <Trackpoint>
            <Time>${new Date(sample.timestamp_ms).toISOString()}</Time>
            <HeartRateBpm>
              <Value>${Math.round(sample.bpm)}</Value>
            </HeartRateBpm>
          </Trackpoint>
`;
        }
    });

    tcxContent += `          <Trackpoint>
            <Time>${endTimeIso}</Time>
            <HeartRateBpm>
              <Value>${Math.round(hrSamples.at(-1).bpm)}</Value>
            </HeartRateBpm>
          </Trackpoint>
`;

    tcxContent += `        </Track>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>Hevy</Name>
      </Creator>
      <Extensions>
        <x:LX>
          <ActiveSeconds>${totalSeconds}</ActiveSeconds>
          <ElapsedSeconds>${totalSeconds}</ElapsedSeconds>
          <DistanceMeters>0</DistanceMeters>
          <KiloCalories>${calories}</KiloCalories>
        </x:LX>
      </Extensions>
    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>matthewhuie/hevy-workout-tcx</Name>
  </Author>
</TrainingCenterDatabase>`;

    return tcxContent;
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'application/vnd.garmin.tcx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
