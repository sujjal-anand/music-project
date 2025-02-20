import React, { useState } from "react";

const XMLToPitch = () => {
  const [pitches, setPitches] = useState([]);
  const [file, setFile] = useState(null);

  // Handle file input
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPitches([]); // Reset pitches when a new file is selected
      parseMusicXML(selectedFile);
    }
  };

  // Function to parse the MusicXML file and extract pitches
  const parseMusicXML = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlString = e.target.result;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "text/xml");

      const extractedPitches = [];

      // Find all <note> elements in the MusicXML
      const noteElements = xmlDoc.getElementsByTagName("note");

      for (let note of noteElements) {
        const pitchElement = note.getElementsByTagName("pitch")[0];
        if (pitchElement) {
          const step = pitchElement.getElementsByTagName("step")[0].textContent;
          const octave = pitchElement.getElementsByTagName("octave")[0].textContent;
          extractedPitches.push(`${step}${octave}`);
        }
      }

      // Update state with new pitches
      setPitches(extractedPitches);
    };

    reader.readAsText(file);
  };

  return (
    <div>
      <h2>MusicXML to Pitch Converter</h2>

      {/* File Input */}
      <input type="file" accept=".xml" onChange={handleFileChange} />

      {/* Extracted Pitches */}
      <h3>Extracted Pitches:</h3>
      <ul>
        {pitches.length > 0 ? (
          pitches.map((pitch, index) => <li key={index}>{pitch}</li>)
        ) : (
          <p>No pitches extracted yet.</p>
        )}
      </ul>
    </div>
  );
};

export default XMLToPitch;
