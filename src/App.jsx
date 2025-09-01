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
  const [apiKey, setApiKey] = useState('');

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
    if (!apiKey) {
      setError("Please enter your API key to generate a story.");
      return;
    }

    // Stop audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLoading(true);
    setStory(null);

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
    if (!apiKey) {
      setError("Please enter your API key to play audio.");
      return;
    }
    if (audioRef.current && paused) {
      audioRef.current.play();
      setPaused(false);
      return;
    }

    if (audioRef.current) audioRef.current.pause();
    setPlaying(true);

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
    <div className="main-container">
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@400;700;800&display=swap');
        
        body {
          margin: 0;
          padding: 0;
        }

        .main-container {
          background: linear-gradient(to bottom right, #fafafa, #fef2f2);
          min-height: 100vh;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #2d3748;
          padding: 1rem;
        }
        
        .container-main {
          max-width: 64rem;
          margin: auto;
          padding: 0 1rem;
        }

        .header-title {
          font-size: 2.25rem;
          font-weight: 800;
          color: #ea580c;
          text-align: center;
          padding-top: 2rem;
          margin-bottom: 0.25rem;
        }

        @media (min-width: 640px) {
          .header-title {
            font-size: 3rem;
          }
          .main-container {
            padding: 2rem;
          }
        }
        
        .header-subtitle {
          font-size: 1.125rem;
          color: #4b5563;
          margin-top: 0;
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .card {
          background-color: white;
          border-radius: 1.5rem;
          transition: transform 0.3s ease-in-out;
          padding: 1.5rem;
        }
        @media (min-width: 640px) {
          .card {
            padding: 2rem;
          }
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
        }
        
        .label {
          color: #374151;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .select-input, .text-input {
          width: 100%;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          transition: box-shadow 0.3s;
        }
        .select-input:focus, .text-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px #fb923c;
        }

        .generate-button-container {
          margin-top: 2rem;
        }

        .button {
          transition: transform 0.3s, background-color 0.3s;
          border-radius: 1.5rem;
        }
        .generate-button {
          width: 100%;
          padding: 1rem;
          background-color: #f97316;
          color: white;
          font-weight: bold;
          font-size: 1.125rem;
          
        }
        .generate-button:hover {
          background-color: #ea580c;
          transform: translateY(-2px);
        }
        .generate-button:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
          transform: translateY(0);
        }

        .error-message {
          margin-top: 1.5rem;
          padding: 1rem;
          background-color: #fee2e2;
          color: #b91c1c;
          border-radius: 0.5rem;
          text-align: center;
          font-weight: 500;
        }
        
        .loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }
        
        .loader-text {
          text-align: center;
          color: white;
          font-size: 1.25rem;
        }
        
        .loader-spin {
          animation: spin 1s linear infinite;
          border-radius: 9999px;
          height: 3rem;
          width: 3rem;
          border-width: 4px;
          border-style: solid;
          border-color: #f97316;
          border-top-color: white;
          margin: 0 auto 1rem;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .story-result {
          margin-top: 3rem;
          box-shadow: none;
          border: none;
        }

        .story-title {
          font-size: 1.875rem;
          font-weight: 800;
          text-align: center;
          color: #ea580c;
          margin-bottom: 1.5rem;
        }
        @media (min-width: 640px) {
          .story-title {
            font-size: 2.25rem;
          }
        }

        .image-container {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }
        
        .story-image {
          width: 100%;
          max-width: 42rem;
          border-radius: 1rem;
          border: none;
          box-shadow: none;
        }

        .audio-buttons {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        
        .audio-button {
          padding: 0.5rem 1.5rem;
          border-radius: 9999px;
          background-color: #fff7ed;
          color: #ea580c;
          font-weight: 600;
          transition: background-color 0.3s;
        }
        .audio-button:hover {
          background-color: #ffedd5;
        }
        .audio-button.mr {
          margin-right: 0.5rem;
        }

        .story-content {
          margin-top: 1.5rem;
          color: #374151;
          font-size: 1.125rem;
          line-height: 1.625;
        }
        .story-content p {
          margin-bottom: 1.5rem;
          text-align: justify;
          text-indent: 2rem;
        }
        .story-content p:first-child {
          text-indent: 0;
        }

        .scroll-button {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          padding: 0.75rem;
          background-color: #fff7ed;
          color: #ea580c;
          border-radius: 9999px;
          transition: transform 0.3s;
          box-shadow: none;
        }
        .scroll-button:hover {
          transform: translateY(-2px);
        }

        .footer {
          text-align: center;
          color: #6b7280;
          margin-top: 3rem;
          margin-bottom: 1rem;
        }
        `}
      </style>
      <div className="container-main">
        <header>
          <h1 className="header-title">Magic Story with AI</h1>
          <p className="header-subtitle">Generate fun and meaningful stories for kids!</p>
        </header>

        <div className="card">
          <div className="form-group mb-4">
            <label className="label">OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="text-input"
              placeholder="Enter your API key here..."
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select-input"
              >
                <option>Animal</option>
                <option>Fruit</option>
                <option>Person</option>
                <option>Mix & Random</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Length</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="select-input"
              >
                <option>5-10 min</option>
                <option>10-15 min</option>
                <option>&gt;15 min</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="select-input"
              >
                <option>English</option>
                <option>Bahasa</option>
                <option>German</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Moral</label>
              <select
                value={moral}
                onChange={(e) => setMoral(e.target.value)}
                className="select-input"
              >
                <option>Kindness</option>
                <option>Friendship</option>
                <option>Honesty</option>
                <option>Perseverance</option>
              </select>
            </div>
          </div>
        </div>

        <div className="generate-button-container">
          <button
            onClick={generateStory}
            disabled={loading || !apiKey}
            className="button generate-button"
          >
            {loading ? 'Generating...' : 'Generate Story'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading && (
          <div className="loader-overlay">
            <div className="loader-text">
              <div className="loader-spin"></div>
              {loaderMessage}
            </div>
          </div>
        )}

        {story && (
          <div ref={storyRef} className="card story-result">
            <h2 id="story-title" className="story-title">{story.title}</h2>
            
            {story.image && (
              <div className="image-container">
                <img
                  src={story.image}
                  alt="Story illustration"
                  className="story-image"
                  onError={(e) => e.target.src = "https://placehold.co/1024x1024/E5E7EB/4B5563?text=Image+Unavailable"}
                />
              </div>
            )}

            <div className="audio-buttons">
              {!playing ? (
                <button
                  onClick={() => playAudio([story.title, ...story.content].join("\n"))}
                  className="button audio-button"
                >
                  🔊 Play with audio
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseAudio}
                    className="button audio-button mr"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={stopAudio}
                    className="button audio-button"
                  >
                    ⏹ Stop
                  </button>
                </>
              )}
            </div>

            <div className="story-content">
              {story.content.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}

        <button
          className="button scroll-button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
        </button>

        <footer className="footer">
          Copyright &copy; 2025 by Laniakea Digital
        </footer>
      </div>
    </div>
  );
};

export default App;
