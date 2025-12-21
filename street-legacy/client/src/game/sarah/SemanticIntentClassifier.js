/**
 * SemanticIntentClassifier - Hybrid pattern + semantic classification
 *
 * Combines fast pattern matching with semantic understanding:
 * 1. Text normalization (slang, abbreviations)
 * 2. Typo correction
 * 3. Pattern matching (fast, for common queries)
 * 4. Semantic similarity (fallback, for novel queries)
 *
 * This wraps and enhances the original IntentClassifier
 */

import { intentClassifier } from './IntentClassifier'
import { textNormalizer } from './TextNormalizer'
import { typoCorrector } from './TypoCorrector'
import { semanticEngine } from './SemanticEngine'
import { INTENT_EXEMPLARS, getFriendlyName } from './IntentExemplars'

// Minimum confidence thresholds
const PATTERN_CONFIDENCE_THRESHOLD = 0.4  // Use pattern result if above this
const SEMANTIC_CONFIDENCE_THRESHOLD = 0.25 // Use semantic result if above this
const HIGH_CONFIDENCE_THRESHOLD = 0.7      // Very confident match

class SemanticIntentClassifierClass {
  constructor() {
    this.initialized = false
    this.classificationCache = new Map()
    this.maxCacheSize = 200

    // Stats tracking
    this.stats = {
      patternHits: 0,
      semanticHits: 0,
      combinedHits: 0,
      cachehits: 0,
      totalClassifications: 0
    }
  }

  /**
   * Initialize the classifier
   */
  initialize() {
    if (this.initialized) return

    // Initialize semantic engine (computes exemplar vectors)
    semanticEngine.initialize()

    this.initialized = true
    console.log('[SemanticIntentClassifier] Initialized')
  }

  /**
   * Preprocess input text
   * @returns { normalized, corrected, changes }
   */
  preprocess(input) {
    // Step 1: Normalize slang, abbreviations
    const normalizeResult = textNormalizer.normalize(input)

    // Step 2: Correct typos
    const typoResult = typoCorrector.correct(normalizeResult.normalized)

    return {
      original: input,
      normalized: normalizeResult.normalized,
      corrected: typoResult.corrected,
      normChanges: normalizeResult.changes,
      typoCorrections: typoResult.corrections,
      wasModified: normalizeResult.wasModified || typoResult.wasModified
    }
  }

  /**
   * Main classification entry point
   * @param {string} input - Raw user input
   * @returns {object} Classification result
   */
  classifyIntent(input) {
    if (!this.initialized) this.initialize()

    const trimmed = (input || '').trim()
    if (!trimmed) {
      return this.createResult('unknown', 0, 'empty input')
    }

    // Check cache
    const cached = this.classificationCache.get(trimmed.toLowerCase())
    if (cached) {
      this.stats.cachehits++
      return { ...cached, fromCache: true }
    }

    this.stats.totalClassifications++

    // Preprocess
    const preprocessed = this.preprocess(trimmed)

    // Try pattern matching first (fast path)
    const patternResult = this.patternClassify(preprocessed.corrected)

    // If high confidence from patterns, use it
    if (patternResult.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      this.stats.patternHits++
      const result = this.createResult(
        patternResult.intent,
        patternResult.confidence,
        'pattern_high',
        preprocessed
      )
      this.cacheResult(trimmed, result)
      return result
    }

    // Try semantic classification
    const semanticResult = semanticEngine.classifyIntent(preprocessed.corrected)

    // Decide which result to use or combine them
    let finalIntent, finalConfidence, source

    if (patternResult.confidence >= PATTERN_CONFIDENCE_THRESHOLD &&
        semanticResult.confidence >= SEMANTIC_CONFIDENCE_THRESHOLD) {
      // Both have reasonable confidence - combine
      if (patternResult.intent === semanticResult.intent) {
        // Agreement! Boost confidence
        finalIntent = patternResult.intent
        finalConfidence = Math.min(1, (patternResult.confidence + semanticResult.confidence) / 1.5)
        source = 'combined_agreement'
        this.stats.combinedHits++
      } else {
        // Disagreement - use higher confidence
        if (patternResult.confidence >= semanticResult.confidence) {
          finalIntent = patternResult.intent
          finalConfidence = patternResult.confidence * 0.9 // Slight penalty for disagreement
          source = 'pattern_preferred'
          this.stats.patternHits++
        } else {
          finalIntent = semanticResult.intent
          finalConfidence = semanticResult.confidence * 0.9
          source = 'semantic_preferred'
          this.stats.semanticHits++
        }
      }
    } else if (patternResult.confidence >= PATTERN_CONFIDENCE_THRESHOLD) {
      // Only pattern has confidence
      finalIntent = patternResult.intent
      finalConfidence = patternResult.confidence
      source = 'pattern_only'
      this.stats.patternHits++
    } else if (semanticResult.confidence >= SEMANTIC_CONFIDENCE_THRESHOLD) {
      // Only semantic has confidence
      finalIntent = semanticResult.intent
      finalConfidence = semanticResult.confidence
      source = 'semantic_only'
      this.stats.semanticHits++
    } else {
      // Neither is confident enough
      // Use semantic if it has any signal, otherwise unknown
      if (semanticResult.similarity > 0.15) {
        finalIntent = semanticResult.intent
        finalConfidence = semanticResult.confidence
        source = 'semantic_fallback'
        this.stats.semanticHits++
      } else {
        finalIntent = 'unknown'
        finalConfidence = 0
        source = 'no_match'
      }
    }

    const result = this.createResult(
      finalIntent,
      finalConfidence,
      source,
      preprocessed,
      {
        patternResult,
        semanticResult
      }
    )

    this.cacheResult(trimmed, result)
    return result
  }

  /**
   * Pattern-based classification using existing IntentClassifier
   */
  patternClassify(input) {
    try {
      const result = intentClassifier.classifyIntent(input)
      return {
        intent: result.intent || 'unknown',
        confidence: result.confidence || 0,
        entities: result.entities || {}
      }
    } catch (e) {
      console.warn('[SemanticIntentClassifier] Pattern classify error:', e)
      return { intent: 'unknown', confidence: 0, entities: {} }
    }
  }

  /**
   * Create a standardized result object
   */
  createResult(intent, confidence, source, preprocessed = null, details = null) {
    return {
      intent,
      confidence,
      friendlyName: getFriendlyName(intent),
      source,
      preprocessed: preprocessed ? {
        original: preprocessed.original,
        normalized: preprocessed.corrected,
        wasModified: preprocessed.wasModified,
        changes: [
          ...preprocessed.normChanges,
          ...preprocessed.typoCorrections
        ]
      } : null,
      details,
      timestamp: Date.now()
    }
  }

  /**
   * Cache a classification result
   */
  cacheResult(input, result) {
    const key = input.toLowerCase()
    if (this.classificationCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.classificationCache.keys().next().value
      this.classificationCache.delete(firstKey)
    }
    // Don't cache the details to save memory
    const cacheEntry = {
      intent: result.intent,
      confidence: result.confidence,
      friendlyName: result.friendlyName,
      source: result.source
    }
    this.classificationCache.set(key, cacheEntry)
  }

  /**
   * Get top N intent matches for an input
   */
  getTopMatches(input, n = 3) {
    if (!this.initialized) this.initialize()

    const preprocessed = this.preprocess(input)
    const semanticResult = semanticEngine.classifyIntent(preprocessed.corrected)

    return semanticResult.topMatches.slice(0, n)
  }

  /**
   * Get semantic concepts extracted from input
   */
  getConcepts(input) {
    if (!this.initialized) this.initialize()

    const preprocessed = this.preprocess(input)
    return semanticEngine.extractConcepts(preprocessed.corrected)
  }

  /**
   * Check if input is semantically similar to a reference
   */
  isSimilarTo(input, reference, threshold = 0.5) {
    if (!this.initialized) this.initialize()

    const prep1 = this.preprocess(input)
    const prep2 = this.preprocess(reference)

    return semanticEngine.areSimilar(prep1.corrected, prep2.corrected, threshold)
  }

  /**
   * Get suggestions for ambiguous input
   */
  getSuggestions(input) {
    if (!this.initialized) this.initialize()

    const topMatches = this.getTopMatches(input, 4)

    return topMatches.map(match => ({
      intent: match.intent,
      friendlyName: match.friendlyName,
      confidence: match.similarity,
      suggestion: this.generateSuggestion(match.intent)
    }))
  }

  /**
   * Generate a helpful suggestion for an intent
   */
  generateSuggestion(intent) {
    const suggestions = {
      money_advice: 'Ask about earning money or managing finances',
      crime_advice: 'Ask about criminal activities and opportunities',
      stat_analysis: 'Check your current stats and status',
      heat_advice: 'Get advice about heat levels and police',
      time_management: 'Get help prioritizing your time',
      job_advice: 'Ask about legitimate job opportunities',
      market_analysis: 'Check prices and trading options',
      equipment_advice: 'Get gear and equipment recommendations',
      location_tips: 'Learn about different districts and areas',
      crew_management: 'Get help with crew and social connections',
      ai_intel: 'Request intelligence and secret information',
      help: 'Get general help and tutorials',
      strategy_advice: 'Get strategic planning advice',
      opportunity_inquiry: 'Check available opportunities',
      adventure_interest: 'Start an interactive adventure',
      relationship_inquiry: 'Check your NPC relationships'
    }

    return suggestions[intent] || 'Try rephrasing your question'
  }

  /**
   * Clear classification cache
   */
  clearCache() {
    this.classificationCache.clear()
    semanticEngine.clearCache()
  }

  /**
   * Get classification stats
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.classificationCache.size,
      hitRate: this.stats.cachehits / Math.max(1, this.stats.totalClassifications),
      patternRate: this.stats.patternHits / Math.max(1, this.stats.totalClassifications),
      semanticRate: this.stats.semanticHits / Math.max(1, this.stats.totalClassifications),
      combinedRate: this.stats.combinedHits / Math.max(1, this.stats.totalClassifications)
    }
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      patternHits: 0,
      semanticHits: 0,
      combinedHits: 0,
      cachehits: 0,
      totalClassifications: 0
    }
  }

  /**
   * Debug: analyze an input in detail
   */
  analyze(input) {
    if (!this.initialized) this.initialize()

    const preprocessed = this.preprocess(input)
    const patternResult = this.patternClassify(preprocessed.corrected)
    const semanticResult = semanticEngine.classifyIntent(preprocessed.corrected)
    const concepts = semanticEngine.extractConcepts(preprocessed.corrected)

    return {
      input: {
        original: input,
        normalized: preprocessed.normalized,
        corrected: preprocessed.corrected,
        changes: [
          ...preprocessed.normChanges.map(c => ({ ...c, stage: 'normalize' })),
          ...preprocessed.typoCorrections.map(c => ({ ...c, stage: 'typo' }))
        ]
      },
      pattern: {
        intent: patternResult.intent,
        confidence: patternResult.confidence,
        entities: patternResult.entities
      },
      semantic: {
        intent: semanticResult.intent,
        confidence: semanticResult.confidence,
        similarity: semanticResult.similarity,
        topMatches: semanticResult.topMatches
      },
      concepts,
      final: this.classifyIntent(input)
    }
  }
}

// Singleton export
export const semanticIntentClassifier = new SemanticIntentClassifierClass()
export default semanticIntentClassifier
