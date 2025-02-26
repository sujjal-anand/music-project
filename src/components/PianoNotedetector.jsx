import React, { useEffect, useState, useRef } from "react";
import Meyda from "meyda";

// Notes Mapping (A4 = 440Hz)
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Convert Frequency to Musical Note
const getNote = (frequency) => {
  if (!frequency) return "N/A";
  const A4 = 440;
  const semitones = Math.round(12 * Math.log2(frequency / A4));
  const noteIndex = (semitones + 9) % 12;
  return NOTES[noteIndex] || "N/A";
};

const PitchDetector = () => {
  const [note, setNote] = useState("Listening...");
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Initialize Audio Context
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create Media Stream Source
        const source = audioContextRef.current.createMediaStreamSource(stream);

        // Create Meyda Analyzer
        analyzerRef.current = Meyda.createMeydaAnalyzer({
          audioContext: audioContextRef.current,
          source: source,
          bufferSize: 512,
          featureExtractors: ["fundamentalFrequency"],  // ✅ Corrected feature
          callback: (features) => {
            if (features?.fundamentalFrequency) {
              setNote(getNote(features.fundamentalFrequency));
            }
          },
        });

        analyzerRef.current.start();
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    };

    setupAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div>
      <h2>🎶 Real-Time Pitch Detector</h2>
      <p>🎵 Detected Note: <strong>{note}</strong></p>
    </div>
  );
};

export default PitchDetector;
