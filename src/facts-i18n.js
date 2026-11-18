/**
 * Angielskie odpowiedniki treści faktograficznych z `src/facts.js`.
 *
 * Polski pozostaje źródłem prawdy; ten moduł dostarcza wyłącznie tłumaczenia
 * pól, które w facts.js nie mają własnego obiektu `pl`/`en`.
 */
export const FACTS_EN = {
  CASE_DISCLAIMER: {
    text: 'Richard James Schueler has not been convicted in any jurisdiction and is presumed innocent. '
      + 'The allegations described remain the claims of the parties at the stage of detention, investigation or court proceedings. '
      + 'The detention in Turkey on 14.10.2026 took place in gözaltı (police custody) — this monitor knows of no public court decision on his further status. '
      + 'This monitor is not a party to the proceedings and does not claim the allegations are true.',
  },

  CASE_STATUS: {
    statusShort: 'Court status undisclosed',
    chargeShort: 'Charge in the notice (Finland)',
    courtShort: 'Remand in absentia (Finland)',
    court: 'Helsinki District Court (käräjäoikeus)',
    requestingCountry: 'Finland',
    extraditionNote: 'no confirmed request. Our calculation: 18 days from 14.10 expires on 1.11.2026, 40 days on 23.11.2026 (ECE art. 16)',
  },

  KEY_FACTS: {
    status: {
      label: 'Legal status',
      value: 'Court status undisclosed',
      note: 'Detained on 14.10.2026 in Beşiktaş (confirmed 17.10). Police custody (gözaltı) ends by law within days, so the court had to decide: provisional extradition arrest, judicial control or release. No decision appears in public sources.',
      source: 'Turkish Ministry of Justice, AA · CMK 91',
    },
    basis: {
      label: 'Basis',
      value: 'Interpol Red Notice 2024/65212',
      note: 'Finland’s request · published 13.12.2024 · the notice is not an arrest warrant.',
      source: 'Interpol',
    },
    charge: {
      label: 'Charge in the notice',
      value: 'Aggravated tax fraud',
      note: 'The only charge in the public Interpol record. Turkey has not announced its own charges.',
      source: 'Interpol',
    },
    seizure: {
      label: 'Seizures',
      value: 'USD 7.15 million and TRY 160,000 in cash',
      note: '15 addresses. 6 cold wallets, 28 watches, 4 rifles, 3 pistols, 1,400 rounds. Separately 9 cars belonging to his wife.',
      source: 'Turkish Ministry of Justice, AA',
    },
    extradition: {
      label: 'Extradition',
      value: 'No confirmed request from Finland',
      note: 'The 1 and 23 November 2026 dates are our calculation from ECE art. 16, not statements by the parties.',
      source: 'Methodology',
    },
    conviction: {
      label: 'Verdict',
      value: 'No known verdict',
      note: 'No public verdict in any jurisdiction. The SEC civil case was dismissed on 28.02.2025 without a ruling on the merits.',
      source: 'E.D.N.Y. 1:23-cv-05749',
    },
  },

  LAST_CONFIRMED: {
    text: 'No public ruling on remand, no announced charges in Turkey and no confirmed extradition request.',
  },

  LEGAL_DEADLINES: {
    'docs-18': {
      label: 'Finland’s documents',
      text: '18 days to send the extradition request and documents. The Convention (ECE art. 16(4)) then permits lifting provisional detention, and Turkish Law 6706 art. 14(6) makes that mandatory if the documents do not arrive.',
      note: 'Deadline calculated by our editorial team from the day of detention; Turkey has not confirmed whether a request has been received.',
      basis: 'ECE art. 16(4) · Law 6706 art. 14(6)',
    },
    'max-40': {
      label: 'Maximum provisional extradition detention',
      text: '40 days — the statutory limit on provisional extradition detention. Release must follow; re-arrest is possible if the request arrives later. Practice occasionally breaches this limit — that is an error, not a legal basis.',
      note: 'This is the limit on detention itself, not a decision on extradition.',
      basis: 'ECE art. 16(4) · Law 6706 art. 14(4)',
    },
  },

  LEGAL_ROADMAP: {
    detention: {
      when: '14.10.2026',
      title: 'Detention and gözaltı',
      text: 'Istanbul police and MİT detain him in Beşiktaş. In extradition cases the detainee must be brought before a magistrate within 24 hours at the latest. Ordinary police custody also has a 24-hour limit (plus 12 hours for transport); extension to four days applies only to collective cases and the exceptions in CMK art. 91(4).',
      basis: 'CMK 5271 art. 91 · Law 6706 art. 14(3)',
      src: 'mevzuat.gov.tr · MoJ TR',
    },
    judge: {
      when: 'until ~18.10.2026',
      title: 'The judge’s decision after gözaltı',
      text: 'Once police custody ends, the court must choose: geçici tutuklama (provisional arrest for extradition), adli kontrol (judicial control) or release. None of these decisions appears in public sources — which is why the legal status remains undisclosed.',
      basis: 'CMK arts. 91 and 109 · Law 6706 art. 14(3), (5)–(6)',
      src: 'mevzuat.gov.tr',
    },
    docs: {
      when: 'window: until 1.11.2026',
      title: '18 days for Finland’s documents',
      text: 'Finland must send a formal request together with the documents. If they do not arrive within 18 days of detention, provisional extradition detention must be lifted. Turkey has not publicly confirmed whether a request has been received.',
      basis: 'ECE art. 16(4) · Law 6706 art. 14(6)',
      src: 'Council of Europe · mevzuat.gov.tr',
    },
    max40: {
      when: 'limit: 23.11.2026',
      title: '40 days — the maximum geçici tutuklama',
      text: 'Even with the documents, provisional extradition detention cannot exceed 40 days. Release must follow; re-arrest is possible if the request arrives later. This is still not a decision on extradition.',
      basis: 'ECE art. 16(4) · Law 6706 art. 14(4)',
      src: 'Council of Europe · mevzuat.gov.tr',
    },
    'finland-request': {
      when: 'no deadline',
      title: 'Finland prepares and sends the request',
      text: 'The outgoing request is prepared by the police and the prosecution, and sent by Finland’s Ministry of Justice through diplomatic channels (Law 456/1970 §§ 13 and 26). Finland has no statutory deadline for filing the request — only Turkey’s 18/40-day window constrains it. The documents are not public by default: access may be refused where disclosure would harm international relations or an investigation (Law 621/1999 § 24). The first public signal will therefore most likely be Yle/HS/STT or a KRP release.',
      basis: 'Laki 456/1970 §§ 13, 26 · 621/1999 § 24',
      src: 'Finlex · Ministry of Justice (Finland)',
    },
    court: {
      when: 'no deadline',
      title: 'The court examines the request (İstanbul Ağır Ceza Mahkemesi)',
      text: 'Once the request is served, the court examines its admissibility and whether the charge is a political matter. There is no statutory deadline; detention is then reviewed every 30 days and may not last longer than the penalty threatened by the charge.',
      basis: '6706 arts. 15, 16(1)–(2) and 18',
      src: '6706 · DIABGM',
    },
    cassation: {
      when: 'within 3 months',
      title: 'Cassation to the Yargıtay',
      text: 'The court’s decision may be appealed to the Supreme Court, which is to hear it within three months. Detention continues until the decision is final.',
      basis: '6706 art. 18(4)',
      src: '6706',
    },
    executive: {
      when: 'within 1 year',
      title: 'The President’s decision on surrender',
      text: 'The final decision on surrender is taken by the President on the proposal of the Minister of Justice. If no executive decision is taken within one year of the court’s final decision, the coercive measures must be lifted. Refusal remains possible even after the court’s decision.',
      basis: '6706 arts. 19 and 16(3) · AYM 2018/19302',
      src: '6706 · Constitutional Court TR',
    },
    surrender: {
      when: 'after the decision',
      title: 'Surrender to Finland',
      text: 'If extradition is approved, Turkey informs Finland of the place and date of surrender. From the appointed date Turkey may release him after 15 days and must after 30 — the parties may also agree a new date (ECE art. 18(3)–(5)). After landing, the Finnish court remands him and the criminal case returns to the docket.',
      basis: 'ECE art. 18(3)–(5)',
      src: 'Council of Europe',
    },
    citizenship: {
      when: 'dependent on an unknown fact',
      title: 'Turkish citizenship would bar extradition',
      text: 'A Turkish citizen cannot be surrendered abroad. We have found no confirmation that Schueler holds Turkish citizenship — Turkish police statements refer to “foreign-national suspects”, and the Interpol record lists US nationality. A Turkish identity card usually proves citizenship, but no source confirms such a document; residence or a residence permit alone confers no such protection.',
      basis: 'Anayasa art. 38 · 6706 art. 11(1)(a)',
      src: 'Constitution TR · 6706',
    },
  },

  LEGAL_NOTES: [
    'The absence of a public decision does not mean there is none — Turkish courts do not publish decisions in extradition cases, and Finland does not comment on requests (document secrecy, Law 621/1999 s. 24).',
    'Practice occasionally extends detention beyond 40 days and prepares a request without complete documents; that is an error, not a legal basis.',
    'Tax offences are in principle extraditable where they correspond to an offence of the same nature under Turkish law (art. 2 of the 1998 ETS protocol, which replaced ECE art. 5). It remains disputed whether the Finnish charge corresponds to a Turkish tax offence (VUK art. 359) — a typical defence argument, not an automatic release.',
    'If Finland did not send the request in time, it may seek detention again (ECE art. 16(5)), proceed in absentia or use legal assistance in Turkey; in this case the Finnish court has already remanded him in absentia once (13.09.2024).',
    'If Turkey refuses, it must give reasons (ECE art. 18(2)), and Finland may return to the criminal case and a future request — refusal does not end the matter.',
    'Formal conditions the Turkish court always checks: dual criminality (conduct punishable by at least one year in both countries — ECE art. 2(1), Finnish Law 456/1970 § 4) and the rule of speciality, i.e. no prosecution for offences other than those covered by the consent (ECE art. 14; Law 6706 art. 10(4)).',
    'Separate grounds for refusal: the political or discriminatory character of the request, ne bis in idem and limitation (ECE arts. 3, 9, 10; Law 6706 art. 11). Simplified surrender with the person’s consent is also possible (Law 6706 art. 17).',
  ],

  PROGRESS_MARKS: {
    start: { note: 'detention' },
    decision: { note: 'court decision' },
    docs: { note: 'Finland documents' },
    limit: { note: '40-day limit' },
  },

  CLAIMED_FACTS: {
    building: { source: 'Yeni Şafak 18.10.2026 (sole source — no official confirmation)' },
    'wife-name': { source: 'Yeni Şafak 18.10.2026 (single source; private individual’s data)' },
    guards: { source: 'Yeni Şafak 18.10.2026 (sole source)' },
    'wanted-since-feb': { source: 'Sabah (single source, no official confirmation)' },
  },

  UNKNOWNS: {
    remand: {
      detail: 'No public ruling. Police custody has a statutory cap (24 hours in extradition proceedings, up to four days in ordinary proceedings), so the court had to decide between 14 and 18.10.2026 — the decision has not been disclosed.',
    },
    citizenship: {
      detail: 'We have found no confirmation. Turkish police statements refer to “foreign-national suspects” (yabancı uyruklu), and the Interpol record lists US nationality only. Turkish citizenship would bar extradition (Turkish Constitution art. 38; Law 6706 art. 11); a residence document alone confers no such protection.',
    },
    'charges-tr': {
      detail: 'There is no public indictment or prosecutor’s statement in Schueler’s case.',
    },
    extradition: {
      detail: 'Unconfirmed. The dates 1 and 23 November are our calculation under ECE art. 16, not an official statement.',
    },
    finland: {
      detail: 'The Finnish police are not commenting. Finland has not publicly confirmed an extradition request.',
    },
    assault: {
      detail: 'The current public Interpol record lists only the tax charge. Interpol does not publish the amendment history of a notice; there is no announcement that the assault charge was withdrawn.',
    },
    whereabouts: {
      detail: 'No statement from his legal team, family or the Turkish authorities after 14.10.2026.',
    },
  },

  KNOWN_ERRORS: {
    'arrested-vs-detained': { label: 'Arrest vs detention' },
    'billion-crypto-fraud': { label: 'The USD 1 billion figure' },
    convicted: { label: 'Verdict vs maximum penalty' },
    watches: { label: 'Number of watches' },
    'mit-university': { label: 'MIT vs MİT' },
    'assault-removed': { label: 'Assault charge' },
    'fund-1-5bn': { label: 'The USD 1.5 billion figure' },
    'seventh-depot': { label: 'Yediemin Otoparkı' },
  },

  CONTRADICTIONS: {
    'charge-basis': {
      topic: 'Basis of the Red Notice',
      summary: 'The official Interpol record: one charge — aggravated tax fraud. The minister speaks of “USD 1 billion in crypto”.',
      rows: [
        ['Interpol (public record, live)', 'the only charge: “1. AGGRAVATED TAX FRAUD”, Finland'],
        ['Europol / FAST Finland (18.12.2024)', 'two charges: tax fraud + assault of a 16-year-old'],
        ['Minister Gürlek / MoJ', '“USD 1 billion fraud involving crypto assets in the US and Finland”'],
        ['İHA / Hürriyet (14.10)', '“a high-value crypto fraud” + “yakalama kararı” (arrest warrant)'],
      ],
      note: 'The official content of the notice = tax fraud. The “USD 1 billion crypto” framing is the minister’s characterisation; no source confirms it as the basis of the notice. Do not merge them.',
    },
    amounts: {
      topic: 'Amounts',
      summary: 'Three different figures: USD 1 billion (minister/SEC), USD 1.5 billion (Turkish media), about EUR 280 million (Finland).',
      rows: [
        ['USD 1 billion', 'wording of the minister’s statement; SEC: “> $1 billion raised”'],
        ['USD 1.5 billion', 'not an SEC figure — a claim by Turkish media (Sözcü/Sabah/A Haber)'],
        ['EUR 280,896,000', 'the Finnish figure (HS, May 2026), closer to the “hundreds of millions” in Interpol/Europol'],
      ],
      note: 'About EUR 280 million is the amount covered by the Finnish charge. According to Finnish sources it concerns employment income (ansiotulo), not capital income, and is not money stolen from investors.',
    },
    seizures: {
      topic: 'Seizures — four incompatible sets',
      summary: 'Four sets: different scope (1 vs 15 addresses) and different watch counts (24/28/64/88).',
      rows: [
        ['MoJ/Gürlek/AA/DHA/TRT/Hürriyet, 17.10', '$7,150,000 + TRY 160,000 | 28 watches | 1,400 rounds | 15 addresses'],
        ['İHA/AA/TRT/Milliyet/TGRT, 14.10', '$600,000 + €2,600 + TRY 50,000 | 24 | 1,360 (+7 magazines, 1 knife) | 1 address'],
        ['Sözcü/TV100/Haberler, 14.10', '$4,000,000 | 64 (53 Rolex + 11 Patek Philippe) | — | his apartment'],
        ['Forbes TR, 14.10', '$4m (vacuum-packed) + $600k | 53 + 11 + 24 earlier | 1,360 | 1 address + bridge'],
      ],
      note: 'Cause: scope (1 address vs 15 addresses). In addition, 2 drones, 20 gold bracelets and 7 gold chains appear only in the 14.10 set. The 9 cars are a separate AA release from 17.10.',
    },
  },

  TIMELINE: {
    '14.10': { date: '14.10', src: 'MoJ · AA · İHA · Istanbul police' },
    '14.10 wieczór': { date: '14.10 evening', src: 'Daily Sabah (İHA) · Finnish media' },
    '15.10': { date: '15.10', src: 'CoinDesk · Decrypt · The Block' },
    '16.10': { date: '16.10', src: 'DHA · Sabah' },
    '17.10': { date: '17.10', src: 'MoJ · AA · TRT Haber' },
    '18.10': { date: '18.10', src: 'Hukuki Haberler · ECE art. 16' },
    '19.10': { date: '19.10', src: 'Yeni Şafak (single source)' },
    '20.10': { date: '20.10', src: 'Hukuki Haberler · Decrypt · The Block' },
    '21.10': { date: '21.10', src: 'Hukuki Haberler · Decrypt · The Block · HS' },
    '22–30.10': { date: '22–30.10', src: 'Source monitoring (no new releases)' },
    '1.11': { date: '1.11', src: 'ECE art. 16 · editorial calculation' },
    '13.11': { date: '13.11', src: 'Cryptospecting — community legal timeline (13.11.2026)' },
    '17.11': { date: '17.11', src: 'KirikKuyruk — rehoming listing (single source)' },
    '10.11': { date: '10.11', src: 'lettersforrichard.org · X: @yourfriendSOMMI (not an official source)' },
  },

  CONFIRMED_FACTS: {
    detained: { links: ['MoJ (17.10.2026)', 'AA (17.10.2026)'] },
    charge: { links: ['Interpol — record 2024/65212', 'Interpol — Red Notices'] },
    'finland-case': { links: ['Yle (17.09.2024)', 'HS (17.09.2024)'] },
    'no-conviction': { links: ['CourtListener — docket', 'Order, Dkt 57 (PDF)'] },
    'tax-record': { links: ['HS Verokone — record', 'IS (22.12.2024)'] },
    disappearance: { links: ['Iltalehti (8.11.2024)'] },
    'seizure-official': { links: ['MoJ — release', 'AA — 9 cars'] },
    'no-court-order': { links: ['Hukuki Haberler (17.10.2026)'] },
    market: { links: ['Cointelegraph (15.10.2026)', 'CoinGecko — HEX'] },
    'no-exchange-halt': { links: ['CoinGecko — HEX'] },
  },
};
