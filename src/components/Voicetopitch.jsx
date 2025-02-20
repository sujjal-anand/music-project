import React, { useState, useEffect, useRef } from "react";
import { ReactMic } from "react-mic";

const Voicetopitch = () => {
  const [pitch, setPitch] = useState("Waiting...");
  const [frequency, setFrequency] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [soundLevel, setSoundLevel] = useState(0);

  const audioContextRef = useRef(new (window.AudioContext || window.webkitAudioContext)());
  const analyserRef = useRef(audioContextRef.current.createAnalyser());
  const dataArrayRef = useRef(null);

  const bufferLength = 4096; // Larger buffer for better low-frequency resolution

  useEffect(() => {
    dataArrayRef.current = new Float32Array(bufferLength);
    return () => stopListening(); // Cleanup on unmount
  }, []);

  const startListening = () => {
    setIsListening(true);
  };

  const stopListening = () => {
    setIsListening(false);
  };

  const detectPitch = () => {
    if (!analyserRef.current) return;

    analyserRef.current.getFloatTimeDomainData(dataArrayRef.current);
    const frequency = autoCorrelate(dataArrayRef.current, audioContextRef.current.sampleRate);

    if (frequency) {
      setPitch(frequencyToNote(frequency));
      setFrequency(frequency.toFixed(2));
    } else {
      setPitch("No pitch detected.");
    }

    // Update sound level after pitch detection
    updateSoundLevel();
  };

  const updateSoundLevel = () => {
    if (!analyserRef.current) return;

    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i] ** 2;
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length);
    const normalizedSoundLevel = Math.min(rms * 200, 100); // Amplify for better visualization
    setSoundLevel(normalizedSoundLevel);
  };

  const autoCorrelate = (buffer, sampleRate) => {
    const n = buffer.length;
    let rms = 0;

    // Calculate the root mean square (RMS) of the audio buffer
    for (let i = 0; i < n; i++) {
      rms += buffer[i] ** 2;
    }
    rms = Math.sqrt(rms / n);

    // Skip if the audio signal is too weak
    if (rms < 0.01) return null;

    // Set a reasonable threshold based on the RMS
    const threshold = 0.1 * rms;

    // Find the first sample that exceeds the threshold
    let i = 0;
    while (i < n / 2 && buffer[i] < threshold) i++;

    // If no sample exceeds the threshold, return null
    if (i === n / 2) return null;

    // Find the peak of the auto-correlation function
    let peakIndex = i;
    let peakValue = buffer[i];
    i++;
    while (i < n / 2) {
      if (buffer[i] > peakValue) {
        peakIndex = i;
        peakValue = buffer[i];
      }
      i++;
    }

    // Interpolate to find the actual peak position
    const alpha = buffer[peakIndex - 1];
    const beta = buffer[peakIndex];
    const gamma = buffer[peakIndex + 1];
    const denom = alpha - 2 * beta + gamma;
    if (denom === 0) return sampleRate / peakIndex;
    const delta = (alpha - gamma) / (2 * denom);
    const adjustedIndex = peakIndex + delta;

    // Calculate the frequency and ensure it's within a reasonable range
    const frequency = sampleRate / adjustedIndex;
    return frequency > 50 && frequency < 2000 ? frequency : null;
  };

  const frequencyToNote = (frequency) => {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const a4 = 440;
    const midiNote = Math.round(12 * (Math.log2(frequency / a4))) + 69;
    const noteIndex = midiNote % 12;
    const octave = Math.floor(midiNote / 12) - 1;
    return `${notes[noteIndex]}${octave}`;
  };

  const onStop = (recordedBlob) => {
    console.log("Audio Blob: ", recordedBlob);
  };

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold">Voice to Pitch Detector</h2>
      <button
        onClick={isListening ? stopListening : startListening}
        className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
      >
        {isListening ? "Stop Listening" : "Start Listening"}
      </button>
      <h3 className="text-lg mt-4">Detected Pitch: <span className="text-black">{pitch}</span></h3>
      <h3 className="text-lg mt-4">Frequency: {frequency} Hz</h3>
      <div className="mt-4">
        <p>Sound Level: {soundLevel.toFixed(2)}%</p>
        <div
          className="bg-gray-300 h-2 rounded mt-2"
          style={{
            width: `${soundLevel}%`,
            backgroundColor: soundLevel > 50 ? "green" : "red",
            transition: "width 50ms ease-out",
          }}
        />
      </div>

      <ReactMic
        record={isListening}
        onStop={onStop}
        visualSetting="frequencyBars"
        width={400}
        height={100}
        strokeColor="#000000"
        backgroundColor="#ff4081"
        onData={detectPitch}  
      />
    </div>
  );
};

export default Voicetopitch;
