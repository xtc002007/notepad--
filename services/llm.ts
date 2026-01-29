
import { storage } from '../storage';

export interface LLMMessageContent {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
    };
}

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | LLMMessageContent[];
}

export interface LLMChatOptions {
    model?: string;
    messages: LLMMessage[];
    max_completion_tokens?: number;
    reasoning_effort?: 'low' | 'medium' | 'high';
}

export class LLMService {
    private baseUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

    async chat(options: LLMChatOptions) {
        const settings = await storage.getSettings();
        const apiKey = settings.arkApiKey;
        const model = options.model || settings.arkModel || 'doubao-seed-1-6-lite-251015';

        if (!apiKey) {
            throw new Error('Ark API key is not configured. Please set it in settings.');
        }

        const body = {
            model: model,
            max_completion_tokens: options.max_completion_tokens || 65535,
            messages: options.messages,
            reasoning_effort: options.reasoning_effort || 'medium',
        };

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ark API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Helper to ask a question about an image
     */
    async askAboutImage(imageUrl: string, question: string) {
        return this.chat({
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl,
                            },
                        },
                        {
                            type: 'text',
                            text: question,
                        },
                    ],
                },
            ],
        });
    }

    /**
     * Helper for simple text completion
     */
    async complete(prompt: string) {
        return this.chat({
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
    }
}

export const llmService = new LLMService();
