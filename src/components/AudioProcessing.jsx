import { useState, useEffect } from "react";

const AudioProcessing = ({ onAudioProcessed }) => {
    const [audioStream, setAudioStream] = useState(null);
    const [audioData, setAudioData] = useState([]);

    useEffect(() => {
        if (audioStream) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(audioStream);
            microphone.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function analyzeAudio() {
                analyser.getByteFrequencyData(dataArray);

                // Mock pitch, timing, and duration calculations
                const pitch = "C4"; // Placeholder for pitch calculation
                const timing = Date.now();
                const duration = 500; // Placeholder for note duration

                const processedData = { pitch, timing, duration };

                setAudioData([processedData]);
                onAudioProcessed([processedData]);

                requestAnimationFrame(analyzeAudio);
            }

            analyzeAudio();
        }
    }, [audioStream, onAudioProcessed]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioStream(stream);
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };

    const stopRecording = () => {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
    };

    return (
        <div>
            <button onClick={startRecording}>Start Recording</button>
            <button onClick={stopRecording}>Stop Recording</button>
            <div>
                <h3>Audio Data:</h3>
                {audioData.map((data, index) => (
                    <div key={index}>
                        <p>Pitch: {data.pitch}</p>
                        <p>Timing: {data.timing}</p>
                        <p>Duration: {data.duration}ms</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AudioProcessing;
