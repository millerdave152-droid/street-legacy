/**
 * AdventureParser - Input matching for text adventures
 *
 * Handles:
 * - Numeric choice selection (1, 2, 3)
 * - Keyword matching from choice keywords
 * - Fuzzy matching for typos
 * - Natural language choice detection
 */

import { textNormalizer } from '../sarah/TextNormalizer'
import { typoCorrector } from '../sarah/TypoCorrector'

class AdventureParserClass {
  constructor() {
    // Common action words to strip
    this.actionPrefixes = [
      'i want to', 'i will', "i'll", 'let me', 'lets', "let's",
      'i choose', 'i pick', 'i select', 'i go with',
      'do', 'go', 'choose', 'pick', 'select', 'take',
    ]
  }

  /**
   * Match user input to a choice
   * @param {string} input - User input
   * @param {array} choices - Available choices
   * @returns {object} { matched: boolean, choice: object, confidence: number }
   */
  matchChoice(input, choices) {
    if (!input || !choices || choices.length === 0) {
      return { matched: false, suggestion: 'No choices available.' }
    }

    const normalizedInput = this.normalizeInput(input)

    // Try numeric match first (most reliable)
    const numericResult = this.matchNumeric(normalizedInput, choices)
    if (numericResult.matched) {
      return numericResult
    }

    // Try keyword match
    const keywordResult = this.matchKeyword(normalizedInput, choices)
    if (keywordResult.matched) {
      return keywordResult
    }

    // Try fuzzy text match
    const fuzzyResult = this.matchFuzzy(normalizedInput, choices)
    if (fuzzyResult.matched) {
      return fuzzyResult
    }

    // No match - generate suggestion
    return {
      matched: false,
      suggestion: this.generateSuggestion(normalizedInput, choices)
    }
  }

  /**
   * Normalize input for matching
   */
  normalizeInput(input) {
    let normalized = input.toLowerCase().trim()

    // Apply text normalization (slang, etc)
    const normResult = textNormalizer.normalize(normalized)
    normalized = normResult.normalized

    // Strip common action prefixes
    for (const prefix of this.actionPrefixes) {
      if (normalized.startsWith(prefix + ' ')) {
        normalized = normalized.slice(prefix.length + 1).trim()
      }
    }

    return normalized
  }

  /**
   * Match numeric input (1, 2, 3, etc)
   */
  matchNumeric(input, choices) {
    // Check for simple number
    const num = parseInt(input, 10)

    if (!isNaN(num) && num >= 1 && num <= choices.length) {
      return {
        matched: true,
        choice: choices[num - 1],
        confidence: 1.0,
        matchType: 'numeric'
      }
    }

    // Check for ordinal (first, second, third)
    const ordinals = {
      'first': 1, 'one': 1, '1st': 1,
      'second': 2, 'two': 2, '2nd': 2,
      'third': 3, 'three': 3, '3rd': 3,
      'fourth': 4, 'four': 4, '4th': 4,
      'fifth': 5, 'five': 5, '5th': 5,
    }

    const ordinalNum = ordinals[input]
    if (ordinalNum && ordinalNum <= choices.length) {
      return {
        matched: true,
        choice: choices[ordinalNum - 1],
        confidence: 0.95,
        matchType: 'ordinal'
      }
    }

    return { matched: false }
  }

  /**
   * Match by keywords defined in choice
   */
  matchKeyword(input, choices) {
    const inputWords = input.split(/\s+/)

    let bestMatch = null
    let bestScore = 0

    for (const choice of choices) {
      const keywords = choice.keywords || []

      // Also extract keywords from choice text
      const textKeywords = this.extractKeywords(choice.text)
      const allKeywords = [...keywords, ...textKeywords]

      for (const keyword of allKeywords) {
        const keywordLower = keyword.toLowerCase()

        // Exact match
        if (input === keywordLower) {
          return {
            matched: true,
            choice,
            confidence: 1.0,
            matchType: 'exact_keyword'
          }
        }

        // Input contains keyword
        if (input.includes(keywordLower)) {
          const score = keywordLower.length / input.length
          if (score > bestScore) {
            bestScore = score
            bestMatch = choice
          }
        }

        // Keyword in input words
        if (inputWords.includes(keywordLower)) {
          const score = 0.9
          if (score > bestScore) {
            bestScore = score
            bestMatch = choice
          }
        }
      }
    }

    if (bestMatch && bestScore >= 0.4) {
      return {
        matched: true,
        choice: bestMatch,
        confidence: bestScore,
        matchType: 'keyword'
      }
    }

    return { matched: false }
  }

  /**
   * Fuzzy match against choice text
   */
  matchFuzzy(input, choices) {
    let bestMatch = null
    let bestScore = 0

    for (const choice of choices) {
      const choiceText = choice.text.toLowerCase()

      // Calculate similarity
      const similarity = this.calculateSimilarity(input, choiceText)

      if (similarity > bestScore) {
        bestScore = similarity
        bestMatch = choice
      }
    }

    // Require reasonable similarity
    if (bestMatch && bestScore >= 0.5) {
      return {
        matched: true,
        choice: bestMatch,
        confidence: bestScore,
        matchType: 'fuzzy'
      }
    }

    return { matched: false }
  }

  /**
   * Calculate text similarity (Jaccard-like)
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2))
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2))

    if (words1.size === 0 || words2.size === 0) return 0

    let intersection = 0
    for (const word of words1) {
      if (words2.has(word)) intersection++

      // Also check for partial matches
      for (const word2 of words2) {
        if (word.includes(word2) || word2.includes(word)) {
          intersection += 0.5
        }
      }
    }

    const union = words1.size + words2.size - intersection
    return intersection / union
  }

  /**
   * Extract important keywords from text
   */
  extractKeywords(text) {
    if (!text) return []

    // Remove common words
    const stopWords = new Set([
      'the', 'a', 'an', 'to', 'and', 'or', 'but', 'in', 'on', 'at',
      'for', 'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
      'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
    ])

    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  }

  /**
   * Generate a helpful suggestion when no match found
   */
  generateSuggestion(input, choices) {
    // Check if input was close to any choice
    let closestChoice = null
    let closestDistance = Infinity

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i]
      const keywords = choice.keywords || []

      for (const keyword of keywords) {
        // Try typo correction
        const corrected = typoCorrector.correct(input)
        if (corrected.corrections.length > 0) {
          // Check if corrected version matches
          if (corrected.corrected === keyword.toLowerCase()) {
            return `Did you mean "${keyword}"? (option ${i + 1})`
          }
        }
      }
    }

    // Generic suggestion
    const optionList = choices.map((c, i) => `${i + 1}`).join(', ')
    return `Try typing a number (${optionList}) or a keyword from the choices.`
  }

  /**
   * Check if input looks like an adventure command
   */
  isAdventureInput(input) {
    const adventurePatterns = [
      /^[1-9]$/,                    // Single digit
      /^(first|second|third|fourth|fifth)$/i,
      /^(yes|no|ok|sure|nah|maybe)$/i,
      /^(go|take|choose|pick|select)\b/i,
      /^(look|examine|check|search)\b/i,
      /^(quit|exit|abandon|leave)\b/i,
      /^(save|load)\b/i,
    ]

    const lower = input.toLowerCase().trim()
    return adventurePatterns.some(p => p.test(lower))
  }

  /**
   * Parse a direction from input
   */
  parseDirection(input) {
    const directions = {
      north: ['north', 'n', 'up', 'forward'],
      south: ['south', 's', 'down', 'back', 'backward'],
      east: ['east', 'e', 'right'],
      west: ['west', 'w', 'left'],
    }

    const lower = input.toLowerCase().trim()

    for (const [direction, aliases] of Object.entries(directions)) {
      if (aliases.some(a => lower.includes(a))) {
        return direction
      }
    }

    return null
  }

  /**
   * Parse a yes/no response
   */
  parseYesNo(input) {
    const lower = input.toLowerCase().trim()

    const yesPatterns = ['yes', 'yeah', 'yep', 'y', 'sure', 'ok', 'okay', 'alright', 'fine', 'do it']
    const noPatterns = ['no', 'nah', 'nope', 'n', 'pass', 'skip', 'dont', "don't", 'refuse']

    if (yesPatterns.some(p => lower.includes(p))) {
      return 'yes'
    }

    if (noPatterns.some(p => lower.includes(p))) {
      return 'no'
    }

    return null
  }
}

// Singleton export
export const adventureParser = new AdventureParserClass()
export default adventureParser
