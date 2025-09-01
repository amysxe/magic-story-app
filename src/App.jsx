import React, { useState, useRef, useEffect } from 'react';

// Utility function to convert PCM audio data to WAV Blob
const pcmToWav = (pcmData, sampleRate) => {
  const dataLength = pcmData.length * 2; // 16-bit
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  
  // WAV header
  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  view.setUint32(12, 0x20746d66, true); // 'fmt '
  view.setUint32(16, 16, true); // PCM format length
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM data
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset, pcmData[i], true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
};

// Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Selector to pick a voice based on the selected language
const VoiceSelector = ({ language }) => {
  switch (language) {
    case 'English':
      return 'Kore';
    case 'Bahasa':
      return 'Leda';
    case 'German':
      return 'Fenrir';
    default:
      return 'Kore';
  }
};

const App = () => {
  const [category, setCategory] = useState("Animal");
  const [length, setLength] = useState("5-10 min");
  const [language, setLanguage] = useState("English");
  const [moral, setMoral] = useState("Kindness");

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Meaningful story makes memorable moments");
  const [error, setError] = useState('');

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef(null);

  const storyRef = useRef();

  // Loader text loop
  useEffect(() => {
    if (!loading) return;
    const messages = [
      "Meaningful story makes memorable moments...",
      "Bedtime stories will never fail the children...",
      "Worry no more with Magic Story...",
      "We are generating your story...",
      "Almost there...",
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLoaderMessage(messages[i % messages.length]);
      i++;
    }, 5000);
    return () => clearInterval(interval);
  }, [loading]);

  const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        throw new Error(`Request failed with status ${response.status}`);
      } catch (err) {
        console.error(`Attempt ${i + 1} failed:`, err);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        } else {
          throw err;
        }
      }
    }
  };

  const generateStory = async () => {
    setError('');
    // Stop audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLoading(true);
    setStory(null);

    try {
      const payload = {
        contents: [{
          parts: [{
            text: `Write a ${length} children's story in ${language} about a ${category}, teaching the moral of ${moral}. The story must be returned as a JSON object with a "title" field (string) and a "content" field (an array of strings for paragraphs).`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              content: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            }
          }
        },
      };

      const imagePayload = {
        instances: {
          prompt: `Children's book illustration, pastel palette, soft outlines, whimsical, theme: ${category}, focus on one main scene that strongly represents the story (no text).`
        },
        parameters: {
          sampleCount: 1
        }
      };

      // Generate Story Text
      const storyApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=';
      const storyResponse = await fetchWithRetry(storyApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!storyResponse.ok) {
        throw new Error('Failed to generate story text.');
      }

      const storyResult = await storyResponse.json();
      const storyText = storyResult.candidates?.[0]?.content?.parts?.[0]?.text;
      const match = storyText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Invalid JSON from AI");

      const parsedStory = JSON.parse(match[0]);

      if (!parsedStory || !parsedStory.title || !parsedStory.content) {
        throw new Error('Invalid story format received.');
      }
      
      // Generate Image
      const imageApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=';
      const imageResponse = await fetchWithRetry(imageApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imagePayload),
      });

      let imageUrl = '';
      if (imageResponse.ok) {
        const imageResult = await imageResponse.json();
        const base64Data = imageResult.predictions?.[0]?.bytesBase64Encoded;
        if (base64Data) {
          imageUrl = `data:image/png;base64,${base64Data}`;
        }
      }

      setStory({ ...parsedStory, image: imageUrl });
      setLoading(false);
      storyRef.current?.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Failed to generate story. Please try again.");
    }
  };

  const playAudio = async (text) => {
    setError('');
    if (audioRef.current && paused) {
      audioRef.current.play();
      setPaused(false);
      return;
    }

    if (audioRef.current) audioRef.current.pause();
    setPlaying(true);

    try {
      const ttsApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=';
      const ttsPayload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VoiceSelector({ language }) }
            }
          }
        },
      };

      const res = await fetchWithRetry(ttsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ttsPayload),
      });

      if (!res.ok) {
        throw new Error('TTS generation failed.');
      }

      const result = await res.json();
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (!audioData || !mimeType) {
        throw new Error('Invalid audio data received.');
      }
      
      const sampleRateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 16000;
      
      const pcmData = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmData);
      const wavBlob = pcmToWav(pcm16, sampleRate);
      
      const audioURL = URL.createObjectURL(wavBlob);
      const audioEl = new Audio(audioURL);
      audioRef.current = audioEl;
      audioEl.play();
      audioEl.onended = () => {
        setPlaying(false);
        setPaused(false);
      };
    } catch (err) {
      console.error(err);
      setError("Failed to play audio. Please try again.");
      setPlaying(false);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPaused(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      setPaused(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-100 min-h-screen font-sans text-gray-800 p-4 sm:p-8">
      {/* Tailwind CSS CDN script */}
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-orange-600 drop-shadow-sm">Magic Story with AI</h1>
          <p className="text-lg text-gray-600 mt-2">Generate fun and meaningful stories for kids!</p>
        </header>

        {/* Input Fields Card */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow"
              >
                <option>Animal</option>
                <option>Fruit</option>
                <option>Person</option>
                <option>Mix & Random</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-2">Length</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow"
              >
                <option>5-10 min</option>
                <option>10-15 min</option>
                <option>&gt;15 min</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-2">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow"
              >
                <option>English</option>
                <option>Bahasa</option>
                <option>German</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-gray-700 font-semibold mb-2">Moral</label>
              <select
                value={moral}
                onChange={(e) => setMoral(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow"
              >
                <option>Kindness</option>
                <option>Friendship</option>
                <option>Honesty</option>
                <option>Perseverance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-8">
          <button
            onClick={generateStory}
            disabled={loading}
            className="w-full py-4 rounded-3xl bg-orange-500 text-white font-bold text-lg shadow-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {loading ? 'Generating...' : 'Generate Story'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        {/* Loader Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="text-center text-white text-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-4 border-orange-500 border-t-white mx-auto mb-4"></div>
              {loaderMessage}
            </div>
          </div>
        )}

        {/* Story Result */}
        {story && (
          <div ref={storyRef} className="bg-white p-6 sm:p-10 mt-12 rounded-3xl shadow-2xl border border-gray-200">
            <h2 id="story-title" className="text-3xl sm:text-4xl font-extrabold text-center text-orange-600 mb-6 drop-shadow-sm">{story.title}</h2>
            
            {story.image && (
              <div className="flex justify-center mb-8">
                <img
                  src={story.image}
                  alt="Story illustration"
                  className="w-full max-w-2xl rounded-2xl shadow-lg border border-gray-200"
                  onError={(e) => e.target.src = "https://placehold.co/1024x1024/E5E7EB/4B5563?text=Image+Unavailable"}
                />
              </div>
            )}

            <div className="text-center mb-6">
              {!playing ? (
                <button
                  onClick={() => playAudio([story.title, ...story.content].join("\n"))}
                  className="px-6 py-2 rounded-full bg-orange-100 text-orange-600 font-semibold shadow-sm hover:bg-orange-200 transition-colors transform hover:scale-105"
                >
                  🔊 Play with audio
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseAudio}
                    className="px-6 py-2 rounded-full bg-orange-100 text-orange-600 font-semibold shadow-sm hover:bg-orange-200 transition-colors transform hover:scale-105 mr-2"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={stopAudio}
                    className="px-6 py-2 rounded-full bg-orange-100 text-orange-600 font-semibold shadow-sm hover:bg-orange-200 transition-colors transform hover:scale-105"
                  >
                    ⏹ Stop
                  </button>
                </>
              )}
            </div>

            <div className="space-y-6 text-gray-700 text-lg leading-relaxed">
              {story.content.map((p, i) => (
                <p key={i} className="text-justify indent-8 first:indent-0">{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* Scroll to top */}
        <button
          className="fixed bottom-6 right-6 p-3 bg-orange-100 text-orange-600 rounded-full shadow-lg hover:bg-orange-200 transition-colors transform hover:scale-110"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
        </button>

        <footer className="text-center text-gray-500 mt-12 mb-4">
          Copyright &copy; 2025 by Laniakea Digital
        </footer>
      </div>
    </div>
  );
};

export default App;
