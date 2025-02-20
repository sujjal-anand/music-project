import React, { useState, useRef } from 'react';
import * as Pitchy from 'pitchy';

const CompareMusicXMLWithAudio = () => {
  const [musicXMLFile, setMusicXMLFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Use useRef to create a persistent AudioContext
  const audioContextRef = useRef(new (window.AudioContext || window.webkitAudioContext)());

  // Handle MusicXML file input
  const handleMusicXMLChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setMusicXMLFile(file);
    }
  };

  // Simulate MusicXML parsing and extract mock notes
  const parseMusicXML = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Mock logic for MusicXML parsing - replace with actual parsing logic
        const mockNotes = ['C4', 'E4', 'G4']; // Mock notes extracted from MusicXML
        resolve(mockNotes);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Start recording audio
  const startRecording = () => {
    setIsRecording(true);
    audioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = event => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          setRecordedAudio(audioBlob);
        };

        mediaRecorderRef.current.start();
      })
      .catch(err => {
        console.error("Error accessing microphone:", err);
        setIsRecording(false);
      });
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Analyze recorded audio using Pitchy
// Analyze recorded audio using Pitchy
const analyzeAudioFile = async (audioBlob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;

      try {
        const audioContext = audioContextRef.current;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const sampleRate = audioBuffer.sampleRate;

        // Fixed frame size
        const frameSize = 2048;

        if (audioBuffer.length < frameSize) {
          console.warn("Audio buffer too small for analysis.");
          resolve([]);
          return;
        }

        const detector = Pitchy.PitchDetector.forFloat32Array(frameSize);

        const samples = audioBuffer.getChannelData(0);
        let detectedPitches = [];

        for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
          const frame = samples.slice(i, i + frameSize);

          if (frame.length === frameSize) {
            const [pitch, clarity] = detector.findPitch(frame, sampleRate);

            if (clarity > 0.8 && pitch > 0) {
              detectedPitches.push(pitch);
            }
          }
        }

        resolve(detectedPitches);
      } catch (error) {
        console.error('Error decoding audio buffer:', error);
        reject('Error decoding audio buffer: ' + error);
      }
    };

    reader.onerror = (error) => reject('Error reading file: ' + error);
    reader.readAsArrayBuffer(audioBlob);
  });
};



  // Convert frequency to note name
  const convertFrequencyToNoteName = (frequency) => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pitchClasses = 12;
    const referenceFrequency = 440; // 'A4' frequency
    const distance = Math.round(12 * Math.log2(frequency / referenceFrequency));
    const noteIndex = (distance + 9) % pitchClasses;
    const octave = Math.floor((distance + 9) / pitchClasses) + 4; // Adjusted for correct octave
    return `${notes[noteIndex]}${octave}`;
  };

  // Compare MusicXML and Recorded Audio
  const handleCompare = async () => {
    if (!musicXMLFile || !recordedAudio) {
      alert('Please upload a MusicXML file and record audio.');
      return;
    }

    setLoading(true);

    try {
      const musicXMLNotes = await parseMusicXML(musicXMLFile);
      const audioPitches = await analyzeAudioFile(recordedAudio);

      let matchCount = 0;
      audioPitches.forEach((detectedPitch) => {
        const note = convertFrequencyToNoteName(detectedPitch);
        if (musicXMLNotes.includes(note)) {
          matchCount++;
        }
      });
console.log("comparinggggggg")
      const comparisonScore = (matchCount / musicXMLNotes.length) * 100;
      setComparisonResult(`Similarity: ${comparisonScore.toFixed(2)}%`);
    } catch (error) {
      console.error('Error comparing files:', error);
      setComparisonResult('An error occurred during comparison');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Compare MusicXML with Recorded Audio</h2>
      <div>
        <input type="file" accept=".xml" onChange={handleMusicXMLChange} />
      </div>

      <div>
        {!isRecording ? (
          <button onClick={startRecording}>Start Recording</button>
        ) : (
          <button onClick={stopRecording}>Stop Recording</button>
        )}
        {recordedAudio && <audio controls src={URL.createObjectURL(recordedAudio)}></audio>}
      </div>

      <button onClick={handleCompare} disabled={loading}>
        {loading ? 'Comparing...' : 'Compare'}
      </button>

      {comparisonResult && (
        <div>
          <h3>Comparison Result</h3>
          <p>{comparisonResult}</p>
        </div>
      )}
    </div>
  );
};

export default CompareMusicXMLWithAudio;
