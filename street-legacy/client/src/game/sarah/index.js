/**
 * S.A.R.A.H. Module Index
 * Street Autonomous Response & Assistance Hub
 *
 * Exports all S.A.R.A.H. components for use throughout the game.
 */

// Core manager
export { sarahManager, default } from './SarahManager'

// Components
export { sarahPersonality, SARAH_IDENTITY, VOICE_TRAITS, SLANG } from './SarahPersonality'
export { intentClassifier, INTENT_TYPES } from './IntentClassifier'
export { responseGenerator } from './ResponseGenerator'
export { sarahKnowledgeBase, MECHANICS, STRATEGIC_ADVICE, FAQ } from './SarahKnowledgeBase'
export { proactiveMonitor } from './ProactiveMonitor'
