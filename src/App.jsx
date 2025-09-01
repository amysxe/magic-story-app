import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  const [category, setCategory] = useState("Animal");
  const [length, setLength] = useState("5-10 min");
  const [language, setLanguage] = useState("English");
  const [moral, setMoral] = useState("Kindness");

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Meaningful story makes memorable moments");
  const [error, setError] = useState('');
  const [isAudioReady, setIsAudioReady] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  // Create the Audio element once and store it in a ref.
  // This helps with mobile browser autoplay policies.
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);

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

    // Stop and clear old audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    }
    setPlaying(false);
    setPaused(false);
    setStory(null);
    setIsAudioReady(false);
    setLoading(true);

    try {
      // Step 1: Generate Story Text and Image
      const lengthPrompt = {
        "5-10 min": "a short story, roughly 300-500 words",
        "10-15 min": "a medium-length story, around 500-800 words",
        ">15 min": "a long and detailed story, over 800 words",
      }[length];

      const storyPayload = {
        type: 'story',
        category,
        length: lengthPrompt,
        language,
        moral,
      };

      const storyRes = await fetchWithRetry('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storyPayload),
      });

      if (!storyRes.ok) {
        throw new Error('Failed to generate story.');
      }

      const storyData = await storyRes.json();
      setStory(storyData);
      
      // Auto-scroll to the story result after the story is set
      setTimeout(() => {
        storyRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Step 2: Generate Audio (non-blocking)
      const audioPayload = {
        type: 'audio',
        text: [storyData.title, ...storyData.content].join("\n"),
        language
      };

      const audioRes = await fetchWithRetry('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(audioPayload),
        });

      if (!audioRes.ok) {
        throw new Error('TTS generation failed.');
      }
      
      const audioBlob = await audioRes.blob();
      const audioURL = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioURL;
        // The audio is ready as soon as the URL is set. This is more reliable
        // than waiting for oncanplaythrough, which can be inconsistent on mobile.
        setIsAudioReady(true);
        audioRef.current.onended = () => {
          setPlaying(false);
          setPaused(false);
        };
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate story. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current && paused) {
      audioRef.current.play();
      setPaused(false);
      setPlaying(true);
      return;
    }

    if (audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPaused(true);
      setPlaying(false);
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
          margin-bottom: 0.5rem;
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
          margin-bottom: 3rem;
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
          -webkit-appearance: none; /* Fix for Safari styling issues */
          -moz-appearance: none;
          appearance: none;
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
          border: none;
          cursor: pointer;
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
          background-color: rgba(0, 0, 0, 0.6);
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
          height: 400px;
        }
        
        .story-image {
          width: 100%;
          max-width: 42rem;
          border-radius: 1rem;
          border: none;
          box-shadow: none;
          object-fit: contain;
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
        .new-story-button-container {
            margin-top: 2rem;
            text-align: center;
        }
        .new-story-button {
            background-color: #f97316;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 1.5rem;
            font-weight: bold;
            transition: background-color 0.3s, transform 0.3s;
            border: none;
            cursor: pointer;
        }
        .new-story-button:hover {
            background-color: #ea580c;
            transform: translateY(-2px);
        }

        .scroll-button {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          padding: 0.75rem 1.5rem;
          background-color: #fff7ed;
          color: #ea580c;
          border-radius: 9999px;
          transition: transform 0.3s;
          box-shadow: none;
          border: none;
          cursor: pointer;
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
            disabled={loading}
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

            {isAudioReady && (
              <div className="audio-buttons">
                {!playing ? (
                  <button
                    onClick={playAudio}
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
            )}

            <div className="story-content">
              {story.content.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="new-story-button-container">
              <button
                className="button new-story-button"
                onClick={() => window.location.reload()}
              >
                Create New Story
              </button>
            </div>
          </div>
        )}

        {story && (
          <button
            className="button scroll-button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ↑ Scroll to top
          </button>
        )}

        <footer className="footer">
          Copyright &copy; 2025 by Laniakea Digital // Naimy
        </footer>
      </div>
    </div>
  );
};

export default App;
