/**
 * TypoCorrector - Edit distance based typo correction
 *
 * Uses Damerau-Levenshtein distance for intelligent typo detection
 * and correction. Optimized for game domain vocabulary.
 */

// Game domain vocabulary - words we know and can correct to
const DOMAIN_VOCABULARY = [
  // Core game concepts
  'money', 'cash', 'crime', 'crimes', 'criminal', 'steal', 'stealing', 'theft',
  'heist', 'robbery', 'burglary', 'pickpocket', 'pickpocketing', 'shoplift',
  'carjack', 'mugging', 'hustle', 'scheme', 'scam', 'fraud', 'fence', 'fencing',

  // Stats and status
  'status', 'stats', 'health', 'energy', 'heat', 'wanted', 'level', 'experience',
  'reputation', 'respect', 'skills', 'ability', 'abilities', 'skill',

  // Police and law
  'police', 'cops', 'arrest', 'arrested', 'jail', 'prison', 'sentence', 'wanted',
  'warrant', 'investigation', 'evidence', 'witness', 'attorney', 'lawyer',

  // Locations
  'downtown', 'uptown', 'suburbs', 'industrial', 'waterfront', 'parkdale',
  'district', 'neighborhood', 'territory', 'location', 'area', 'zone',

  // Characters
  'sarah', 'fixer', 'dealer', 'fence', 'contact', 'connection', 'crew', 'gang',
  'member', 'boss', 'associate', 'partner', 'rival', 'enemy', 'ally',

  // Items and equipment
  'lockpick', 'lockpicks', 'weapon', 'weapons', 'tool', 'tools', 'gear',
  'equipment', 'item', 'items', 'inventory', 'bag', 'disguise', 'mask',

  // Actions and commands
  'help', 'status', 'travel', 'go', 'move', 'buy', 'sell', 'use', 'equip',
  'attack', 'flee', 'run', 'hide', 'wait', 'rest', 'sleep', 'work',
  'commit', 'plan', 'execute', 'escape', 'evade', 'bribe',

  // Time
  'morning', 'afternoon', 'evening', 'night', 'dawn', 'dusk', 'midnight',
  'hour', 'hours', 'minute', 'minutes', 'day', 'days', 'week', 'weeks',

  // Money terms
  'dollars', 'bucks', 'grand', 'thousand', 'million', 'broke', 'rich', 'wealthy',
  'profit', 'loss', 'cost', 'price', 'value', 'worth', 'income', 'expense',

  // Advice and info
  'tips', 'advice', 'help', 'guide', 'tutorial', 'explain', 'explain',
  'information', 'info', 'details', 'strategy', 'strategies', 'recommend',

  // Questions
  'what', 'where', 'when', 'why', 'how', 'which', 'who', 'should', 'could',
  'would', 'can', 'will', 'does', 'is', 'are', 'have', 'has',

  // Common verbs
  'need', 'want', 'like', 'know', 'think', 'make', 'get', 'give', 'take',
  'find', 'show', 'tell', 'start', 'stop', 'try', 'do', 'earn', 'spend',

  // Modifiers
  'fast', 'quick', 'slow', 'easy', 'hard', 'difficult', 'simple', 'complex',
  'safe', 'dangerous', 'risky', 'best', 'worst', 'good', 'bad', 'more', 'less',

  // Game specific
  'minigame', 'mission', 'quest', 'objective', 'goal', 'target', 'reward',
  'cooldown', 'timer', 'unlock', 'upgrade', 'progress', 'achievement',

  // S.A.R.A.H. specific
  'sarah', 'assistant', 'analyze', 'analysis', 'recommend', 'suggestion',
  'opportunity', 'opportunities', 'alert', 'warning', 'critical',
]

// Common keyboard typo patterns (adjacent key substitutions)
const KEYBOARD_ADJACENT = {
  'q': ['w', 'a'],
  'w': ['q', 'e', 's', 'a'],
  'e': ['w', 'r', 'd', 's'],
  'r': ['e', 't', 'f', 'd'],
  't': ['r', 'y', 'g', 'f'],
  'y': ['t', 'u', 'h', 'g'],
  'u': ['y', 'i', 'j', 'h'],
  'i': ['u', 'o', 'k', 'j'],
  'o': ['i', 'p', 'l', 'k'],
  'p': ['o', 'l'],
  'a': ['q', 'w', 's', 'z'],
  's': ['w', 'e', 'a', 'd', 'z', 'x'],
  'd': ['e', 'r', 's', 'f', 'x', 'c'],
  'f': ['r', 't', 'd', 'g', 'c', 'v'],
  'g': ['t', 'y', 'f', 'h', 'v', 'b'],
  'h': ['y', 'u', 'g', 'j', 'b', 'n'],
  'j': ['u', 'i', 'h', 'k', 'n', 'm'],
  'k': ['i', 'o', 'j', 'l', 'm'],
  'l': ['o', 'p', 'k'],
  'z': ['a', 's', 'x'],
  'x': ['z', 's', 'd', 'c'],
  'c': ['x', 'd', 'f', 'v'],
  'v': ['c', 'f', 'g', 'b'],
  'b': ['v', 'g', 'h', 'n'],
  'n': ['b', 'h', 'j', 'm'],
  'm': ['n', 'j', 'k'],
}

// Phonetically similar letter groups
const PHONETIC_GROUPS = [
  ['c', 'k', 'ck'],
  ['f', 'ph'],
  ['g', 'j'],
  ['s', 'c', 'z'],
  ['i', 'y'],
  ['a', 'e'],
  ['o', 'u'],
  ['n', 'm'],
  ['b', 'p'],
  ['d', 't'],
  ['v', 'w'],
]

class TypoCorrectorClass {
  constructor() {
    this.vocabulary = new Set()
    this.vocabularyList = []
    this.cache = new Map()
    this.maxCacheSize = 1000

    this.initialize()
  }

  initialize() {
    // Build vocabulary set
    DOMAIN_VOCABULARY.forEach(word => {
      this.vocabulary.add(word.toLowerCase())
    })
    this.vocabularyList = Array.from(this.vocabulary)

    console.log('[TypoCorrector] Initialized with', this.vocabulary.size, 'vocabulary words')
  }

  /**
   * Correct typos in text
   * @param {string} text - Input text
   * @param {number} maxDistance - Maximum edit distance for corrections (default 2)
   * @returns {object} { corrected: string, corrections: [], original: string }
   */
  correct(text, maxDistance = 2) {
    if (!text || typeof text !== 'string') {
      return { corrected: '', corrections: [], original: text || '' }
    }

    const original = text
    const corrections = []

    // Split into words while preserving punctuation
    const tokens = text.toLowerCase().match(/[\w]+|[^\w\s]+|\s+/g) || []

    const correctedTokens = tokens.map(token => {
      // Skip non-word tokens (punctuation, whitespace)
      if (!/^[\w]+$/.test(token)) {
        return token
      }

      // Check cache first
      if (this.cache.has(token)) {
        const cached = this.cache.get(token)
        if (cached !== token) {
          corrections.push({ from: token, to: cached, distance: 1 })
        }
        return cached
      }

      // If word is in vocabulary, no correction needed
      if (this.vocabulary.has(token)) {
        this.cacheResult(token, token)
        return token
      }

      // Find best correction
      const correction = this.findBestCorrection(token, maxDistance)

      if (correction) {
        corrections.push({
          from: token,
          to: correction.word,
          distance: correction.distance
        })
        this.cacheResult(token, correction.word)
        return correction.word
      }

      // No correction found, keep original
      this.cacheResult(token, token)
      return token
    })

    return {
      corrected: correctedTokens.join(''),
      corrections,
      original,
      wasModified: corrections.length > 0
    }
  }

  /**
   * Find the best correction for a word
   */
  findBestCorrection(word, maxDistance) {
    let bestMatch = null
    let bestScore = Infinity

    for (const candidate of this.vocabularyList) {
      // Quick length check to skip obviously wrong candidates
      if (Math.abs(candidate.length - word.length) > maxDistance) {
        continue
      }

      // Calculate distance
      const distance = this.damerauLevenshtein(word, candidate)

      if (distance <= maxDistance && distance < bestScore) {
        bestScore = distance
        bestMatch = candidate

        // Perfect match at distance 1, unlikely to find better
        if (distance === 1) {
          break
        }
      }
    }

    return bestMatch ? { word: bestMatch, distance: bestScore } : null
  }

  /**
   * Damerau-Levenshtein distance (includes transpositions)
   */
  damerauLevenshtein(s1, s2) {
    const len1 = s1.length
    const len2 = s2.length

    if (len1 === 0) return len2
    if (len2 === 0) return len1

    // Create distance matrix
    const d = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0))

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) d[i][0] = i
    for (let j = 0; j <= len2; j++) d[0][j] = j

    // Fill in the rest
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1

        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // Deletion
          d[i][j - 1] + 1,      // Insertion
          d[i - 1][j - 1] + cost // Substitution
        )

        // Transposition
        if (i > 1 && j > 1 &&
            s1[i - 1] === s2[j - 2] &&
            s1[i - 2] === s2[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost)
        }
      }
    }

    return d[len1][len2]
  }

  /**
   * Weighted edit distance that accounts for keyboard adjacency
   */
  weightedDistance(s1, s2) {
    const len1 = s1.length
    const len2 = s2.length

    if (len1 === 0) return len2
    if (len2 === 0) return len1

    const d = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0))

    for (let i = 0; i <= len1; i++) d[i][0] = i
    for (let j = 0; j <= len2; j++) d[0][j] = j

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        let cost = 0
        if (s1[i - 1] !== s2[j - 1]) {
          // Check if it's an adjacent key typo
          cost = this.isAdjacentKey(s1[i - 1], s2[j - 1]) ? 0.5 : 1
          // Check if phonetically similar
          if (cost === 1 && this.isPhoneticalySimilar(s1[i - 1], s2[j - 1])) {
            cost = 0.7
          }
        }

        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        )

        // Transposition (common typing error)
        if (i > 1 && j > 1 &&
            s1[i - 1] === s2[j - 2] &&
            s1[i - 2] === s2[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.5)
        }
      }
    }

    return d[len1][len2]
  }

  /**
   * Check if two keys are adjacent on keyboard
   */
  isAdjacentKey(char1, char2) {
    const adjacent = KEYBOARD_ADJACENT[char1.toLowerCase()]
    return adjacent && adjacent.includes(char2.toLowerCase())
  }

  /**
   * Check if two characters are phonetically similar
   */
  isPhoneticalySimilar(char1, char2) {
    const c1 = char1.toLowerCase()
    const c2 = char2.toLowerCase()

    for (const group of PHONETIC_GROUPS) {
      if (group.includes(c1) && group.includes(c2)) {
        return true
      }
    }
    return false
  }

  /**
   * Cache a correction result
   */
  cacheResult(input, result) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(input, result)
  }

  /**
   * Add word to vocabulary
   */
  addWord(word) {
    const lower = word.toLowerCase()
    if (!this.vocabulary.has(lower)) {
      this.vocabulary.add(lower)
      this.vocabularyList.push(lower)
    }
  }

  /**
   * Add multiple words to vocabulary
   */
  addWords(words) {
    words.forEach(word => this.addWord(word))
  }

  /**
   * Check if a word might be a typo
   */
  mightBeTypo(word) {
    if (this.vocabulary.has(word.toLowerCase())) {
      return false
    }

    // Check if any vocabulary word is within distance 2
    const correction = this.findBestCorrection(word.toLowerCase(), 2)
    return correction !== null
  }

  /**
   * Get possible corrections for a word
   */
  getSuggestions(word, maxResults = 5) {
    const suggestions = []
    const wordLower = word.toLowerCase()

    for (const candidate of this.vocabularyList) {
      if (Math.abs(candidate.length - wordLower.length) <= 2) {
        const distance = this.weightedDistance(wordLower, candidate)
        if (distance <= 2.5) {
          suggestions.push({ word: candidate, distance })
        }
      }
    }

    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults)
      .map(s => s.word)
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      vocabularySize: this.vocabulary.size,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize
    }
  }
}

// Singleton export
export const typoCorrector = new TypoCorrectorClass()
export default typoCorrector

// Export vocabulary for extension
export { DOMAIN_VOCABULARY, KEYBOARD_ADJACENT, PHONETIC_GROUPS }
