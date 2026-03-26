
import { GoogleGenAI } from "@google/genai";

/**
 * Generates a response from Gemini, supporting both text and images.
 * @param userMessage - The text prompt from the user.
 * @param lang - UI language context.
 * @param imageData - Optional base64 image data (including data:image/... prefix).
 * @param userApiKey - Optional API key provided by the user in settings.
 * @param userAvatarData - Optional base64 data of the user's profile picture.
 */
export const getGeminiResponse = async (
  userMessage: string, 
  lang: 'en' | 'ru', 
  imageData?: string, 
  userApiKey?: string,
  userAvatarData?: string
) => {
  try {
    // Use the user's key if provided, otherwise fallback to the environment key
    const apiKey = userApiKey || process.env.API_KEY;
    if (!apiKey) {
      return lang === 'ru' ? "API ключ не настроен." : "API key is not configured.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Prepare the parts for multi-modal input
    const parts: any[] = [];
    
    // 1. Add System context about the user's appearance if available
    let systemPrompt = lang === 'ru' 
      ? "Ты - живой пользователь мессенджера ArbuzGram по имени ыхыхыххы гимини. Твои ответы должны быть краткими, живыми, с эмодзи. Ты видишь изображения, которые тебе присылают."
      : "You are a lively user of ArbuzGram messenger named ыхыхыххы гимини. Your responses should be short, vivid, and casual with emojis. You can see the images sent to you.";

    if (userAvatarData) {
      systemPrompt += lang === 'ru' 
        ? " В первом вложении ты видишь аватар пользователя, с которым общаешься."
        : " In the first attachment, you see the avatar of the user you are talking to.";
      
      const [mime, data] = userAvatarData.split(',');
      parts.push({
        inlineData: {
          mimeType: mime.match(/:(.*?);/)?.[1] || 'image/png',
          data: data
        }
      });
    }

    // 2. Add the user's sent image if provided
    if (imageData) {
      const [mime, data] = imageData.split(',');
      parts.push({
        inlineData: {
          mimeType: mime.match(/:(.*?);/)?.[1] || 'image/png',
          data: data
        }
      });
    }

    // 3. Add the text message
    parts.push({ text: userMessage || (lang === 'ru' ? "Что ты видишь на этом фото?" : "What do you see in this photo?") });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.9,
      },
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("API_KEY_INVALID")) {
      return lang === 'ru' ? "Неверный API ключ." : "Invalid API key.";
    }
    return lang === 'ru' ? "Ошибка связи с ботом." : "Bot connection error.";
  }
};
