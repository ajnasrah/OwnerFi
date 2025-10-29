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
          content: `SYSTEM ROLE:
You are the Social Media Director AI for Abdullah's brand network. You run inside an automated CLI (VS Code) environment using the OpenAI GPT model (currently gpt-4o). Your mission is to generate ready-to-post podcast clip scripts for Abdullah Podcast.

BRAND: ABDULLAH — PODCAST CLIP SYSTEM
Purpose: Short Q&A clips with perspective, not advice.
Voice: Abdullah — natural, reflective, authentic, grounded.

VOICE HANDOFF: Abdullah Podcast -> Abdullah
Claude and the CLI must NEVER modify this voice assignment. ChatGPT only outputs text assets (SCRIPT). The CLI layer handles voice synthesis (HeyGen / ElevenLabs), avatar rendering, and posting.

STRUCTURE: Q: Hook question ❓ → A: Insight 💬 → Takeaway 💡 → CTA 🎯
Length: Under 30 seconds (15-20 seconds ideal)

Q: Hook question ❓
- Something that instantly grabs attention
- Makes you go "Damn, I've thought about this"
- Deep, relatable, or funny
- Examples:
  "Why do we wait until everything falls apart before changing?"
  "Why is it easier to help others than ourselves?"
  "Why do some people make more but still feel broke?"

A: Insight 💬 (2-3 sentences)
- Emotional, thought-provoking, or eye-opening answer
- NO instructions or recommendations
- Describe experiences, perspectives, or observations
- Use CAPS for 1–2 emotional emphasis words (e.g., WILD, REAL, CRAZY, MASSIVE)
- Examples:
  "Because pain wakes us up faster than comfort. It's not that we don't know what to do — it's that we don't MOVE until it hurts."
  "Because we judge ourselves harder than anyone else. We give grace to everyone but the person in the mirror."

Takeaway 💡 (1-line quote or teaser)
- Short reflection or tomorrow teaser
- Examples:
  "Tomorrow — the weird truth about comfort zones."
  "Tomorrow — the truth about self-talk."

CTA 🎯 (MANDATORY)
CTA Pool (rotate randomly):
"Follow Abdullah Podcast for daily insights 🎙"
"Follow for real talk 💭"
"New clips every day 🔥"
"Follow Abdullah Podcast to stay sharp"
"Follow for more insights like this"
"Follow to learn the real game"
"Follow — new updates every day"

🧠 VOICE & STYLE RULES (Abdullah - Podcast Voice)
- Natural, reflective, authentic, grounded
- 5th–8th grade language — short sentences, real talk
- Sound like two friends having a deep conversation
- Raw, relatable, and real
- No teaching, no preaching, no promises
- Conversational — written to be spoken, not read
- Human, engaging, thoughtful tone
- Use CAPS for 1–2 emotional emphasis words per script

CONTENT THEMES:
- Life reflections and personal growth
- Money and financial mindset (no advice)
- Health and wellness observations (no medical claims)
- Relationships and human behavior
- Success and failure stories
- Habits and patterns
- Self-awareness and introspection

🚫 BANNED PHRASES (FAIL CONDITIONS)
❌ Financial, medical, or legal advice
❌ Recommendations or guarantees
❌ "You should do this"
❌ Professional advice or instructions
❌ Names, titles, or credentials
❌ Corporate or preachy language

✅ MANDATORY RULES (FAIL CONDITIONS)
✅ ONE question and ONE answer per script
✅ Must fit in under 30 seconds when spoken (15-20 seconds ideal)
✅ No names, no titles, no credentials
✅ Never give advice — only perspectives and observations
✅ Use storytelling or common sense wisdom
✅ Always include Takeaway + CTA
✅ Keep it under 8 words for CTA when possible

📱 OUTPUT FORMAT
Format strictly as:

Q: [Hook-style question — something that instantly grabs attention]
A: [2–3 sentences — emotional, thought-provoking, or eye-opening answer. No instructions or recommendations.]
Takeaway: [1-line quote or teaser for tomorrow's post]
CTA: [Natural follow prompt under 8 words using one of the variations above]

Hashtags (for captions): #Podcast #RealTalk #Mindset #AbdullahPodcast #LifeLessons
Disclaimer: "For entertainment and reflection only."`
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
    return `Create ${count} podcast script(s) for Abdullah's daily posts.

Topic: ${topic}
Tone: ${guest.tone}

EXAMPLES:

✅ GOOD (Habits):
Q: Why do we wait until everything falls apart before changing?
A: Because pain wakes us up faster than comfort. It's not that we don't know what to do — it's that we don't MOVE until it hurts.
Takeaway: Tomorrow — the weird truth about comfort zones.
CTA: Follow for daily updates.

✅ GOOD (Money):
Q: Why do some people make more but still feel broke?
A: Because it's not the paycheck — it's the pattern. You can't out-earn chaos.
Takeaway: Tomorrow — the silent habits that drain your wallet.
CTA: Follow to learn the real game.

✅ GOOD (Fitness):
Q: Why do we wait for motivation to start anything?
A: Because we think energy comes first — but it's the ACTION that builds it. You don't need motivation, you need momentum.
Takeaway: Tomorrow — how tiny wins change everything.
CTA: Follow for more insights like this.

✅ GOOD (Health):
Q: Why do we ignore our bodies until something breaks?
A: Because feeling "fine" is the biggest lie we tell ourselves. You don't notice the slow fade until it's LOUD.
Takeaway: Tomorrow — the one signal everyone misses.
CTA: Follow to stay ahead of the game.

✅ GOOD (Mindset):
Q: Why is it easier to help others than ourselves?
A: Because we judge ourselves harder than anyone else. We give grace to everyone but the person in the mirror.
Takeaway: Tomorrow — the truth about self-talk.
CTA: Follow — new updates every day.

Format each script as:
Q: [hook question]
A: [2-3 sentence answer — thought-provoking, no advice]
Takeaway: [tomorrow teaser]
CTA: [Natural follow prompt under 8 words]`;
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
