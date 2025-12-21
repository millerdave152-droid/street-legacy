/**
 * Relationship Adventures - NPC relationship arcs
 * Multi-part stories that develop over time
 */

export const MARCUS_RELATIONSHIP = {
  id: 'marcus_intro',
  name: 'The Fixer\'s Test',
  description: 'Marcus the Fixer wants to see what you\'re made of. Prove yourself.',
  category: 'relationship',
  difficulty: 'Medium',
  estimatedTime: '8-10 min',

  requirements: {
    minLevel: 3,
  },

  startNode: 'start',

  endConsequences: {
    completed: [
      { type: 'xp', amount: 100 },
      { type: 'relationship', npcId: 'marcus_the_fixer', interaction: 'completed_test', amount: 20 },
      { type: 'flag', global: true, name: 'marcus_knows_you', value: true },
    ],
    failed: [
      { type: 'relationship', npcId: 'marcus_the_fixer', interaction: 'failed_test', amount: -15 },
    ],
  },

  nodes: {
    start: {
      text: [
        'A message arrives on your burner.',
        '',
        '"This is Marcus. Word is you\'ve been making moves.',
        'Come by the shop on Elm. Let\'s talk."',
        '',
        'Marcus "The Fixer" - everyone knows the name.',
        'He connects people. Solves problems. For a price.',
        '',
        'An invitation from him could change everything.',
      ],
      choices: [
        {
          id: 'go',
          text: 'Head to the shop',
          keywords: ['go', 'shop', 'head', 'meet'],
          next: 'arrive_shop',
        },
        {
          id: 'research',
          text: 'Ask around about Marcus first',
          keywords: ['ask', 'research', 'who', 'about'],
          next: 'research_marcus',
        },
        {
          id: 'ignore',
          text: 'Ignore it - don\'t trust it',
          keywords: ['ignore', 'skip', 'no', 'dont'],
          next: 'ignore_message',
        },
      ],
    },

    research_marcus: {
      text: [
        'You put out feelers. Ask the right questions.',
        '',
        'What you learn:',
        '• Marcus runs a legitimate electronics repair shop',
        '• Behind it, he\'s the go-to guy for "fixable problems"',
        '• Never double-crosses clients - reputation is everything',
        '• Has connections to every crew in the city',
        '• Tests new people before trusting them',
        '',
        'He\'s the real deal.',
      ],
      setFlags: { researched: true },
      choices: [
        {
          id: 'go_now',
          text: 'Time to meet him',
          keywords: ['go', 'meet', 'time'],
          next: 'arrive_shop',
        },
        {
          id: 'still_no',
          text: 'Too risky. Stay off the radar.',
          keywords: ['no', 'risky', 'radar'],
          next: 'ignore_message',
        },
      ],
    },

    arrive_shop: {
      text: [
        'The shop is small, cramped. Old TVs, phones, radios.',
        'A bell jingles as you enter.',
        '',
        'Behind the counter: Marcus.',
        'Older than expected. Calm eyes. Measuring you.',
        '',
        '"You came. Good. Close the door."',
        '',
        'He locks the front, flips the sign to CLOSED.',
        '',
        '"I need to know you can handle yourself.',
        'Before I put you in contact with the right people."',
      ],
      choices: [
        {
          id: 'listen',
          text: '"I\'m listening."',
          keywords: ['listening', 'go on', 'tell me'],
          next: 'the_test',
        },
        {
          id: 'skeptical',
          text: '"What\'s in it for me?"',
          keywords: ['what', 'for me', 'why'],
          next: 'skeptical_response',
        },
      ],
    },

    skeptical_response: {
      text: [
        'Marcus smiles. Just barely.',
        '',
        '"Smart. You don\'t work for free. I respect that."',
        '',
        '"Pass my test, and I\'ll put you in touch with people',
        'who pay real money for real work. Connections you can\'t',
        'buy anywhere else."',
        '',
        '"Plus a cash bonus. Call it good faith."',
      ],
      choices: [
        {
          id: 'interested',
          text: '"Alright, I\'m interested."',
          keywords: ['interested', 'okay', 'deal'],
          next: 'the_test',
        },
      ],
    },

    the_test: {
      text: [
        'Marcus slides a photo across the counter.',
        '',
        'A young guy. Nervous eyes. Cheap suit.',
        '',
        '"This is Danny. He stole from one of my clients.',
        '$2,000. Doesn\'t sound like much, but it\'s the principle."',
        '',
        '"I need two things: the money back, and Danny scared',
        'enough to never pull this again."',
        '',
        'He hands you an address.',
        '',
        '"No permanent damage. I need him functional."',
      ],
      choices: [
        {
          id: 'accept',
          text: '"Consider it done."',
          keywords: ['done', 'accept', 'yes', 'okay'],
          next: 'go_to_danny',
        },
        {
          id: 'more_info',
          text: '"What do I know about Danny?"',
          keywords: ['know', 'info', 'tell', 'more'],
          next: 'danny_info',
        },
        {
          id: 'refuse',
          text: '"This isn\'t my style."',
          keywords: ['no', 'refuse', 'cant'],
          next: 'refuse_test',
        },
      ],
    },

    danny_info: {
      text: [
        '"Danny\'s a gambler. Bad one. Owes money all over.',
        'Took my client\'s cash hoping to win it back."',
        '',
        '"He works night shift at a parking garage on 5th.',
        'Lives in the apartment above it. Alone."',
        '',
        '"Not violent. Just stupid.',
        'Use that."',
      ],
      setFlags: { knows_danny: true },
      choices: [
        {
          id: 'do_it',
          text: '"I\'ll handle it."',
          keywords: ['handle', 'do', 'got it'],
          next: 'go_to_danny',
        },
      ],
    },

    refuse_test: {
      text: [
        'Marcus\'s expression doesn\'t change.',
        '',
        '"Your choice. Door\'s that way."',
        '',
        'He turns back to his work.',
        'Conversation over.',
        '',
        'You leave. Some opportunities only knock once.',
      ],
      isEnding: true,
      endingType: 'abandoned',
      endingMessage: 'The Fixer\'s Test - DECLINED',
    },

    go_to_danny: {
      text: [
        'The parking garage is quiet this time of night.',
        'One attendant in the booth. That\'s Danny.',
        '',
        'His apartment door is visible from the street.',
        'Second floor, right above the entrance.',
        '',
        'How do you play this?',
      ],
      choices: [
        {
          id: 'direct',
          text: 'Walk up to the booth, confront him directly',
          keywords: ['direct', 'booth', 'confront', 'walk'],
          next: 'confront_direct',
        },
        {
          id: 'wait',
          text: 'Wait until his shift ends, catch him at home',
          keywords: ['wait', 'home', 'shift', 'apartment'],
          next: 'wait_for_shift',
        },
        {
          id: 'trick',
          text: 'Pretend to be a customer, get him to open up',
          keywords: ['pretend', 'customer', 'trick', 'talk'],
          next: 'trick_approach',
        },
      ],
    },

    confront_direct: {
      text: [
        'You walk straight up to the booth.',
        '',
        'Danny looks up from his phone. "Yeah? Help you?"',
        '',
        '"Marcus sent me."',
        '',
        'The color drains from his face.',
      ],
      choices: [
        {
          id: 'intimidate',
          text: '"$2,000. Now. Or this gets ugly."',
          keywords: ['money', 'now', 'ugly', 'intimidate'],
          next: 'intimidate_danny',
        },
        {
          id: 'calm',
          text: '"Relax. I\'m here to help you fix this."',
          keywords: ['relax', 'help', 'fix', 'calm'],
          next: 'calm_approach',
        },
      ],
    },

    wait_for_shift: {
      text: [
        'You wait in the shadows for two hours.',
        '',
        'Finally, Danny locks the booth and heads upstairs.',
        'You follow. Quiet.',
        '',
        'He\'s unlocking his door when you speak.',
        '',
        '"Danny."',
        '',
        'He spins. Freezes.',
      ],
      choices: [
        {
          id: 'push_inside',
          text: 'Push him inside, close the door',
          keywords: ['push', 'inside', 'door'],
          next: 'inside_apartment',
        },
        {
          id: 'talk_hall',
          text: '"We need to talk. About Marcus."',
          keywords: ['talk', 'marcus'],
          next: 'hall_conversation',
        },
      ],
    },

    trick_approach: {
      text: [
        '"Hey man, need to park overnight. What\'s the rate?"',
        '',
        'Danny relaxes. Just a customer.',
        '"Twenty for overnight. Thirty if you want the covered spot."',
        '',
        'You lean in. Lower your voice.',
        '"Actually, I\'m here about your debt. To Marcus."',
        '',
        'He goes rigid.',
      ],
      choices: [
        {
          id: 'offer_help',
          text: '"I might be able to help you out of this."',
          keywords: ['help', 'out', 'offer'],
          next: 'offer_deal',
        },
        {
          id: 'demand',
          text: '"Money. Now. Or I make things worse."',
          keywords: ['money', 'now', 'worse'],
          next: 'intimidate_danny',
        },
      ],
    },

    intimidate_danny: {
      text: [
        'Danny starts shaking.',
        '',
        '"I-I don\'t have it. I lost it. All of it.',
        'I was going to win it back, I swear—"',
        '',
        '"Marcus doesn\'t care about your excuses."',
        '',
        'He breaks down. Crying. Pathetic.',
        '',
        '"I have $500. That\'s it. Everything I have.',
        'Please. I\'ll get the rest. I swear."',
      ],
      choices: [
        {
          id: 'take_500',
          text: 'Take the $500 and a promise for the rest',
          keywords: ['take', '500', 'promise'],
          next: 'partial_payment',
        },
        {
          id: 'search',
          text: 'Search his belongings for hidden cash',
          keywords: ['search', 'hidden', 'more'],
          next: 'search_danny',
        },
        {
          id: 'get_creative',
          text: '"No cash? Then pay in another way."',
          keywords: ['another', 'way', 'creative'],
          next: 'alternative_payment',
        },
      ],
    },

    calm_approach: {
      text: [
        'Danny blinks. "Help me? You\'re... not here to hurt me?"',
        '',
        '"I\'m here to solve a problem. For everyone.',
        'You pay what you owe, Marcus is satisfied,',
        'and we all walk away."',
        '',
        'He takes a breath. "I gambled it. All of it.',
        'I only have $500 left. I swear I\'ll get the rest."',
      ],
      setFlags: { calm_path: true },
      choices: [
        {
          id: 'accept_500',
          text: '"Give me the $500 and a timeline for the rest."',
          keywords: ['500', 'timeline', 'give'],
          next: 'calm_resolution',
        },
        {
          id: 'find_more',
          text: '"There has to be something else. Think."',
          keywords: ['more', 'else', 'think'],
          next: 'alternative_payment',
        },
      ],
    },

    inside_apartment: {
      text: [
        'You push him inside. Lock the door.',
        '',
        'Small place. Messy. Betting slips everywhere.',
        '',
        '"Where\'s Marcus\'s money?"',
        '',
        '"I DON\'T HAVE IT! I lost it! Please—"',
        '',
        'He\'s telling the truth. You can see it.',
      ],
      choices: [
        {
          id: 'search_place',
          text: 'Search the apartment',
          keywords: ['search', 'look', 'apartment'],
          next: 'search_danny',
        },
        {
          id: 'negotiate',
          text: '"Then we\'re going to figure out a plan."',
          keywords: ['plan', 'figure', 'negotiate'],
          next: 'alternative_payment',
        },
      ],
    },

    hall_conversation: {
      text: [
        '"Marcus? Oh god. Look, I was going to—"',
        '',
        '"Save it. I need two things: the money back,',
        'and assurance this won\'t happen again."',
        '',
        'Danny slumps against the wall.',
        '"I only have $500. I lost the rest. Horses."',
      ],
      choices: [
        {
          id: 'take_what_he_has',
          text: '"Give me the $500 and figure out the rest."',
          keywords: ['give', '500', 'figure'],
          next: 'partial_payment',
        },
      ],
    },

    offer_deal: {
      text: [
        '"Help me? How?"',
        '',
        '"You\'re going to give me everything you have now.',
        'And you\'re going to work off the rest.',
        'Information. Tips about what goes on around here."',
        '',
        'Danny considers. "You mean... be an informant?"',
        '',
        '"I mean survive. Which would you prefer?"',
      ],
      choices: [
        {
          id: 'accept_informant',
          text: 'Set him up as an informant',
          keywords: ['informant', 'deal', 'accept'],
          next: 'informant_deal',
        },
        {
          id: 'just_money',
          text: '"On second thought, just the money."',
          keywords: ['money', 'just', 'forget'],
          next: 'partial_payment',
        },
      ],
    },

    search_danny: {
      text: [
        'You tear through the apartment.',
        '',
        'Under the mattress: another $200.',
        'In a coffee can: $150.',
        'Hidden in a sock drawer: a watch. Looks valuable.',
        '',
        'Danny just sits there. Broken.',
        '',
        '"That\'s everything. I swear."',
      ],
      consequences: [
        { type: 'cash', amount: 350 },
      ],
      choices: [
        {
          id: 'take_all',
          text: 'Take it all and leave',
          keywords: ['take', 'all', 'leave'],
          next: 'complete_recovery',
        },
        {
          id: 'leave_watch',
          text: 'Take the cash, leave the watch. It\'s personal.',
          keywords: ['leave', 'watch', 'cash'],
          next: 'merciful_recovery',
        },
      ],
    },

    alternative_payment: {
      text: [
        '"Think. You work at a parking garage.',
        'Nice cars come through. Keys get left."',
        '',
        'Danny\'s eyes widen. "You want me to..."',
        '',
        '"I want you to make Marcus whole.',
        'How you do that is your business."',
        '',
        'He nods slowly. "There\'s a BMW. Owner leaves the key..."',
      ],
      choices: [
        {
          id: 'car_deal',
          text: '"The BMW covers the debt. Make it happen."',
          keywords: ['bmw', 'car', 'deal'],
          next: 'car_deal',
        },
        {
          id: 'just_cash',
          text: '"Too risky. Just get the cash together."',
          keywords: ['cash', 'no', 'risky'],
          next: 'partial_payment',
        },
      ],
    },

    partial_payment: {
      text: [
        'Danny hands over $500 in crumpled bills.',
        '',
        '"One week. I\'ll have the rest.',
        'Please... tell Marcus I\'m good for it."',
        '',
        'You pocket the cash.',
        '',
        '"One week. If I have to come back,',
        'it won\'t be to talk."',
        '',
        'He nods, trembling.',
        'Message received.',
      ],
      consequences: [
        { type: 'cash', amount: 500 },
      ],
      next: 'return_to_marcus',
      autoNext: 'return_to_marcus',
    },

    calm_resolution: {
      text: [
        'Danny hands over the money.',
        '"Two weeks. I\'ll have the rest.',
        'I\'m done gambling. I swear."',
        '',
        '"Make sure you are."',
        '',
        'You leave him shaking but unharmed.',
        'Sometimes fear is enough.',
      ],
      consequences: [
        { type: 'cash', amount: 500 },
        { type: 'flag', name: 'no_violence', value: true },
      ],
      next: 'return_to_marcus',
      autoNext: 'return_to_marcus',
    },

    complete_recovery: {
      text: [
        'You leave with everything.',
        '',
        'Danny\'s apartment looks ransacked.',
        'He looks broken.',
        '',
        'Job done. Maybe went too far.',
        'But the debt is closer to paid.',
      ],
      consequences: [
        { type: 'cash', amount: 850 },
      ],
      next: 'return_to_marcus',
      autoNext: 'return_to_marcus',
    },

    merciful_recovery: {
      text: [
        'You pocket the cash, push the watch back.',
        '',
        '"Keep the watch. Sell it yourself for the rest."',
        '',
        'Danny looks up, surprised.',
        '"Thank you. I won\'t forget this."',
        '',
        'Maybe you just made an ally.',
        'Or maybe you\'re going soft.',
      ],
      consequences: [
        { type: 'cash', amount: 350 },
        { type: 'flag', name: 'showed_mercy', value: true },
        { type: 'relationship', npcId: 'danny', interaction: 'showed_mercy', amount: 25 },
      ],
      next: 'return_to_marcus',
      autoNext: 'return_to_marcus',
    },

    informant_deal: {
      text: [
        'Danny agrees. Desperation makes people cooperative.',
        '',
        '"Every week, you pass along what you see.',
        'In return, I put in a good word with Marcus."',
        '',
        'He hands over his $500.',
        '"First payment. I\'ll earn the rest."',
        '',
        'You\'ve got yourself an informant.',
      ],
      consequences: [
        { type: 'cash', amount: 500 },
        { type: 'flag', global: true, name: 'has_informant_danny', value: true },
        { type: 'relationship', npcId: 'danny', interaction: 'recruited', amount: 10 },
      ],
      next: 'return_to_marcus',
      autoNext: 'return_to_marcus',
    },

    car_deal: {
      text: [
        'Two days later, your phone buzzes.',
        '',
        '"It\'s done. BMW. Keys under the mat.',
        'Alley behind the garage."',
        '',
        'You find the car. Beautiful.',
        'Worth way more than $2,000.',
        '',
        'You arrange for Marcus\'s people to pick it up.',
        'Debt paid. With interest.',
      ],
      consequences: [
        { type: 'flag', name: 'got_car', value: true },
      ],
      next: 'return_to_marcus_car',
      autoNext: 'return_to_marcus_car',
    },

    return_to_marcus: {
      text: [
        'You\'re back at the shop.',
        '',
        'Marcus counts the money. "$850. Not the full amount."',
        '',
        '"Rest is coming. Danny\'s motivated now."',
        '',
        'Marcus nods slowly.',
        '"You handled it. Not bad."',
        '',
        'He slides $200 across the counter.',
        '"Your cut. And here—"',
        '',
        'He writes a number on a card.',
        '"Call this when you need work. Real work."',
        '',
        'You\'ve passed the test.',
      ],
      consequences: [
        { type: 'cash', amount: 200 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'The Fixer\'s Test - PASSED',
    },

    return_to_marcus_car: {
      text: [
        'Marcus is almost smiling when you return.',
        '',
        '"A BMW? For a $2,000 debt?"',
        '',
        '"Covered the debt and then some."',
        '',
        '"I like how you think."',
        '',
        'He hands you $500.',
        '"Your cut. Bigger than planned.',
        'You earned it."',
        '',
        'He writes a number on a card.',
        '"My private line. You\'re in."',
        '',
        'You haven\'t just passed the test.',
        'You\'ve exceeded expectations.',
      ],
      consequences: [
        { type: 'cash', amount: 500 },
        { type: 'relationship', npcId: 'marcus_the_fixer', interaction: 'exceeded', amount: 15 },
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'The Fixer\'s Test - EXCEEDED EXPECTATIONS',
    },

    ignore_message: {
      text: [
        'You delete the message.',
        '',
        'Marcus who? You don\'t know any Marcus.',
        '',
        'Some doors are better left closed.',
      ],
      isEnding: true,
      endingType: 'abandoned',
      endingMessage: 'The Fixer\'s Test - IGNORED',
    },
  },
}

export default { MARCUS_RELATIONSHIP }
