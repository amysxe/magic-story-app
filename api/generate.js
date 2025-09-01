import OpenAI from "openai";

// Load the API key from the environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  runtime: 'edge',
};

// Main handler for the API endpoint
export default async function handler(req) {
  try {
    const { type, category, length, language, moral, text } = await req.json();

    if (type === 'story') {
      const storyPrompt = `Create a short children's story (around ${length}, in ${language}, with a moral about ${moral}). The story should feature a character that is a ${category}. The response MUST be a JSON object with two fields: "title" (string) and "content" (an array of strings, where each string is a paragraph of the story). The story should be sweet and gentle.`;

      const imagePrompt = `A children's storybook illustration of a happy ${category} character, watercolor style, soft colors, gentle and friendly atmosphere.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "user",
          content: storyPrompt,
        }],
        response_format: { type: "json_object" },
      });

      const storyContent = JSON.parse(response.choices[0].message.content);

      let imageUrl = null;
      try {
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
        });
        imageUrl = imageResponse.data[0].url;
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
            return 'shimmer'; // Fallback as no specific Bahasa voice is available
          case 'German':
            return 'nova';
          default:
            return 'alloy';
        }
      };

      try {
        const audio = await openai.audio.speech.create({
          model: "tts-1",
          voice: voiceSelector(language),
          input: text,
        });

        const buffer = await audio.arrayBuffer();
        const audioBlob = new Blob([buffer], { type: 'audio/mpeg' });

        return new Response(audioBlob, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'attachment; filename="story_audio.mp3"',
          },
        });
      } catch (audioError) {
        console.error("OpenAI TTS API call failed:", audioError);
        return new Response(JSON.stringify({ error: 'TTS generation failed.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
