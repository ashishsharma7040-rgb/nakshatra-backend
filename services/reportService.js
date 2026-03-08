// services/reportService.js
// Generates Vedic Astrology PDF reports using jsPDF (pure JS, no native deps)
// Basic: 8-9 pages | Detailed: 25-30 pages
// Uses classical text interpretations from BPHS, Phaladeepika, Jataka Parijata etc.

// ── Classical Interpretation Engine ──────────────────────────────────────────

const PLANET_NATURE = {
  sun:     { name:'Sun (Surya)', nature:'Masculine, Fiery, Royal', element:'Fire', gem:'Ruby', mantra:'Om Suryaya Namah', charity:'Wheat/Jaggery on Sunday', color:'Red/Orange', day:'Sunday' },
  moon:    { name:'Moon (Chandra)', nature:'Feminine, Watery, Nurturing', element:'Water', gem:'Pearl or Moonstone', mantra:'Om Chandraya Namah', charity:'Rice/Milk on Monday', color:'White/Silver', day:'Monday' },
  mars:    { name:'Mars (Mangal)', nature:'Masculine, Fiery, Warrior', element:'Fire', gem:'Red Coral', mantra:'Om Angarakaya Namah', charity:'Red Lentils on Tuesday', color:'Red', day:'Tuesday' },
  mercury: { name:'Mercury (Budh)', nature:'Neutral, Earthy, Intellectual', element:'Earth', gem:'Emerald', mantra:'Om Budhaya Namah', charity:'Green Mung on Wednesday', color:'Green', day:'Wednesday' },
  jupiter: { name:'Jupiter (Guru)', nature:'Masculine, Fiery, Wise', element:'Ether', gem:'Yellow Sapphire', mantra:'Om Gurave Namah', charity:'Yellow Cloth on Thursday', color:'Yellow/Gold', day:'Thursday' },
  venus:   { name:'Venus (Shukra)', nature:'Feminine, Watery, Artistic', element:'Water', gem:'Diamond or White Sapphire', mantra:'Om Shukraya Namah', charity:'White sweets on Friday', color:'White/Pink', day:'Friday' },
  saturn:  { name:'Saturn (Shani)', nature:'Neutral, Airy, Karmic', element:'Air', gem:'Blue Sapphire (careful)', mantra:'Om Shanaye Namah', charity:'Black sesame on Saturday', color:'Black/Dark Blue', day:'Saturday' },
  rahu:    { name:'Rahu (North Node)', nature:'Shadowy, Illusory, Obsessive', element:'Air', gem:'Hessonite (Gomed)', mantra:'Om Rahave Namah', charity:'Donate black/dark items', color:'Dark/Multicolor', day:'Saturday' },
  ketu:    { name:'Ketu (South Node)', nature:'Spiritual, Detaching, Moksha', element:'Fire', gem:"Cat's Eye (Lehsunia)", mantra:'Om Ketave Namah', charity:'Brown/spotted items', color:'Smoky/Brown', day:'Tuesday' },
};

const SIGN_INFO = {
  'Aries':       { lord:'Mars',    nature:'Movable/Cardinal, Fiery, Masculine', symbol:'Ram',      body:'Head, Face' },
  'Taurus':      { lord:'Venus',   nature:'Fixed, Earthy, Feminine',             symbol:'Bull',     body:'Neck, Throat' },
  'Gemini':      { lord:'Mercury', nature:'Dual/Mutable, Airy, Masculine',       symbol:'Twins',    body:'Arms, Lungs' },
  'Cancer':      { lord:'Moon',    nature:'Movable, Watery, Feminine',           symbol:'Crab',     body:'Chest, Stomach' },
  'Leo':         { lord:'Sun',     nature:'Fixed, Fiery, Masculine',             symbol:'Lion',     body:'Heart, Spine' },
  'Virgo':       { lord:'Mercury', nature:'Dual, Earthy, Feminine',              symbol:'Maiden',   body:'Intestines' },
  'Libra':       { lord:'Venus',   nature:'Movable, Airy, Masculine',            symbol:'Scales',   body:'Kidneys, Lower Back' },
  'Scorpio':     { lord:'Mars',    nature:'Fixed, Watery, Feminine',             symbol:'Scorpion', body:'Genitals, Excretory' },
  'Sagittarius': { lord:'Jupiter', nature:'Dual, Fiery, Masculine',              symbol:'Archer',   body:'Thighs, Hips' },
  'Capricorn':   { lord:'Saturn',  nature:'Movable, Earthy, Feminine',           symbol:'Goat',     body:'Knees, Bones' },
  'Aquarius':    { lord:'Saturn',  nature:'Fixed, Airy, Masculine',              symbol:'Waterpot', body:'Ankles, Calves' },
  'Pisces':      { lord:'Jupiter', nature:'Dual, Watery, Feminine',              symbol:'Fish',     body:'Feet' },
};

// BPHS Chapter: Planets in Houses — interpretations
const PLANET_IN_HOUSE = {
  sun: [
    'The Sun in the 1st house bestows a regal, authoritative personality. You radiate confidence and natural leadership. Health is generally robust. You may be headstrong but courageous. BPHS states: the native is bilious, of high spirit, and renowned.',
    'Sun in the 2nd house creates focus on wealth through one\'s own efforts. Speech is authoritative. Some family tensions are possible. Wealth comes through government or authority. Eye health requires attention.',
    'Sun in the 3rd house gives tremendous courage and willpower. Siblings may be prominent. Short travels are frequent and beneficial. Excellent for communication, writing, and creative pursuits.',
    'Sun in the 4th house can create distance from the mother or homeland. Property matters need care. Government connections support home affairs. Emotional security comes through achieving status.',
    'The Sun in the 5th house is highly auspicious — the Sun loves the dharmic 5th. Intelligence, creativity, and children are highlighted. Speculation and leadership in creative fields. Past life merit supports you.',
    'Sun in the 6th house gives tremendous ability to overcome enemies and obstacles. Health professions suit you. You defeat rivals through sheer force of will. Service to authority is key.',
    'The Sun in the 7th house can delay or challenge marriage — the proud Sun seeks an equal partner. Business partnerships with authority figures. Foreign dealings. Marriage after sufficient maturity brings stability.',
    'Sun in the 8th house is challenging — longevity of parents requires attention. You may face sudden changes. However, deep interest in occult and hidden knowledge grows. Transformation comes through challenges.',
    'The Sun in the 9th house is extremely fortunate. Fortune, father, dharma, and higher education are all blessed. You have natural wisdom and philosophical inclination. Long journeys bring expansion.',
    'Sun in the 10th house is its most powerful placement — the Sun\'s own house is the 10th of career. Outstanding career in government, authority, politics, or public life. Name and fame are assured.',
    'Sun in the 11th house brings gains through networks, elder siblings, and authority figures. Income from government sources. Social status elevates progressively. Desires are fulfilled in the second half of life.',
    'Sun in the 12th house creates a private, introspective personality. Government service in foreign lands. Spiritual inclinations grow over time. Expenses should be watched. Hidden connections to powerful people.',
  ],
  moon: [
    'Moon in the 1st house creates an emotionally sensitive, intuitive, and nurturing personality. The mind is quick and impressionable. You are deeply connected to the public. Health fluctuates with emotions. Waxing Moon strengthens this.',
    'Moon in the 2nd house blesses with wealth accumulation through nurturing activities. Sweet speech. Good family life. Wealth through mother, women, or public. Face and eyes are attractive.',
    'Moon in the 3rd house gives an active, restless mind. Frequent short travels. Siblings (especially sisters) are important. Writing, communication, and social media may be profitable.',
    'Moon in the 4th house is a powerful placement — Moon in its joy! Happiness, mother, and home comforts are abundant. Strong emotional intelligence. Property and vehicles are indicated. Deep roots.',
    'Moon in the 5th house blesses with children and creative intelligence. You are romantic and emotionally invested in love. Speculation may bring gains. Fine arts and entertainment suit you.',
    'Moon in the 6th house requires care — enemies may affect peace of mind. Health of the mother needs attention. Service professions involving nurturing (healthcare, counseling) are suitable.',
    'Moon in the 7th house gives a charming, attractive spouse. Business partnerships with women. Public dealing is favored. Emotions strongly tied to relationships. Marriage brings fulfillment.',
    'Moon in the 8th house creates psychic sensitivity and deep emotional nature. Inheritance is possible. Hidden fears need addressing. Interest in the occult and mystical grows. Mother\'s health needs care.',
    'Moon in the 9th house gives a philosophical, fortune-blessed nature. Dharmic inclinations are strong. Mother is wise and religious. Long journeys, especially pilgrimages, are beneficial.',
    'Moon in the 10th house brings public fame and emotional satisfaction through career. Business connected to public, masses, women, or nurturing professions. Reputation rises steadily.',
    'Moon in the 11th house blesses with gains through social connections and women. Desires are fulfilled. Large social circle. Elder siblings (especially female) are supportive.',
    'Moon in the 12th house creates a need for solitude and spiritual retreat. Foreign lands may bring peace. Hospitals, ashrams, or NGOs are suitable work environments. Charitable impulses are strong.',
  ],
  mars: [
    'Mars in the 1st house creates a physically powerful, courageous, and ambitious personality. You are a natural warrior. Mangal Dosha consideration for marriage. Athletic ability. Tendency toward impatience.',
    'Mars in the 2nd house can affect family harmony and speech (sharp tongue). Wealth comes through courage and initiative. Land and property dealings are profitable. Financial ambition is strong.',
    'Mars in the 3rd house is excellent — Mars is naturally strong here. Tremendous courage, initiative, and willpower. Siblings may be in the military or sports. Short travels are action-oriented.',
    'Mars in the 4th house creates Mangal Dosha. Property matters involve disputes. Mother\'s health needs care. Land and construction are profitable. Home environment may be dynamic or tense.',
    'Mars in the 5th house blesses with courage, competitive intelligence, and athletic children. Speculation can be profitable. Creative energy is enormous. Some impulsiveness in romance.',
    'Mars in the 6th house is excellent for defeating enemies and overcoming health challenges. You are a formidable opponent in litigation. Military, police, surgery, and sports suit you perfectly.',
    'Mars in the 7th house (Mangal Dosha) may delay marriage or bring a dynamic, assertive partner. Business partnerships require clear boundaries. Legal matters need patience.',
    'Mars in the 8th house gives longevity through sheer willpower. Interest in occult and surgery. Inheritance is possible. Sudden events transform life. Accidents require care.',
    'Mars in the 9th house creates a zealous, action-oriented approach to dharma. Father may be a dynamic personality. Long journeys are adventurous. Philosophy meets action.',
    'Mars in the 10th house is powerful — career in military, police, surgery, sports, engineering, or real estate flourishes. Authority through action. Public life is energetic and competitive.',
    'Mars in the 11th house brings significant financial gains through courage and initiative. Elder siblings (especially brothers) are competitive. Fulfillment of desires through determined effort.',
    'Mars in the 12th house creates expenditure on property or action in foreign lands. Military service abroad. Spiritual practices require discipline. Bed pleasures are indicated.',
  ],
  mercury: [
    'Mercury in the 1st house creates an intellectual, communicative, youthful appearance. You are witty, adaptable, and analytical. Business acumen is natural. Writing and speaking come easily.',
    'Mercury in the 2nd house gives eloquent speech and intellectual wealth accumulation. Business through communication. Education is emphasized. Multiple income streams are possible.',
    'Mercury in the 3rd house is a natural placement — Mercury represents communication and siblings. Writing, journalism, social media, marketing, and education shine here. Siblings are intellectual.',
    'Mercury in the 4th house gives an educated home environment. Mother is intelligent. Education and intellect are the foundation of happiness. Real estate through intellectual means.',
    'Mercury in the 5th house blesses with exceptional intelligence, speculative acumen, and creative thinking. Education is a strength. Children are intellectually gifted. Writing for entertainment.',
    'Mercury in the 6th house excels in service, analysis, and problem-solving. Healthcare, law, accounting, and research suit you. You overcome obstacles through intelligence.',
    'Mercury in the 7th house gives an intellectual, communicative spouse. Business partnerships in communication, trade, or education are highly favorable. Legal matters require precision.',
    'Mercury in the 8th house creates a deep, research-oriented mind. Interest in occult sciences, astrology, psychology, and mysteries. Long life through adaptability. Hidden knowledge is accessible.',
    'Mercury in the 9th house gives a philosophical, scholarly nature. Higher education, law, publishing, and spiritual teaching are indicated. Writing about dharma or philosophy brings recognition.',
    'Mercury in the 10th house is excellent for communication-based careers. Journalism, public speaking, consulting, teaching, trading, and business administration flourish. Multiple careers possible.',
    'Mercury in the 11th house brings gains through networking, communication, and intellectual work. Social connections with intellectuals. Multiple income sources. Desires fulfilled through cleverness.',
    'Mercury in the 12th house creates private intellectual pursuits. Research, writing, and analysis in seclusion. Foreign languages or work in foreign lands. Spiritual texts are favored.',
  ],
  jupiter: [
    'Jupiter in the 1st house is one of the most auspicious placements. A wise, optimistic, dharmic personality. You are naturally fortunate, generous, and respected. Weight gain is possible. Teaching and guidance come naturally.',
    'Jupiter in the 2nd house blesses with considerable wealth, eloquent speech, and a large, fortunate family. Financial wisdom grows over time. Second marriage is possible. Spiritual speech is powerful.',
    'Jupiter in the 3rd house is moderately placed — Jupiter prefers contemplation over short journeys. Wisdom in communication. Siblings may be fewer but prosperous. Philosophical writing.',
    'Jupiter in the 4th house is highly auspicious — happiness, mother, vehicles, property, and education are all blessed. Emotional wisdom brings contentment. Home is a place of learning and peace.',
    'Jupiter in the 5th house is its most powerful position — the 5th is the house of dharma and Jupiter loves it here. Exceptional intelligence, noble children, speculative wisdom, and past life merit are strong.',
    'Jupiter in the 6th house is moderate — Jupiter loses some power in enemy territory. Legal wisdom, healthcare service, and overcoming obstacles through dharma. Debts may accumulate. Enemies are overcome through wisdom.',
    'Jupiter in the 7th house blesses with a wise, spiritual, and fortunate spouse. Marriage brings expansion of wisdom. Business partnerships with ethical people. Legal matters are resolved favorably.',
    'Jupiter in the 8th house gives longevity and interest in spiritual hidden knowledge. Inheritance is possible. Life is transformed through wisdom after challenges. Research into ancient texts is favorable.',
    'Jupiter in the 9th house is the most auspicious placement for Jupiter — the 9th is Jupiter\'s natural house. Exceptional fortune, dharmic father, higher education, spiritual wisdom, and long pilgrimages are indicated.',
    'Jupiter in the 10th house creates an outstanding career in teaching, law, consulting, religion, philosophy, or public service. Recognition and authority through wisdom. A dharmic career brings fame.',
    'Jupiter in the 11th house is considered by BPHS as one of the best placements for wealth — gains through wisdom, social connections, and dharmic activities. Large social circle. Elder siblings are prosperous.',
    'Jupiter in the 12th house creates spiritual inclinations, ashram life, or service in foreign spiritual institutions. Expenses on dharmic activities. Moksha-oriented. Foreign lands bring spiritual growth.',
  ],
  venus: [
    'Venus in the 1st house creates a beautiful, charming, artistic, and attractive personality. You are naturally magnetic. Luxury and refinement are important. Talents in arts, music, and beauty professions.',
    'Venus in the 2nd house blesses with wealth through artistic means, beauty products, luxury goods, or family businesses. Sweet speech. Attractive face. Multiple income streams from creative work.',
    'Venus in the 3rd house gives artistic communication — writing, music, and creative expression come naturally. Relationships with siblings are pleasurable. Short travels for artistic purposes.',
    'Venus in the 4th house creates a beautiful, comfortable home environment. Happiness through domestic pleasures. Mother is artistic. Property and vehicles are well-appointed. Comfort is paramount.',
    'Venus in the 5th house is highly auspicious — romance, creativity, and artistic expression flourish. Children are artistic. Love affairs are passionate. Speculation through artistic means. Past life artistic merit.',
    'Venus in the 6th house creates challenges in love and luxury (Venus is in its sign of debilitation here in Virgo). Service professions in beauty and healthcare. Overcoming romantic obstacles strengthens character.',
    'Venus in the 7th house is Venus\'s own house of relationships — marriage is blissful. The spouse is beautiful, artistic, and wealthy. Business in luxury goods, beauty, arts, or entertainment.',
    'Venus in the 8th house creates deep sensual and artistic nature. Inheritance through the spouse. Interest in occult beauty traditions. Long life through pleasurable activities. Hidden artistic talents emerge.',
    'Venus in the 9th house blesses with a dharmic, fortunate approach to relationships. Father has artistic inclinations. Long journeys for artistic pursuits. Philosophy of beauty and love is developed.',
    'Venus in the 10th house creates a career in arts, entertainment, beauty, luxury goods, fashion, or hospitality. Public life is glamorous and refined. Recognition through artistic achievements.',
    'Venus in the 11th house is excellent for financial gains through artistic networks, beauty industry, or entertainment. Large social circle of creative people. Fulfillment of desires through charm.',
    'Venus in the 12th house creates pleasures in seclusion, foreign lands, and spiritual retreats. Expenses on luxury and pleasure. Spiritual practice through sacred arts. Foreign spouses are possible.',
  ],
  saturn: [
    'Saturn in the 1st house creates a serious, disciplined, and persevering personality. Life lessons come early. Longevity is strong. Success comes through patience and hard work. Sade Sati effects are significant.',
    'Saturn in the 2nd house creates slow but steady wealth accumulation. Family responsibilities are heavy. Speech is measured and serious. Financial discipline is crucial. Dental health needs attention.',
    'Saturn in the 3rd house gives tremendous persistence and discipline in communication and effort. Siblings may be older or face hardships. Short journeys for work. Discipline brings professional results.',
    'Saturn in the 4th house creates challenges in domestic happiness and mother\'s health. Property matters require patience. Happiness comes later in life after hard work. Real estate through discipline.',
    'Saturn in the 5th house delays or reduces children but makes them disciplined when they arrive. Speculative losses need avoiding. Intellectual depth and seriousness. Past life karma around children.',
    'Saturn in the 6th house is highly favorable — Saturn\'s discipline defeats enemies, diseases, and debts. Service professions, healthcare, law, and systematic work bring tremendous success.',
    'Saturn in the 7th house delays marriage and brings karmic lessons through partnerships. The spouse may be older, serious, or from a different background. Disciplined partnerships last a lifetime.',
    'Saturn in the 8th house gives exceptional longevity — this is one of the best placements for long life. Interest in occult, research, and hidden matters. Karmic lessons through inheritance and transformation.',
    'Saturn in the 9th house creates a serious, disciplined approach to dharma. Father may be strict or distant. Fortune comes through patience and hard work rather than luck. Organized religion or systematic philosophy.',
    'Saturn in the 10th house is its strongest placement — exalted in Libra in the 10th is ideal. A distinguished career built through decades of disciplined effort. Authority figures recognize your consistency.',
    'Saturn in the 11th house delays gains but makes them permanent when they arrive. Gains through older people, industry, or systematic networking. Financial discipline brings eventual prosperity.',
    'Saturn in the 12th house creates karmic expenditure, isolation, and spiritual discipline. Foreign lands offer karmic resolution. Ashrams, hospitals, or isolated service. Moksha through disciplined practice.',
  ],
  rahu: [
    'Rahu in the 1st house creates an intense, ambitious, unconventional personality. You break norms and create new paths. Foreign cultures attract you. Health needs attention — mysterious ailments are possible.',
    'Rahu in the 2nd house creates obsession with wealth and material accumulation. Unconventional income sources. Speech may be deceptive or foreign-accented. Foreign food preferences.',
    'Rahu in the 3rd house gives tremendous ambition in communication, media, and technology. Siblings may be unconventional. Unconventional courage and risk-taking. Media and technology skills.',
    'Rahu in the 4th house creates displacement from homeland. Foreign real estate is possible. Unconventional home life. Technology in the home. Mother may be from a foreign background.',
    'Rahu in the 5th house creates unconventional romance, speculative obsession, and unusual relationship with children. Creative intelligence in unconventional fields. Technology and entertainment.',
    'Rahu in the 6th house is powerful for defeating enemies through unconventional means. Healing through alternative medicine. Obsession with service and perfection. Excellent for medical or legal careers.',
    'Rahu in the 7th house creates unusual marriages — often to someone from a different culture, religion, or background. Business partnerships with foreigners. International business is highlighted.',
    'Rahu in the 8th house gives deep interest in occult, mystery, and transformation. Sudden changes in life are dramatic. Research into ancient or hidden knowledge. Unconventional longevity practices.',
    'Rahu in the 9th house creates an unconventional approach to dharma and philosophy. Foreign guru or spiritual teacher. Long journeys to foreign lands. Questioning conventional religious beliefs.',
    'Rahu in the 10th house creates ambition for worldly success — often becoming prominent in unconventional fields, technology, foreign affairs, or mass media. Dramatic career rises and falls.',
    'Rahu in the 11th house is highly favorable for gains — unconventional income from foreign sources, technology, or networks. Large social circles. Sudden and unusual financial gains.',
    'Rahu in the 12th house creates fascination with foreign lands, hidden realms, and spiritual mysteries. Expenditure on foreign items or substances. Hospital connections. Spiritual experiences in foreign lands.',
  ],
  ketu: [
    'Ketu in the 1st house creates a spiritually oriented, detached personality. Past life wisdom is accessible. You may feel a sense of not belonging. Mysterious health issues. Interest in spirituality and moksha.',
    'Ketu in the 2nd house creates detachment from material accumulation. Past life wealth karma is resolving. Speech may be cryptic or spiritual. Family may feel disconnected. Spiritual knowledge of values.',
    'Ketu in the 3rd house gives natural courage without knowing its source (past life). Siblings may be spiritually inclined or distant. Communication is intuitive rather than logical.',
    'Ketu in the 4th house creates detachment from homeland and mother. Property matters need grounding. Spiritual peace at home. Past life connection to the birthplace is resolving.',
    'Ketu in the 5th house creates deep past life spiritual merit. Children may be spiritual or few. Speculation should be avoided. Mantra siddhis are powerful. Past life teacher karma.',
    'Ketu in the 6th house is excellent — past life victory over enemies supports present life. Health through alternative and spiritual medicine. Intuitive ability to overcome obstacles.',
    'Ketu in the 7th house creates detachment from marriage and partnership. Spouse may be spiritually inclined or distant. Past life unresolved partnership karma. Spiritual partnerships are fulfilling.',
    'Ketu in the 8th house gives natural access to occult knowledge from past lives. Mysterious circumstances surround transformation. Interest in death, rebirth, and spiritual liberation.',
    'Ketu in the 9th house creates past life dharmic wisdom. Guru connection is karmic and deep. Father may be spiritually inclined. Long journeys for spiritual purposes. Questioning of inherited beliefs.',
    'Ketu in the 10th house creates detachment from career ambitions (which have been fulfilled in past lives). Present life career may be spiritual, research-oriented, or service-based. Fame without seeking.',
    'Ketu in the 11th house creates detachment from gains and social networks (resolved in past lives). Income from spiritual sources. Friends may be few but deeply meaningful.',
    'Ketu in the 12th house is highly auspicious for moksha — past life spiritual practices bear fruit. Retreat, meditation, and spiritual liberation are natural outcomes. Foreign lands offer resolution.',
  ],
};

// House significations with full interpretation
const HOUSE_SIGNIFICATIONS = [
  { num:1,  name:'Lagna (Self)',           topics:'Personality, body, health, appearance, early life, overall destiny, vitality' },
  { num:2,  name:'Dhana (Wealth)',          topics:'Wealth, family, speech, food, face, right eye, accumulated resources, education' },
  { num:3,  name:'Sahaja (Courage)',        topics:'Siblings, courage, short travel, communication, hands, neighbours, skills, media' },
  { num:4,  name:'Sukha (Happiness)',       topics:'Mother, home, vehicles, land, education, emotional security, heart, agriculture' },
  { num:5,  name:'Putra (Intellect)',       topics:'Children, intelligence, creativity, romance, past merit, speculation, mantras' },
  { num:6,  name:'Ripu (Enemies)',          topics:'Enemies, diseases, debts, daily work, servants, litigation, maternal relatives' },
  { num:7,  name:'Kalatra (Spouse)',        topics:'Spouse, partnerships, business, foreign travel, public dealings, desires' },
  { num:8,  name:'Randhra (Longevity)',     topics:'Longevity, transformation, inheritance, occult, hidden matters, sudden events' },
  { num:9,  name:'Dharma (Fortune)',        topics:'Father, fortune, dharma, higher education, guru, long travel, spirituality' },
  { num:10, name:'Karma (Career)',          topics:'Career, status, reputation, government, authority, public life, achievements' },
  { num:11, name:'Labha (Gains)',           topics:'Gains, income, elder siblings, social circle, fulfillment of desires, networks' },
  { num:12, name:'Vyaya (Liberation)',      topics:'Expenses, foreign lands, liberation, bed pleasures, hospitals, isolation, moksha' },
];

// Yoga detection
function detectYogas(planets, ascendant) {
  const yogas = [];
  const p = planets;
  const conjunct = (a, b) => p[a] && p[b] && p[a].sign === p[b].sign;
  const inKendra = (pl) => p[pl] && [1,4,7,10].includes(p[pl].house);
  const inTrikona = (pl) => p[pl] && [1,5,9].includes(p[pl].house);

  if (conjunct('sun','mercury')) yogas.push({ name:'Budha-Aditya Yoga', type:'Wisdom', desc:'Sun and Mercury together in the same sign. Classical texts declare this creates exceptional intelligence, administrative ability, and favour from authority. The native is eloquent, scholarly, and recognised by government.' });
  if (conjunct('moon','mars'))  yogas.push({ name:'Chandra-Mangala Yoga', type:'Wealth', desc:'Moon and Mars in conjunction. Phaladeepika declares this creates financial drive and emotional courage. Income through land, property, mother-related businesses, or action.' });
  if (p.jupiter && p.moon) {
    const diff = Math.abs(p.jupiter.house - p.moon.house);
    if ([0,3,6,9].includes(diff)) yogas.push({ name:'Gaja-Kesari Yoga', type:'Fame', desc:'Jupiter in a kendra from Moon. BPHS declares this creates wisdom, fame, and prosperity — the native is respected like an elephant-king (Gaja-Kesari). Fortune and social respect throughout life.' });
  }
  if (p.jupiter && inKendra('jupiter') && p.jupiter.sign === 'Cancer') yogas.push({ name:'Hamsa Yoga (Pancha Mahapurusha)', type:'Wisdom/Fortune', desc:'Jupiter exalted in Cancer in a kendra. Hamsa Yoga is one of the Pancha Mahapurusha yogas. The native is exceptionally wise, spiritually inclined, fortunate, handsome, and becomes a great leader or teacher.' });
  if (p.venus && inKendra('venus') && ['Taurus','Libra','Pisces'].includes(p.venus.sign)) yogas.push({ name:'Malavya Yoga (Pancha Mahapurusha)', type:'Beauty/Luxury', desc:'Venus in own sign or exaltation in a kendra. Sarvartha Chintamani declares the native is beautiful, artistic, wealthy, enjoys luxury, and has a refined character.' });
  if (p.saturn && inKendra('saturn') && ['Capricorn','Aquarius','Libra'].includes(p.saturn.sign)) yogas.push({ name:'Sasa Yoga (Pancha Mahapurusha)', type:'Authority', desc:'Saturn in own sign or exaltation in a kendra. The native commands authority over masses, has excellent leadership in industry or government, and builds lasting institutions.' });
  if (p.mars && inKendra('mars') && ['Aries','Scorpio','Capricorn'].includes(p.mars.sign)) yogas.push({ name:'Ruchaka Yoga (Pancha Mahapurusha)', type:'Courage/Power', desc:'Mars in own sign or exaltation in a kendra. The native has exceptional physical prowess, military or athletic success, and commands others through strength.' });
  if (p.mercury && inKendra('mercury') && ['Gemini','Virgo'].includes(p.mercury.sign)) yogas.push({ name:'Bhadra Yoga (Pancha Mahapurusha)', type:'Intelligence', desc:'Mercury in own sign in a kendra. Outstanding intelligence, business acumen, communication skills, and success in education or trade.' });
  if (p.mars && [1,4,7,8,12].includes(p.mars.house)) yogas.push({ name:'Mangal Dosha', type:'Dosha/Caution', desc:`Mars in house ${p.mars.house} creates Mangal Dosha. Classical texts advise care in marriage partnerships. Matching with a partner of similar dosha or remedies through Mangal puja, Hanuman worship, and patience ensures harmonious marriage.` });
  if (p.rahu && p.ketu) {
    const rahuH = p.rahu.house, ketuH = p.ketu.house;
    const others = ['sun','moon','mars','mercury','jupiter','venus','saturn'].map(n => p[n]?.house).filter(Boolean);
    const allBetween = others.every(h => {
      const d = (h - rahuH + 12) % 12;
      const span = (ketuH - rahuH + 12) % 12;
      return d <= span;
    });
    if (allBetween) yogas.push({ name:'Kala Sarpa Dosha', type:'Dosha/Caution', desc:'All planets fall between Rahu and Ketu. Jataka Parijata and classical tradition note this creates dramatic rises and falls in life. Serpent worship, especially at Trimbakeshwar or Kukke Subramanya, is the classical remedy. The native\'s karma is intense and transformative but ultimately leads to liberation.' });
  }
  if (p.sun && [6,8,12].includes(p.sun.house)) yogas.push({ name:'Pitra Dosha', type:'Dosha/Caution', desc:'The Sun in a dusthana (6th, 8th, or 12th) creates Pitra Dosha — ancestral karma affecting the current life. Performing Pitru Tarpan, especially on Amavasya, and offering food to the needy in the name of ancestors resolves this effectively.' });
  return yogas;
}

// Dasha interpretations from Laghu Parashari
function getDashaInterpretation(planet, chart) {
  const interp = {
    Sun:     'This Mahadasha activates matters related to your soul\'s purpose, authority, career, and father. Government dealings, health of the eyes and heart, and your dharmic path are highlighted. Leadership opportunities emerge. Success comes through integrity and ethical action.',
    Moon:    'The Moon Mahadasha activates emotions, mind, mother, public life, and domestic affairs. Travel is frequent. Business connected to the public, nurturing professions, and emotional intelligence are highlighted. Peace of mind depends on emotional harmony.',
    Mars:    'Mars Mahadasha activates courage, energy, siblings, property, and competitive drive. Real estate dealings, physical activities, engineering, and surgery are highlighted. This is a period of action — those who work hard achieve significant results. Accidents require care.',
    Rahu:    'Rahu Mahadasha brings sudden and dramatic changes, foreign connections, unconventional gains, and technology. The first and last portions can bring confusion, but the middle brings unusual opportunities. International matters, hidden knowledge, and ambitious pursuits are activated.',
    Jupiter: 'Jupiter Mahadasha is one of the most auspicious periods — wisdom, wealth, children, spiritual growth, and expansion are all highlighted. Teaching, counseling, law, and dharmic activities bring rewards. Marriage and childbirth are favorable during this period.',
    Saturn:  'Saturn Mahadasha is karmic — the results depend on how Saturn sits in your chart. Hard work, discipline, and service yield long-term rewards. Delays are common but results are permanent. Health requires attention. Service to the elderly and needy is the classical remedy.',
    Mercury: 'Mercury Mahadasha activates intelligence, business, communication, and education. Multiple income streams emerge. Writing, trading, consulting, and analytical work flourish. Short travels for business are frequent. Education and skill development yield exceptional returns.',
    Ketu:    'Ketu Mahadasha is intensely spiritual. Past life patterns surface for resolution. Detachment from material pursuits increases. Interest in occult, spirituality, and liberation grows. Health through alternative healing. Unexpected separations and spiritual insights characterize this period.',
    Venus:   'Venus Mahadasha is the longest at 20 years and one of the most pleasurable. Love, marriage, luxury, arts, beauty, vehicles, and creative pursuits are all highlighted. The first portion activates relationships; the middle brings material prosperity; the latter brings spiritual refinement.',
  };
  return interp[planet] || 'This Mahadasha activates the significations of its lord based on your natal chart.';
}

function getLagnaInterpretation(sign) {
  const interps = {
    'Aries':       'Aries Lagna (Mesha) creates a pioneering, courageous, and action-oriented personality. Ruled by Mars, you are born a leader with natural warrior spirit. BPHS declares Aries natives are quick-tempered but generous, physically strong, and entrepreneurial. You take initiative where others hesitate. Career in leadership, sports, military, engineering, or entrepreneurship suits you. Your first impulse is always action — learn to pause and strategize for maximum results.',
    'Taurus':      'Taurus Lagna (Vrishabha) creates a patient, artistic, wealth-loving, and sensually refined personality. Ruled by Venus, you appreciate beauty, comfort, and material stability. Phaladeepika declares Taurus natives are steady, determined, and highly productive when motivated. Luxury, arts, food, music, fashion, and financial services suit you. Your strength is your consistency — when you decide to pursue something, nothing stops you. Build slowly, but build permanently.',
    'Gemini':      'Gemini Lagna (Mithuna) creates a quick, intellectual, communicative, and versatile personality. Ruled by Mercury, you are naturally curious and capable in multiple fields simultaneously. Jataka Parijata declares Gemini natives excel in communication, education, business, and social networking. Writing, journalism, trading, consulting, and education suit you perfectly. Your challenge is focus — your many talents can scatter unless channeled purposefully.',
    'Cancer':      'Cancer Lagna (Kataka) creates a deeply intuitive, nurturing, emotionally intelligent, and public-oriented personality. Ruled by Moon, you are naturally connected to the pulse of society. BPHS declares Cancer natives have strong business instincts, deep family bonds, and fluctuating fortunes that ultimately stabilize. Healthcare, real estate, hospitality, public service, and creative arts suit you. Trust your intuition — it is rarely wrong.',
    'Leo':         'Leo Lagna (Simha) creates a regal, generous, proud, and naturally authoritative personality. Ruled by Sun, you are born to lead and inspire. Sarvartha Chintamani declares Leo natives shine in positions of authority and are respected for their dignity and generosity. Government, politics, entertainment, education, and executive roles suit you perfectly. Your challenge is ego management — when you lead with heart rather than pride, you achieve legendary status.',
    'Virgo':       'Virgo Lagna (Kanya) creates a analytical, service-oriented, perfectionist, and intellectually precise personality. Ruled by Mercury, you have exceptional attention to detail. BPHS declares Virgo natives excel in analysis, healthcare, accounting, editing, and systematic work. Medicine, research, data analysis, writing, and quality management suit you. Your perfectionism is your superpower — learn to also celebrate what is good enough.',
    'Libra':       'Libra Lagna (Tula) creates a balanced, diplomatic, aesthetically refined, and justice-oriented personality. Ruled by Venus, you are a natural mediator and relationship artist. Phaladeepika declares Libra natives excel in partnerships, law, arts, and social diplomacy. Law, fashion, arts, counseling, international business, and mediation suit you. Your strength is seeing all sides — use this for decisive leadership, not endless deliberation.',
    'Scorpio':     'Scorpio Lagna (Vrishchika) creates an intense, perceptive, transformative, and psychologically deep personality. Co-ruled by Mars and Ketu, you see beneath surfaces that others cannot. Jataka Parijata declares Scorpio natives have extraordinary willpower and the ability to resurrect themselves from any adversity. Research, surgery, psychology, occult sciences, investigation, and transformation work suit you. Your intensity is your greatest gift — directed wisely, it creates miracles.',
    'Sagittarius': 'Sagittarius Lagna (Dhanu) creates a philosophical, optimistic, freedom-loving, and wisdom-seeking personality. Ruled by Jupiter, you are a natural teacher and seeker of truth. BPHS declares Sagittarius natives are dharmic, fortunate, and inclined toward higher wisdom. Teaching, law, international work, philosophy, publishing, and spiritual leadership suit you. Your optimism creates opportunity — combine it with discipline for extraordinary results.',
    'Capricorn':   'Capricorn Lagna (Makara) creates an ambitious, disciplined, practically brilliant, and persevering personality. Ruled by Saturn, you are built for long-term achievement. Sarvartha Chintamani declares Capricorn natives rise slowly but achieve positions of lasting authority. Business, administration, finance, architecture, and systematic management suit you. Your greatest strength is patience — most of your best achievements come after age 30 and accelerate with each decade.',
    'Aquarius':    'Aquarius Lagna (Kumbha) creates an innovative, humanitarian, independent, and intellectually unconventional personality. Ruled by Saturn, you see systems and societies differently. BPHS declares Aquarius natives often become pioneers in their fields. Technology, social reform, NGOs, research, science, and humanitarian work suit you. You are ahead of your time — trust your vision even when others do not immediately understand it.',
    'Pisces':      'Pisces Lagna (Meena) creates a compassionate, spiritually sensitive, creatively gifted, and intuitively profound personality. Ruled by Jupiter, you move between the material and spiritual worlds with ease. Phaladeepika declares Pisces natives are deeply empathetic and often achieve spiritual distinction. Healing arts, spirituality, creative arts, counseling, and NGO work suit you. Your compassion is your superpower — ensure healthy boundaries protect your sensitive energy.',
  };
  return interps[sign] || `${sign} Lagna creates a unique cosmic personality with its own special gifts and dharmic path.`;
}

// ── Calculate Panchang from chart data ────────────────────────────────────────
function calcPanchang(chart, dob, birthTime) {
  const { planets = {} } = chart;
  const sunLon  = (planets.sun?.signIndex  || 0) * 30 + (planets.sun?.degrees  || 0);
  const moonLon = (planets.moon?.signIndex || 0) * 30 + (planets.moon?.degrees || 0);
  const diff = ((moonLon - sunLon) + 360) % 360;
  const tithiNum = Math.floor(diff / 12) + 1;
  const TITHIS = ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima/Amavasya'];
  const tithi = TITHIS[(tithiNum - 1) % 15] || 'Unknown';
  const yogaNum = Math.floor(((sunLon + moonLon) % 360) / (360 / 27));
  const YOGAS_P = ['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyan','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
  const yoga = YOGAS_P[yogaNum % 27] || 'Unknown';
  const karanaNum = Math.floor(diff / 6) % 11;
  const KARANAS = ['Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Shakuni','Chatushpada','Naga','Kimstughna'];
  const karana = KARANAS[karanaNum] || 'Unknown';
  const moonNak = planets.moon?.nakshatra?.name || 'Unknown';
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const weekday = dob ? days[new Date(dob).getDay()] : 'Unknown';
  return { tithi, yoga, karana, nakshatra: moonNak, weekday };
}

module.exports = { PLANET_IN_HOUSE, HOUSE_SIGNIFICATIONS, SIGN_INFO, PLANET_NATURE, detectYogas, getDashaInterpretation, getLagnaInterpretation, calcPanchang };
