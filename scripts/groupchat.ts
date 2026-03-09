#!/usr/bin/env npx tsx
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Message = { role: "user"; name: string; content: string };

const history: Message[] = [];

const SYSTEM_PROMPT = `You are in a group chat with a human user and another AI.
The other AI's messages will appear with their name prefix.
Keep responses concise and conversational. You can respond to the user or to the other AI.
Don't be overly agreeable — share your actual perspective. This is a casual group chat.`;

function buildOpenAIMessages(): OpenAI.ChatCompletionMessageParam[] {
  const msgs: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT + "\nYou are ChatGPT (GPT-4o). The other AI is Claude." },
  ];
  for (const m of history) {
    if (m.name === "ChatGPT") {
      msgs.push({ role: "assistant", content: m.content });
    } else {
      msgs.push({ role: "user", content: `[${m.name}]: ${m.content}` });
    }
  }
  return msgs;
}

function buildClaudeMessages(): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.name === "Claude") {
      msgs.push({ role: "assistant", content: m.content });
    } else {
      msgs.push({ role: "user", content: `[${m.name}]: ${m.content}` });
    }
  }
  return msgs;
}

async function getChatGPTResponse(): Promise<string> {
  process.stdout.write("\n\x1b[32m ChatGPT:\x1b[0m ");
  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: buildOpenAIMessages(),
    stream: true,
  });

  let full = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    process.stdout.write(content);
    full += content;
  }
  console.log();
  return full;
}

async function getClaudeResponse(): Promise<string> {
  process.stdout.write("\n\x1b[35m Claude:\x1b[0m ");
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT + "\nYou are Claude. The other AI is ChatGPT.",
    messages: buildClaudeMessages(),
  });

  let full = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
      full += event.delta.text;
    }
  }
  console.log();
  return full;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function prompt() {
  rl.question("\n\x1b[36m You:\x1b[0m ", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return prompt();
    if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
      console.log("\n\x1b[33mGoodbye!\x1b[0m\n");
      rl.close();
      process.exit(0);
    }

    history.push({ role: "user", name: "You", content: trimmed });

    try {
      // Alternate who goes first so it's fair
      const claudeFirst = history.filter((m) => m.name === "You").length % 2 === 0;

      if (claudeFirst) {
        const claudeResp = await getClaudeResponse();
        history.push({ role: "user", name: "Claude", content: claudeResp });

        const gptResp = await getChatGPTResponse();
        history.push({ role: "user", name: "ChatGPT", content: gptResp });
      } else {
        const gptResp = await getChatGPTResponse();
        history.push({ role: "user", name: "ChatGPT", content: gptResp });

        const claudeResp = await getClaudeResponse();
        history.push({ role: "user", name: "Claude", content: claudeResp });
      }
    } catch (err: any) {
      console.error(`\n\x1b[31mError: ${err.message}\x1b[0m`);
    }

    prompt();
  });
}

console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
console.log("\x1b[33m  🗣️  AI Group Chat — You + ChatGPT + Claude\x1b[0m");
console.log("\x1b[33m  Type a message and both AIs will respond.\x1b[0m");
console.log("\x1b[33m  They can see each other's responses.\x1b[0m");
console.log("\x1b[33m  Type 'exit' to quit.\x1b[0m");
console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
prompt();
