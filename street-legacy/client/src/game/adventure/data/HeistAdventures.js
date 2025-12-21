/**
 * Heist Adventures - Planning and executing heists
 */

export const WAREHOUSE_HEIST = {
  id: 'warehouse_heist',
  name: 'The Warehouse Score',
  description: 'A contact tips you off about an unguarded warehouse. Big payout, but something feels off.',
  category: 'heist',
  difficulty: 'Medium',
  estimatedTime: '10-15 min',

  requirements: {
    minLevel: 5,
  },

  startNode: 'start',

  endConsequences: {
    completed: [
      { type: 'cash', amount: 2500 },
      { type: 'xp', amount: 150 },
      { type: 'heat', amount: 25 },
    ],
    failed: [
      { type: 'heat', amount: 40 },
      { type: 'cash', amount: -500 },
    ],
  },

  nodes: {
    start: {
      text: [
        'Your burner phone buzzes. Unknown number.',
        '',
        '"Got a tip for you. Warehouse on the docks.',
        'Owner\'s out of town. Night security called in sick.',
        'Easy money. You interested?"',
      ],
      choices: [
        {
          id: 'accept',
          text: '"I\'m listening. What\'s the catch?"',
          keywords: ['yes', 'listening', 'interested', 'accept'],
          next: 'get_details',
        },
        {
          id: 'suspicious',
          text: '"Sounds too easy. Who is this?"',
          keywords: ['suspicious', 'who', 'easy', 'catch'],
          next: 'suspicious_question',
        },
        {
          id: 'decline',
          text: 'Hang up. Not worth the risk.',
          keywords: ['no', 'hang up', 'decline', 'pass'],
          next: 'decline_end',
        },
      ],
    },

    get_details: {
      text: [
        '"No catch. I get 20% of what you find, and we never met."',
        '"Warehouse is at Pier 7. Electronics, maybe some cash."',
        '"Back entrance has a broken lock. Front has a camera."',
        '',
        'The line clicks dead.',
      ],
      choices: [
        {
          id: 'scout',
          text: 'Scout the location first',
          keywords: ['scout', 'check', 'look', 'recon'],
          next: 'scout_location',
        },
        {
          id: 'direct',
          text: 'Head straight there - time is money',
          keywords: ['go', 'straight', 'direct', 'now'],
          next: 'approach_direct',
        },
        {
          id: 'gear',
          text: 'Gather some gear first',
          keywords: ['gear', 'prepare', 'equipment', 'tools'],
          next: 'gather_gear',
        },
      ],
    },

    suspicious_question: {
      text: [
        'Long pause.',
        '',
        '"Someone who knows things. Someone who knows you\'ve been',
        'looking for a score. Take it or leave it."',
        '',
        '"Pier 7. Tonight. Don\'t be stupid about it."',
        '',
        'Click.',
      ],
      choices: [
        {
          id: 'go',
          text: 'Head to Pier 7',
          keywords: ['go', 'pier', 'head', 'check'],
          next: 'approach_direct',
        },
        {
          id: 'ignore',
          text: 'Ignore it - too sketchy',
          keywords: ['ignore', 'skip', 'forget', 'no'],
          next: 'decline_end',
        },
      ],
    },

    scout_location: {
      text: [
        'You spend an hour watching the warehouse from across the street.',
        '',
        'Observations:',
        '• Two guards on rotation - they switch every 30 minutes',
        '• Back entrance is unlit, but there\'s a motion sensor',
        '• Loading dock has a gap big enough to squeeze through',
        '• Front camera sweeps left to right on a 45-second cycle',
        '',
        'Your phone buzzes. Unknown number again.',
        '"Taking your time, huh? Guards change shift in 20 minutes.',
        'That\'s your window."',
      ],
      setFlags: { scouted: true },
      choices: [
        {
          id: 'back',
          text: 'Take the back entrance',
          keywords: ['back', 'rear', 'behind'],
          next: 'back_entrance',
        },
        {
          id: 'loading',
          text: 'Slip through the loading dock gap',
          keywords: ['loading', 'dock', 'gap', 'squeeze'],
          next: 'loading_dock',
        },
        {
          id: 'front',
          text: 'Time the camera and go through front',
          keywords: ['front', 'camera', 'main'],
          next: 'front_entrance',
          skillCheck: {
            stat: 'level',
            threshold: 8,
            comparison: 'atLeast',
            successMessage: 'You time it perfectly.',
            failMessage: 'The camera catches you. Alarms blare.',
            failNext: 'alarm_triggered',
          },
        },
      ],
    },

    approach_direct: {
      text: [
        'You arrive at Pier 7. The warehouse looms in the darkness.',
        '',
        'A security guard is smoking near the front entrance.',
        'The back of the building is shrouded in shadow.',
        'You spot a loading dock with a partially open shutter.',
      ],
      choices: [
        {
          id: 'wait',
          text: 'Wait for the guard to finish his smoke',
          keywords: ['wait', 'guard', 'smoke', 'patience'],
          next: 'wait_for_guard',
        },
        {
          id: 'back_sneak',
          text: 'Sneak around to the back',
          keywords: ['back', 'sneak', 'around', 'shadow'],
          next: 'back_entrance',
        },
        {
          id: 'loading_quick',
          text: 'Make for the loading dock',
          keywords: ['loading', 'dock', 'quick'],
          next: 'loading_dock',
        },
      ],
    },

    gather_gear: {
      text: [
        'You hit up your stash.',
        '',
        'Available:',
        '• Lockpicks (reliable)',
        '• Crowbar (loud but effective)',
        '• Flashlight (essential for the dark)',
        '',
        'You grab what you need and head out.',
      ],
      setFlags: { has_gear: true },
      next: 'approach_direct',
      autoNext: 'approach_direct',
    },

    wait_for_guard: {
      text: [
        'Ten minutes pass. The guard finally stubs out his cigarette',
        'and heads inside.',
        '',
        'The front is clear. The camera continues its slow sweep.',
      ],
      choices: [
        {
          id: 'front_now',
          text: 'Move to the front entrance',
          keywords: ['front', 'entrance', 'door'],
          next: 'front_entrance_clear',
        },
        {
          id: 'still_back',
          text: 'Still prefer the back - less risky',
          keywords: ['back', 'safe', 'careful'],
          next: 'back_entrance',
        },
      ],
    },

    back_entrance: {
      text: [
        'The back door is barely visible in the darkness.',
        'A red light blinks slowly - the motion sensor.',
        '',
        'The broken lock the caller mentioned hangs uselessly.',
        'But that sensor is a problem.',
      ],
      choices: [
        {
          id: 'disable',
          text: 'Try to disable the sensor',
          keywords: ['disable', 'sensor', 'cut'],
          next: 'disable_sensor',
          showIf: { flag: 'scouted' },
        },
        {
          id: 'crawl',
          text: 'Crawl under the sensor\'s range',
          keywords: ['crawl', 'under', 'slow', 'low'],
          next: 'crawl_under',
        },
        {
          id: 'other_way',
          text: 'Find another way in',
          keywords: ['other', 'different', 'loading'],
          next: 'loading_dock',
        },
      ],
    },

    loading_dock: {
      text: [
        'The loading dock shutter is rusted and jammed halfway.',
        'You can squeeze through the gap, barely.',
        '',
        'Inside is pitch black. You hear the hum of machinery.',
      ],
      choices: [
        {
          id: 'squeeze',
          text: 'Squeeze through',
          keywords: ['squeeze', 'through', 'enter', 'go'],
          next: 'inside_warehouse',
        },
        {
          id: 'light_first',
          text: 'Use your phone light to check first',
          keywords: ['light', 'phone', 'check', 'look'],
          next: 'phone_light',
        },
      ],
    },

    phone_light: {
      text: [
        'Your phone light reveals stacked crates and machinery.',
        'No guards visible. Coast looks clear.',
        '',
        'But wait - there\'s a wire near the ground.',
        'Trip wire. Someone expected visitors.',
      ],
      setFlags: { saw_tripwire: true },
      choices: [
        {
          id: 'step_over',
          text: 'Step carefully over the wire',
          keywords: ['step', 'over', 'careful', 'avoid'],
          next: 'inside_warehouse',
        },
        {
          id: 'abort',
          text: 'This is a trap. Get out.',
          keywords: ['trap', 'abort', 'leave', 'run'],
          next: 'abort_mission',
        },
      ],
    },

    inside_warehouse: {
      text: [
        'You\'re inside. The warehouse is bigger than expected.',
        '',
        'Rows of crates stretch into darkness. Electronic equipment',
        'gleams on shelving units. In the far corner, you spot a',
        'small office with a light on.',
        '',
        'From somewhere, you hear voices. Guards.',
      ],
      choices: [
        {
          id: 'electronics',
          text: 'Grab electronics from the shelves - quick and dirty',
          keywords: ['electronics', 'grab', 'quick', 'shelves'],
          next: 'grab_electronics',
        },
        {
          id: 'office',
          text: 'Check the office - could be a safe',
          keywords: ['office', 'safe', 'check', 'light'],
          next: 'approach_office',
        },
        {
          id: 'crates',
          text: 'Investigate the crates',
          keywords: ['crates', 'investigate', 'boxes'],
          next: 'check_crates',
        },
      ],
    },

    grab_electronics: {
      text: [
        'You start loading a bag with laptops and tablets.',
        '$2000 worth easy.',
        '',
        'Then you hear footsteps. Getting closer.',
      ],
      consequences: [
        { type: 'flag', name: 'has_loot', value: true },
      ],
      choices: [
        {
          id: 'hide',
          text: 'Hide behind the shelves',
          keywords: ['hide', 'duck', 'shelves', 'quiet'],
          next: 'hide_from_guard',
        },
        {
          id: 'run',
          text: 'Grab what you can and run',
          keywords: ['run', 'flee', 'escape', 'go'],
          next: 'escape_with_loot',
        },
      ],
    },

    approach_office: {
      text: [
        'You creep toward the lit office. Through the window,',
        'you see a desk, computer, and... a floor safe.',
        '',
        'There\'s a guard inside, scrolling on his phone.',
      ],
      choices: [
        {
          id: 'wait_leave',
          text: 'Wait for him to leave',
          keywords: ['wait', 'patient', 'leave'],
          next: 'guard_leaves_office',
        },
        {
          id: 'distraction',
          text: 'Create a distraction',
          keywords: ['distraction', 'distract', 'noise'],
          next: 'create_distraction',
        },
        {
          id: 'forget_safe',
          text: 'Too risky - grab electronics instead',
          keywords: ['forget', 'electronics', 'shelves', 'back'],
          next: 'grab_electronics',
        },
      ],
    },

    guard_leaves_office: {
      text: [
        'You wait. And wait.',
        '',
        'After what feels like forever, the guard stretches,',
        'pockets his phone, and steps out for a smoke break.',
        '',
        'The office is empty. The safe beckons.',
      ],
      choices: [
        {
          id: 'crack_safe',
          text: 'Try to crack the safe',
          keywords: ['safe', 'crack', 'open', 'break'],
          next: 'crack_safe',
        },
        {
          id: 'computer',
          text: 'Check the computer',
          keywords: ['computer', 'desk', 'files'],
          next: 'check_computer',
        },
      ],
    },

    crack_safe: {
      text: [
        'You examine the safe. Cheap model. Common combo lock.',
        '',
        'You put your ear to the dial and start working...',
      ],
      skillCheck: {
        stat: 'level',
        threshold: 7,
        comparison: 'atLeast',
        randomFactor: 0.7,
        successMessage: 'Click. Click. Click. The safe swings open.',
        failMessage: 'No luck. The combo eludes you.',
        failNext: 'safe_fail',
      },
      choices: [
        {
          id: 'open',
          text: 'Open the safe',
          keywords: ['open', 'look', 'inside'],
          next: 'safe_contents',
        },
      ],
    },

    safe_contents: {
      text: [
        'Inside the safe:',
        '',
        '• $5,000 in cash bundles',
        '• A USB drive labeled "INSURANCE"',
        '• A small handgun',
        '',
        'Jackpot.',
      ],
      consequences: [
        { type: 'flag', name: 'got_safe', value: true },
      ],
      choices: [
        {
          id: 'take_all',
          text: 'Take everything',
          keywords: ['all', 'everything', 'take'],
          next: 'take_safe_contents',
        },
        {
          id: 'cash_only',
          text: 'Just the cash - less risky',
          keywords: ['cash', 'money', 'only'],
          next: 'take_cash_only',
        },
      ],
    },

    take_safe_contents: {
      text: [
        'You stuff everything into your bag.',
        '',
        'Time to go. You hear the guard returning.',
      ],
      consequences: [
        { type: 'cash', amount: 5000 },
        { type: 'flag', name: 'took_usb', value: true },
      ],
      next: 'final_escape',
      autoNext: 'final_escape',
    },

    take_cash_only: {
      text: [
        'You pocket the cash and leave the rest.',
        '',
        'Time to go. The guard\'s smoke break is almost over.',
      ],
      consequences: [
        { type: 'cash', amount: 5000 },
      ],
      next: 'final_escape',
      autoNext: 'final_escape',
    },

    hide_from_guard: {
      text: [
        'You duck behind the shelving unit, heart pounding.',
        '',
        'The guard\'s flashlight sweeps past. He mutters something',
        'about checking the east side and moves on.',
        '',
        'Close call.',
      ],
      choices: [
        {
          id: 'continue',
          text: 'Continue grabbing electronics',
          keywords: ['continue', 'more', 'grab'],
          next: 'escape_with_loot',
        },
        {
          id: 'office_now',
          text: 'Now\'s your chance for the office',
          keywords: ['office', 'safe', 'chance'],
          next: 'approach_office',
        },
      ],
    },

    escape_with_loot: {
      text: [
        'You make for the loading dock with your haul.',
        'Electronics worth at least $2,500.',
        '',
        'Almost there when—',
        '',
        '"HEY! STOP!"',
        '',
        'A guard spotted you.',
      ],
      consequences: [
        { type: 'cash', amount: 2500 },
        { type: 'flag', name: 'spotted', value: true },
      ],
      choices: [
        {
          id: 'run_fast',
          text: 'Run for it!',
          keywords: ['run', 'sprint', 'fast', 'escape'],
          next: 'chase_scene',
        },
        {
          id: 'fight',
          text: 'Turn and fight',
          keywords: ['fight', 'turn', 'attack'],
          next: 'fight_guard',
        },
      ],
    },

    final_escape: {
      text: [
        'You slip out the same way you came.',
        '',
        'Outside, the cool night air hits your face.',
        'Your pockets are heavy. Your heart is light.',
        '',
        'A block away, your phone buzzes.',
        '"Nice work. My cut will find its way to you. We\'ll talk again."',
        '',
        'You disappear into the night, richer and more dangerous.',
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'The Warehouse Score - COMPLETED',
    },

    chase_scene: {
      text: [
        'You sprint toward the loading dock.',
        'The guard is yelling into his radio.',
        '',
        'Sirens in the distance. Getting closer.',
      ],
      skillCheck: {
        stat: 'heat',
        threshold: 50,
        comparison: 'less',
        successMessage: 'You\'re faster. You lose him in the alley.',
        failMessage: 'Too slow. Backup arrives.',
        failNext: 'caught',
      },
      choices: [
        {
          id: 'escape_success',
          text: 'Keep running',
          keywords: ['run', 'keep', 'go'],
          next: 'escape_success',
        },
      ],
    },

    escape_success: {
      text: [
        'You vault a fence, cut through a parking lot,',
        'and emerge three blocks away.',
        '',
        'Safe. Rich. Alive.',
        '',
        'Your phone buzzes. "Clean work. See you around."',
      ],
      isEnding: true,
      endingType: 'completed',
      endingMessage: 'The Warehouse Score - COMPLETED (with heat)',
    },

    caught: {
      text: [
        'They\'re everywhere. Flashlights. Shouting.',
        '',
        '"ON THE GROUND! NOW!"',
        '',
        'No way out. You drop the bag.',
        '',
        'The cold pavement meets your face.',
        'Cuffs click shut.',
        '',
        'Should have trusted your instincts.',
      ],
      isEnding: true,
      endingType: 'failed',
      endingMessage: 'The Warehouse Score - BUSTED',
      consequences: [
        { type: 'jail', days: 3 },
      ],
    },

    alarm_triggered: {
      text: [
        'Alarms scream. Lights flood the area.',
        '',
        'Guards converge on your position.',
        'There\'s nowhere to run.',
      ],
      isEnding: true,
      endingType: 'failed',
      endingMessage: 'The Warehouse Score - BUSTED',
    },

    abort_mission: {
      text: [
        'You back away slowly and disappear into the night.',
        '',
        'Your phone buzzes. "Cold feet? Shame.',
        'Opportunity doesn\'t knock twice."',
        '',
        'Maybe it was a trap. Maybe it was real.',
        'You\'ll never know.',
      ],
      isEnding: true,
      endingType: 'abandoned',
      endingMessage: 'The Warehouse Score - ABANDONED',
    },

    decline_end: {
      text: [
        'You pocket the phone and walk away.',
        '',
        'Some tips aren\'t worth following.',
        'Live to hustle another day.',
      ],
      isEnding: true,
      endingType: 'abandoned',
      endingMessage: 'The Warehouse Score - DECLINED',
    },

    // Additional nodes for completeness
    front_entrance_clear: {
      text: [
        'You time the camera perfectly and slip through the front door.',
        '',
        'Inside, you find yourself in a small reception area.',
        'A hallway leads deeper into the warehouse.',
      ],
      next: 'inside_warehouse',
      autoNext: 'inside_warehouse',
    },

    disable_sensor: {
      text: [
        'Using what you learned from scouting, you locate',
        'the sensor\'s power cable and cut it.',
        '',
        'The red light dies. You\'re in.',
      ],
      next: 'inside_warehouse',
      autoNext: 'inside_warehouse',
    },

    crawl_under: {
      text: [
        'You drop to your belly and crawl under the sensor beam.',
        'The motion detector stays silent.',
        '',
        'Inside the warehouse now.',
      ],
      next: 'inside_warehouse',
      autoNext: 'inside_warehouse',
    },

    create_distraction: {
      text: [
        'You toss a small piece of debris toward the far shelves.',
        'It clatters loudly.',
        '',
        'The guard\'s head snaps up. "What the—"',
        'He steps out to investigate.',
        '',
        'The office is yours.',
      ],
      next: 'guard_leaves_office',
      autoNext: 'guard_leaves_office',
    },

    safe_fail: {
      text: [
        'The combination eludes you. Too complex.',
        '',
        'Footsteps approach. No time for this.',
        'Better grab what you can and get out.',
      ],
      choices: [
        {
          id: 'grab_desk',
          text: 'Grab what\'s on the desk and run',
          keywords: ['grab', 'desk', 'run', 'leave'],
          next: 'escape_with_loot',
        },
      ],
    },

    check_crates: {
      text: [
        'You pry open a crate.',
        '',
        'Cheap knockoff electronics. Worthless.',
        'Another crate: empty packaging.',
        '',
        'Wait—this warehouse isn\'t full of valuables.',
        'It\'s mostly empty. A front for something?',
      ],
      setFlags: { found_empty: true },
      choices: [
        {
          id: 'office_anyway',
          text: 'Check the office - that\'s where the real goods are',
          keywords: ['office', 'real', 'check'],
          next: 'approach_office',
        },
        {
          id: 'leave_now',
          text: 'This is wrong. Get out now.',
          keywords: ['leave', 'wrong', 'trap', 'out'],
          next: 'abort_mission',
        },
      ],
    },

    check_computer: {
      text: [
        'The computer is unlocked. Sloppy.',
        '',
        'You find shipping manifests, contacts, schedules.',
        'This warehouse is a front for a smuggling operation.',
        '',
        'Intel worth money to the right people.',
      ],
      consequences: [
        { type: 'flag', name: 'got_intel', value: true },
        { type: 'flag', global: true, name: 'knows_smugglers', value: true },
      ],
      choices: [
        {
          id: 'take_photos',
          text: 'Take photos of the screen',
          keywords: ['photo', 'photos', 'picture', 'evidence'],
          next: 'final_escape',
        },
        {
          id: 'and_safe',
          text: 'Now crack that safe',
          keywords: ['safe', 'crack', 'open'],
          next: 'crack_safe',
        },
      ],
    },

    fight_guard: {
      text: [
        'You spin and swing. Connect.',
        'The guard staggers back.',
        '',
        'But he\'s reaching for something.',
        '',
        'BANG.',
        '',
        'Pain rips through your shoulder.',
        'You drop. The loot scatters.',
        '',
        'Sirens. Darkness.',
      ],
      consequences: [
        { type: 'health', amount: -40 },
      ],
      isEnding: true,
      endingType: 'failed',
      endingMessage: 'The Warehouse Score - SHOT AND CAPTURED',
    },
  },
}

export default { WAREHOUSE_HEIST }
