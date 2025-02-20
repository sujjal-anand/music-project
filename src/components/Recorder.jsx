import { useEffect, useState, useRef } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { ReactMic } from "react-mic";
import Pitchfinder from "pitchfinder";
import "bootstrap/dist/css/bootstrap.min.css";

const Music = () => {
  const [osmd, setOsmd] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const intervalRef = useRef(null);
  const pitchDataRef = useRef([]);
  const detectPitch = new Pitchfinder.YIN();
  const sampleRate = 44100;

navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log("✅ Microphone access granted"))
  .catch(err => console.error("❌ Microphone access error:", err));


  useEffect(() => {
    const fileInput = document.getElementById("fileInput");
    const osmdContainer = document.getElementById("osmdContainer");
    if (!fileInput || !osmdContainer) return;

    const handleFileInput = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          renderMusicXML(e.target.result);
        }
      };
      reader.readAsText(file);
    };

    fileInput.addEventListener("change", handleFileInput);

    function renderMusicXML(xmlContent) {
      const newOsmd = new OpenSheetMusicDisplay(osmdContainer, {
        backend: "svg",
        drawTitle: false,
        drawPartNames: false,
      });

      newOsmd
        .load(xmlContent)
        .then(() => {
          newOsmd.render();
          newOsmd.cursor.show();
          setOsmd(newOsmd);
          extractTempo(xmlContent);
        })
        .catch((error) => {
          console.error("Error rendering MusicXML:", error);
        });
    }

    function extractTempo(xmlContent) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

      const tempoNode = xmlDoc.querySelector("sound[tempo]");
      let extractedTempo = tempoNode
        ? parseFloat(tempoNode.getAttribute("tempo") || "120")
        : null;

      if (!extractedTempo) {
        const beatUnit = xmlDoc.querySelector("per-minute");
        if (beatUnit) {
          extractedTempo = parseFloat(beatUnit.textContent || "120");
        }
      }
      setTempo(extractedTempo || 120);
    }

    return () => {
      fileInput.removeEventListener("change", handleFileInput);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

 const onData = (recordingData) => {
  const rawData = new Float32Array(recordingData.buffer);

  if (rawData.length === 0) {
    console.warn("No audio data received.");
    return;
  }

  console.log("Audio Data Sample:", rawData.slice(0, 10));

  if (!rawData.some(value => value !== 0)) {
    console.warn("Audio data contains only zeros.");
    return;
  }

  const pitch = detectPitch(rawData);

  console.log("Detected pitch:", pitch);

  if (pitch) {
    const midiNote = Math.round(69 + 12 * Math.log2(pitch / 440));
    pitchDataRef.current = [...pitchDataRef.current.slice(-4), midiNote];
    const frequentNote = getFrequentNote(pitchDataRef.current);

    if (frequentNote) {
      matchPitchWithMusic(frequentNote);
    }
  } else {
    console.warn("Pitch detection returned null.");
  }
};

  
  
  
  navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log("✅ Microphone access granted"))
  .catch(err => console.error("❌ Microphone access error:", err));

  const getFrequentNote = (notes) => {
    const frequency = {};
    let maxFreq = 0;
    let mostFrequentNote = null;

    notes.forEach(note => {
      frequency[note] = (frequency[note] || 0) + 1;
      if (frequency[note] > maxFreq) {
        maxFreq = frequency[note];
        mostFrequentNote = note;
      }
    });

    return maxFreq >= 2 ? mostFrequentNote : null;
  };

  const matchPitchWithMusic = (detectedMidi) => {
  if (!osmd?.cursor?.iterator?.currentVoiceEntries?.length) {
    console.log("No current voice entries, skipping match.");
    return;
  }

  try {
    const currentNotes = osmd.cursor.iterator.currentVoiceEntries
      .map(entry => entry.notes)
      .flat()
      .map(note => note.halfTone);

    console.log("Current notes in sheet music:", currentNotes);

    const isMatch = currentNotes.some(note => Math.abs(note - detectedMidi) <= 1);

    if (isMatch) {
      console.log("🎵 Matched Note:", detectedMidi);

      const alertDiv = document.createElement('div');
      alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
      `;
      alertDiv.textContent = `🎵 Matched Note: ${detectedMidi}`;
      document.body.appendChild(alertDiv);

      setTimeout(() => {
        if (document.body.contains(alertDiv)) {
          document.body.removeChild(alertDiv);
        }
      }, 1000);
    } else {
      console.log("No match found.");
    }
  } catch (error) {
    console.error("Error matching pitch:", error);
  }
};

  
  
  const onStop = (recordedBlob) => {
    console.log("Final Recording Blob:", recordedBlob);
    setAudioBlob(recordedBlob.blob);
  };

 const playAnimation = () => {
  if (!osmd) return;
  osmd.cursor.reset();
  osmd.cursor.show();
  setIsPlaying(true);
  setRecording(true); // ✅ Start microphone recording when play starts

  const intervalTime = (60 / (tempo || 120)) * 1000;

  intervalRef.current = setInterval(() => {
    if (!osmd.cursor || !osmd.cursor.iterator.currentVoiceEntries.length) {
      stopAnimation();
      return;
    }
    osmd.cursor.next();
    if (!osmd.cursor.iterator.currentMeasure || osmd.cursor.iterator.endReached) {
      stopAnimation();
    }
  }, intervalTime);
};


const stopAnimation = () => {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  setIsPlaying(false);
  setRecording(false); // ✅ Stop microphone recording when playback stops

  if (osmd?.cursor) osmd.cursor.hide();
};



  

  return (
    <div className="container py-4">
      <div className="row">
        <div className="col text-center">
          <h1 className="display-5 fw-bold">MusicXML Sheet Music Renderer</h1>
        </div>
      </div>

      <div className="row align-items-center mt-4">
        <div className="col-md-4 text-center">
          <input id="fileInput" type="file" accept=".xml,.musicxml" className="form-control" />
        </div>
        <div className="col-md-8">
          <div
            id="osmdContainer"
            className="border rounded p-4 bg-white shadow"
            style={{ width: "100vh", height: "300px", margin: "20px auto" }}
          ></div>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col text-center">
          {tempo !== null && <p>Tempo: {tempo} BPM</p>}
          <button
            className={`btn ${isPlaying ? "btn-secondary" : "btn-primary"} mx-2`}
            onClick={isPlaying ? stopAnimation : playAnimation}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col text-center">
        <ReactMic
  record={recording} // ✅ Now controlled by play/stop functions
  className="sound-wave"
  onStop={onStop}
  onData={onData}
  strokeColor="#000000"
  backgroundColor="#FF4081"
  mimeType="audio/webm"
  bufferSize={8192}  // ✅ Increased for better analysis
  sampleRate={48000} // ✅ More precise pitch detection
  timeSlice={200}    // ✅ More stable pitch tracking
/>
        </div>
      </div>

      
    </div>
  );
};

export default Music;