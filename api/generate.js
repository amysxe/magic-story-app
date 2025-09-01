import { OpenAIStream, StreamingTextResponse } from 'ai';

export const config = {
  runtime: 'edge',
};

// Main handler for the API endpoint
export default async function handler(req) {
  const { type, category, length, language, moral, text } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  try {
    if (type === 'story') {
      const storyPrompt = `Create a short children's story (around ${length}, in ${language}, with a moral about ${moral}). The story should feature a character that is a ${category}. The response MUST be a JSON object with two fields: "title" (string) and "content" (an array of strings, where each string is a paragraph of the story). The story should be sweet and gentle.`;
      const imagePrompt = `A children's storybook illustration of a happy ${category} character, watercolor style, soft colors, gentle and friendly atmosphere.`;

      const chatCompletion = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "user",
            content: storyPrompt
          }],
          response_format: { type: "json_object" }
        })
      });

      const storyData = await chatCompletion.json();
      const storyContent = JSON.parse(storyData.choices[0].message.content);

      let imageUrl = null;
      try {
        const imageResponse = await fetchWithRetry('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: imagePrompt,
            n: 1,
            size: "1024x1024",
          })
        });
        const imageData = await imageResponse.json();
        imageUrl = imageData.data[0].url;
      } catch (imageError) {
        console.error("OpenAI Image API call failed:", imageError);
      }

      return new Response(JSON.stringify({ ...storyContent, image: imageUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else if (type === 'audio') {
      const voiceSelector = (lang) => {
        switch (lang) {
          case 'English':
            return 'alloy';
          case 'Bahasa':
            return 'shimmer';
          case 'German':
            return 'nova';
          default:
            return 'alloy';
        }
      };
      
      const audioResponse = await fetchWithRetry('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: voiceSelector(language),
          input: text,
        }),
      });

      const audioBlob = await audioResponse.blob();
      return new Response(audioBlob, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="story_audio.mp3"',
        },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid request type.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error("An unexpected error occurred:", err);
    return new Response(JSON.stringify({ error: 'Failed to process the request.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
