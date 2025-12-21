/**
 * IntentClassifier - Query understanding for S.A.R.A.H.
 *
 * Classifies user queries into intent categories using pattern matching
 * and keyword analysis. No external AI required.
 */

// Intent types
export const INTENT_TYPES = {
  // Strategic advice
  CRIME_ADVICE: 'crime_advice',
  JOB_ADVICE: 'job_advice',
  MONEY_ADVICE: 'money_advice',
  HEAT_ADVICE: 'heat_advice',
  INVESTMENT: 'investment',

  // Game navigation
  HOW_TO: 'how_to',
  WHERE_IS: 'where_is',
  WHAT_IS: 'what_is',

  // Analysis
  STAT_ANALYSIS: 'stat_analysis',
  AI_INTEL: 'ai_intel',
  MARKET_ANALYSIS: 'market_analysis',
  ACHIEVEMENT: 'achievement',
  PROGRESS: 'progress',

  // Crew & Equipment (NEW)
  CREW_MANAGEMENT: 'crew_management',
  CREW_SYNERGY: 'crew_synergy',
  EQUIPMENT_ADVICE: 'equipment_advice',
  EQUIPMENT_COMPARE: 'equipment_compare',

  // Location & Strategy (NEW)
  LOCATION_TIPS: 'location_tips',
  TERRITORY_STRATEGY: 'territory_strategy',
  TIME_MANAGEMENT: 'time_management',
  EFFICIENCY: 'efficiency',

  // Legal & Jail (NEW)
  JAIL_STRATEGY: 'jail_strategy',
  LAWYER_ADVICE: 'lawyer_advice',
  PAROLE_STRATEGY: 'parole_strategy',

  // AI Players (NEW)
  AI_RELATIONSHIP: 'ai_relationship',
  AI_THREAT: 'ai_threat',
  TRADE_ANALYSIS: 'trade_analysis',
  ALLIANCE_STRATEGY: 'alliance_strategy',

  // Social
  GREETING: 'greeting',
  THANKS: 'thanks',
  HELP: 'help',
  WHO_ARE_YOU: 'who_are_you',

  // Fallback
  UNKNOWN: 'unknown',
}

// Intent patterns - arrays of regex patterns for each intent
// Made flexible with casual/conversational patterns
const INTENT_PATTERNS = {
  [INTENT_TYPES.CRIME_ADVICE]: [
    // Direct questions
    /what (crime|should i (do|commit|steal|rob))/i,
    /best crime/i,
    /which crime/i,
    /(suggest|recommend).*(crime|steal|rob)/i,
    /crime (advice|suggestion|tip)/i,
    /should i (steal|rob|heist|burglar)/i,
    /what('s| is) (a )?good crime/i,
    // Casual/simple
    /^crimes?$/i,
    /do a crime/i,
    /commit/i,
    /what to steal/i,
    /rob what/i,
    /steal what/i,
    /next crime/i,
    /good score/i,
    /easy score/i,
    /quick score/i,
    /hit/i,
    /lick/i,
    /pull a job/i,
  ],

  [INTENT_TYPES.JOB_ADVICE]: [
    // Direct questions
    /what job/i,
    /best job/i,
    /which job/i,
    /(suggest|recommend).*job/i,
    /job (advice|suggestion|tip)/i,
    /safe (money|income|way)/i,
    /legit (work|money|income)/i,
    /earn (money )?safely/i,
    // Casual/simple
    /^jobs?$/i,
    /work/i,
    /legit/i,
    /legal money/i,
    /clean money/i,
    /9 to 5/i,
    /honest work/i,
    /safe income/i,
    /no risk/i,
    /play it safe/i,
  ],

  [INTENT_TYPES.MONEY_ADVICE]: [
    // Direct questions
    /how (do i |can i |to )?(make|get|earn) (more )?(money|cash)/i,
    /need (more )?(money|cash)/i,
    /(get|become) rich/i,
    /money (advice|tips?|strategy)/i,
    /broke|poor/i,
    /fastest way.*(money|cash)/i,
    /best way.*(money|cash|earn)/i,
    // Casual/simple
    /^money$/i,
    /^cash$/i,
    /get rich/i,
    /make bank/i,
    /stack/i,
    /bag/i,
    /bread/i,
    /guap/i,
    /bands/i,
    /racks/i,
    /more money/i,
    /need cash/i,
    /im broke/i,
    /i'm broke/i,
    /no money/i,
    /funds/i,
    /income/i,
    /earn more/i,
  ],

  [INTENT_TYPES.HEAT_ADVICE]: [
    // Direct questions
    /reduce (my )?heat/i,
    /(lower|decrease|get rid of) (my )?heat/i,
    /too (much )?heat/i,
    /heat (is )?(too )?(high|hot)/i,
    /cops|police|fuzz|5-0|wanted/i,
    /(avoid|escape) (arrest|jail|police)/i,
    /how (do i |to )?(lose|shake).*(heat|cops)/i,
    /lay low/i,
    // Casual/simple
    /^heat$/i,
    /hot/i,
    /cool off/i,
    /cool down/i,
    /being watched/i,
    /feds/i,
    /pigs/i,
    /12/i,
    /one time/i,
    /po po/i,
    /five-o/i,
    /arrest/i,
    /busted/i,
    /caught/i,
    /wanted level/i,
    /hide/i,
    /laying low/i,
  ],

  [INTENT_TYPES.INVESTMENT]: [
    // Direct questions
    /(should i |do i )?(buy|invest|purchase).*(property|properties)/i,
    /property (advice|investment)/i,
    /passive income/i,
    /what (should i )?(buy|invest)/i,
    /worth (buying|investing)/i,
    /best (property|investment)/i,
    // Casual/simple
    /^property$/i,
    /^properties$/i,
    /^invest$/i,
    /^investment$/i,
    /real estate/i,
    /buy a place/i,
    /own something/i,
    /assets/i,
    /portfolio/i,
    /rental/i,
    /income property/i,
  ],

  [INTENT_TYPES.HOW_TO]: [
    /how (do|can|should) i/i,
    /how to/i,
    /what('s| is) the (best )?way to/i,
    /teach me/i,
    /explain how/i,
    /show me/i,
    /guide/i,
    /tutorial/i,
    /walkthrough/i,
    /steps/i,
  ],

  [INTENT_TYPES.WHERE_IS]: [
    /where (is|can i find|do i)/i,
    /how (do i )?(get to|find|access)/i,
    /location of/i,
    /find the/i,
    /looking for/i,
    /navigate/i,
  ],

  [INTENT_TYPES.WHAT_IS]: [
    /what (is|are) /i,
    /what('s| does)/i,
    /explain /i,
    /tell me about (the |a )?(game|system|mechanic)/i,
    /define /i,
    /meaning of/i,
    /describe/i,
  ],

  [INTENT_TYPES.STAT_ANALYSIS]: [
    // Direct questions
    /how (am i|('m i)) doing/i,
    /my (stats|progress|status|situation)/i,
    /analyze (my|me)/i,
    /what('s| is) my (status|situation|state)/i,
    /give me a (rundown|summary|breakdown)/i,
    /assess (me|my)/i,
    // Casual/simple
    /^stats?$/i,
    /^status$/i,
    /^me$/i,
    /^my stats$/i,
    /check me/i,
    /how am i/i,
    /doing good/i,
    /doing bad/i,
    /rundown/i,
    /summary/i,
    /overview/i,
    /report/i,
    /situation/i,
    /where do i stand/i,
  ],

  [INTENT_TYPES.AI_INTEL]: [
    // Direct questions
    /tell me about \w+/i,
    /who is \w+/i,
    /who's \w+/i,
    /whos \w+/i,
    /info (on|about) \w+/i,
    /what (do you )?know about \w+/i,
    /(intel|info|information) (on|about)/i,
    /can i trust \w+/i,
    // Casual/simple
    /^intel$/i,
    /know about/i,
    /heard of/i,
    /who dat/i,
    /that guy/i,
    /that player/i,
    /player info/i,
    /dossier/i,
    /background on/i,
    /scoop on/i,
  ],

  [INTENT_TYPES.MARKET_ANALYSIS]: [
    // Direct questions
    /market (analysis|prices?|info)/i,
    /what (should i )?(trade|buy|sell)/i,
    /trading (advice|tips?)/i,
    /(good|best) (trade|deal)/i,
    /prices? (for|of|on)/i,
    /profit(able)?/i,
    // Casual/simple
    /^market$/i,
    /^trade$/i,
    /^trading$/i,
    /^prices$/i,
    /flip/i,
    /hustle/i,
    /goods/i,
    /contraband/i,
    /merchandise/i,
    /product/i,
    /supply/i,
    /demand/i,
  ],

  [INTENT_TYPES.ACHIEVEMENT]: [
    /achievement/i,
    /what achievements/i,
    /close to (unlocking|getting)/i,
    /unlock/i,
    /badges?/i,
    // Casual/simple
    /^achievements$/i,
    /trophies/i,
    /rewards/i,
    /milestones/i,
    /goals/i,
    /unlocks/i,
    /accomplishments/i,
  ],

  [INTENT_TYPES.PROGRESS]: [
    /progress/i,
    /level up/i,
    /next level/i,
    /xp (needed|required|to)/i,
    /how (much )?(more )?xp/i,
    // Casual/simple
    /^level$/i,
    /^xp$/i,
    /^exp$/i,
    /^lvl$/i,
    /experience/i,
    /leveling/i,
    /grind/i,
    /ranking/i,
    /rank up/i,
  ],

  [INTENT_TYPES.GREETING]: [
    /^(hey|hi|hello|yo|sup|what'?s up|whats up|wassup|wazzup)/i,
    /^good (morning|afternoon|evening|day)/i,
    /^greetings/i,
    /^sarah$/i,
    /^s$/i,
    /^howdy/i,
    /^hola/i,
    /^ayo/i,
    /^ayy/i,
  ],

  [INTENT_TYPES.THANKS]: [
    /thank(s| you)/i,
    /appreciate/i,
    /helpful/i,
    /^ty$/i,
    /^thx$/i,
    /^thanks$/i,
    /^cheers$/i,
    /^cool$/i,
    /^nice$/i,
    /^bet$/i,
    /^word$/i,
    /^dope$/i,
    /good looking/i,
    /good look/i,
    /preciate/i,
  ],

  [INTENT_TYPES.HELP]: [
    /^help$/i,
    /what can you (do|help)/i,
    /your (capabilities|features|functions)/i,
    /how (do i |can i )?use (you|sarah|this)/i,
    /what (do you|can you) (know|do)/i,
    /commands?/i,
    // Casual/simple
    /^options$/i,
    /^menu$/i,
    /what do/i,
    /can you/i,
    /abilities/i,
    /features/i,
    /functions/i,
    /assist/i,
  ],

  [INTENT_TYPES.WHO_ARE_YOU]: [
    /who are you/i,
    /what are you/i,
    /your name/i,
    /introduce yourself/i,
    /tell me about yourself/i,
    /^who$/i,
    /^you$/i,
    /whats your name/i,
    /what's your name/i,
  ],

  // Crew & Equipment
  [INTENT_TYPES.CREW_MANAGEMENT]: [
    /hire|recruit|fire/i,
    /crew member/i,
    /who should i (hire|recruit|get)/i,
    /(best|good) crew/i,
    /need (more )?crew/i,
    /my crew/i,
    // Casual/simple
    /^crew$/i,
    /^team$/i,
    /^squad$/i,
    /^gang$/i,
    /homies/i,
    /boys/i,
    /people/i,
    /members/i,
    /partners/i,
    /associates/i,
  ],

  [INTENT_TYPES.CREW_SYNERGY]: [
    /best (crew|team) for/i,
    /heist team/i,
    /crew (combo|combination|synergy)/i,
    /who (works|goes) (well )?with/i,
    /crew for (heist|bank|vault)/i,
    // Casual/simple
    /dream team/i,
    /lineup/i,
    /roster/i,
    /combo/i,
    /synergy/i,
    /team composition/i,
    /squad goals/i,
  ],

  [INTENT_TYPES.EQUIPMENT_ADVICE]: [
    /what (item|weapon|gear|equipment)/i,
    /should i (buy|get|purchase) (a )?(weapon|item|gear)/i,
    /best (weapon|item|gear)/i,
    /need (a )?(weapon|item|gear)/i,
    /recommend.*(weapon|item|gear)/i,
    // Casual/simple
    /^gear$/i,
    /^weapons?$/i,
    /^items?$/i,
    /^equipment$/i,
    /^tools$/i,
    /what to buy/i,
    /shopping/i,
    /loadout/i,
    /kit/i,
    /strapped/i,
    /heat/i,
    /piece/i,
    /tool/i,
    /burner/i,
  ],

  [INTENT_TYPES.EQUIPMENT_COMPARE]: [
    /(compare|vs|versus|or)/i,
    /which (is )?better/i,
    /pistol.*(knife|switchblade)/i,
    /(knife|switchblade).*pistol/i,
    /difference between/i,
    // Casual/simple
    /better/i,
    /worse/i,
    /stronger/i,
    /weaker/i,
    /upgrade/i,
    /comparison/i,
  ],

  // Location & Strategy
  [INTENT_TYPES.LOCATION_TIPS]: [
    /best (district|area|location|place)/i,
    /crimes? in (downtown|parkdale|scarborough|yorkville|kensington)/i,
    /where should i (go|be|operate)/i,
    /(safest|best|worst) (district|area)/i,
    /what('s| is) in (downtown|parkdale|scarborough|yorkville|kensington)/i,
    // Casual/simple
    /^downtown$/i,
    /^parkdale$/i,
    /^scarborough$/i,
    /^yorkville$/i,
    /^kensington$/i,
    /^district$/i,
    /^area$/i,
    /^location$/i,
    /^hood$/i,
    /^neighborhood$/i,
    /^zone$/i,
    /^spot$/i,
    /where to go/i,
    /best place/i,
    /good spot/i,
  ],

  [INTENT_TYPES.TERRITORY_STRATEGY]: [
    /control|territory|turf/i,
    /take over/i,
    /expand (my )?(territory|turf)/i,
    /defend (my )?(territory|turf)/i,
    /territory (war|battle|fight)/i,
    // Casual/simple
    /^turf$/i,
    /^territory$/i,
    /^control$/i,
    /own the block/i,
    /run this/i,
    /my block/i,
    /claim/i,
    /takeover/i,
    /dominate/i,
    /conquer/i,
  ],

  [INTENT_TYPES.TIME_MANAGEMENT]: [
    /what (should i do )?now/i,
    /priority|priorities/i,
    /what (first|next)/i,
    /best use of (my )?(time|energy)/i,
    /what('s| is) (the )?(priority|most important)/i,
    // Casual/simple
    /^now$/i,
    /^next$/i,
    /^priority$/i,
    /^what now$/i,
    /^what next$/i,
    /do now/i,
    /do next/i,
    /move/i,
    /action/i,
    /plan/i,
    /focus/i,
    /todo/i,
    /to do/i,
    // Catch-all vague queries
    /^what$/i,
    /^what do$/i,
    /^what should$/i,
    /^should i$/i,
    /^advice$/i,
    /^suggest$/i,
    /^recommendation$/i,
    /^recommend$/i,
    /^idea$/i,
    /^ideas$/i,
    /^tips?$/i,
    /^strategy$/i,
    /bored/i,
    /nothing to do/i,
    /idk/i,
    /dunno/i,
    /idek/i,
  ],

  [INTENT_TYPES.EFFICIENCY]: [
    /fastest (way|route|path)/i,
    /optimal|optimize/i,
    /best (way|route) to (level|reach|get)/i,
    /quickest/i,
    /efficient|efficiency/i,
    /speed ?run/i,
    // Casual/simple
    /^fast$/i,
    /^quick$/i,
    /^speed$/i,
    /shortcut/i,
    /fastest/i,
    /quickest/i,
    /speedrun/i,
    /min max/i,
    /minmax/i,
    /power level/i,
  ],

  // Legal & Jail
  [INTENT_TYPES.JAIL_STRATEGY]: [
    /jail(break)?/i,
    /prison/i,
    /escape (jail|prison)/i,
    /reduce (my )?sentence/i,
    /bail/i,
    /get out of jail/i,
    // Casual/simple
    /^jail$/i,
    /^prison$/i,
    /^locked up$/i,
    /^behind bars$/i,
    /^incarcerated$/i,
    /locked up/i,
    /doing time/i,
    /sentence/i,
    /break out/i,
    /escape/i,
    /freedom/i,
    /get out/i,
  ],

  [INTENT_TYPES.LAWYER_ADVICE]: [
    /lawyer/i,
    /attorney/i,
    /legal (help|defense|advice)/i,
    /which lawyer/i,
    /hire.*(lawyer|attorney)/i,
    /need (a )?(lawyer|legal)/i,
    // Casual/simple
    /^lawyer$/i,
    /^attorney$/i,
    /^legal$/i,
    /representation/i,
    /counsel/i,
    /defense/i,
    /court/i,
    /trial/i,
  ],

  [INTENT_TYPES.PAROLE_STRATEGY]: [
    /parole/i,
    /good behavior/i,
    /early release/i,
    /get out early/i,
    /reduce time/i,
    // Casual/simple
    /^parole$/i,
    /behave/i,
    /time off/i,
    /shorter sentence/i,
    /release/i,
  ],

  // AI Players
  [INTENT_TYPES.AI_RELATIONSHIP]: [
    /ally with/i,
    /can i trust/i,
    /is .* (trust|friend|enemy)/i,
    /relationship with/i,
    /befriend/i,
    /make (friends|allies) with/i,
    // Casual/simple
    /^trust$/i,
    /^ally$/i,
    /^friend$/i,
    /^enemy$/i,
    /reliable/i,
    /trustworthy/i,
    /snitch/i,
    /rat/i,
    /solid/i,
    /real one/i,
    /fake/i,
    /snake/i,
  ],

  [INTENT_TYPES.AI_THREAT]: [
    /who('s| is) (a )?threat/i,
    /dangerous (player|ai|npc)/i,
    /watch out for/i,
    /enemy|enemies/i,
    /biggest threat/i,
    /who (should i )?(avoid|fear)/i,
    // Casual/simple
    /^threat$/i,
    /^threats$/i,
    /^danger$/i,
    /^enemies$/i,
    /^rivals$/i,
    /^opps$/i,
    /who dangerous/i,
    /who to avoid/i,
    /beef/i,
    /problem/i,
    /issues/i,
    /hostile/i,
    /watching me/i,
    /after me/i,
  ],

  [INTENT_TYPES.TRADE_ANALYSIS]: [
    /accept (this )?(offer|deal|trade)/i,
    /is (this|that) (a )?scam/i,
    /legit (deal|offer|trade)/i,
    /should i (accept|take|decline)/i,
    /(good|bad) (deal|offer|trade)/i,
    /trust (this|that) (deal|offer)/i,
    // Casual/simple
    /^scam$/i,
    /^offer$/i,
    /^deal$/i,
    /sus/i,
    /suspicious/i,
    /sketchy/i,
    /shady/i,
    /fishy/i,
    /rip ?off/i,
    /ripoff/i,
    /take this/i,
    /accept this/i,
    /decline/i,
    /this legit/i,
    /is it real/i,
  ],

  [INTENT_TYPES.ALLIANCE_STRATEGY]: [
    /who (should|can) i ally/i,
    /best (ally|alliance|partner)/i,
    /who to (partner|team|ally) with/i,
    /alliance (advice|strategy|tip)/i,
    /find (an )?ally/i,
    /need (an )?(ally|partner)/i,
    // Casual/simple
    /^alliance$/i,
    /^allies$/i,
    /^partners$/i,
    /team up/i,
    /join forces/i,
    /work together/i,
    /link up/i,
    /connect/i,
    /collab/i,
    /collaborate/i,
    /who to trust/i,
    /who reliable/i,
  ],
}

// Keyword weights for additional scoring
// Includes casual slang and street terms for flexibility
const KEYWORD_WEIGHTS = {
  // Crime keywords
  crime: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  crimes: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  steal: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  rob: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  heist: { [INTENT_TYPES.CRIME_ADVICE]: 2, [INTENT_TYPES.CREW_SYNERGY]: 1.5 },
  lick: { [INTENT_TYPES.CRIME_ADVICE]: 2.5 },
  hit: { [INTENT_TYPES.CRIME_ADVICE]: 1.5 },
  score: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  jack: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  boost: { [INTENT_TYPES.CRIME_ADVICE]: 2 },

  // Job keywords
  job: { [INTENT_TYPES.JOB_ADVICE]: 2 },
  jobs: { [INTENT_TYPES.JOB_ADVICE]: 2 },
  work: { [INTENT_TYPES.JOB_ADVICE]: 1.5 },
  legit: { [INTENT_TYPES.JOB_ADVICE]: 2 },
  clean: { [INTENT_TYPES.JOB_ADVICE]: 1.5 },
  honest: { [INTENT_TYPES.JOB_ADVICE]: 1.5 },
  safe: { [INTENT_TYPES.JOB_ADVICE]: 1 },

  // Money keywords (expanded with slang)
  money: { [INTENT_TYPES.MONEY_ADVICE]: 2, [INTENT_TYPES.JOB_ADVICE]: 1 },
  cash: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  guap: { [INTENT_TYPES.MONEY_ADVICE]: 3 },
  racks: { [INTENT_TYPES.MONEY_ADVICE]: 3 },
  bands: { [INTENT_TYPES.MONEY_ADVICE]: 3 },
  bread: { [INTENT_TYPES.MONEY_ADVICE]: 2.5 },
  bag: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  bags: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  stacks: { [INTENT_TYPES.MONEY_ADVICE]: 2.5 },
  stack: { [INTENT_TYPES.MONEY_ADVICE]: 2.5 },
  funds: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  rich: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  broke: { [INTENT_TYPES.MONEY_ADVICE]: 2.5 },
  poor: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  paper: { [INTENT_TYPES.MONEY_ADVICE]: 2 },
  cheddar: { [INTENT_TYPES.MONEY_ADVICE]: 2.5 },
  bank: { [INTENT_TYPES.MONEY_ADVICE]: 1.5, [INTENT_TYPES.CRIME_ADVICE]: 1 },

  // Heat keywords (expanded with slang)
  heat: { [INTENT_TYPES.HEAT_ADVICE]: 3 },
  hot: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  cops: { [INTENT_TYPES.HEAT_ADVICE]: 2.5 },
  police: { [INTENT_TYPES.HEAT_ADVICE]: 2.5 },
  feds: { [INTENT_TYPES.HEAT_ADVICE]: 3 },
  pigs: { [INTENT_TYPES.HEAT_ADVICE]: 2.5 },
  '12': { [INTENT_TYPES.HEAT_ADVICE]: 3 },
  twelve: { [INTENT_TYPES.HEAT_ADVICE]: 3 },
  fuzz: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  wanted: { [INTENT_TYPES.HEAT_ADVICE]: 2.5 },
  arrest: { [INTENT_TYPES.HEAT_ADVICE]: 2, [INTENT_TYPES.JAIL_STRATEGY]: 1.5 },
  busted: { [INTENT_TYPES.HEAT_ADVICE]: 2.5 },
  caught: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  watched: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  lay: { [INTENT_TYPES.HEAT_ADVICE]: 1.5 },
  low: { [INTENT_TYPES.HEAT_ADVICE]: 1.5 },
  cool: { [INTENT_TYPES.HEAT_ADVICE]: 1 },

  // Property/Investment keywords
  property: { [INTENT_TYPES.INVESTMENT]: 2.5 },
  properties: { [INTENT_TYPES.INVESTMENT]: 2.5 },
  invest: { [INTENT_TYPES.INVESTMENT]: 2.5 },
  investment: { [INTENT_TYPES.INVESTMENT]: 2.5 },
  passive: { [INTENT_TYPES.INVESTMENT]: 2 },
  rental: { [INTENT_TYPES.INVESTMENT]: 2 },
  estate: { [INTENT_TYPES.INVESTMENT]: 2 },
  asset: { [INTENT_TYPES.INVESTMENT]: 2 },
  assets: { [INTENT_TYPES.INVESTMENT]: 2 },
  portfolio: { [INTENT_TYPES.INVESTMENT]: 2 },

  // Market/Trade keywords
  trade: { [INTENT_TYPES.MARKET_ANALYSIS]: 2, [INTENT_TYPES.TRADE_ANALYSIS]: 1.5 },
  trading: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  market: { [INTENT_TYPES.MARKET_ANALYSIS]: 2.5 },
  prices: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  price: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  buy: { [INTENT_TYPES.MARKET_ANALYSIS]: 1.5, [INTENT_TYPES.EQUIPMENT_ADVICE]: 1 },
  sell: { [INTENT_TYPES.MARKET_ANALYSIS]: 1.5 },
  flip: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  hustle: { [INTENT_TYPES.MARKET_ANALYSIS]: 2, [INTENT_TYPES.MONEY_ADVICE]: 1 },
  product: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  supply: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  demand: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  contraband: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },

  // Progress keywords
  achievement: { [INTENT_TYPES.ACHIEVEMENT]: 3 },
  achievements: { [INTENT_TYPES.ACHIEVEMENT]: 3 },
  badge: { [INTENT_TYPES.ACHIEVEMENT]: 2 },
  badges: { [INTENT_TYPES.ACHIEVEMENT]: 2 },
  trophy: { [INTENT_TYPES.ACHIEVEMENT]: 2 },
  unlock: { [INTENT_TYPES.ACHIEVEMENT]: 2 },
  progress: { [INTENT_TYPES.PROGRESS]: 2.5 },
  level: { [INTENT_TYPES.PROGRESS]: 2 },
  lvl: { [INTENT_TYPES.PROGRESS]: 2 },
  xp: { [INTENT_TYPES.PROGRESS]: 2.5 },
  exp: { [INTENT_TYPES.PROGRESS]: 2 },
  experience: { [INTENT_TYPES.PROGRESS]: 2 },
  grind: { [INTENT_TYPES.PROGRESS]: 2, [INTENT_TYPES.EFFICIENCY]: 1.5 },
  rank: { [INTENT_TYPES.PROGRESS]: 2 },

  // Stats keywords
  stats: { [INTENT_TYPES.STAT_ANALYSIS]: 3 },
  stat: { [INTENT_TYPES.STAT_ANALYSIS]: 3 },
  status: { [INTENT_TYPES.STAT_ANALYSIS]: 2.5 },
  me: { [INTENT_TYPES.STAT_ANALYSIS]: 2 },
  my: { [INTENT_TYPES.STAT_ANALYSIS]: 1 },
  situation: { [INTENT_TYPES.STAT_ANALYSIS]: 2 },
  report: { [INTENT_TYPES.STAT_ANALYSIS]: 2 },
  overview: { [INTENT_TYPES.STAT_ANALYSIS]: 2 },
  rundown: { [INTENT_TYPES.STAT_ANALYSIS]: 2 },
  summary: { [INTENT_TYPES.STAT_ANALYSIS]: 2 },

  // Crew & Equipment keywords
  crew: { [INTENT_TYPES.CREW_MANAGEMENT]: 2.5, [INTENT_TYPES.CREW_SYNERGY]: 2 },
  squad: { [INTENT_TYPES.CREW_MANAGEMENT]: 2.5, [INTENT_TYPES.CREW_SYNERGY]: 2 },
  gang: { [INTENT_TYPES.CREW_MANAGEMENT]: 2, [INTENT_TYPES.CREW_SYNERGY]: 1.5 },
  homies: { [INTENT_TYPES.CREW_MANAGEMENT]: 2.5 },
  boys: { [INTENT_TYPES.CREW_MANAGEMENT]: 2 },
  team: { [INTENT_TYPES.CREW_SYNERGY]: 2.5 },
  lineup: { [INTENT_TYPES.CREW_SYNERGY]: 2 },
  roster: { [INTENT_TYPES.CREW_SYNERGY]: 2 },
  hire: { [INTENT_TYPES.CREW_MANAGEMENT]: 3 },
  recruit: { [INTENT_TYPES.CREW_MANAGEMENT]: 3 },
  fire: { [INTENT_TYPES.CREW_MANAGEMENT]: 2.5 },
  weapon: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5, [INTENT_TYPES.EQUIPMENT_COMPARE]: 1.5 },
  weapons: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5 },
  gear: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5 },
  item: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2 },
  items: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2 },
  equipment: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5 },
  loadout: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5 },
  kit: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2 },
  strapped: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5 },
  piece: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2 },
  tool: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 1.5 },
  tools: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 1.5 },
  burner: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2.5 },
  pistol: { [INTENT_TYPES.EQUIPMENT_COMPARE]: 2.5 },
  knife: { [INTENT_TYPES.EQUIPMENT_COMPARE]: 2 },
  gun: { [INTENT_TYPES.EQUIPMENT_ADVICE]: 2 },

  // Location keywords
  district: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  area: { [INTENT_TYPES.LOCATION_TIPS]: 2 },
  location: { [INTENT_TYPES.LOCATION_TIPS]: 2 },
  hood: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  neighborhood: { [INTENT_TYPES.LOCATION_TIPS]: 2 },
  zone: { [INTENT_TYPES.LOCATION_TIPS]: 2 },
  spot: { [INTENT_TYPES.LOCATION_TIPS]: 2 },
  downtown: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  parkdale: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  yorkville: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  scarborough: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  kensington: { [INTENT_TYPES.LOCATION_TIPS]: 2.5 },
  territory: { [INTENT_TYPES.TERRITORY_STRATEGY]: 3 },
  turf: { [INTENT_TYPES.TERRITORY_STRATEGY]: 3 },
  control: { [INTENT_TYPES.TERRITORY_STRATEGY]: 2.5 },
  block: { [INTENT_TYPES.TERRITORY_STRATEGY]: 2 },
  takeover: { [INTENT_TYPES.TERRITORY_STRATEGY]: 2.5 },
  claim: { [INTENT_TYPES.TERRITORY_STRATEGY]: 2 },

  // Strategy/Time keywords
  priority: { [INTENT_TYPES.TIME_MANAGEMENT]: 3 },
  priorities: { [INTENT_TYPES.TIME_MANAGEMENT]: 3 },
  now: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  next: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  first: { [INTENT_TYPES.TIME_MANAGEMENT]: 1.5 },
  plan: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  focus: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  move: { [INTENT_TYPES.TIME_MANAGEMENT]: 1.5 },
  action: { [INTENT_TYPES.TIME_MANAGEMENT]: 1.5 },
  fastest: { [INTENT_TYPES.EFFICIENCY]: 3 },
  quickest: { [INTENT_TYPES.EFFICIENCY]: 3 },
  optimal: { [INTENT_TYPES.EFFICIENCY]: 2.5 },
  efficient: { [INTENT_TYPES.EFFICIENCY]: 2.5 },
  speed: { [INTENT_TYPES.EFFICIENCY]: 2 },
  speedrun: { [INTENT_TYPES.EFFICIENCY]: 3 },
  minmax: { [INTENT_TYPES.EFFICIENCY]: 3 },
  shortcut: { [INTENT_TYPES.EFFICIENCY]: 2 },

  // Legal keywords
  jail: { [INTENT_TYPES.JAIL_STRATEGY]: 3 },
  prison: { [INTENT_TYPES.JAIL_STRATEGY]: 3 },
  bail: { [INTENT_TYPES.JAIL_STRATEGY]: 3 },
  jailbreak: { [INTENT_TYPES.JAIL_STRATEGY]: 3 },
  escape: { [INTENT_TYPES.JAIL_STRATEGY]: 2.5 },
  locked: { [INTENT_TYPES.JAIL_STRATEGY]: 2 },
  sentence: { [INTENT_TYPES.JAIL_STRATEGY]: 2.5, [INTENT_TYPES.PAROLE_STRATEGY]: 2 },
  time: { [INTENT_TYPES.JAIL_STRATEGY]: 1 },
  lawyer: { [INTENT_TYPES.LAWYER_ADVICE]: 3 },
  attorney: { [INTENT_TYPES.LAWYER_ADVICE]: 3 },
  legal: { [INTENT_TYPES.LAWYER_ADVICE]: 2.5 },
  defense: { [INTENT_TYPES.LAWYER_ADVICE]: 2 },
  court: { [INTENT_TYPES.LAWYER_ADVICE]: 2 },
  trial: { [INTENT_TYPES.LAWYER_ADVICE]: 2 },
  parole: { [INTENT_TYPES.PAROLE_STRATEGY]: 3 },
  release: { [INTENT_TYPES.PAROLE_STRATEGY]: 2 },
  behavior: { [INTENT_TYPES.PAROLE_STRATEGY]: 2 },

  // AI player keywords (expanded with slang)
  ally: { [INTENT_TYPES.AI_RELATIONSHIP]: 2.5, [INTENT_TYPES.ALLIANCE_STRATEGY]: 2.5 },
  allies: { [INTENT_TYPES.ALLIANCE_STRATEGY]: 2.5 },
  alliance: { [INTENT_TYPES.ALLIANCE_STRATEGY]: 3 },
  trust: { [INTENT_TYPES.AI_RELATIONSHIP]: 2.5, [INTENT_TYPES.TRADE_ANALYSIS]: 1.5 },
  trustworthy: { [INTENT_TYPES.AI_RELATIONSHIP]: 2.5 },
  reliable: { [INTENT_TYPES.AI_RELATIONSHIP]: 2.5 },
  solid: { [INTENT_TYPES.AI_RELATIONSHIP]: 2.5 },
  real: { [INTENT_TYPES.AI_RELATIONSHIP]: 2 },
  fake: { [INTENT_TYPES.AI_RELATIONSHIP]: 2.5 },
  snake: { [INTENT_TYPES.AI_RELATIONSHIP]: 3, [INTENT_TYPES.AI_THREAT]: 2 },
  rat: { [INTENT_TYPES.AI_RELATIONSHIP]: 3, [INTENT_TYPES.AI_THREAT]: 2 },
  snitch: { [INTENT_TYPES.AI_RELATIONSHIP]: 3, [INTENT_TYPES.AI_THREAT]: 2 },
  friend: { [INTENT_TYPES.AI_RELATIONSHIP]: 2 },
  enemy: { [INTENT_TYPES.AI_THREAT]: 3, [INTENT_TYPES.AI_RELATIONSHIP]: 1.5 },
  enemies: { [INTENT_TYPES.AI_THREAT]: 3 },
  threat: { [INTENT_TYPES.AI_THREAT]: 3 },
  threats: { [INTENT_TYPES.AI_THREAT]: 3 },
  danger: { [INTENT_TYPES.AI_THREAT]: 2.5 },
  dangerous: { [INTENT_TYPES.AI_THREAT]: 2.5 },
  hostile: { [INTENT_TYPES.AI_THREAT]: 2.5 },
  opps: { [INTENT_TYPES.AI_THREAT]: 3 },
  opp: { [INTENT_TYPES.AI_THREAT]: 3 },
  rival: { [INTENT_TYPES.AI_THREAT]: 2.5 },
  rivals: { [INTENT_TYPES.AI_THREAT]: 2.5 },
  beef: { [INTENT_TYPES.AI_THREAT]: 2.5 },
  problem: { [INTENT_TYPES.AI_THREAT]: 2 },
  scam: { [INTENT_TYPES.TRADE_ANALYSIS]: 3 },
  sus: { [INTENT_TYPES.TRADE_ANALYSIS]: 3 },
  suspicious: { [INTENT_TYPES.TRADE_ANALYSIS]: 2.5 },
  sketchy: { [INTENT_TYPES.TRADE_ANALYSIS]: 3 },
  shady: { [INTENT_TYPES.TRADE_ANALYSIS]: 3 },
  fishy: { [INTENT_TYPES.TRADE_ANALYSIS]: 2.5 },
  ripoff: { [INTENT_TYPES.TRADE_ANALYSIS]: 3 },
  offer: { [INTENT_TYPES.TRADE_ANALYSIS]: 2 },
  deal: { [INTENT_TYPES.TRADE_ANALYSIS]: 2, [INTENT_TYPES.MARKET_ANALYSIS]: 1 },
  accept: { [INTENT_TYPES.TRADE_ANALYSIS]: 2 },
  decline: { [INTENT_TYPES.TRADE_ANALYSIS]: 2 },
  partner: { [INTENT_TYPES.ALLIANCE_STRATEGY]: 2.5 },
  partners: { [INTENT_TYPES.ALLIANCE_STRATEGY]: 2.5 },
  collab: { [INTENT_TYPES.ALLIANCE_STRATEGY]: 2 },
  link: { [INTENT_TYPES.ALLIANCE_STRATEGY]: 2 },

  // Intel keywords
  intel: { [INTENT_TYPES.AI_INTEL]: 3 },
  info: { [INTENT_TYPES.AI_INTEL]: 2 },
  dossier: { [INTENT_TYPES.AI_INTEL]: 3 },
  background: { [INTENT_TYPES.AI_INTEL]: 2 },
  scoop: { [INTENT_TYPES.AI_INTEL]: 2.5 },
  who: { [INTENT_TYPES.AI_INTEL]: 1.5, [INTENT_TYPES.WHO_ARE_YOU]: 1 },
  player: { [INTENT_TYPES.AI_INTEL]: 1.5 },

  // Catch-all/vague query keywords
  what: { [INTENT_TYPES.TIME_MANAGEMENT]: 1 },
  should: { [INTENT_TYPES.TIME_MANAGEMENT]: 1.5 },
  advice: { [INTENT_TYPES.TIME_MANAGEMENT]: 2.5 },
  suggest: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  recommendation: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  recommend: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  idea: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  ideas: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  tip: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  tips: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  strategy: { [INTENT_TYPES.TIME_MANAGEMENT]: 2, [INTENT_TYPES.EFFICIENCY]: 1.5 },
  bored: { [INTENT_TYPES.TIME_MANAGEMENT]: 2.5 },
  idk: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },
  dunno: { [INTENT_TYPES.TIME_MANAGEMENT]: 2 },

  // Greeting keywords (for flexibility)
  hey: { [INTENT_TYPES.GREETING]: 3 },
  hi: { [INTENT_TYPES.GREETING]: 3 },
  hello: { [INTENT_TYPES.GREETING]: 3 },
  yo: { [INTENT_TYPES.GREETING]: 3 },
  sup: { [INTENT_TYPES.GREETING]: 3 },
  wassup: { [INTENT_TYPES.GREETING]: 3 },
  ayo: { [INTENT_TYPES.GREETING]: 3 },
  sarah: { [INTENT_TYPES.GREETING]: 2 },

  // Help keywords
  help: { [INTENT_TYPES.HELP]: 3 },
  commands: { [INTENT_TYPES.HELP]: 2.5 },
  options: { [INTENT_TYPES.HELP]: 2 },
  menu: { [INTENT_TYPES.HELP]: 2 },
  abilities: { [INTENT_TYPES.HELP]: 2 },
  features: { [INTENT_TYPES.HELP]: 2 },
  can: { [INTENT_TYPES.HELP]: 1 },
}

class IntentClassifier {
  /**
   * Classify a query into an intent category
   * @param {string} query - User query
   * @returns {object} { intent, confidence, entities }
   */
  classifyIntent(query) {
    const normalizedQuery = query.toLowerCase().trim()

    // Score each intent
    const scores = {}
    for (const intent of Object.values(INTENT_TYPES)) {
      scores[intent] = 0
    }

    // Pattern matching
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          scores[intent] += 3 // Pattern match is strong signal
        }
      }
    }

    // Keyword scoring
    const words = normalizedQuery.split(/\s+/)
    for (const word of words) {
      const weights = KEYWORD_WEIGHTS[word]
      if (weights) {
        for (const [intent, weight] of Object.entries(weights)) {
          scores[intent] += weight
        }
      }
    }

    // Find best match
    let bestIntent = INTENT_TYPES.UNKNOWN
    let bestScore = 0

    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score
        bestIntent = intent
      }
    }

    // Calculate confidence (0-1)
    // Lowered threshold from 6 to 3 for more responsive recognition
    const confidence = Math.min(1, bestScore / 3)

    // Extract entities
    const entities = this.extractEntities(normalizedQuery)

    return {
      intent: bestIntent,
      confidence,
      scores, // For debugging
      entities,
    }
  }

  /**
   * Extract entities from query (names, numbers, etc.)
   * @param {string} query - Normalized query
   * @returns {object} Extracted entities
   */
  extractEntities(query) {
    const entities = {}

    // Extract player names (capitalized words that might be AI names)
    const namePatterns = [
      /(?:about|tell me about|who is|info on|trust)\s+(\w+)/i,
      /(\w+)(?:'s| is| has)/i,
    ]

    for (const pattern of namePatterns) {
      const match = query.match(pattern)
      if (match && match[1]) {
        const potentialName = match[1]
        // Filter out common words
        const commonWords = ['the', 'a', 'an', 'my', 'your', 'this', 'that', 'what', 'how', 'who', 'is', 'are']
        if (!commonWords.includes(potentialName.toLowerCase())) {
          entities.playerName = potentialName
          break
        }
      }
    }

    // Extract numbers
    const numbers = query.match(/\d+/g)
    if (numbers) {
      entities.numbers = numbers.map(n => parseInt(n, 10))
    }

    // Extract crime types mentioned
    const crimeTypes = ['pickpocket', 'shoplifting', 'mugging', 'car theft', 'burglary', 'robbery', 'heist']
    for (const crime of crimeTypes) {
      if (query.includes(crime)) {
        entities.crimeType = crime
        break
      }
    }

    // Extract job types mentioned
    const jobTypes = ['dishwasher', 'delivery', 'security', 'bartender', 'mechanic']
    for (const job of jobTypes) {
      if (query.includes(job)) {
        entities.jobType = job
        break
      }
    }

    // Extract location/district mentions
    const districts = ['downtown', 'parkdale', 'scarborough', 'yorkville', 'kensington']
    for (const district of districts) {
      if (query.includes(district)) {
        entities.district = district
        break
      }
    }

    return entities
  }

  /**
   * Check if query matches a specific intent
   * @param {string} query - User query
   * @param {string} intent - Intent to check
   * @returns {boolean} True if query matches intent
   */
  matchesIntent(query, intent) {
    const patterns = INTENT_PATTERNS[intent]
    if (!patterns) return false

    const normalizedQuery = query.toLowerCase().trim()
    return patterns.some(pattern => pattern.test(normalizedQuery))
  }

  /**
   * Get all possible intents (for help display)
   */
  getAllIntents() {
    return Object.values(INTENT_TYPES).filter(i => i !== INTENT_TYPES.UNKNOWN)
  }

  /**
   * Get top matching intents for a query (even if below threshold)
   * Used for suggesting alternatives when query isn't clear
   * @param {string} query - User query
   * @param {number} count - Number of suggestions to return
   * @returns {array} Array of { intent, score, description }
   */
  getTopMatches(query, count = 3) {
    const normalizedQuery = query.toLowerCase().trim()
    const scores = {}

    // Score each intent
    for (const intent of Object.values(INTENT_TYPES)) {
      scores[intent] = 0
    }

    // Pattern matching
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          scores[intent] += 3
        }
      }
    }

    // Keyword scoring
    const words = normalizedQuery.split(/\s+/)
    for (const word of words) {
      const weights = KEYWORD_WEIGHTS[word]
      if (weights) {
        for (const [intent, weight] of Object.entries(weights)) {
          scores[intent] += weight
        }
      }
    }

    // Sort by score and filter out UNKNOWN, GREETING, THANKS
    const sorted = Object.entries(scores)
      .filter(([intent]) => ![INTENT_TYPES.UNKNOWN, INTENT_TYPES.GREETING, INTENT_TYPES.THANKS, INTENT_TYPES.WHO_ARE_YOU].includes(intent))
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([intent, score]) => ({
        intent,
        score,
        description: this.getIntentDescription(intent),
        friendlyName: this.getFriendlyIntentName(intent)
      }))

    return sorted
  }

  /**
   * Get a user-friendly name for an intent
   */
  getFriendlyIntentName(intent) {
    const friendlyNames = {
      [INTENT_TYPES.CRIME_ADVICE]: 'crime tips',
      [INTENT_TYPES.JOB_ADVICE]: 'job recommendations',
      [INTENT_TYPES.MONEY_ADVICE]: 'money-making tips',
      [INTENT_TYPES.HEAT_ADVICE]: 'avoiding cops/heat',
      [INTENT_TYPES.INVESTMENT]: 'property investment',
      [INTENT_TYPES.HOW_TO]: 'how-to guides',
      [INTENT_TYPES.WHERE_IS]: 'finding locations',
      [INTENT_TYPES.WHAT_IS]: 'game mechanics',
      [INTENT_TYPES.STAT_ANALYSIS]: 'your stats/status',
      [INTENT_TYPES.AI_INTEL]: 'player intel',
      [INTENT_TYPES.MARKET_ANALYSIS]: 'trading/market',
      [INTENT_TYPES.ACHIEVEMENT]: 'achievements',
      [INTENT_TYPES.PROGRESS]: 'level progress',
      [INTENT_TYPES.CREW_MANAGEMENT]: 'crew hiring',
      [INTENT_TYPES.CREW_SYNERGY]: 'crew combos',
      [INTENT_TYPES.EQUIPMENT_ADVICE]: 'gear/weapons',
      [INTENT_TYPES.EQUIPMENT_COMPARE]: 'comparing items',
      [INTENT_TYPES.LOCATION_TIPS]: 'district info',
      [INTENT_TYPES.TERRITORY_STRATEGY]: 'territory control',
      [INTENT_TYPES.TIME_MANAGEMENT]: 'what to do next',
      [INTENT_TYPES.EFFICIENCY]: 'fastest routes',
      [INTENT_TYPES.JAIL_STRATEGY]: 'jail/escape',
      [INTENT_TYPES.LAWYER_ADVICE]: 'legal defense',
      [INTENT_TYPES.PAROLE_STRATEGY]: 'parole/early release',
      [INTENT_TYPES.AI_RELATIONSHIP]: 'player trust',
      [INTENT_TYPES.AI_THREAT]: 'threats/enemies',
      [INTENT_TYPES.TRADE_ANALYSIS]: 'scam detection',
      [INTENT_TYPES.ALLIANCE_STRATEGY]: 'alliances',
      [INTENT_TYPES.HELP]: 'what I can do',
    }
    return friendlyNames[intent] || intent.replace(/_/g, ' ')
  }

  /**
   * Check if a word is recognized as a keyword
   */
  isRecognizedWord(word) {
    const lowerWord = word.toLowerCase()
    return Object.keys(KEYWORD_WEIGHTS).some(kw =>
      lowerWord.includes(kw) || kw.includes(lowerWord)
    )
  }

  /**
   * Get all recognized words from a query
   */
  getRecognizedWords(query) {
    const words = query.toLowerCase().split(/\s+/)
    return words.filter(word => this.isRecognizedWord(word))
  }

  /**
   * Generate a smart clarifying question based on partial matches
   */
  getClarifyingQuestion(query, topMatches) {
    if (topMatches.length === 0) {
      return null
    }

    if (topMatches.length === 1) {
      return `Did you mean you want help with ${topMatches[0].friendlyName}?`
    }

    if (topMatches.length === 2) {
      return `Are you asking about ${topMatches[0].friendlyName} or ${topMatches[1].friendlyName}?`
    }

    const options = topMatches.slice(0, 3).map(m => m.friendlyName).join(', ')
    return `I think you might be asking about: ${options}. Which one?`
  }

  /**
   * Get intent description for help
   */
  getIntentDescription(intent) {
    const descriptions = {
      [INTENT_TYPES.CRIME_ADVICE]: 'Get crime recommendations',
      [INTENT_TYPES.JOB_ADVICE]: 'Get job recommendations',
      [INTENT_TYPES.MONEY_ADVICE]: 'Tips for making money',
      [INTENT_TYPES.HEAT_ADVICE]: 'How to reduce heat/avoid cops',
      [INTENT_TYPES.INVESTMENT]: 'Property investment advice',
      [INTENT_TYPES.HOW_TO]: 'Learn how to do things',
      [INTENT_TYPES.WHERE_IS]: 'Find locations and features',
      [INTENT_TYPES.WHAT_IS]: 'Explain game mechanics',
      [INTENT_TYPES.STAT_ANALYSIS]: 'Analyze your current stats',
      [INTENT_TYPES.AI_INTEL]: 'Info about other players',
      [INTENT_TYPES.MARKET_ANALYSIS]: 'Trading market analysis',
      [INTENT_TYPES.ACHIEVEMENT]: 'Achievement tracking',
      [INTENT_TYPES.PROGRESS]: 'Level progress info',
      [INTENT_TYPES.GREETING]: 'Say hello',
      [INTENT_TYPES.THANKS]: 'Thank S.A.R.A.H.',
      [INTENT_TYPES.HELP]: 'See what I can do',
      [INTENT_TYPES.WHO_ARE_YOU]: 'Learn about S.A.R.A.H.',

      // New intent descriptions
      [INTENT_TYPES.CREW_MANAGEMENT]: 'Crew hiring and management advice',
      [INTENT_TYPES.CREW_SYNERGY]: 'Best crew combinations for jobs',
      [INTENT_TYPES.EQUIPMENT_ADVICE]: 'Weapon and gear recommendations',
      [INTENT_TYPES.EQUIPMENT_COMPARE]: 'Compare weapons and items',
      [INTENT_TYPES.LOCATION_TIPS]: 'District-specific tips and info',
      [INTENT_TYPES.TERRITORY_STRATEGY]: 'Territory control strategies',
      [INTENT_TYPES.TIME_MANAGEMENT]: 'Priority and next action advice',
      [INTENT_TYPES.EFFICIENCY]: 'Optimal progression paths',
      [INTENT_TYPES.JAIL_STRATEGY]: 'Jail escape and bail advice',
      [INTENT_TYPES.LAWYER_ADVICE]: 'Legal defense recommendations',
      [INTENT_TYPES.PAROLE_STRATEGY]: 'Early release strategies',
      [INTENT_TYPES.AI_RELATIONSHIP]: 'AI player relationship advice',
      [INTENT_TYPES.AI_THREAT]: 'Threat detection and warnings',
      [INTENT_TYPES.TRADE_ANALYSIS]: 'Trade offer scam detection',
      [INTENT_TYPES.ALLIANCE_STRATEGY]: 'Alliance recommendations',
    }

    return descriptions[intent] || 'Unknown'
  }
}

// Singleton instance
export const intentClassifier = new IntentClassifier()

export default intentClassifier
