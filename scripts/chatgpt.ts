#!/usr/bin/env npx tsx
import OpenAI from "openai";
import * as readline from "readline";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: "You are a helpful assistant." },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt() {
  rl.question("\n\x1b[36mYou:\x1b[0m ", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return prompt();
    if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
      console.log("\n\x1b[33mGoodbye!\x1b[0m\n");
      rl.close();
      process.exit(0);
    }

    messages.push({ role: "user", content: trimmed });

    try {
      process.stdout.write("\n\x1b[32mChatGPT:\x1b[0m ");
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        process.stdout.write(content);
        fullResponse += content;
      }
      console.log();

      messages.push({ role: "assistant", content: fullResponse });
    } catch (err: any) {
      console.error(`\n\x1b[31mError: ${err.message}\x1b[0m`);
    }

    prompt();
  });
}

console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
console.log("\x1b[33m  ChatGPT CLI (gpt-4o) — type 'exit' to quit\x1b[0m");
console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
prompt();
