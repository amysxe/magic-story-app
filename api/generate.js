import { Readable } from 'stream';

const voiceSelector = (language) => {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, category, length, language, moral, text } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }

  try {
    let apiEndpoint = '';
    let apiPayload = {};
    let responseFormat = 'json';
    let finalData;

    switch (type) {
      case 'story':
        apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        apiPayload = {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a children's story writer. Generate a JSON object with a "title" field (string) and a "content" field (an array of strings for paragraphs). The JSON object must be valid.`
            },
            {
              role: "user",
              content: `Write a ${length} children's story in ${language} about a ${category}, teaching the moral of ${moral}.`
            }
          ]
        };
        break;

      case 'audio':
        apiEndpoint = 'https://api.openai.com/v1/audio/speech';
        apiPayload = {
          model: "tts-1",
          input: text,
          voice: voiceSelector(language),
          response_format: "mp3"
        };
        responseFormat = 'blob';
        break;

      default:
        return res.status(400).json({ error: 'Invalid request type.' });
    }

    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(apiPayload),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`OpenAI API call failed: ${errorText}`);
      throw new Error(`OpenAI API error: ${apiResponse.statusText}`);
    }

    if (responseFormat === 'blob') {
      res.setHeader('Content-Type', 'audio/mp3');
      const audioBuffer = await apiResponse.arrayBuffer();
      const audioStream = new Readable();
      audioStream.push(Buffer.from(audioBuffer));
      audioStream.push(null);
      audioStream.pipe(res);
    } else {
      const data = await apiResponse.json();
      
      if (type === 'story') {
        try {
          const storyContent = JSON.parse(data.choices[0].message.content);
          
          try {
            const imagePayload = {
                prompt: `Children's book illustration, pastel palette, soft outlines, whimsical, theme: ${category}, focus on one main scene that strongly represents the story (no text).`,
                n: 1,
                size: "1024x1024"
            };
            const imageApiUrl = 'https://api.openai.com/v1/images/generations';
            const imageResponse = await fetch(imageApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(imagePayload),
            });

            if (imageResponse.ok) {
                const imageResult = await imageResponse.json();
                storyContent.image = imageResult.data?.[0]?.url;
            } else {
              console.error(`Image generation failed with status: ${imageResponse.status}`);
            }
          } catch (imageError) {
            console.error("Error generating image:", imageError);
          }

          finalData = storyContent;
        } catch (jsonError) {
          console.error("Failed to parse JSON from OpenAI:", jsonError);
          console.error("Raw response:", data.choices[0].message.content);
          throw new Error("Invalid JSON response from story generation.");
        }
      }
      
      res.status(200).json(finalData);
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
}
