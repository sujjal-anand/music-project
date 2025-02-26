import React, { useState, useRef, useEffect } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import * as Pitchy from 'pitchy';

const CompareMusicXMLWithAudio = () => {
  const [musicXMLFile, setMusicXMLFile] = useState(null);
  const [musicXMLContent, setMusicXMLContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const osmdContainerRef = useRef(null);
  const osmdRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
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
  const [minClarity, setMinClarity] = useState(0.8); // Increased minimum clarity for piano
  const [isMicrophoneSilent, setIsMicrophoneSilent] = useState(true);
  const [backgroundNoiseLevel, setBackgroundNoiseLevel] = useState(0); // Background noise level
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0); // Track the current note index
  const [notesPlayed, setNotesPlayed] = useState(0); // Track the number of notes played
  const [matchCount, setMatchCount] = useState(0); // Track number of correctly matched notes
  const [silentThreshold, setSilentThreshold] = useState(0.02); // Adjusted silent threshold
  const [voiceOrPianoThreshold, setVoiceOrPianoThreshold] = useState(0.35); // Adjusted voice/piano threshold for piano
  const expectedNotesRef = useRef([]); // Store expected notes based on cursor
  const [showDebug, setShowDebug] = useState(false); // Debugging toggle
  const [debugInfo, setDebugInfo] = useState(''); // Debug info to display
  const [amplitudeThreshold, setAmplitudeThreshold] = useState(0.05); // Adjusted amplitude threshold
  const [buttonColor, setButtonColor] = useState('btn-primary');
  const [animationSpeed, setAnimationSpeed] = useState(1.1); // Speed multiplier for animation
  const [pianoNoteRange, setPianoNoteRange] = useState({ min: 'C2', max: 'C7' }); //Focus on piano note range
  const [displayedNotes, setDisplayedNotes] = useState([]);
  const [noteStatuses, setNoteStatuses] = useState({}); // Track status of each note

  // Function to handle MusicXML file change
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

      // Initialize note statuses with unique keys
      const initialNoteStatuses = {};
      notes.forEach((note, index) => {
        initialNoteStatuses[`${note}_${index}`] = 'pending';
      });
      setNoteStatuses(initialNoteStatuses);
    //   console.log("initialNoteStatuses",initialNoteStatuses)
      setDisplayedNotes(notes);
    };
    reader.readAsText(file);
  };

  // Effect to initialize and update OSMD
  useEffect(() => {
    const loadMusicXML = async (xmlContent) => {
      if (!xmlContent || !osmdContainerRef.current) return;
      setLoading(true);
      try {
        // Dispose of the old OSMD instance if it exists
        if (osmdRef.current) {
          stopAnimation();
          osmdRef.current.clear();
          osmdRef.current = null;
        }
        // Initialize OSMD
        const osmd = new OpenSheetMusicDisplay(osmdContainerRef.current, {
          backend: 'svg',
          drawTitle: false,
          drawPartNames: false,
        });
        osmdRef.current = osmd;
        await osmd.load(xmlContent);
        await osmd.render();
        // Extract tempo from MusicXML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        const tempoElement = xmlDoc.querySelector('sound[tempo]');
        if (tempoElement) {
          const tempoValue = parseFloat(tempoElement.getAttribute('tempo'));
          setTempo(tempoValue);
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

 const parseMusicXML = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(reader.result, 'text/xml');

      // Select all 'note' elements
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


  const convertFrequencyToNoteName = (frequency) => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pitchClasses = 12;
    const referenceFrequency = 440;
    const distance = Math.round(12 * Math.log2(frequency / referenceFrequency));
    const noteIndex = (distance + 9) % pitchClasses;
    const octave = Math.floor((distance + 9) / pitchClasses) + 4;
    return `${notes[noteIndex]}${octave}`;
  };

  const isWithinPianoRange = (note) => {
    const noteToMidi = (note) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const noteName = note.slice(0, -1);
      const octave = parseInt(note.slice(-1));
      const noteIndex = notes.indexOf(noteName);
      if (noteIndex === -1) {
        return -1; // Invalid note
      }
      return 12 * (octave + 1) + noteIndex;
    };
    const minMidi = noteToMidi(pianoNoteRange.min);
    const maxMidi = noteToMidi(pianoNoteRange.max);
    const currentMidi = noteToMidi(note);
    return currentMidi >= minMidi && currentMidi <= maxMidi;
  };
//
  // Function to start real-time pitch detection
  const startRealTimePitchDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      const audioContext = audioContextRef.current;
      // Check and resume AudioContext if it's suspended (autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      pitchAnalyserRef.current = analyser;
      const sampleRate = audioContext.sampleRate;
      const frameSize = 2048;
      const detector = Pitchy.PitchDetector.forFloat32Array(frameSize);
      const input = new Float32Array(analyser.fftSize);
      // Function to calculate the average amplitude
      const calculateAverageAmplitude = (data) => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += Math.abs(data[i]);
        }
        return sum / data.length;
      };
 
      const detectPitch = () => {
        analyser.getFloatTimeDomainData(input);
        const averageAmplitude = calculateAverageAmplitude(input); // Get current amplitude
        detector.minVolumeAbsolute = 0.1;
        // detector.maxInputAmplitude = 0.6;
        const [pitch, clarity] = detector.findPitch(input, sampleRate);
        console.log("Pitch:", pitch, "Clarity:", clarity);
        //Silence Detection
        // if (averageAmplitude < silentThreshold) {
        //   setIsMicrophoneSilent(true);
        //   return;
        // } else {
        //   setIsMicrophoneSilent(false);
        // }
        // if (averageAmplitude < amplitudeThreshold) {
        //   return; //Skip very low amplitudes
        // }
        // // Voice/Piano discrimination using amplitude threshold
        // if (averageAmplitude < voiceOrPianoThreshold) {
        //   return;
        // }
        if (pitch > 0) {
          const note = convertFrequencyToNoteName(pitch);
          console.log("note:", note);
          // Only consider notes within the piano range
          if (isWithinPianoRange(note)) {
            recordedPitchesRef.current = [...recordedPitchesRef.current, note]; // Store the note
            //Get expected notes
            const expectedNotes = expectedNotesRef.current;
            const isMatch = expectedNotes.includes(note);
            setCurrentMatch(isMatch);
            // Update button color here
            if (isMatch === true) {
              setButtonColor("btn-success");
            } else if (isMatch === false) {
              setButtonColor("btn-danger");
            } else {
              setButtonColor("btn-primary");
            }
            setDebugInfo(
              `Detected: ${note}, Expected: ${expectedNotes.join(
                ", "
              )}, Clarity: ${clarity.toFixed(
                2
              )}, Amplitude: ${averageAmplitude.toFixed(2)}, Match: ${isMatch}`
            );
          }
        }
      };
 
      intervalRef.current = setInterval(detectPitch, 50); // Adjust interval as needed
    } catch (error) {
      console.error("Error starting real-time pitch detection:", error);
      // More specific error handling
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

  // Function to stop real-time pitch detection
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

    // Prevent multiple comparisons from running simultaneously
    if (isComparing) {
      return;
    }

    setIsComparing(true);
    setTransitionComplete(false);
    setRealTimePitches([]); // Clear previous real-time pitches
    recordedPitchesRef.current = []; // Clear ref
    setButtonColor('btn-primary'); // Reset button color on new comparison
    setComparisonResult(null); // Clear previous comparison result

    await parseMusicXML(musicXMLFile); // Parse MusicXML to get notes

    // Start real-time pitch detection when animation starts
    await startRealTimePitchDetection();

    // Reset note statuses to 'pending' before starting the animation
    const initialNoteStatuses = {};
    displayedNotes.forEach((note, index) => {
      initialNoteStatuses[`${note}_${index}`] = 'pending';
    });
    setNoteStatuses(initialNoteStatuses);

    startAnimation(() => {
      setTransitionComplete(true);
      setTimeout(() => {
        performComparison();
      }, 500);
    });
  };

  useEffect(() => {
    if (comparisonResult) {
      // Stop mic when comparison result is displayed
      stopRealTimePitchDetection();
      setIsComparing(false); // Also set isComparing to false
    }
  }, [comparisonResult]);

  const performComparison = async () => {
    setLoading(true);
    try {
      const musicXMLNotes = musicXMLNotesRef.current;
      const detectedPitches = recordedPitchesRef.current;
      let matchCount = 0;
      const unmatched = [];
      const newNoteStatuses = { ...noteStatuses };

      musicXMLNotes.forEach((musicXMLNote, index) => {
        // Create a unique key using both note and its index
        const noteKey = `${musicXMLNote}_${index}`;

        if (!detectedPitches.includes(musicXMLNote)) {
          unmatched.push(musicXMLNote);
          newNoteStatuses[noteKey] = 'unmatched';
        } else {
          matchCount++;
          newNoteStatuses[noteKey] = 'matched';
        }
      });

      setUnmatchedNotes(unmatched);
      setNoteStatuses(newNoteStatuses);
      const rawScore = (matchCount / musicXMLNotes.length) * 100;
      const comparisonScore = Math.min(rawScore, 100);
      setComparisonResult(`Similarity: ${comparisonScore.toFixed(2)}%`);
    } catch (error) {
      console.error('Error comparing files:', error);
      setComparisonResult('An error occurred during comparison');
    } finally {
      setLoading(false);
    }
  };

  // Mapping Unicode characters to notes
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

  // Modified startAnimation to update noteStatuses
const startAnimation = (onAnimationComplete) => {
    if (!osmdRef.current) return;

    osmdRef.current.cursor.reset();
    osmdRef.current.cursor.show();
    setIsPlaying(true);

    console.log("osmdRef.current.cursor",osmdRef.current.cursor)

    const musicXMLNotes = musicXMLNotesRef.current;
    let noteIndex = 0; // Track the current note index
    const intervalTime = (60 / (tempo || 120)) * 1000 * animationSpeed;

    intervalRef.current = setInterval(() => {
        if (!osmdRef.current.cursor || osmdRef.current.cursor.iterator.endReached) {
            stopAnimation();
            onAnimationComplete();
            return;
        }

        // Get current voice entries (notes being played at cursor position)
        const currentVoiceEntries = osmdRef.current.cursor.iterator.CurrentVoiceEntries;
        let extractedNotes = [];

        if (currentVoiceEntries?.length) {
            currentVoiceEntries.forEach((voiceEntry, entryIndex) => {
                if (voiceEntry?.Notes?.length) {
                    voiceEntry.Notes.forEach((note, noteIdx) => {
                        if (note?.Pitch) {
                            const step = note.Pitch.step || "UnknownStep"; // Default to avoid undefined
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

        // Store and log extracted notes
        expectedNotesRef.current = extractedNotes;
        console.log("✅ Corrected Expected Notes:", extractedNotes);

        // Ensure `currentNote` size matches `extractedNotes`
        if (musicXMLNotes?.length && noteIndex + extractedNotes.length <= musicXMLNotes.length) {
            const currentNotes = musicXMLNotes.slice(noteIndex, noteIndex + extractedNotes.length); // Get same number of notes
            console.log("currentNotes", currentNotes);

            currentNotes.forEach((currentNote, idx) => {
                const noteKey = `${currentNote}_${noteIndex + idx}`; // Unique key
                const isMatched = recordedPitchesRef.current.includes(currentNote);

                setNoteStatuses((prevStatuses) => ({
                    ...prevStatuses,
                    [noteKey]: isMatched ? "matched" : "unmatched",
                }));
            });

            noteIndex += extractedNotes.length; // Move index forward correctly
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

  const togglePlay = () => {
    if (isPlaying) {
      stopAnimation();
    } else {
      startAnimation(() => { }); // Empty callback here as we don't need specific action
    }
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
            // Use the index in the unique key for the status lookup
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
            onClick={() => setShowDebug(!showDebug)}
            className="btn btn-info me-2"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>
        <div className="mb-3">
          {/* <label className="form-label">Animation Speed:</label>
          <input
            type="number"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value))}
            className="form-control bg-secondary text-white"
          /> */}
        </div>
        {transitionComplete && comparisonResult && (
          <div className="mt-4 alert alert-secondary text-center">
            <h3>Comparison Result</h3>
            <p>{comparisonResult}</p>
            {unmatchedNotes.length > 0 && (
              <div className="mt-3">
                <h4>Unmatched Notes:</h4>
                <p className="unmatched-note">{unmatchedNotes.join(', ')}</p>
              </div>
            )}
          </div>
        )}
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
