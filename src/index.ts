import OpenAI from 'openai';
import { config } from 'dotenv';
import readline from 'readline';
import fs from 'fs';

// https://ampcode.com/how-to-build-an-agent

// load env vars
config();

interface ToolDefinition  {
    // internal representation
    name: string;
    description: string;
    inputSchema: OpenAI.FunctionParameters;
    function: (input: any) => Promise<string> | string;
}

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

async function readFile(input: string): Promise<string> {
    try {
        const content = await fs.promises.readFile(input, 'utf8');
        if (!content) {
            throw new Error("File is empty");
        }
        return content;
    } catch (error) {
        console.error("Error reading file", error);
        throw new Error("Error reading file");
    }
}

const readFileTool: ToolDefinition = {
    name: "read_file",
    description: "Read the contents of a file and return it as a string",
    inputSchema: {
        type: "object",
        properties: {
            filePath: {
                type: "string",
                description: "The path to the file to read",
            }
        },
        required: ["filePath"]
    },
    function: (input: any) => {
        const { filePath } = input;
        return readFile(filePath);
    }
};

// agent class that handles interaction with OpenRouter
class Agent {
    constructor(
        private client: OpenAI,
        private getUserMessage: () => Promise<string | null>,
        private tools: ToolDefinition[]=[],
        // type that's built into OpenAI SDK
        // conversation is an array of messages, each message has a role (user or assistant) and content
        private conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: "You are a helpful assistant." },
        ],
    ) {}

    // convert ToolDefinition to OpenAI format
    private convertToolsToOpenAI(): OpenAI.Chat.Completions.ChatCompletionTool[] {
        return this.tools.map(tool => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            }
        }));
    }

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
                    max_tokens: 1024,
                    tools: this.tools.length > 0 ? this.convertToolsToOpenAI() : undefined
                });

                console.log(`Assistant: ${response.choices[0].message.content ?? "[No reply]"}`);
                let assistantMessage = response.choices[0].message;
                this.conversation.push(assistantMessage);

            } catch (error) {
                console.error("Error:", (error as Error).message);
                break;
            }
        }
    }
}

async function main() {
    const agent = new Agent(
        openai, 
        getUserMessage,
        [readFileTool],
    );
    await agent.run();
}

main();