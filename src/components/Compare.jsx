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
    const audioContextRef = useRef(new (window.AudioContext || window.webkitAudioContext)());
    const [transitionComplete, setTransitionComplete] = useState(false);
    const [realTimePitches, setRealTimePitches] = useState([]);
    const [micStream, setMicStream] = useState(null);
    const pitchAnalyserRef = useRef(null);
    const animationCallbackRef = useRef(null); // useRef to hold the animation callback
    const recordedPitchesRef = useRef([]);  // Ref to hold pitches

    // Function to handle MusicXML file change
    const handleMusicXMLChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setMusicXMLFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setMusicXMLContent(e.target.result);
            };
            reader.readAsText(file);
        }
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
                const mockNotes = ['C4', 'E4', 'G4']; // Mock notes extracted from MusicXML
                resolve(mockNotes);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const startRecording = () => {
        setIsRecording(true);
    };

    const stopRecording = () => {
        setIsRecording(false);
    };

    const onStop = (recordedBlob) => {
        setRecordedAudio(recordedBlob.blob);
    };

    const analyzeAudioFile = async (audioBlob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;

                try {
                    const audioContext = audioContextRef.current;
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const sampleRate = audioBuffer.sampleRate;
                    const frameSize = 2048;

                    if (audioBuffer.length < frameSize) {
                        console.warn('Audio buffer too small for analysis.');
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

    const convertFrequencyToNoteName = (frequency) => {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const pitchClasses = 12;
        const referenceFrequency = 440;
        const distance = Math.round(12 * Math.log2(frequency / referenceFrequency));
        const noteIndex = (distance + 9) % pitchClasses;
        const octave = Math.floor((distance + 9) / pitchClasses) + 4;
        return `${notes[noteIndex]}${octave}`;
    };

    // Function to start real-time pitch detection
    const startRealTimePitchDetection = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMicStream(stream);

            const audioContext = audioContextRef.current;

            // Check and resume AudioContext if it's suspended (autoplay policy)
            if (audioContext.state === 'suspended') {
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

            const detectPitch = () => {
                analyser.getFloatTimeDomainData(input);
                const [pitch, clarity] = detector.findPitch(input, sampleRate);

                // Debugging logs
                console.log("Pitch:", pitch, "Clarity:", clarity);  // ADDED

                if (clarity > 0.5 && pitch > 0) {  // Reduced clarity threshold
                    //  setRealTimePitches((prevPitches) => [...prevPitches, pitch]);
                    recordedPitchesRef.current = [...recordedPitchesRef.current, pitch];  // Use ref
                    console.log("Pitches in ref:", recordedPitchesRef.current);  // Log pitches in ref

                }
            };

            intervalRef.current = setInterval(detectPitch, 50); // Adjust interval as needed
        } catch (error) {
            console.error('Error starting real-time pitch detection:', error);

            // More specific error handling
            if (error.name === 'NotAllowedError') {
                console.error('Microphone permission denied by user.');
                alert('Please allow microphone access to use this feature.');
            } else if (error.name === 'NotFoundError') {
                console.error('No microphone found.');
                alert('No microphone detected. Please connect a microphone.');
            } else {
                console.error('An error occurred while accessing the microphone:', error);
                alert('An error occurred while accessing the microphone.');
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

        setIsComparing(true);
        setTransitionComplete(false);
        setRealTimePitches([]); // Clear previous real-time pitches
        recordedPitchesRef.current = [];  // Clear ref

        // Wrap startAnimation in a Promise to handle completion
        new Promise((resolve) => {
            startAnimation(() => {
                // This will be the callback executed at the end of the animation.
                setTransitionComplete(true);
                resolve(); // Resolve the promise when animation is complete
            });
        }).then(() => {
            // ADD DELAY HERE
            setTimeout(() => {
                performComparison();
                stopRealTimePitchDetection(); //  stop mic here bcz transition complete
            }, 500); // Adjust the delay (in milliseconds) as needed (e.g., 500ms)
        });

        startRealTimePitchDetection(); // Start real-time pitch detection when animation starts
    };

    const performComparison = async () => {
        setLoading(true);

        try {
            const musicXMLNotes = await parseMusicXML(musicXMLFile);
            // const audioPitches = await analyzeAudioFile(recordedAudio); // No longer using recorded audio
            console.log(musicXMLNotes, "musicXMLnotes");

            // Access pitches from ref
            const detectedPitches = recordedPitchesRef.current;
            console.log("realTimePitches from ref:", detectedPitches);

            let matchCount = 0;
            detectedPitches.forEach((detectedPitch) => {
                const note = convertFrequencyToNoteName(detectedPitch);
                if (musicXMLNotes.includes(note)) {
                    matchCount++;
                }
            });

            const rawScore = (matchCount / musicXMLNotes.length) * 100;
            const comparisonScore = Math.min(rawScore / 10, 100);

            setComparisonResult(`Similarity: ${comparisonScore.toFixed(2)}%`);
        } catch (error) {
            console.error('Error comparing files:', error);
            setComparisonResult('An error occurred during comparison');
        } finally {
            setLoading(false);
            setIsComparing(false);
        }
    };

    // Modified startAnimation to accept a callback
    const startAnimation = (onAnimationComplete) => {
        if (!osmdRef.current) return;

        osmdRef.current.cursor.reset();
        osmdRef.current.cursor.show();

        setIsPlaying(true);

        const intervalTime = (60 / (tempo || 120)) * 1000;
        let notesPlayed = 0;  // Keep track of played notes.

        intervalRef.current = setInterval(() => {
            if (
                !osmdRef.current.cursor ||
                osmdRef.current.cursor.iterator.endReached
            ) {
                stopAnimation();
                onAnimationComplete(); // Execute the callback when the animation is complete
                return;
            }


            osmdRef.current.cursor.next();
            notesPlayed++;  // Increment the played notes count

            // Check if the end is reached.
            if (osmdRef.current.cursor.iterator.endReached) {
                stopAnimation();
                onAnimationComplete(); // execute the callback function
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
            style={{ width: "100vw", margin: "0", padding: "0", overflow: "hidden" }}
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

                <div ref={osmdContainerRef} className="border rounded p-3 mb-3 bg-secondary" style={{ height: '300px' }}></div>

                {/* <div className="mb-3 text-center">
                    <ReactMic
                        record={isRecording}
                        onStop={onStop}
                        strokeColor="#0000ff"
                        backgroundColor="#f8f8f8"
                    />
                </div>

                <div className="mb-3 text-center">
                    {!isRecording ? (
                        <button onClick={startRecording} className="btn btn-primary">Start Recording</button>
                    ) : (
                        <button onClick={stopRecording} className="btn btn-danger">Stop Recording</button>
                    )}
                    {recordedAudio && <audio controls src={URL.createObjectURL(recordedAudio)} />}
                </div> */}

                <div className="text-center">
                    <button
                        onClick={handleCompare}
                        disabled={loading || isComparing}
                        className="btn btn-success me-2"
                    >
                        {loading
                            ? 'Comparing...'
                            : isComparing
                                ? 'Transitioning...'
                                : 'Compare'}
                    </button>
                    {/* <button onClick={togglePlay} disabled={loading || isComparing} className="btn btn-info">
                        {isPlaying ? 'Stop' : 'Play'}
                    </button> */}
                </div>

                {transitionComplete && comparisonResult && (
                    <div className="mt-4 alert alert-secondary text-center">
                        <h3>Comparison Result</h3>
                        <p>{comparisonResult}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompareMusicXMLWithAudio;
