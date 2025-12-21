/**
 * Encounter Adventures - Random street encounters
 * Short, impactful scenarios that can happen during gameplay
 */

export const STREET_ENCOUNTER = {
  id: 'street_encounter_alley',
  name: 'Wrong Turn',
  description: 'A shortcut through an alley leads to an unexpected confrontation.',
  category: 'encounter',
  difficulty: 'Easy',
  estimatedTime: '5 min',

  requirements: {
    minLevel: 1,
  },

  startNode: 'start',

  endConsequences: {
    completed: [
      { type: 'xp', amount: 50 },
    ],
  },

  nodes: {
    start: {
      text: [
        'You cut through an alley to save time.',
        '',
        'Halfway through, you realize your mistake.',
        '',
        'Three figures block the far exit. One steps forward.',
        '',
        '"Wrong turn, friend. Toll to pass through is...',
        'everything you got."',
      ],
      choices: [
        {
          id: 'pay',
          text: '"Alright, alright. Take it easy."',
          keywords: ['pay', 'give', 'okay', 'fine', 'wallet'],
          next: 'pay_toll',
        },
        {
          id: 'talk',
          text: '"Let\'s talk about this. I know people."',
          keywords: ['talk', 'negotiate', 'know', 'people'],
          next: 'negotiate',
        },
        {
          id: 'run',
          text: 'Spin and run back the way you came',
          keywords: ['run', 'flee', 'escape', 'back'],
          next: 'run_away',
        },
        {
          id: 'fight',
          text: 'Square up. You\'re not giving them anything.',
          keywords: ['fight', 'no', 'nothing', 'square'],
          next: 'fight_start',
        },
      ],
    },

    pay_toll: {
      text: [
        'You slowly reach for your wallet.',
        '',
        'The leader grins. "Smart. We like smart."',
        '',
        'You hand over $200. Could be worse.',
        '',
        '"Now walk. And maybe pick a different route next time."',
        '',
        'You keep your eyes down and slip past them.',
        'Lesson learned.',
      ],
      consequences: [
        { type: 'cash', amount: -200 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'Wrong Turn - Paid the Toll',
    },

    negotiate: {
      text: [
        '"People?" The leader laughs. "What people?"',
        '',
        'You drop a name. Marcus. The Fixer.',
        '',
        'The laughter stops. They exchange glances.',
        '',
        '"You work for Marcus?"',
      ],
      choices: [
        {
          id: 'bluff',
          text: '"Work for him? I AM his collection guy."',
          keywords: ['yes', 'work', 'collection', 'bluff'],
          next: 'bluff_attempt',
          skillCheck: {
            stat: 'level',
            threshold: 5,
            comparison: 'atLeast',
            randomFactor: 0.6,
            successMessage: 'They buy it.',
            failMessage: 'They don\'t believe you.',
            failNext: 'bluff_fails',
          },
        },
        {
          id: 'truth',
          text: '"I\'ve done work for him. Call and check."',
          keywords: ['truth', 'done', 'check', 'call'],
          next: 'truth_path',
        },
      ],
    },

    bluff_attempt: {
      text: [
        'The leader goes pale.',
        '',
        '"Look, we didn\'t know. No harm done, right?"',
        '',
        'They part like the sea, pressing themselves',
        'against the alley walls.',
        '',
        '"Tell Marcus we\'re sorry."',
        '',
        'You stroll through like you own the place.',
        'Which, for this moment, you do.',
      ],
      consequences: [
        { type: 'respect', amount: 10 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'Wrong Turn - Bluffed Your Way Out',
    },

    bluff_fails: {
      text: [
        'The leader stares you down.',
        '',
        '"Nice try. But I know Marcus\'s people.',
        'You ain\'t one of them."',
        '',
        'He cracks his knuckles. "Now it\'s gonna cost extra',
        'for wasting my time."',
      ],
      choices: [
        {
          id: 'pay_extra',
          text: 'Pay and get out alive',
          keywords: ['pay', 'fine', 'take'],
          next: 'pay_extra',
        },
        {
          id: 'fight_now',
          text: 'If you\'re going down, go down swinging',
          keywords: ['fight', 'swing', 'no'],
          next: 'fight_start',
        },
      ],
    },

    truth_path: {
      text: [
        'The leader pulls out a phone, never breaking eye contact.',
        '',
        'A muffled conversation. Long pause.',
        '',
        'He hangs up.',
        '',
        '"Marcus says you\'re cool. Says leave you alone."',
        '',
        'He jerks his head. "Get out of here."',
        '',
        'You walk past, heart pounding.',
        'Marcus remembers you. That\'s worth something.',
      ],
      consequences: [
        { type: 'relationship', npcId: 'marcus_the_fixer', interaction: 'vouched', amount: 5 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'Wrong Turn - Name Dropped Successfully',
    },

    run_away: {
      text: [
        'You spin and bolt.',
        '',
        '"Get him!"',
        '',
        'Footsteps pound behind you. Heavy. Fast.',
      ],
      skillCheck: {
        stat: 'heat',
        threshold: 30,
        comparison: 'less',
        successMessage: 'You\'re faster.',
        failMessage: 'They\'re gaining.',
        failNext: 'caught_running',
      },
      choices: [
        {
          id: 'escape',
          text: 'Keep running',
          keywords: ['run', 'keep', 'go'],
          next: 'escape_success',
        },
      ],
    },

    escape_success: {
      text: [
        'You vault a dumpster, cut left, burst onto the main street.',
        '',
        'They won\'t follow you here. Too many witnesses.',
        '',
        'You keep walking, blend into the crowd.',
        '',
        'Heart racing, but wallet intact.',
        'Next time, take the long way.',
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'Wrong Turn - Escaped',
    },

    caught_running: {
      text: [
        'A hand grabs your collar, yanks you back.',
        '',
        'You hit the ground hard.',
        '',
        '"Running? Really? Now we\'re REALLY gonna tax you."',
        '',
        'They take everything. Every dollar.',
        'And throw in a few kicks for the trouble.',
        '',
        'You lay there until they\'re gone.',
        'Everything hurts.',
      ],
      consequences: [
        { type: 'cash', amount: -500 },
        { type: 'health', amount: -20 },
      ],
      isEnding: true,
      endingType: 'failed',
      endingMessage: 'Wrong Turn - Caught and Beaten',
    },

    pay_extra: {
      text: [
        'You hand over $400. Every bill you have.',
        '',
        'The leader pockets it with a smirk.',
        '',
        '"Pleasure doing business. Now get lost."',
        '',
        'You stumble out of the alley, broke but breathing.',
      ],
      consequences: [
        { type: 'cash', amount: -400 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'Wrong Turn - Paid Through the Nose',
    },

    fight_start: {
      text: [
        'You raise your fists.',
        '',
        '"Oh, he wants to play!" The leader grins.',
        '"Boys, let\'s teach him about tolls."',
        '',
        'Three on one. Bad odds.',
        'But you\'ve had worse.',
      ],
      skillCheck: {
        stat: 'level',
        threshold: 8,
        comparison: 'atLeast',
        randomFactor: 0.4,
        successMessage: 'You\'re ready.',
        failMessage: 'They\'re too many.',
        failNext: 'fight_loss',
      },
      choices: [
        {
          id: 'continue_fight',
          text: 'Fight!',
          keywords: ['fight', 'go', 'attack'],
          next: 'fight_win',
        },
      ],
    },

    fight_win: {
      text: [
        'The first one comes in swinging.',
        'You duck, counter, and he goes down.',
        '',
        'The second hesitates. Bad move.',
        'You don\'t.',
        '',
        'The leader pulls a knife.',
        '"You got skills. I respect that."',
        '',
        'He backs away, picking up his groaning friends.',
        '',
        '"We\'ll remember you."',
        '',
        'You let them go. You won.',
        'But you\'ve made enemies.',
      ],
      consequences: [
        { type: 'respect', amount: 15 },
        { type: 'heat', amount: 5 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'Wrong Turn - Fought and Won',
    },

    fight_loss: {
      text: [
        'The first punch rocks you.',
        'The second drops you.',
        '',
        'You try to get up, but boots find your ribs.',
        '',
        'When it\'s over, you\'re alone.',
        'No wallet. No dignity.',
        'Just pain.',
      ],
      consequences: [
        { type: 'cash', amount: -300 },
        { type: 'health', amount: -35 },
      ],
      isEnding: true,
      endingType: 'failed',
      endingMessage: 'Wrong Turn - Beaten Down',
    },
  },
}

export default { STREET_ENCOUNTER }
