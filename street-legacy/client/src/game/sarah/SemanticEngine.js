/**
 * SemanticEngine - Local semantic understanding without external APIs
 *
 * Implements lightweight word vectors and similarity matching:
 * - Word clusters for synonym groups
 * - TF-IDF style phrase weighting
 * - Cosine similarity for matching
 * - Pre-computed exemplar vectors for fast lookup
 */

import { INTENT_EXEMPLARS, INTENT_NAMES } from './IntentExemplars'
import { textNormalizer } from './TextNormalizer'
import { typoCorrector } from './TypoCorrector'

// Word clusters - groups of semantically similar words
// Each cluster represents a concept, words in same cluster are treated as similar
const WORD_CLUSTERS = {
  // Money cluster
  money: ['money', 'cash', 'dollars', 'bucks', 'earn', 'income', 'profit', 'rich', 'wealthy',
          'broke', 'poor', 'paid', 'payment', 'funds', 'budget', 'fortune', 'wealth'],

  // Crime cluster
  crime: ['crime', 'steal', 'theft', 'robbery', 'burglary', 'heist', 'criminal', 'illegal',
          'pickpocket', 'mugging', 'shoplift', 'carjack', 'fraud', 'scam', 'hustle'],

  // Violence cluster
  violence: ['attack', 'fight', 'weapon', 'gun', 'knife', 'assault', 'hurt', 'damage',
             'kill', 'murder', 'violent', 'dangerous', 'threat'],

  // Police cluster
  police: ['police', 'cops', 'law', 'arrest', 'jail', 'prison', 'warrant', 'wanted',
           'heat', 'caught', 'bust', 'investigation', 'detective', 'officer'],

  // Location cluster
  location: ['downtown', 'uptown', 'district', 'area', 'neighborhood', 'territory',
             'zone', 'place', 'spot', 'location', 'region', 'block'],

  // Time cluster
  time: ['time', 'now', 'later', 'soon', 'wait', 'fast', 'quick', 'slow', 'hour',
         'minute', 'day', 'night', 'morning', 'evening'],

  // Status cluster
  status: ['status', 'stats', 'health', 'energy', 'level', 'experience', 'progress',
           'rank', 'condition', 'situation', 'state'],

  // Equipment cluster
  equipment: ['gear', 'equipment', 'tool', 'item', 'weapon', 'lockpick', 'disguise',
              'inventory', 'upgrade', 'supplies'],

  // Social cluster
  social: ['crew', 'gang', 'team', 'partner', 'ally', 'friend', 'enemy', 'connection',
           'contact', 'associate', 'trust', 'loyalty', 'relationship'],

  // Action cluster
  action: ['do', 'make', 'get', 'take', 'go', 'find', 'help', 'show', 'tell', 'give',
           'start', 'stop', 'try', 'want', 'need'],

  // Question cluster
  question: ['what', 'how', 'where', 'when', 'why', 'which', 'who', 'should', 'could',
             'would', 'can', 'will'],

  // Quality cluster
  quality: ['best', 'good', 'bad', 'better', 'worse', 'easy', 'hard', 'safe', 'risky',
            'fast', 'slow', 'high', 'low'],

  // Advice cluster
  advice: ['tip', 'tips', 'advice', 'help', 'guide', 'recommend', 'suggestion', 'hint',
           'strategy', 'plan', 'idea'],

  // Trade cluster
  trade: ['buy', 'sell', 'trade', 'price', 'cost', 'value', 'worth', 'market', 'deal',
          'offer', 'bargain'],

  // Job cluster
  job: ['job', 'work', 'employ', 'career', 'occupation', 'legit', 'legal', 'honest',
        'salary', 'wage'],

  // Adventure cluster
  adventure: ['adventure', 'story', 'mission', 'quest', 'journey', 'explore', 'narrative',
              'exciting', 'fun', 'challenge'],

  // Opportunity cluster
  opportunity: ['opportunity', 'chance', 'offer', 'deal', 'available', 'open', 'pending',
                'waiting', 'message', 'contact'],

  // Intel cluster
  intel: ['intel', 'information', 'info', 'secret', 'hidden', 'rumor', 'news',
          'knowledge', 'data', 'insight'],
}

// Build reverse lookup: word -> cluster name
const WORD_TO_CLUSTER = new Map()
Object.entries(WORD_CLUSTERS).forEach(([cluster, words]) => {
  words.forEach(word => {
    if (!WORD_TO_CLUSTER.has(word)) {
      WORD_TO_CLUSTER.set(word, [])
    }
    WORD_TO_CLUSTER.get(word).push(cluster)
  })
})

// Important words get higher weight (inverse document frequency approximation)
const WORD_IMPORTANCE = {
  // High importance (specific to intents)
  'crime': 2.0, 'steal': 2.0, 'heist': 2.0, 'robbery': 2.0, 'burglary': 2.0,
  'money': 1.8, 'cash': 1.8, 'earn': 1.8, 'rich': 1.8, 'broke': 1.8,
  'heat': 2.0, 'wanted': 2.0, 'police': 1.8, 'cops': 1.8, 'arrest': 1.8,
  'status': 1.8, 'stats': 1.8, 'health': 1.7, 'energy': 1.7, 'level': 1.7,
  'job': 1.8, 'work': 1.5, 'legal': 1.8, 'legit': 1.8,
  'gear': 1.8, 'equipment': 1.8, 'weapon': 1.8, 'tool': 1.7,
  'crew': 1.8, 'gang': 1.8, 'ally': 1.8, 'trust': 1.7,
  'price': 1.7, 'buy': 1.6, 'sell': 1.6, 'trade': 1.7, 'market': 1.8,
  'district': 1.7, 'area': 1.5, 'location': 1.6, 'downtown': 1.8,
  'intel': 2.0, 'secret': 1.8, 'rumor': 1.8,
  'adventure': 2.0, 'story': 1.8, 'mission': 1.8, 'quest': 1.8,
  'opportunity': 1.9, 'offer': 1.7, 'available': 1.5,
  'help': 1.5, 'tutorial': 1.8, 'guide': 1.6,
  'tips': 1.6, 'advice': 1.6, 'recommend': 1.6, 'strategy': 1.7,

  // Medium importance
  'best': 1.3, 'good': 1.2, 'fast': 1.3, 'quick': 1.3, 'easy': 1.3,
  'safe': 1.4, 'risky': 1.4, 'dangerous': 1.4,
  'time': 1.3, 'now': 1.2, 'next': 1.3,

  // Low importance (common words)
  'what': 1.0, 'how': 1.0, 'where': 1.0, 'when': 1.0, 'why': 1.0,
  'should': 1.0, 'could': 1.0, 'would': 1.0, 'can': 1.0, 'will': 1.0,
  'do': 0.8, 'make': 0.9, 'get': 0.9, 'give': 0.9, 'take': 0.9,
  'i': 0.5, 'me': 0.5, 'my': 0.5, 'you': 0.5, 'your': 0.5,
  'a': 0.3, 'an': 0.3, 'the': 0.3, 'is': 0.3, 'are': 0.3,
  'to': 0.3, 'for': 0.3, 'of': 0.3, 'in': 0.3, 'on': 0.3,
}

class SemanticEngineClass {
  constructor() {
    this.initialized = false
    this.exemplarVectors = new Map() // intent -> array of phrase vectors
    this.intentCentroids = new Map() // intent -> centroid vector
    this.phraseCache = new Map()
    this.maxCacheSize = 500

    // Cluster vectors for similarity computation
    this.clusterNames = Object.keys(WORD_CLUSTERS)
    this.clusterDimensions = this.clusterNames.length
  }

  /**
   * Initialize the engine - compute exemplar vectors
   */
  initialize() {
    if (this.initialized) return

    console.log('[SemanticEngine] Initializing...')
    const startTime = Date.now()

    // Pre-compute vectors for all exemplars
    for (const intentName of INTENT_NAMES) {
      const exemplars = INTENT_EXEMPLARS[intentName]?.exemplars || []
      const vectors = []

      for (const phrase of exemplars) {
        const vector = this.phraseToVector(phrase)
        vectors.push(vector)
      }

      this.exemplarVectors.set(intentName, vectors)

      // Compute centroid (average vector) for the intent
      if (vectors.length > 0) {
        const centroid = this.computeCentroid(vectors)
        this.intentCentroids.set(intentName, centroid)
      }
    }

    this.initialized = true
    console.log('[SemanticEngine] Initialized in', Date.now() - startTime, 'ms')
    console.log('[SemanticEngine]', this.exemplarVectors.size, 'intents,',
      this.clusterDimensions, 'dimensions')
  }

  /**
   * Convert a phrase to a vector representation
   * Uses cluster-based dimensions with TF-IDF style weighting
   */
  phraseToVector(phrase) {
    // Check cache
    const cached = this.phraseCache.get(phrase)
    if (cached) return cached

    // Normalize and tokenize
    const normalized = textNormalizer.normalize(phrase).normalized
    const corrected = typoCorrector.correct(normalized).corrected
    const words = corrected.toLowerCase().split(/\s+/).filter(w => w.length > 1)

    // Create zero vector
    const vector = new Array(this.clusterDimensions).fill(0)

    // Accumulate cluster activations
    for (const word of words) {
      const weight = WORD_IMPORTANCE[word] || 1.0
      const clusters = WORD_TO_CLUSTER.get(word) || []

      for (const cluster of clusters) {
        const dimIndex = this.clusterNames.indexOf(cluster)
        if (dimIndex >= 0) {
          vector[dimIndex] += weight
        }
      }
    }

    // Normalize vector to unit length
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude
      }
    }

    // Cache result
    if (this.phraseCache.size < this.maxCacheSize) {
      this.phraseCache.set(phrase, vector)
    }

    return vector
  }

  /**
   * Compute centroid of multiple vectors
   */
  computeCentroid(vectors) {
    if (vectors.length === 0) return new Array(this.clusterDimensions).fill(0)

    const centroid = new Array(this.clusterDimensions).fill(0)

    for (const vector of vectors) {
      for (let i = 0; i < vector.length; i++) {
        centroid[i] += vector[i]
      }
    }

    // Average
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] /= vectors.length
    }

    // Normalize
    const magnitude = Math.sqrt(centroid.reduce((sum, v) => sum + v * v, 0))
    if (magnitude > 0) {
      for (let i = 0; i < centroid.length; i++) {
        centroid[i] /= magnitude
      }
    }

    return centroid
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0

    let dotProduct = 0
    let mag1 = 0
    let mag2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      mag1 += vec1[i] * vec1[i]
      mag2 += vec2[i] * vec2[i]
    }

    mag1 = Math.sqrt(mag1)
    mag2 = Math.sqrt(mag2)

    if (mag1 === 0 || mag2 === 0) return 0

    return dotProduct / (mag1 * mag2)
  }

  /**
   * Find the best matching intent for an input phrase
   * Returns { intent, confidence, topMatches }
   */
  classifyIntent(input) {
    if (!this.initialized) this.initialize()

    const inputVector = this.phraseToVector(input)

    // Check if input has any semantic content
    const hasContent = inputVector.some(v => v !== 0)
    if (!hasContent) {
      return {
        intent: 'unknown',
        confidence: 0,
        topMatches: []
      }
    }

    const scores = []

    // Compare against all intent centroids
    for (const [intentName, centroid] of this.intentCentroids) {
      const similarity = this.cosineSimilarity(inputVector, centroid)
      scores.push({
        intent: intentName,
        similarity,
        friendlyName: INTENT_EXEMPLARS[intentName]?.friendlyName || intentName
      })
    }

    // Also compare against best individual exemplars for fine-grained matching
    for (const [intentName, vectors] of this.exemplarVectors) {
      let maxExemplarSim = 0
      for (const exemplarVec of vectors) {
        const sim = this.cosineSimilarity(inputVector, exemplarVec)
        maxExemplarSim = Math.max(maxExemplarSim, sim)
      }

      // Blend centroid and best exemplar match
      const existingScore = scores.find(s => s.intent === intentName)
      if (existingScore) {
        // Weight: 60% centroid, 40% best exemplar
        existingScore.similarity = existingScore.similarity * 0.6 + maxExemplarSim * 0.4
      }
    }

    // Sort by similarity
    scores.sort((a, b) => b.similarity - a.similarity)

    // Get top 3 matches
    const topMatches = scores.slice(0, 3)

    // Determine confidence based on score distribution
    const bestScore = topMatches[0]?.similarity || 0
    const secondScore = topMatches[1]?.similarity || 0

    // Confidence factors:
    // 1. Absolute score (higher = more confident)
    // 2. Gap to second best (larger gap = more confident)
    const absoluteConfidence = bestScore
    const separationConfidence = bestScore > 0 ? (bestScore - secondScore) / bestScore : 0
    const confidence = absoluteConfidence * 0.7 + separationConfidence * 0.3

    return {
      intent: topMatches[0]?.intent || 'unknown',
      confidence,
      similarity: bestScore,
      topMatches: topMatches.map(m => ({
        intent: m.intent,
        friendlyName: m.friendlyName,
        similarity: m.similarity
      }))
    }
  }

  /**
   * Get semantic similarity between two phrases
   */
  phraseSimilarity(phrase1, phrase2) {
    if (!this.initialized) this.initialize()

    const vec1 = this.phraseToVector(phrase1)
    const vec2 = this.phraseToVector(phrase2)

    return this.cosineSimilarity(vec1, vec2)
  }

  /**
   * Find phrases most similar to input from a list
   */
  findSimilar(input, candidates, topK = 5) {
    if (!this.initialized) this.initialize()

    const inputVector = this.phraseToVector(input)
    const scored = []

    for (const candidate of candidates) {
      const candidateVector = this.phraseToVector(candidate)
      const similarity = this.cosineSimilarity(inputVector, candidateVector)
      scored.push({ phrase: candidate, similarity })
    }

    scored.sort((a, b) => b.similarity - a.similarity)
    return scored.slice(0, topK)
  }

  /**
   * Extract key concepts from a phrase
   */
  extractConcepts(phrase) {
    if (!this.initialized) this.initialize()

    const normalized = textNormalizer.normalize(phrase).normalized
    const words = normalized.toLowerCase().split(/\s+/).filter(w => w.length > 1)

    const concepts = new Set()

    for (const word of words) {
      const clusters = WORD_TO_CLUSTER.get(word) || []
      clusters.forEach(c => concepts.add(c))
    }

    return Array.from(concepts)
  }

  /**
   * Check if two phrases are semantically similar
   */
  areSimilar(phrase1, phrase2, threshold = 0.5) {
    return this.phraseSimilarity(phrase1, phrase2) >= threshold
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      initialized: this.initialized,
      intentCount: this.intentCentroids.size,
      dimensions: this.clusterDimensions,
      cacheSize: this.phraseCache.size,
      clusterCount: Object.keys(WORD_CLUSTERS).length,
      wordMappings: WORD_TO_CLUSTER.size
    }
  }

  /**
   * Clear phrase cache
   */
  clearCache() {
    this.phraseCache.clear()
  }

  /**
   * Add a custom word to a cluster at runtime
   */
  addWordToCluster(word, clusterName) {
    if (WORD_CLUSTERS[clusterName]) {
      WORD_CLUSTERS[clusterName].push(word)
      if (!WORD_TO_CLUSTER.has(word)) {
        WORD_TO_CLUSTER.set(word, [])
      }
      WORD_TO_CLUSTER.get(word).push(clusterName)
    }
  }

  /**
   * Add a custom word with importance weight
   */
  setWordImportance(word, weight) {
    WORD_IMPORTANCE[word] = weight
  }
}

// Singleton export
export const semanticEngine = new SemanticEngineClass()
export default semanticEngine

// Export internals for extending
export { WORD_CLUSTERS, WORD_TO_CLUSTER, WORD_IMPORTANCE }
