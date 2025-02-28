import React, { useState, useRef, useEffect } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import * as Pitchy from 'pitchy';
import { NOTES } from './Constants';

const CompareMusicXMLWithAudio = () => {
  const [musicXMLFile, setMusicXMLFile] = useState(null);
  const [musicXMLContent, setMusicXMLContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const osmdContainerRef = useRef(null);
  const osmdRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState("");
  const intervalRef = useRef(null);
  const [isComparing, setIsComparing] = useState(false);
  const audioContextRef = useRef(
    new (window.AudioContext || window.webkitAudioContext)()
  );
  const [transitionComplete, setTransitionComplete] = useState(false);
  const [realTimePitches, setRealTimePitches] = useState([]);
  const [micStream, setMicStream] = useState(null);
  const pitchAnalyserRef = useRef(null);
  const recordedPitchesRef = useRef([]);
  const musicXMLNotesRef = useRef([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [unmatchedNotes, setUnmatchedNotes] = useState([]);
  const [minClarity, setMinClarity] = useState(0.8);
  const [isMicrophoneSilent, setIsMicrophoneSilent] = useState(true);
  const [silentThreshold, setSilentThreshold] = useState(0.02);
  const expectedNotesRef = useRef([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [amplitudeThreshold, setAmplitudeThreshold] = useState(0.05);
  const [buttonColor, setButtonColor] = useState('btn-primary');
  const [displayedNotes, setDisplayedNotes] = useState([]);
  const [noteStatuses, setNoteStatuses] = useState({});

  const NOTE_BUFFER_WINDOW = 200;

  const handleMusicXMLChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setMusicXMLFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMusicXMLContent(e.target.result);
        parseMusicXMLAndSetNotes(file);
      };
      reader.readAsText(file);
    }
  };

  const parseMusicXMLAndSetNotes = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(reader.result, 'text/xml');
      const noteElements = xmlDoc.querySelectorAll('note pitch step, note pitch octave');
      let notes = [];
      for (let i = 0; i < noteElements.length; i += 2) {
        const step = noteElements[i].textContent;
        const octave = noteElements[i + 1].textContent;
        notes.push(`${step}${octave}`);
      }

      const initialNoteStatuses = {};
      notes.forEach((note, index) => {
        initialNoteStatuses[`${note}_${index}`] = 'pending';
      });
      setNoteStatuses(initialNoteStatuses);
      setDisplayedNotes(notes);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const loadMusicXML = async (xmlContent) => {
      if (!xmlContent || !osmdContainerRef.current) return;
      setLoading(true);
      try {
        if (osmdRef.current) {
          stopAnimation();
          osmdRef.current.clear();
          osmdRef.current = null;
        }

        const osmd = new OpenSheetMusicDisplay(osmdContainerRef.current, {
          backend: 'svg',
          drawTitle: false,
          drawPartNames: false,
        });
        osmdRef.current = osmd;
        await osmd.load(xmlContent);
        await osmd.render();
        const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

// Find the <per-minute> element inside <metronome>
const perMinuteElement = xmlDoc.querySelector("metronome per-minute");

if (perMinuteElement) {
  const tempoValue = parseFloat(perMinuteElement.textContent);
  setTempo(tempoValue);
  console.log(`🎵 Extracted BPM: ${tempoValue}`);
} else {
  console.warn("⚠️ No <per-minute> found, using default BPM 120.");
  setTempo(120);
}

      } catch (error) {
        console.error('Error rendering MusicXML:', error);
      } finally {
        setLoading(false);
      }
    };

    if (musicXMLContent) {
      loadMusicXML(musicXMLContent);
    }

    return () => {
      if (osmdRef.current) {
        stopAnimation();
        osmdRef.current.clear();
        osmdRef.current = null;
      }
    };
  }, [musicXMLContent]);
console.log(tempo,"s")
  const parseMusicXML = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(reader.result, 'text/xml');
        const noteElements = xmlDoc.querySelectorAll('note');
        let notes = [];

        noteElements.forEach((note) => {
          const step = note.querySelector('pitch step')?.textContent;
          const octave = note.querySelector('pitch octave')?.textContent;
          if (step && octave) {
            notes.push(`${step}${octave}`);
          }
        });

        musicXMLNotesRef.current = notes;
        resolve(notes);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const startRealTimePitchDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      pitchAnalyserRef.current = analyser;

      const sampleRate = audioContext.sampleRate;
      const frameSize = analyser.fftSize;
      const detector = Pitchy.PitchDetector.forFloat32Array(frameSize);
      const input = new Float32Array(analyser.fftSize);

      const calculateAverageAmplitude = (data) => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += Math.abs(data[i]);
        }
        return sum / data.length;
      };

      const matchFrequencyToNote = (frequency) => {
        if (frequency <= 0) return null;

        let closestNote = null;
        let minDifference = Infinity;

        for (const noteObj of NOTES) {
          const difference = Math.abs(noteObj.freq - frequency);
          if (difference < minDifference) {
            minDifference = difference;
            closestNote = noteObj.note;
          }
        }
        return closestNote;
      };

      const detectPitch = () => {
        analyser.getFloatTimeDomainData(input);
        const averageAmplitude = calculateAverageAmplitude(input);
        if (averageAmplitude < silentThreshold) {
          setIsMicrophoneSilent(true);
          return;
        } else {
          setIsMicrophoneSilent(false);
        }
        if (averageAmplitude < amplitudeThreshold) return;

        const [pitch, clarity] = detector.findPitch(input, sampleRate);
        if (pitch > 0 && clarity > minClarity) {
          const matchedNote = matchFrequencyToNote(pitch);

          if (matchedNote) {
            recordedPitchesRef.current = [...recordedPitchesRef.current, matchedNote];

            const expectedNotes = expectedNotesRef.current;
            const isMatch = expectedNotes.includes(matchedNote);
            setCurrentMatch(isMatch);
            setButtonColor(isMatch ? "btn-success" : "btn-danger");

            setDebugInfo(
              `Detected: ${matchedNote}, Expected: ${expectedNotes.join(
                ", "
              )}, Clarity: ${clarity.toFixed(
                2
              )}, Amplitude: ${averageAmplitude.toFixed(2)}, Match: ${isMatch}`
            );
          }
        }
      };

      intervalRef.current = setInterval(detectPitch, 50);
    } catch (error) {
      console.error("Error starting real-time pitch detection:", error);

      if (error.name === "NotAllowedError") {
        console.error("Microphone permission denied by user.");
        alert("Please allow microphone access to use this feature.");
      } else if (error.name === "NotFoundError") {
        console.error("No microphone found.");
        alert("No microphone detected. Please connect a microphone.");
      } else {
        console.error(
          "An error occurred while accessing the microphone:",
          error
        );
        alert("An error occurred while accessing the microphone.");
      }
    }
  };

  const stopRealTimePitchDetection = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }
    pitchAnalyserRef.current = null;
  };

  const handleCompare = async () => {
    if (!musicXMLFile) {
      alert('Please upload a MusicXML file.');
      return;
    }

    if (isComparing) {
      return;
    }

    setIsComparing(true);
    setTransitionComplete(false);
    setRealTimePitches([]);
    recordedPitchesRef.current = [];
    setButtonColor('btn-primary');
    setComparisonResult(null);

    await parseMusicXML(musicXMLFile);
    await startRealTimePitchDetection();

    const initialNoteStatuses = {};
    displayedNotes.forEach((note, index) => {
      initialNoteStatuses[`${note}_${index}`] = 'pending';
    });
    setNoteStatuses(initialNoteStatuses);

    startAnimation(() => {
      setTransitionComplete(true);
      setTimeout(() => {
        processNotes();
      }, 500);
    });
  };

  useEffect(() => {
    if (comparisonResult) {
      stopRealTimePitchDetection();
      setIsComparing(false);
    }
  }, [comparisonResult]);

 const processNotes = async () => {
  setLoading(true);
  console.log("🚀 Starting the comparison process...");

  try {
    const musicXMLNotes = [...musicXMLNotesRef.current]; // Keep an array of expected notes
    const detectedPitches = [...recordedPitchesRef.current]; // List of recorded notes

    let matchCount = 0;
    let unmatched = [];
    let newNoteStatuses = {};
    let detectedIndex = 0; // Tracks sequential detection

    musicXMLNotes.forEach((expectedNote, index) => {
      const noteKey = `${expectedNote}_${index}`;

      // Check if the expected note is present at the correct sequence position
      if (detectedIndex < detectedPitches.length && detectedPitches[detectedIndex] === expectedNote) {
        newNoteStatuses[noteKey] = "matched";
        matchCount++;
        console.log(`✅ Matched: ${expectedNote}`);
        detectedIndex++; // Move to the next detected note
      } else {
        // If not matched at the expected position, mark as unmatched
        newNoteStatuses[noteKey] = "unmatched";
        unmatched.push(expectedNote);
        console.log(`❌ Missed: ${expectedNote}`);
      }
    });

    setNoteStatuses(newNoteStatuses);
    setUnmatchedNotes(unmatched);

    // Calculate the similarity score
    const rawScore = (matchCount / musicXMLNotes.length) * 100;
    setComparisonResult(`Similarity: ${Math.min(rawScore, 100).toFixed(2)}%`);
  } catch (error) {
    console.error("Error comparing files:", error);
    setComparisonResult("An error occurred during comparison");
  } finally {
    setLoading(false);
    console.log("✅ Comparison process completed.");
  }
};


  const noteToUnicode = {
    'C': 'C',
    'C#': 'C#',
    'D': 'D',
    'D#': 'D#',
    'E': 'E',
    'F': 'F',
    'F#': 'F#',
    'G': 'G',
    'G#': 'G#',
    'A': 'A',
    'A#': 'A#',
    'B': 'B',
  };

  const startAnimation = (onAnimationComplete) => {
    if (!osmdRef.current) return;

    osmdRef.current.cursor.reset();
    osmdRef.current.cursor.show();
    setIsPlaying(true);

    const musicXMLNotes = musicXMLNotesRef.current;
    let noteIndex = 0;
    const intervalTime = (60 / (tempo || 120)) * 1000 ;
    const matchedNoteIndices = new Set();

    intervalRef.current = setInterval(() => {
      if (!osmdRef.current.cursor || osmdRef.current.cursor.iterator.endReached) {
        stopAnimation();
        onAnimationComplete();
        return;
      }

      const currentVoiceEntries = osmdRef.current.cursor.iterator.CurrentVoiceEntries;
console.log(osmdRef.current.cursor.iterator.CurrentVoiceEntries[0].timestamp, "current timestamp");
      let extractedNotes = [];

      if (currentVoiceEntries?.length) {
        currentVoiceEntries.forEach((voiceEntry, entryIndex) => {
          if (voiceEntry?.Notes?.length) {
            voiceEntry.Notes.forEach((note, noteIdx) => {
              if (note?.Pitch) {
                const step = note.Pitch.step || "UnknownStep";
                const octave = note.Pitch.octave !== undefined ? note.Pitch.octave : "UnknownOctave";
                const extractedNote = `${step}${octave}`;
                extractedNotes.push(extractedNote);
              } else {
                console.warn(`⚠️ No Pitch found in Note ${noteIdx}`);
              }
            });
          } else {
            console.warn(`⚠️ No Notes in VoiceEntry ${entryIndex}`);
          }
        });
      }

      expectedNotesRef.current = extractedNotes;

      if (musicXMLNotes?.length && noteIndex + extractedNotes.length <= musicXMLNotes.length) {
        const currentNotes = musicXMLNotes.slice(noteIndex, noteIndex + extractedNotes.length);

        console.log("✅ Parsing Notes in Sequence:", currentNotes);

        currentNotes.forEach((currentNote, idx) => {
          const globalNoteIndex = noteIndex + idx;
          const noteKey = `${currentNote}_${globalNoteIndex}`;

          if (matchedNoteIndices.has(globalNoteIndex)) {
            return;
          }

          const wasNotePlayed = recordedPitchesRef.current.some(
            pitch => pitch === currentNote
          );

          if (wasNotePlayed) {
            matchedNoteIndices.add(globalNoteIndex);
            setNoteStatuses(prevStatuses => ({
              ...prevStatuses,
              [noteKey]: "matched"
            }));
          } else {
            setNoteStatuses(prevStatuses => ({
              ...prevStatuses,
              [noteKey]: "unmatched"
            }));
          }
          // Real-time comparison and logging here:
          console.log(`Comparing (Real-time) MusicXML note: ${currentNote} with recorded pitches: ${recordedPitchesRef.current.join(', ')}`);
        });

        recordedPitchesRef.current = [];
        noteIndex += extractedNotes.length;
      }

      osmdRef.current.cursor.next();
      if (osmdRef.current.cursor.iterator.endReached) {
        stopAnimation();
        onAnimationComplete();
      }
    }, intervalTime);
  };

  const stopAnimation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    if (osmdRef.current?.cursor) {
      osmdRef.current.cursor.hide();
    }
  };

  const toggleShowDebug = () => {
    setShowDebug(!showDebug);
  };

  return (
    <div
      className="container-fluid bg-dark text-white vh-100 d-flex justify-content-center align-items-center"
      style={{ width: '100vw', margin: '0', padding: '0', overflow: 'hidden' }}
    >
      <div className="w-75 p-5">
        <h2 className="mb-4 text-center">Compare MusicXML with Real-time Audio</h2>
        <div className="mb-3">
          <input
            type="file"
            accept=".xml"
            onChange={handleMusicXMLChange}
            className="form-control bg-secondary text-white"
          />
        </div>
        <div>
          {displayedNotes.map((note, index) => {
            const noteName = note.slice(0, -1);
            const octave = note.slice(-1);
            const unicodeNote = noteToUnicode[noteName] || noteName;
            const noteKey = `${note}_${index}`;
            const isMatched = noteStatuses[noteKey] === 'matched';
            const isUnmatched = noteStatuses[noteKey] === 'unmatched';
            const noteStyle = {
              color: isMatched ? 'green' : isUnmatched ? 'red' : 'inherit',
            };
            return (
              <span key={noteKey} style={noteStyle}>
                {unicodeNote}{octave}
                {index < displayedNotes.length - 1 && ', '}
              </span>
            );
          })}
        </div>

        <div
          ref={osmdContainerRef}
          className="border rounded p-3 mb-3 bg-secondary"
          style={{ height: '300px' }}
        ></div>
        <div className="text-center">
          <button
            onClick={handleCompare}
            disabled={loading || isComparing}
            className={`btn ${buttonColor} me-2`}
          >
            {loading
              ? 'Comparing...'
              : isComparing
                ? 'Transitioning...'
                : 'Compare'}
          </button>
          <button
            onClick={toggleShowDebug}
            className="btn btn-info me-2"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>
        <div className="mb-3">
        </div>
        {showDebug && (
          <div className="mt-4 alert alert-warning">
            <h4>Debug Information:</h4>
            <p>{debugInfo}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareMusicXMLWithAudio;
