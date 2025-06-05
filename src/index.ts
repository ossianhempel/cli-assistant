import OpenAI from 'openai';
import { config } from 'dotenv';
import readline from 'readline';

// https://ampcode.com/how-to-build-an-agent

// load env vars
config();

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_KEY,
});


function getUserMessage(): Promise<string | null> {
    // get a single line of user input (in CLI)
    // resusable "ask the user something" function
    // building block in cli app
    const rl = readline.createInterface({ // readline used to interact with users via terminal
        input: process.stdin,
        output: process.stdout,
        terminal: false, // disable terminal features like echo
    });

    return new Promise((resolve) => {
        rl.question('You: ', (answer) => {
            rl.close();
            resolve(answer.trim() || null);
        });
    });
}

// agent class that handles interaction with OpenRouter
class Agent {
    constructor(
        private client: OpenAI,
        private getUserMessage: () => Promise<string | null>,
        private conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [],
    ) {}

    async run(): Promise<void> {
        console.log("Chat with Assistant (Ctrl+C to exit):");
        while (true) {
            const message  = await this.getUserMessage();
            if (!message) break;

            this.conversation.push({ role: "user", content: message }); // push the new message to conversation before sending it

            try {
                // inference
                const response = await this.client.chat.completions.create({
                    model: "deepseek/deepseek-chat:free",
                    messages: this.conversation, // include the entire conversation as input
                    max_tokens: 1000,
                });

                console.log(`Assistant: ${response.choices[0].message.content ?? "[No reply]"}`);
                let assistantMessage = response.choices[0].message;
                this.conversation.push(assistantMessage);

                // console.log("Conversation so far:");
                // this.conversation.forEach((msg, index) => {
                //     const role = msg.role === "user" ? "You" : "Assistant";
                //     console.log(`${index + 1}. ${role}: ${msg.content}`);
                // });

            } catch (error) {
                console.error("Error:", (error as Error).message);
                break;
            }
        }
    }
}

async function main() {
    const agent = new Agent(openai, getUserMessage);
    await agent.run();
}

main();