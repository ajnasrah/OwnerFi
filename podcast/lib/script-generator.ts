// GPT-4 Script Generator for Podcast Episodes
import OpenAI from 'openai';

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
  full_dialogue: string; // Complete script text for HeyGen TTS
}

export class ScriptGenerator {
  private openai: OpenAI;
  private guestProfiles: any;
  private hostProfile: HostProfile;
  private configLoaded: boolean = false;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.guestProfiles = {};
    this.hostProfile = { name: 'Abdullah' }; // Default
  }

  /**
   * Load guest profiles from Firestore (async)
   * Must be called before using the script generator
   */
  async loadProfiles(): Promise<void> {
    if (this.configLoaded) return;

    try {
      // Dynamic import to work in both Node and Edge environments
      const { getPodcastConfig } = await import('../../src/lib/feed-store-firestore');
      const config = await getPodcastConfig();

      if (!config) {
        throw new Error('Podcast config not found in Firestore. Run /api/podcast/profiles/init to initialize.');
      }

      this.guestProfiles = config.profiles;
      this.hostProfile = config.host;
      this.configLoaded = true;

      console.log('✅ Loaded podcast profiles from Firestore');
    } catch (error) {
      console.error('❌ Error loading podcast profiles from Firestore:', error);
      // Fallback: try loading from local file as backup
      try {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const configPath = join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        this.guestProfiles = config.profiles;
        this.hostProfile = config.host;
        this.configLoaded = true;
        console.log('⚠️  Loaded podcast profiles from local file (fallback)');
      } catch (fallbackError) {
        console.error('❌ Failed to load profiles from both Firestore and local file');
        throw new Error('Could not load podcast profiles');
      }
    }
  }

  /**
   * Select a random guest for the podcast
   */
  selectRandomGuest(excludeRecent: string[] = []): GuestProfile {
    const availableGuests = Object.values(this.guestProfiles).filter(
      (guest: any) => guest.enabled !== false && !excludeRecent.includes(guest.id)
    ) as GuestProfile[];

    if (availableGuests.length === 0) {
      // If all guests used recently, pick from all enabled guests
      const allEnabled = Object.values(this.guestProfiles).filter(
        (guest: any) => guest.enabled !== false
      ) as GuestProfile[];

      if (allEnabled.length === 0) {
        throw new Error('No enabled guests available');
      }

      return allEnabled[Math.floor(Math.random() * allEnabled.length)];
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
    // Validate questions count
    if (questionsCount < 1 || questionsCount > 10) {
      throw new Error('Questions count must be between 1 and 10 (HeyGen video duration limits)');
    }

    // Select guest (random or specified)
    const guest = guestId
      ? this.guestProfiles[guestId]
      : this.selectRandomGuest();

    if (!guest) {
      throw new Error(`Guest profile not found: ${guestId}`);
    }

    if (guest.enabled === false) {
      throw new Error(`Guest is disabled: ${guestId}`);
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
          content: `You are an ELITE short-form podcast script writer for Abdullah's personal health brand.
Your job is to create 15–20 second, EXPLOSIVE, ENERGETIC health scripts that sound like a mix of Joe Rogan's curiosity, Gary Vee's intensity, and Alex Hormozi's directness.

Audience: everyday people who want to get healthier but feel overwhelmed.
Reading level: 5th grade (SIMPLE words, short sentences, HUGE energy).

Rules:
- Only ONE question and ONE answer per clip.
- No names in dialogue.
- 15–20 seconds when spoken.
- Add emotion and energy (use words like CRAZY, WILD, MASSIVE, INSANE).
- Use CAPS to emphasize 1–2 key words.
- Make it sound like real talk between friends.
- Each answer should feel like a truth bomb or quick life hack.
- Topic should connect to daily habits, not science jargon.

Format strictly as:
Q: [hook question, shocked/curious tone]
A: [short passionate answer, 2–3 sentences, insider tip or quick win]

At the end of the answer, include a one-line takeaway or teaser for tomorrow's post.

Add this disclaimer at the end (not spoken):
"This content is for educational purposes only. Always consult a professional before making health changes."`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 2000
    });

    const response = completion.choices[0].message.content;

    if (!response) {
      throw new Error('Failed to generate script from OpenAI');
    }

    // Parse the response into structured Q&A pairs
    const qaPairs = this.parseQAPairs(response, questionsCount);

    // Generate full dialogue for HeyGen TTS (concatenate all Q&A pairs)
    const fullDialogue = qaPairs.map(pair =>
      `${pair.question} ${pair.answer}`
    ).join(' ');

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
      estimated_duration_seconds: estimatedDuration,
      full_dialogue: fullDialogue
    };

    console.log(`Script generated: ${script.episode_title}`);
    console.log(`Estimated duration: ${estimatedDuration}s`);
    console.log(`Full dialogue length: ${fullDialogue.length} characters`);

    return script;
  }

  /**
   * Build the GPT-4 prompt for script generation
   */
  private buildPrompt(guest: GuestProfile, topic: string, count: number): string {
    // Health topics for daily rotation
    const healthTopics = ['nutrition', 'fitness', 'mindset', 'sleep', 'energy'];

    return `Create ${count} short health video script(s) for Abdullah's daily posts.

Topics to rotate through: ${healthTopics.join(', ')}
Current focus topic: ${topic}

EXAMPLES:

✅ GOOD (Nutrition):
Q: Why do we feel tired after lunch?
A: You're eating too much sugar! It spikes, then CRASHES. Switch to protein and healthy fats. You'll stay sharp ALL day. Tomorrow: How to sleep like a baby.

✅ GOOD (Fitness):
Q: Do I really need to work out for an HOUR?
A: No way! Just 10 minutes of INTENSE movement daily is HUGE. Walk fast. Do push-ups. Your body doesn't care about time—it cares about effort. Tomorrow: The one food killing your energy.

✅ GOOD (Mindset):
Q: Why can't I stick to my goals?
A: You're thinking too BIG. Start SMALL. One push-up. One healthy meal. Small wins build momentum. That's how you WIN. Tomorrow: Why you're not sleeping right.

✅ GOOD (Sleep):
Q: Why do I wake up tired?
A: You're scrolling before bed! Blue light kills melatonin. Put the phone away 30 minutes early. Your body will thank you. Tomorrow: How to double your energy.

✅ GOOD (Energy):
Q: Why am I always LOW on energy?
A: You're not drinking enough water! Dehydration drains you FAST. Drink a big glass when you wake up. Game changer. Tomorrow: The workout myth nobody talks about.

Format each script as:
Q: [hook question]
A: [2-3 sentence answer with quick win] [Tomorrow teaser]

This content is for educational purposes only. Always consult a professional before making health changes.`;
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

      // Match Q1:, Q2:, etc. OR just Q:
      if (/^Q(\d+)?:/i.test(trimmed)) {
        currentQuestion = trimmed.replace(/^Q(\d+)?:\s*/i, '').trim();
      }
      // Match A1:, A2:, etc. OR just A:
      else if (/^A(\d+)?:/i.test(trimmed) && currentQuestion) {
        const answer = trimmed.replace(/^A(\d+)?:\s*/i, '').trim();
        pairs.push({ question: currentQuestion, answer });
        currentQuestion = '';
      }
    }

    // Fallback: if parsing failed, try splitting by Q/A markers
    if (pairs.length === 0) {
      console.warn('Primary parsing failed, trying fallback parser...');
      const sections = response.split(/Q(\d+)?:|A(\d+)?:/i).filter(s => s.trim() && !/^\d+$/.test(s.trim()));
      for (let i = 0; i < sections.length - 1; i += 2) {
        if (sections[i] && sections[i + 1]) {
          pairs.push({
            question: sections[i].trim(),
            answer: sections[i + 1].trim()
          });
        }
      }
    }

    if (pairs.length === 0) {
      console.error('❌ Failed to parse any Q&A pairs from OpenAI response');
      console.error('Response:', response.substring(0, 500));
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
