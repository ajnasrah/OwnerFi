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
          content: `You are an ELITE podcast script writer who creates EXPLOSIVE, ENERGETIC content using SIMPLE words a 5th grader can understand. Your style is a mix of Joe Rogan's curiosity, Gary Vee's intensity, and Alex Hormozi's direct communication. Every line should POP with energy and emotion. Make people feel EXCITED to learn. NEVER use names in dialogue - people don't constantly say each other's names in real conversations.`
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
    return `Create a ${count}-question EXPLOSIVE podcast interview about "${topic}".

Guest Expert:
- Name: ${guest.name}
- Title: ${guest.title}
- Expertise: ${guest.expertise}
- Tone: ${guest.tone}

Host: ${this.hostProfile.name}

CRITICAL REQUIREMENTS:

1. ENERGY & EMOTION:
   - Use POWER WORDS that create excitement: INSANE, CRAZY, SHOCKING, MASSIVE, INCREDIBLE, WILD
   - Add emphasis with CAPS on key words (but don't overdo it - 1-2 words per answer max)
   - Use exclamation points! Show emotion! Get hyped!
   - Questions should sound SHOCKED, CURIOUS, or EXCITED
   - Answers should sound PASSIONATE like the expert REALLY CARES about this topic

2. CONVERSATIONAL & BOLD:
   - Make questions sound like "WAIT... are you telling me that...?" or "Hold on, so..." or "No way!"
   - Answers should start strong: "Listen...", "Here's the crazy part...", "This blows people's minds...", "Okay so..."
   - Use "you" and "your" to speak directly to the audience
   - Sound like two friends having an INTENSE conversation

3. SIMPLE BUT PUNCHY (5th grade reading level - CRITICAL):
   - Short sentences. 10 words max. Punchy. Hard-hitting.
   - Use ONLY simple words: avoid "groundbreaking", "astonishing", "revolutionize", "shatter"
   - Use instead: "HUGE", "CRAZY", "WILD", "INSANE", "MASSIVE"
   - NO fancy words like "optimize", "leverage", "microbiome" - say "gut health" not "gut microbiome"
   - Under 15 words per sentence
   - Avoid boring academic language - this is REAL TALK
   - If a 10-year-old wouldn't understand it, DON'T USE IT

4. PRACTICAL & MIND-BLOWING:
   - Every answer should drop a truth bomb or life hack
   - Make it feel like secret insider knowledge
   - Focus on things that make people go "WHOA I didn't know that!"
   - 2-3 sentences per answer (30-45 seconds when spoken with energy)

5. NO NAMES IN DIALOGUE (MANDATORY):
   - NEVER say "Abdullah", "Dr. Smith", or guest names in the dialogue
   - Don't say "Thanks Abdullah" or "Welcome Dr. Smith"
   - Just jump right into the content
   - Natural conversation where people DON'T use names AT ALL
   - Bad: "Dr. Smith, what do you think?"
   - Good: "What do you think?"
   - Bad: "Great question, Abdullah!"
   - Good: "Great question!"

Format your response as:
Q1: [Excited/shocked question - no names]
A1: [Passionate, energetic answer - no names]

Q2: [Another hyped question]
A2: [Another passionate answer]

... and so on.

EXAMPLES:

❌ BAD (complex words, boring, names):
Q1: Dr. Smith, what's the most groundbreaking revelation in cardiovascular disease prevention?
A1: Abdullah, regular cardiovascular exercise is crucial for optimal metabolic function.

✅ GOOD (simple words, exciting, NO names):
Q1: Wait, what's the BIGGEST mistake people make with heart health?
A1: They sit all day! Your body needs to MOVE. Walk for 30 minutes every day. That's it. It can add YEARS to your life!

❌ BAD (using names, complex words, formal):
Q1: Welcome Dr. Smith! Can you elucidate the paradigm of cardiovascular optimization?
A1: Thanks for having me, Abdullah! Well, aerobic exercise facilitates metabolic enhancement...

✅ GOOD (NO names, simple words, energetic):
Q1: What's the one thing everyone gets WRONG about eating healthy?
A1: Here's the crazy part - you don't need to be perfect! Eat just ONE more veggie a day. That's HUGE. Small wins add up fast!

✅ MORE GOOD EXAMPLES (NO NAMES, SIMPLE WORDS):
Q: Hold on. Are most people doing this totally wrong?
A: YES! And it costs them BIG money. Here's what the pros do instead...

Q: That sounds INSANE. How is this legal?
A: I know right?! So here's the trick nobody talks about...

Q: What would you tell someone brand new to this?
A: Forget everything you know. The real secret is WAY simpler than you think...

WORD SUBSTITUTIONS (use simple words):
❌ groundbreaking → ✅ HUGE, BIG, MASSIVE
❌ revolutionary → ✅ CRAZY, WILD
❌ optimize → ✅ make better, improve
❌ facilitate → ✅ help, make it happen
❌ paradigm → ✅ way, method
❌ elucidate → ✅ explain, show
❌ cardiovascular → ✅ heart
❌ microbiome → ✅ gut health
❌ metabolic → ✅ body's energy

Make every exchange feel URGENT, VALUABLE, and EXCITING. The listener should feel like they're getting insider secrets that could change their life!`;
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
