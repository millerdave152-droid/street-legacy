/**
 * IntentExemplars - Training phrases for semantic intent classification
 *
 * Each intent has multiple exemplar phrases that represent how users
 * might express that intent. These are used by the semantic engine
 * to match similar inputs via embedding similarity.
 */

// Intent categories with training exemplars
export const INTENT_EXEMPLARS = {
  // === MONEY & EARNING ===
  money_advice: {
    friendlyName: 'Money Tips',
    exemplars: [
      // Direct questions
      'how do i make money',
      'how can i earn cash',
      'whats the best way to get money',
      'i need money fast',
      'help me earn money',
      'give me money tips',
      'how to make more cash',
      'tell me how to get rich',
      'whats the fastest way to earn',
      'how do i earn more',

      // Slang variations (pre-normalized)
      'need money right now',
      'need money quick',
      'how to stack money',
      'best way to get money',
      'making money advice',
      'what should i do for money',
      'how to become rich',

      // Situational
      'im broke what do i do',
      'i have no money',
      'low on cash help',
      'need to earn fast',
      'running out of money',
      'cant afford anything',

      // Comparative
      'whats more profitable',
      'which makes more money',
      'best paying activity',
      'highest earning option',
    ],
    keywords: ['money', 'cash', 'earn', 'rich', 'broke', 'profit', 'income', 'pay', 'wealthy'],
  },

  // === CRIME ADVICE ===
  crime_advice: {
    friendlyName: 'Crime Tips',
    exemplars: [
      // Direct questions
      'what crime should i do',
      'which crime is best',
      'help me with crimes',
      'crime recommendations',
      'what crime to commit',
      'best crime for my level',
      'suggest a crime',
      'what can i steal',
      'crime tips please',

      // Skill-based
      'what crime matches my skills',
      'crimes for beginners',
      'easy crimes to start',
      'harder crimes available',
      'advanced crime options',

      // Risk/reward
      'low risk crimes',
      'safe crimes to do',
      'high reward crimes',
      'risky but worth it',
      'crimes with good payout',

      // Situational
      'something quick to do',
      'got time to kill crime',
      'what can i do right now',
      'any opportunities',
      'whats available',
    ],
    keywords: ['crime', 'steal', 'robbery', 'heist', 'burglary', 'theft', 'criminal'],
  },

  // === STATS & STATUS ===
  stat_analysis: {
    friendlyName: 'Status Check',
    exemplars: [
      // Direct requests
      'show my stats',
      'check my status',
      'what are my stats',
      'how am i doing',
      'analyze my situation',
      'give me a rundown',
      'my current status',
      'status report',

      // Specific stats
      'what is my health',
      'how much energy do i have',
      'check my money',
      'what level am i',
      'how much experience',
      'my reputation level',

      // Progress
      'how far have i come',
      'am i doing well',
      'is my progress good',
      'where do i stand',
      'how do i compare',
    ],
    keywords: ['stats', 'status', 'health', 'energy', 'level', 'experience', 'progress'],
  },

  // === HEAT & WANTED ===
  heat_advice: {
    friendlyName: 'Heat Check',
    exemplars: [
      // Direct questions
      'how hot am i',
      'what is my heat level',
      'am i wanted',
      'check my wanted level',
      'are cops after me',
      'heat check',
      'how much heat',

      // Advice seeking
      'how to reduce heat',
      'how to lower wanted level',
      'getting too hot',
      'cops are onto me',
      'how to cool down',
      'lay low advice',
      'avoiding police tips',
      'escape the heat',

      // Situational
      'will i get caught',
      'is it safe to do crime',
      'should i lay low',
      'am i being watched',
      'heat too high',
    ],
    keywords: ['heat', 'wanted', 'police', 'cops', 'arrest', 'caught', 'hot', 'cool'],
  },

  // === TIME MANAGEMENT ===
  time_management: {
    friendlyName: 'Time Advice',
    exemplars: [
      // General
      'what should i do now',
      'whats the best use of time',
      'what to do next',
      'how to spend my time',
      'prioritize my actions',
      'whats most important',

      // Specific situations
      'running out of energy',
      'should i rest',
      'should i sleep',
      'what to do while waiting',
      'best thing to do right now',
      'optimize my time',
      'time is running out',

      // Planning
      'plan my next move',
      'what comes next',
      'priority list',
      'daily routine advice',
    ],
    keywords: ['time', 'now', 'next', 'priority', 'should', 'best', 'wait', 'rest'],
  },

  // === JOB ADVICE ===
  job_advice: {
    friendlyName: 'Job Tips',
    exemplars: [
      // Seeking work
      'what jobs are available',
      'how do i get a job',
      'legit work options',
      'legal ways to earn',
      'any work around',
      'job opportunities',
      'where to find work',

      // Comparison
      'crime vs jobs',
      'is working worth it',
      'should i get a job',
      'jobs that pay well',
      'best legal job',

      // Specific
      'part time work',
      'quick jobs',
      'flexible work',
    ],
    keywords: ['job', 'work', 'employ', 'legal', 'legit', 'honest', 'career'],
  },

  // === MARKET & TRADING ===
  market_analysis: {
    friendlyName: 'Market Info',
    exemplars: [
      // Prices
      'what are current prices',
      'price check',
      'how much is this worth',
      'market prices',
      'going rate for items',
      'check item value',

      // Trading
      'best things to sell',
      'what to buy',
      'trading advice',
      'profitable trades',
      'fence prices',
      'sell my stuff',

      // Trends
      'market trends',
      'price changes',
      'good time to sell',
      'worth holding onto',
    ],
    keywords: ['price', 'buy', 'sell', 'trade', 'market', 'value', 'worth', 'cost'],
  },

  // === EQUIPMENT & ITEMS ===
  equipment_advice: {
    friendlyName: 'Equipment Tips',
    exemplars: [
      // General
      'what gear do i need',
      'equipment recommendations',
      'best tools for the job',
      'upgrade my gear',
      'item suggestions',

      // Specific
      'what lockpicks to buy',
      'best weapon',
      'disguise options',
      'tools for burglary',
      'equipment for heists',

      // Comparison
      'is this item worth it',
      'should i upgrade',
      'better equipment available',
      'my current gear good enough',
    ],
    keywords: ['gear', 'equipment', 'tool', 'item', 'weapon', 'upgrade', 'buy'],
  },

  // === LOCATION & TERRITORY ===
  location_tips: {
    friendlyName: 'Location Info',
    exemplars: [
      // Information
      'tell me about downtown',
      'what area is best',
      'describe this district',
      'location information',
      'neighborhood guide',
      'territory info',

      // Recommendations
      'where should i go',
      'best area for crimes',
      'safest neighborhood',
      'high value targets area',
      'which district',

      // Navigation
      'how to get to',
      'travel options',
      'distance to',
    ],
    keywords: ['area', 'district', 'location', 'neighborhood', 'territory', 'zone', 'downtown'],
  },

  // === CREW & SOCIAL ===
  crew_management: {
    friendlyName: 'Crew Info',
    exemplars: [
      // General
      'how do i get a crew',
      'crew management',
      'team advice',
      'working with others',
      'partner up',

      // Specific
      'recruit members',
      'crew benefits',
      'split earnings',
      'trust issues with crew',
      'crew loyalty',

      // Social
      'making connections',
      'build relationships',
      'network in the game',
    ],
    keywords: ['crew', 'team', 'partner', 'gang', 'member', 'ally', 'connection'],
  },

  // === AI INTEL ===
  ai_intel: {
    friendlyName: 'AI Intel',
    exemplars: [
      // General intel
      'give me intel',
      'what do you know',
      'any useful information',
      'secret tips',
      'insider info',
      'hidden knowledge',

      // Specific
      'whats happening in the city',
      'any news',
      'word on the street',
      'rumors',
      'underground info',

      // Analysis
      'analyze the situation',
      'threat assessment',
      'opportunity analysis',
    ],
    keywords: ['intel', 'info', 'secret', 'hidden', 'rumor', 'news', 'knowledge'],
  },

  // === GREETING & SOCIAL ===
  greeting: {
    friendlyName: 'Greeting',
    exemplars: [
      'hello',
      'hi sarah',
      'hey',
      'whats up',
      'yo',
      'sup',
      'greetings',
      'good morning',
      'good evening',
      'howdy',
    ],
    keywords: ['hello', 'hi', 'hey', 'greet', 'morning', 'evening'],
  },

  thanks: {
    friendlyName: 'Thanks',
    exemplars: [
      'thanks',
      'thank you',
      'appreciate it',
      'thats helpful',
      'awesome thanks',
      'perfect',
      'great help',
    ],
    keywords: ['thank', 'appreciate', 'helpful', 'great'],
  },

  who_are_you: {
    friendlyName: 'Identity Question',
    exemplars: [
      'who are you',
      'what are you',
      'whats sarah',
      'tell me about yourself',
      'what can you do',
      'are you an ai',
      'how do you work',
    ],
    keywords: ['who', 'what', 'yourself', 'about'],
  },

  // === HELP & TUTORIAL ===
  help: {
    friendlyName: 'Help Request',
    exemplars: [
      'help',
      'i need help',
      'how does this work',
      'explain the game',
      'tutorial',
      'guide me',
      'im lost',
      'what do i do',
      'im confused',
      'show me around',
      'beginner tips',
      'new player help',
      'commands list',
      'what commands are there',
    ],
    keywords: ['help', 'tutorial', 'guide', 'confused', 'lost', 'explain', 'beginner'],
  },

  // === STRATEGY & PLANNING ===
  strategy_advice: {
    friendlyName: 'Strategy Tips',
    exemplars: [
      'how to succeed',
      'best strategy',
      'long term plan',
      'how to progress',
      'tips for winning',
      'optimal path',
      'how to level up fast',
      'efficiency tips',
      'min max advice',
      'advanced strategies',
    ],
    keywords: ['strategy', 'plan', 'succeed', 'win', 'progress', 'level', 'optimal'],
  },

  // === OPPORTUNITIES ===
  opportunity_inquiry: {
    friendlyName: 'Opportunities',
    exemplars: [
      'any opportunities',
      'whats available',
      'show me opportunities',
      'pending offers',
      'any jobs waiting',
      'messages for me',
      'anyone looking for me',
      'any work available',
      'new opportunities',
    ],
    keywords: ['opportunity', 'offer', 'available', 'pending', 'message', 'waiting'],
  },

  // === ADVENTURE ===
  adventure_interest: {
    friendlyName: 'Adventure',
    exemplars: [
      'start an adventure',
      'i want a story',
      'give me a mission',
      'something exciting',
      'lets do something fun',
      'adventure time',
      'interactive story',
      'text adventure',
      'play a story',
    ],
    keywords: ['adventure', 'story', 'mission', 'exciting', 'fun', 'quest', 'narrative'],
  },

  // === RELATIONSHIP ===
  relationship_inquiry: {
    friendlyName: 'Relationships',
    exemplars: [
      'who can i trust',
      'relationship status',
      'npc relationships',
      'who likes me',
      'trust levels',
      'my connections',
      'allies and enemies',
      'who should i work with',
    ],
    keywords: ['trust', 'relationship', 'ally', 'enemy', 'friend', 'connection', 'like'],
  },

  // === FALLBACK ===
  unknown: {
    friendlyName: 'Unknown',
    exemplars: [],
    keywords: [],
  }
}

// Export list of all intent names
export const INTENT_NAMES = Object.keys(INTENT_EXEMPLARS)

// Get all exemplars for an intent
export function getExemplars(intentName) {
  return INTENT_EXEMPLARS[intentName]?.exemplars || []
}

// Get keywords for an intent
export function getKeywords(intentName) {
  return INTENT_EXEMPLARS[intentName]?.keywords || []
}

// Get friendly name for an intent
export function getFriendlyName(intentName) {
  return INTENT_EXEMPLARS[intentName]?.friendlyName || intentName
}

// Get all intents with their exemplar counts
export function getIntentStats() {
  return Object.entries(INTENT_EXEMPLARS).map(([name, data]) => ({
    name,
    friendlyName: data.friendlyName,
    exemplarCount: data.exemplars.length,
    keywordCount: data.keywords.length
  }))
}

// Find intents by keyword
export function findIntentsByKeyword(keyword) {
  const lower = keyword.toLowerCase()
  const matches = []

  for (const [name, data] of Object.entries(INTENT_EXEMPLARS)) {
    if (data.keywords.some(k => k.includes(lower) || lower.includes(k))) {
      matches.push(name)
    }
  }

  return matches
}

// Total exemplar count
export function getTotalExemplarCount() {
  return Object.values(INTENT_EXEMPLARS)
    .reduce((sum, data) => sum + data.exemplars.length, 0)
}

console.log('[IntentExemplars] Loaded',
  INTENT_NAMES.length, 'intents with',
  getTotalExemplarCount(), 'total exemplars'
)

export default INTENT_EXEMPLARS
