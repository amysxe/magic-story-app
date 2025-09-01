import React, { useState, useRef, useEffect } from 'react';

const VoiceSelector = ({ language }) => {
  switch (language) {
    case 'English':
      return 'onyx';
    case 'Bahasa':
      return 'fable';
    case 'German':
      return 'nova';
    default:
      return 'onyx';
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
        const errorText = await response.text();
        console.error(`Request failed with status ${response.status}: ${errorText}`);
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

    // IMPORTANT: Replace 'YOUR_OPENAI_API_KEY' with your actual key here.
    const apiKey = 'YOUR_OPENAI_API_KEY';

    try {
      const textPayload = {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a children's story writer. Generate a JSON object with a "title" field (string) and a "content" field (an array of strings for paragraphs).`
          },
          {
            role: "user",
            content: `Write a ${length} children's story in ${language} about a ${category}, teaching the moral of ${moral}.`
          }
        ],
        response_format: { type: "json_object" }
      };

      const imagePayload = {
        prompt: `Children's book illustration, pastel palette, soft outlines, whimsical, theme: ${category}, focus on one main scene that strongly represents the story (no text).`,
        n: 1,
        size: "1024x1024"
      };

      // Generate Story Text
      const textApiUrl = 'https://api.openai.com/v1/chat/completions';
      const textResponse = await fetchWithRetry(textApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(textPayload),
      });

      if (!textResponse.ok) {
        throw new Error('Failed to generate story text.');
      }

      const textResult = await textResponse.json();
      const storyContent = JSON.parse(textResult.choices[0].message.content);

      if (!storyContent || !storyContent.title || !storyContent.content) {
        throw new Error('Invalid story format received.');
      }
      
      // Generate Image
      const imageApiUrl = 'https://api.openai.com/v1/images/generations';
      const imageResponse = await fetchWithRetry(imageApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(imagePayload),
      });

      let imageUrl = '';
      if (imageResponse.ok) {
        const imageResult = await imageResponse.json();
        imageUrl = imageResult.data?.[0]?.url;
      }

      setStory({ ...storyContent, image: imageUrl });
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

    const apiKey = 'YOUR_OPENAI_API_KEY';

    try {
      const ttsApiUrl = 'https://api.openai.com/v1/audio/speech';
      const ttsPayload = {
        model: "tts-1",
        input: text,
        voice: VoiceSelector({ language }),
        response_format: "mp3"
      };

      const res = await fetchWithRetry(ttsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(ttsPayload),
      });

      if (!res.ok) {
        throw new Error('TTS generation failed.');
      }
      
      const audioBlob = await res.blob();
      const audioURL = URL.createObjectURL(audioBlob);
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
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@400;700;800&display=swap');
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .button {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
          transition-duration: 300ms;
        }
        .button:hover {
          transform: scale(1.05);
        }
        .button:disabled {
          background-color: #9ca3af; /* gray-400 */
          cursor: not-allowed;
        }
        .card {
          background-color: white;
          border: 1px solid #e5e7eb;
          border-radius: 1.5rem; /* rounded-3xl */
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        .shadow-lg-custom {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        .drop-shadow-sm-custom {
          filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.05));
        }
        `}
      </style>
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-orange-600 drop-shadow-sm-custom">Magic Story with AI</h1>
          <p className="text-lg text-gray-600 mt-2">Generate fun and meaningful stories for kids!</p>
        </header>

        {/* Input Fields Card */}
        <div className="card p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            className="button w-full py-4 rounded-3xl bg-orange-500 text-white font-bold text-lg shadow-lg-custom hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
          <div ref={storyRef} className="card p-6 sm:p-10 mt-12 shadow-2xl">
            <h2 id="story-title" className="text-3xl sm:text-4xl font-extrabold text-center text-orange-600 mb-6 drop-shadow-sm-custom">{story.title}</h2>
            
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
                  className="button px-6 py-2 rounded-full bg-orange-100 text-orange-600 font-semibold shadow-sm hover:bg-orange-200"
                >
                  🔊 Play with audio
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseAudio}
                    className="button px-6 py-2 rounded-full bg-orange-100 text-orange-600 font-semibold shadow-sm hover:bg-orange-200 mr-2"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={stopAudio}
                    className="button px-6 py-2 rounded-full bg-orange-100 text-orange-600 font-semibold shadow-sm hover:bg-orange-200"
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
          className="button fixed bottom-6 right-6 p-3 bg-orange-100 text-orange-600 rounded-full shadow-lg"
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
