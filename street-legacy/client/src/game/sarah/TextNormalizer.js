/**
 * TextNormalizer - Text preprocessing for semantic understanding
 *
 * Handles:
 * - Street slang translation
 * - Abbreviation expansion
 * - Text cleaning and normalization
 * - Contraction expansion
 */

// Comprehensive street slang dictionary
const SLANG_MAP = {
  // Money slang
  'paper': 'money',
  'bread': 'money',
  'dough': 'money',
  'cheddar': 'money',
  'guap': 'money',
  'stacks': 'money',
  'bands': 'money',
  'racks': 'money',
  'benjamins': 'money',
  'bucks': 'money',
  'cash': 'money',
  'loot': 'money',
  'moolah': 'money',
  'gwop': 'money',
  'cheese': 'money',
  'green': 'money',
  'scrilla': 'money',
  'cake': 'money',
  'bag': 'money',
  'bankroll': 'money',

  // Crime slang
  'lick': 'crime',
  'score': 'crime',
  'job': 'crime',
  'gig': 'crime',
  'heist': 'crime',
  'hustle': 'crime',
  'come up': 'opportunity',
  'plug': 'connection',
  'connect': 'connection',
  'fence': 'seller',
  'boost': 'steal',
  'jack': 'steal',
  'hit': 'crime',
  'move': 'action',
  'play': 'scheme',

  // Police/Heat slang
  'heat': 'wanted',
  'hot': 'wanted',
  'five-o': 'police',
  'feds': 'police',
  'cops': 'police',
  'pigs': 'police',
  '12': 'police',
  'po-po': 'police',
  'law': 'police',
  'badge': 'police',
  'boys in blue': 'police',
  'narcs': 'police',
  'one time': 'police',
  'jake': 'police',
  'on my ass': 'wanted',
  'laying low': 'hiding',
  'underground': 'hiding',

  // Status/Condition slang
  'broke': 'poor',
  'busted': 'poor',
  'strapped': 'poor',
  'tight': 'poor',
  'loaded': 'rich',
  'ballin': 'rich',
  'flush': 'rich',
  'paid': 'rich',
  'stacked': 'rich',
  'eating good': 'successful',
  'starving': 'desperate',
  'hurting': 'desperate',

  // Action slang
  'roll': 'go',
  'bounce': 'leave',
  'dip': 'leave',
  'jet': 'leave',
  'slide': 'go',
  'pull up': 'arrive',
  'mob': 'go',
  'cruise': 'go',
  'peep': 'look',
  'scope': 'look',
  'check out': 'look',
  'eyeball': 'look',
  'case': 'scout',
  'stake out': 'scout',

  // People slang
  'homie': 'friend',
  'dawg': 'friend',
  'fam': 'friend',
  'bro': 'friend',
  'bruh': 'friend',
  'cuz': 'friend',
  'g': 'friend',
  'gang': 'crew',
  'squad': 'crew',
  'set': 'crew',
  'clique': 'crew',
  'opp': 'enemy',
  'opps': 'enemies',
  'snitch': 'informant',
  'rat': 'informant',

  // Affirmative/Negative
  'bet': 'yes',
  'aight': 'okay',
  'ight': 'okay',
  'word': 'yes',
  'facts': 'true',
  'no cap': 'true',
  'fr': 'for real',
  'deadass': 'seriously',
  'nah': 'no',
  'hell nah': 'no',
  'cap': 'lie',
  'cappin': 'lying',
  'trippin': 'wrong',

  // Intensity/Quality
  'fire': 'good',
  'lit': 'good',
  'dope': 'good',
  'sick': 'good',
  'cold': 'good',
  'hard': 'good',
  'lowkey': 'somewhat',
  'highkey': 'very',
  'mad': 'very',
  'hella': 'very',
  'sus': 'suspicious',
  'sketch': 'suspicious',
  'sketchy': 'suspicious',
  'shady': 'suspicious',
  'legit': 'legitimate',
  'solid': 'reliable',
  'weak': 'bad',
  'trash': 'bad',
  'wack': 'bad',
  'lame': 'bad',
  'whack': 'bad',

  // Time slang
  'rn': 'right now',
  'asap': 'immediately',
  'stat': 'immediately',
  'quick': 'fast',
  'later': 'soon',
  'in a min': 'soon',
  'in a sec': 'soon',

  // Misc game-related
  'rep': 'reputation',
  'cred': 'reputation',
  'clout': 'reputation',
  'respect': 'reputation',
  'xp': 'experience',
  'lvl': 'level',
  'stats': 'status',
  'gear': 'equipment',
  'tools': 'equipment',
  'kit': 'equipment',
  'ride': 'vehicle',
  'whip': 'vehicle',
  'turf': 'territory',
  'block': 'territory',
  'hood': 'neighborhood',
  'trap': 'location',
  'spot': 'location',
  'crib': 'home',
  'pad': 'home',
}

// Abbreviation expansion
const ABBREVIATIONS = {
  // Common internet/text abbreviations
  'u': 'you',
  'ur': 'your',
  'r': 'are',
  'y': 'why',
  'n': 'and',
  'b': 'be',
  'c': 'see',
  'k': 'okay',
  'w': 'with',
  'w/': 'with',
  'w/o': 'without',
  'bc': 'because',
  'cuz': 'because',
  'tho': 'though',
  'thru': 'through',
  'pls': 'please',
  'plz': 'please',
  'thx': 'thanks',
  'ty': 'thank you',
  'np': 'no problem',
  'nvm': 'never mind',
  'idk': 'i dont know',
  'ik': 'i know',
  'ikr': 'i know right',
  'idc': 'i dont care',
  'idgaf': 'i dont care',
  'imo': 'in my opinion',
  'imho': 'in my opinion',
  'tbh': 'to be honest',
  'tbt': 'throwback',
  'smh': 'shaking my head',
  'ngl': 'not gonna lie',
  'jk': 'just kidding',
  'lol': 'laughing',
  'lmao': 'laughing',
  'lmfao': 'laughing',
  'rofl': 'laughing',
  'brb': 'be right back',
  'gtg': 'got to go',
  'g2g': 'got to go',
  'omg': 'oh my god',
  'omw': 'on my way',
  'wyd': 'what you doing',
  'wya': 'where you at',
  'hmu': 'hit me up',
  'lmk': 'let me know',
  'rn': 'right now',
  'atm': 'at the moment',
  'btw': 'by the way',
  'fyi': 'for your information',
  'afaik': 'as far as i know',
  'iirc': 'if i remember correctly',
  'fwiw': 'for what its worth',
  'tldr': 'summary',
  'eta': 'estimated time',
  'asap': 'as soon as possible',
  'diy': 'do it yourself',
  'aka': 'also known as',
  'faq': 'frequently asked questions',
  'misc': 'miscellaneous',
  'vs': 'versus',
  'etc': 'etcetera',
  'eg': 'for example',
  'ie': 'that is',

  // Game-specific abbreviations
  'xp': 'experience points',
  'lvl': 'level',
  'hp': 'health',
  'dmg': 'damage',
  'atk': 'attack',
  'def': 'defense',
  'npc': 'character',
  'ai': 'artificial intelligence',
  'pve': 'player versus environment',
  'pvp': 'player versus player',
  'op': 'overpowered',
  'nerf': 'weaken',
  'buff': 'strengthen',
  'gg': 'good game',
  'gl': 'good luck',
  'hf': 'have fun',
  'afk': 'away',

  // Question words abbreviated
  'wat': 'what',
  'wut': 'what',
  'wht': 'what',
  'hw': 'how',
  'wen': 'when',
  'wer': 'where',
  'hu': 'who',
}

// Contractions that need expansion
const CONTRACTIONS = {
  "i'm": 'i am',
  "im": 'i am',
  "you're": 'you are',
  "youre": 'you are',
  "he's": 'he is',
  "hes": 'he is',
  "she's": 'she is',
  "shes": 'she is',
  "it's": 'it is',
  "its": 'it is', // Could be possessive, but usually means "it is" in queries
  "we're": 'we are',
  "were": 'we are',
  "they're": 'they are',
  "theyre": 'they are',
  "that's": 'that is',
  "thats": 'that is',
  "what's": 'what is',
  "whats": 'what is',
  "who's": 'who is',
  "whos": 'who is',
  "where's": 'where is',
  "wheres": 'where is',
  "how's": 'how is',
  "hows": 'how is',
  "here's": 'here is',
  "heres": 'here is',
  "there's": 'there is',
  "theres": 'there is',
  "i've": 'i have',
  "ive": 'i have',
  "you've": 'you have',
  "youve": 'you have',
  "we've": 'we have',
  "weve": 'we have',
  "they've": 'they have',
  "theyve": 'they have',
  "i'll": 'i will',
  "ill": 'i will',
  "you'll": 'you will',
  "youll": 'you will',
  "he'll": 'he will',
  "hell": 'he will',
  "she'll": 'she will',
  "shell": 'she will',
  "it'll": 'it will',
  "itll": 'it will',
  "we'll": 'we will',
  "well": 'we will',
  "they'll": 'they will',
  "theyll": 'they will',
  "i'd": 'i would',
  "id": 'i would',
  "you'd": 'you would',
  "youd": 'you would',
  "he'd": 'he would',
  "hed": 'he would',
  "she'd": 'she would',
  "shed": 'she would',
  "we'd": 'we would',
  "wed": 'we would',
  "they'd": 'they would',
  "theyd": 'they would',
  "don't": 'do not',
  "dont": 'do not',
  "doesn't": 'does not',
  "doesnt": 'does not',
  "didn't": 'did not',
  "didnt": 'did not',
  "won't": 'will not',
  "wont": 'will not',
  "wouldn't": 'would not',
  "wouldnt": 'would not',
  "can't": 'cannot',
  "cant": 'cannot',
  "couldn't": 'could not',
  "couldnt": 'could not',
  "shouldn't": 'should not',
  "shouldnt": 'should not',
  "haven't": 'have not',
  "havent": 'have not',
  "hasn't": 'has not',
  "hasnt": 'has not',
  "hadn't": 'had not',
  "hadnt": 'had not',
  "isn't": 'is not',
  "isnt": 'is not',
  "aren't": 'are not',
  "arent": 'are not',
  "wasn't": 'was not',
  "wasnt": 'was not',
  "weren't": 'were not',
  "werent": 'were not',
  "let's": 'let us',
  "lets": 'let us',
  "ain't": 'is not',
  "aint": 'is not',
  "gonna": 'going to',
  "gotta": 'got to',
  "wanna": 'want to',
  "gimme": 'give me',
  "lemme": 'let me',
  "kinda": 'kind of',
  "sorta": 'sort of',
  "outta": 'out of',
  "coulda": 'could have',
  "shoulda": 'should have',
  "woulda": 'would have',
  "mighta": 'might have',
  "musta": 'must have',
  "hafta": 'have to',
  "dunno": 'do not know',
  "whatcha": 'what are you',
  "gotcha": 'got you',
}

// Multi-word phrase normalization
const PHRASE_MAP = {
  'need that paper': 'need money',
  'stack paper': 'earn money',
  'get paper': 'earn money',
  'making moves': 'doing crimes',
  'make a move': 'do something',
  'catch a body': 'kill someone',
  'catch a case': 'get arrested',
  'do a bid': 'go to jail',
  'on the run': 'fleeing police',
  'laying low': 'hiding from police',
  'keep it real': 'be honest',
  'keep it 100': 'be honest',
  'keep it a buck': 'be honest',
  'what it do': 'whats up',
  'what good': 'whats up',
  'whats good': 'whats up',
  'whats poppin': 'whats happening',
  'whats crackin': 'whats happening',
  'whats the word': 'whats happening',
  'whats the move': 'what should i do',
  'put me on': 'tell me about',
  'plug me in': 'connect me with',
  'run it down': 'explain',
  'break it down': 'explain',
  'school me': 'teach me',
  'put me up on game': 'teach me',
  'how do i get': 'how to earn',
  'how can i get': 'how to earn',
  'how to get': 'how to earn',
  'i need': 'want',
  'i wanna': 'want to',
  'i want to': 'want to',
  'looking for': 'want',
  'trying to': 'want to',
  'tryna': 'want to',
  'finna': 'going to',
  'boutta': 'about to',
  'bout to': 'about to',
  'need some': 'need',
  'give me some': 'give me',
  'hook me up': 'help me',
  'help me out': 'help me',
  'help a brother out': 'help me',
  'no doubt': 'okay',
  'for sure': 'yes definitely',
  'my bad': 'sorry',
  'all good': 'no problem',
  'its all good': 'no problem',
  'you feel me': 'you understand',
  'feel me': 'understand',
  'you know what im saying': 'you understand',
  'know what i mean': 'you understand',
  'na mean': 'you understand',
  'real talk': 'seriously',
  'on god': 'i swear',
  'on my mama': 'i swear',
  'no lie': 'truthfully',
  'straight up': 'honestly',
  'hit a lick': 'do a crime',
  'run a play': 'do a scheme',
  'catch a play': 'get an opportunity',
  'get this bread': 'earn money',
  'secure the bag': 'get money',
  'chase a bag': 'pursue money',
  'in the bag': 'guaranteed',
  'in the cut': 'hidden',
  'on the low': 'secretly',
  'keep it on the low': 'keep it secret',
  'off the radar': 'undetected',
  'under the radar': 'undetected',
  'stay strapped': 'carry weapon',
  'stay ready': 'be prepared',
  'stay woke': 'be alert',
  'watch your back': 'be careful',
  'watch your six': 'be careful',
  'keep your head on a swivel': 'be alert',
  'trust no one': 'be suspicious',
  'trust nobody': 'be suspicious',
}

class TextNormalizerClass {
  constructor() {
    // Build reverse lookup for common word forms
    this.slangLookup = new Map()
    this.abbreviationLookup = new Map()
    this.contractionLookup = new Map()
    this.phraseLookup = new Map()

    // Pre-compile phrase patterns for efficient matching
    this.phrasePatterns = []

    this.initialize()
  }

  initialize() {
    // Build lowercase lookup maps
    Object.entries(SLANG_MAP).forEach(([slang, normalized]) => {
      this.slangLookup.set(slang.toLowerCase(), normalized)
    })

    Object.entries(ABBREVIATIONS).forEach(([abbr, expanded]) => {
      this.abbreviationLookup.set(abbr.toLowerCase(), expanded)
    })

    Object.entries(CONTRACTIONS).forEach(([contraction, expanded]) => {
      this.contractionLookup.set(contraction.toLowerCase(), expanded)
    })

    // Build phrase patterns (longer phrases first for greedy matching)
    const sortedPhrases = Object.entries(PHRASE_MAP)
      .sort((a, b) => b[0].length - a[0].length)

    sortedPhrases.forEach(([phrase, normalized]) => {
      this.phraseLookup.set(phrase.toLowerCase(), normalized)
      // Create regex pattern that matches phrase with word boundaries
      const pattern = new RegExp(
        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'gi'
      )
      this.phrasePatterns.push({ pattern, normalized })
    })

    console.log('[TextNormalizer] Initialized with',
      this.slangLookup.size, 'slang terms,',
      this.abbreviationLookup.size, 'abbreviations,',
      this.contractionLookup.size, 'contractions,',
      this.phrasePatterns.length, 'phrases'
    )
  }

  /**
   * Main normalization entry point
   * @param {string} text - Raw user input
   * @returns {object} { normalized: string, original: string, changes: [] }
   */
  normalize(text) {
    if (!text || typeof text !== 'string') {
      return { normalized: '', original: text || '', changes: [] }
    }

    const original = text
    const changes = []

    // Step 1: Basic cleaning
    let normalized = this.cleanText(text)

    // Step 2: Expand multi-word phrases first (before word-level processing)
    const phraseResult = this.expandPhrases(normalized)
    normalized = phraseResult.text
    changes.push(...phraseResult.changes)

    // Step 3: Process word by word
    const words = normalized.split(/\s+/)
    const processedWords = words.map(word => {
      const wordLower = word.toLowerCase()

      // Try contraction expansion
      if (this.contractionLookup.has(wordLower)) {
        const expanded = this.contractionLookup.get(wordLower)
        changes.push({ from: word, to: expanded, type: 'contraction' })
        return expanded
      }

      // Try abbreviation expansion
      if (this.abbreviationLookup.has(wordLower)) {
        const expanded = this.abbreviationLookup.get(wordLower)
        changes.push({ from: word, to: expanded, type: 'abbreviation' })
        return expanded
      }

      // Try slang translation
      if (this.slangLookup.has(wordLower)) {
        const translated = this.slangLookup.get(wordLower)
        changes.push({ from: word, to: translated, type: 'slang' })
        return translated
      }

      return word
    })

    normalized = processedWords.join(' ')

    // Step 4: Final cleanup (remove extra spaces, etc.)
    normalized = this.finalCleanup(normalized)

    return {
      normalized,
      original,
      changes,
      wasModified: changes.length > 0
    }
  }

  /**
   * Basic text cleaning
   */
  cleanText(text) {
    return text
      // Remove excess whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Normalize apostrophes
      .replace(/[''`]/g, "'")
      // Remove repeated punctuation (but keep single)
      .replace(/([!?.]){2,}/g, '$1')
      // Lowercase for consistent processing
      .toLowerCase()
  }

  /**
   * Expand multi-word phrases
   */
  expandPhrases(text) {
    const changes = []
    let result = text

    for (const { pattern, normalized } of this.phrasePatterns) {
      const match = result.match(pattern)
      if (match) {
        changes.push({ from: match[0], to: normalized, type: 'phrase' })
        result = result.replace(pattern, normalized)
      }
    }

    return { text: result, changes }
  }

  /**
   * Final cleanup pass
   */
  finalCleanup(text) {
    return text
      // Remove double spaces that may have been introduced
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
  }

  /**
   * Get all slang terms (for UI display or debugging)
   */
  getSlangTerms() {
    return Array.from(this.slangLookup.entries())
  }

  /**
   * Add a custom slang term at runtime
   */
  addSlangTerm(slang, normalized) {
    this.slangLookup.set(slang.toLowerCase(), normalized)
  }

  /**
   * Add a custom phrase at runtime
   */
  addPhrase(phrase, normalized) {
    const lowerPhrase = phrase.toLowerCase()
    this.phraseLookup.set(lowerPhrase, normalized)
    const pattern = new RegExp(
      `\\b${lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi'
    )
    // Insert at beginning for priority
    this.phrasePatterns.unshift({ pattern, normalized })
  }

  /**
   * Quick check if text contains any known slang
   */
  hasSlang(text) {
    const words = text.toLowerCase().split(/\s+/)
    return words.some(word =>
      this.slangLookup.has(word) ||
      this.abbreviationLookup.has(word)
    )
  }

  /**
   * Get normalization stats
   */
  getStats() {
    return {
      slangTerms: this.slangLookup.size,
      abbreviations: this.abbreviationLookup.size,
      contractions: this.contractionLookup.size,
      phrases: this.phrasePatterns.length
    }
  }
}

// Singleton export
export const textNormalizer = new TextNormalizerClass()
export default textNormalizer

// Also export maps for extending
export { SLANG_MAP, ABBREVIATIONS, CONTRACTIONS, PHRASE_MAP }
