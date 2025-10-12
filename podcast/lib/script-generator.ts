// GPT-4 Script Generator for Podcast Episodes
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

interface GuestProfile {
  id: string;
  name: string;
  title: string;
  expertise: string;
  question_topics: string[];
  tone: string;
}

interface HostProfile {
  name: string;
}

interface QAPair {
  question: string;
  answer: string;
}

interface PodcastScript {
  episode_title: string;
  guest_id: string;
  guest_name: string;
  topic: string;
  qa_pairs: QAPair[];
  estimated_duration_seconds: number;
}

export class ScriptGenerator {
  private openai: OpenAI;
  private guestProfiles: any;
  private hostProfile: HostProfile;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });

    // Load guest profiles
    const configPath = join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    this.guestProfiles = config.profiles;
    this.hostProfile = config.host;
  }

  /**
   * Select a random guest for the podcast
   */
  selectRandomGuest(excludeRecent: string[] = []): GuestProfile {
    const availableGuests = Object.values(this.guestProfiles).filter(
      (guest: any) => !excludeRecent.includes(guest.id)
    ) as GuestProfile[];

    if (availableGuests.length === 0) {
      // If all guests used recently, reset and pick from all
      return Object.values(this.guestProfiles)[
        Math.floor(Math.random() * Object.values(this.guestProfiles).length)
      ] as GuestProfile;
    }

    return availableGuests[Math.floor(Math.random() * availableGuests.length)];
  }

  /**
   * Generate a complete podcast script with Q&A pairs
   */
  async generateScript(
    guestId?: string,
    questionsCount: number = 5
  ): Promise<PodcastScript> {
    // Select guest (random or specified)
    const guest = guestId
      ? this.guestProfiles[guestId]
      : this.selectRandomGuest();

    if (!guest) {
      throw new Error(`Guest profile not found: ${guestId}`);
    }

    console.log(`Generating script for guest: ${guest.name} (${guest.title})`);

    // Select random topic from guest's expertise
    const topic = guest.question_topics[
      Math.floor(Math.random() * guest.question_topics.length)
    ];

    // Generate Q&A pairs using GPT-4
    const prompt = this.buildPrompt(guest, topic, questionsCount);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional podcast script writer. Create engaging, educational Q&A content for adult audiences. The host's name is ${this.hostProfile.name}.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    const response = completion.choices[0].message.content;

    if (!response) {
      throw new Error('Failed to generate script from OpenAI');
    }

    // Parse the response into structured Q&A pairs
    const qaPairs = this.parseQAPairs(response, questionsCount);

    // Calculate estimated duration (average speaking rate: 150 words/minute)
    const totalWords = qaPairs.reduce((sum, pair) => {
      return sum + pair.question.split(' ').length + pair.answer.split(' ').length;
    }, 0);
    const estimatedDuration = Math.ceil((totalWords / 150) * 60);

    const script: PodcastScript = {
      episode_title: `${guest.name} on ${this.formatTopic(topic)}`,
      guest_id: guest.id,
      guest_name: guest.name,
      topic,
      qa_pairs: qaPairs,
      estimated_duration_seconds: estimatedDuration
    };

    console.log(`Script generated: ${script.episode_title}`);
    console.log(`Estimated duration: ${estimatedDuration}s`);

    return script;
  }

  /**
   * Build the GPT-4 prompt for script generation
   */
  private buildPrompt(guest: GuestProfile, topic: string, count: number): string {
    return `Create a ${count}-question podcast interview script about "${topic}".

Guest Expert:
- Name: ${guest.name}
- Title: ${guest.title}
- Expertise: ${guest.expertise}
- Tone: ${guest.tone}

Host: ${this.hostProfile.name}

Requirements:
1. ${count} questions from the host, each followed by a detailed answer from ${guest.name}
2. Questions should be clear, engaging, and educational
3. Answers should be 2-3 sentences, informative but concise (30-45 seconds when spoken)
4. Use a conversational, professional tone suitable for adults
5. Focus on practical, actionable information
6. Keep it engaging and interesting
7. IMPORTANT: Do NOT include names in the dialogue. Do NOT say "Thanks ${this.hostProfile.name}" or "Welcome ${guest.name}". Just ask/answer directly.
8. Make it sound like a natural conversation where people DON'T repeatedly use each other's names

Format your response as:
Q1: [Direct question - no names, no greetings]
A1: [Direct answer - no names, just the information]

Q2: [Direct question]
A2: [Direct answer]

... and so on.

Example of GOOD format:
Q1: What's the most important factor in preventing heart disease?
A1: Regular cardiovascular exercise is crucial. Just 30 minutes of moderate activity five days a week can significantly reduce your risk. Combined with a balanced diet, it's one of the most effective preventive measures.

Example of BAD format (don't do this):
Q1: Welcome Dr. Smith! Tell me, what's important for heart health?
A1: Thanks for having me, Abdullah! Well, exercise is really important...

Make it natural and engaging without using names!`;
  }

  /**
   * Parse GPT-4 response into Q&A pairs
   */
  private parseQAPairs(response: string, expectedCount: number): QAPair[] {
    const pairs: QAPair[] = [];
    const lines = response.split('\n').filter(line => line.trim());

    let currentQuestion = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Match Q1:, Q2:, etc.
      if (/^Q\d+:/i.test(trimmed)) {
        currentQuestion = trimmed.replace(/^Q\d+:\s*/i, '').trim();
      }
      // Match A1:, A2:, etc.
      else if (/^A\d+:/i.test(trimmed) && currentQuestion) {
        const answer = trimmed.replace(/^A\d+:\s*/i, '').trim();
        pairs.push({ question: currentQuestion, answer });
        currentQuestion = '';
      }
    }

    // Fallback: if parsing failed, try alternative format
    if (pairs.length === 0) {
      const sections = response.split(/Q\d+:|A\d+:/i).filter(s => s.trim());
      for (let i = 0; i < sections.length - 1; i += 2) {
        if (sections[i] && sections[i + 1]) {
          pairs.push({
            question: sections[i].trim(),
            answer: sections[i + 1].trim()
          });
        }
      }
    }

    if (pairs.length !== expectedCount) {
      console.warn(`Expected ${expectedCount} Q&A pairs, got ${pairs.length}`);
    }

    return pairs.slice(0, expectedCount);
  }

  /**
   * Format topic string for display
   */
  private formatTopic(topic: string): string {
    return topic
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get guest profile by ID
   */
  getGuestProfile(guestId: string): GuestProfile | null {
    return this.guestProfiles[guestId] || null;
  }

  /**
   * List all available guests
   */
  listGuests(): GuestProfile[] {
    return Object.values(this.guestProfiles) as GuestProfile[];
  }
}

export default ScriptGenerator;
