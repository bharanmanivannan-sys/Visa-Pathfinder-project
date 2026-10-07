export type PreliminaryStatus =
  | 'POTENTIALLY_SUITABLE'
  | 'MORE_INFORMATION_REQUIRED'
  | 'OUT_OF_SCOPE';

export type RefusalRecoveryStatus = 'MANUAL_REVIEW_REQUIRED';

export type RefusalRecoveryDecision = {
  status: RefusalRecoveryStatus;
  deadline: null;
  message: string;
};

export const supportedDestinationCountryCodes = `AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW`.split(' ');
export const inDemandSkills = [
  { name: 'Software engineer', aliases: ['software engineer', 'software developer', 'developer', 'programmer'] },
  { name: 'AI / ML engineer', aliases: ['ai engineer', 'ml engineer', 'machine learning engineer', 'artificial intelligence engineer'] },
  { name: 'Data engineer', aliases: ['data engineer', 'analytics engineer'] },
  { name: 'Cybersecurity specialist', aliases: ['cybersecurity specialist', 'cyber security specialist', 'security engineer'] },
  { name: 'Cloud engineer', aliases: ['cloud engineer', 'devops engineer', 'site reliability engineer', 'sre'] },
  { name: 'Registered nurse', aliases: ['registered nurse', 'nurse', 'rn'] },
  { name: 'Accountant', aliases: ['accountant', 'chartered accountant'] },
  { name: 'Secondary school teacher', aliases: ['secondary school teacher', 'high school teacher', 'teacher'] },
  { name: 'Civil engineer', aliases: ['civil engineer'] },
  { name: 'Mechanical engineer', aliases: ['mechanical engineer'] },
  { name: 'Electrical engineer', aliases: ['electrical engineer'] },
  { name: 'Electrical engineering technician', aliases: ['electrical engineering technician', 'electrical technician'] },
  { name: 'Renewable energy engineer', aliases: ['renewable energy engineer', 'energy engineer'] },
  { name: 'Industrial automation engineer', aliases: ['industrial automation engineer', 'automation engineer', 'controls engineer'] },
  { name: 'Chef', aliases: ['chef'] },
  { name: 'Electrician', aliases: ['electrician'] },
  { name: 'Construction project manager', aliases: ['construction project manager', 'project manager'] },
  { name: 'ICT business analyst', aliases: ['ict business analyst', 'business analyst'] },
  { name: 'Data scientist', aliases: ['data scientist'] },
];

const unsafeInputPattern = /<[^>]*>|(?:ignore|disregard)\s+(?:all\s+)?(?:previous|prior)|\b(?:select|insert|update|delete|drop|alter|truncate|union|exec(?:ute)?|declare)\b|(?:prompt|system|assistant)\s*:/i;
const occupationPattern = /^[\p{L}][\p{L}\p{N} &'()/-]{1,79}$/u;

export function sanitizePlainText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>{}`$[\]|\\;]/g, '')
    .slice(0, 80);
}

function normalizeOccupation(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findOccupationMatch(value: string) {
  const normalized = normalizeOccupation(value);
  return inDemandSkills.find((skill) => skill.aliases.some((alias) => {
    const normalizedAlias = normalizeOccupation(alias);
    return normalized === normalizedAlias
      || normalized.includes(` ${normalizedAlias} `)
      || normalized.startsWith(`${normalizedAlias} `)
      || normalized.endsWith(` ${normalizedAlias}`);
  }));
}

export function validateOccupation(value: string) {
  if (!value.trim()) return { valid: false, message: 'Enter an occupation to continue.', match: undefined };
  if (unsafeInputPattern.test(value)) return { valid: false, message: 'Use plain occupation text only. Markup, commands and prompt-style instructions are not accepted.', match: undefined };
  if (!occupationPattern.test(value)) return { valid: false, message: 'Use letters, numbers, spaces, hyphens, apostrophes, brackets or slashes only.', match: undefined };
  const match = findOccupationMatch(value);
  if (!match) return { valid: true, message: 'Occupation captured. Skills will drive the demand match; confirm the official occupation code later.', match: undefined };
  return { valid: true, message: `Matched to skills in demand: ${match.name}`, match };
}

export function validateCountrySelection(
  passport: string,
  destination: string,
  passportCountryOptions: readonly string[],
  destinationOptions: readonly string[] = passportCountryOptions,
) {
  return passportCountryOptions.includes(passport) && destinationOptions.includes(destination);
}

export function isVisitorPurpose(purpose: string) {
  const normalized = purpose.toLowerCase();
  return normalized.includes('visit') || normalized.includes('tour');
}

export function isWorkPurpose(purpose: string) {
  return purpose.trim().toLowerCase() === 'work and settle';
}

export function isStudyPurpose(purpose: string) {
  return purpose.trim().toLowerCase() === 'study';
}

export function isBusinessPurpose(purpose: string) {
  return purpose.trim().toLowerCase() === 'start a business';
}

export function getPurposePlanningRules(purpose: string) {
  const showWorkFields = isWorkPurpose(purpose);
  const showStudyFields = isStudyPurpose(purpose);
  const showBusinessFields = isBusinessPurpose(purpose);
  return {
    showWorkFields,
    showWorkPathways: showWorkFields,
    allowSkilledPlanSave: showWorkFields,
    showStudyFields,
    showBusinessFields,
    allowPlanSave: showWorkFields || showStudyFields || showBusinessFields,
  };
}

export function determinePreliminaryStatus(input: {
  destinationConfigured: boolean;
  profileComplete: boolean;
  matchedSignal: boolean;
}): PreliminaryStatus {
  if (!input.destinationConfigured) return 'OUT_OF_SCOPE';
  if (!input.profileComplete || !input.matchedSignal) return 'MORE_INFORMATION_REQUIRED';
  return 'POTENTIALLY_SUITABLE';
}

export function evaluateRefusalRecovery(input: {
  hasRefusal: boolean;
  hasCompleteEvidence: boolean;
}): RefusalRecoveryDecision | null {
  if (!input.hasRefusal) return null;
  return {
    status: 'MANUAL_REVIEW_REQUIRED',
    deadline: null,
    message: input.hasCompleteEvidence
      ? 'A refusal needs a qualified professional or official review of the decision and evidence before any next step is chosen.'
      : 'A refusal needs manual review. Gather the decision, reasons and supporting evidence before discussing any next step.',
  };
}

export function hasAuthoritativeSourceMetadata(value: {
  sourceName?: string | null;
  sourceUrl?: string | null;
  reviewedOn?: string | null;
  authority?: string | null;
}) {
  return Boolean(
    value.authority === 'official'
      && value.sourceName?.trim()
      && value.sourceUrl?.startsWith('https://')
      && value.reviewedOn?.trim(),
  );
}

export function getBusinessInvestmentRangeForCurrency(value: string, currencyCode: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('not decided')) return 'Not decided';
  if (normalized.startsWith('less than')) return `Less than ${currencyCode} 25,000`;
  if (normalized.startsWith('more than')) return `More than ${currencyCode} 500,000`;
  if (normalized.includes('100,000') && normalized.includes('500,000')) return `${currencyCode} 100,000–500,000`;
  if (normalized.includes('25,000') && normalized.includes('100,000')) return `${currencyCode} 25,000–100,000`;
  return `Less than ${currencyCode} 25,000`;
}

const destinationCurrencyGroups: Record<string, string> = {
  AFN: 'AF', ALL: 'AL', DZD: 'DZ', USD: 'AS AQ BQ IO EC SV GU MH FM PW MP PR UM VI TL TC VG US',
  EUR: 'AD AT BE CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MT MQ YT NL PT RE BL MF PM SM SI SK VA TF',
  AOA: 'AO', XCD: 'AI AG DM GD MS KN LC VC', ARS: 'AR', AMD: 'AM', AWG: 'AW', AUD: 'AU CX CC HM KI NR NF TV',
  AZN: 'AZ', BSD: 'BS', BHD: 'BH', BDT: 'BD', BBD: 'BB', BYN: 'BY', BZD: 'BZ', XOF: 'BJ BF CI GW ML NE SN TG',
  BMD: 'BM', BTN: 'BT', BOB: 'BO', BAM: 'BA', BWP: 'BW', NOK: 'BV NO SJ', BRL: 'BR', BND: 'BN', BGN: 'BG',
  BIF: 'BI', CVE: 'CV', KHR: 'KH', XAF: 'CM CF TD GQ CG GA', CAD: 'CA', KYD: 'KY', CLP: 'CL', CNY: 'CN',
  COP: 'CO', KMF: 'KM', CDF: 'CD', NZD: 'CK NZ NU PN TK', CRC: 'CR', CUP: 'CU', XCG: 'CW SX', CZK: 'CZ',
  DKK: 'DK FO GL', DJF: 'DJ', DOP: 'DO', EGP: 'EG', ERN: 'ER', ETB: 'ET',
  SZL: 'SZ', FKP: 'FK', FJD: 'FJ', GMD: 'GM', GEL: 'GE', GHS: 'GH', GIP: 'GI', GTQ: 'GT', GBP: 'GG IM JE GB GS',
  GNF: 'GN', GYD: 'GY', HTG: 'HT', HNL: 'HN', HKD: 'HK', HUF: 'HU', ISK: 'IS', INR: 'IN', IDR: 'ID', IRR: 'IR',
  IQD: 'IQ', ILS: 'IL PS', JMD: 'JM', JPY: 'JP', JOD: 'JO', KZT: 'KZ', KES: 'KE', KPW: 'KP', KRW: 'KR',
  KWD: 'KW', KGS: 'KG', LAK: 'LA', LBP: 'LB', LSL: 'LS', LRD: 'LR', LYD: 'LY', CHF: 'LI CH', MOP: 'MO',
  MGA: 'MG', MWK: 'MW', MYR: 'MY', MVR: 'MV', MRU: 'MR', MUR: 'MU', MXN: 'MX', MDL: 'MD', MNT: 'MN',
  MAD: 'MA EH', MZN: 'MZ', MMK: 'MM', NAD: 'NA', NPR: 'NP', NIO: 'NI', NGN: 'NG', MKD: 'MK', OMR: 'OM',
  PKR: 'PK', PAB: 'PA', PGK: 'PG', PYG: 'PY', PEN: 'PE', PHP: 'PH', PLN: 'PL', QAR: 'QA', RON: 'RO',
  RWF: 'RW', SHP: 'SH', WST: 'WS', STN: 'ST', SAR: 'SA', RSD: 'RS', SCR: 'SC', SLE: 'SL', SGD: 'SG',
  SBD: 'SB', SOS: 'SO', ZAR: 'ZA', SSP: 'SS', LKR: 'LK', SDG: 'SD', SRD: 'SR', SEK: 'SE', SYP: 'SY',
  TWD: 'TW', TJS: 'TJ', TZS: 'TZ', THB: 'TH', TOP: 'TO', TTD: 'TT', TND: 'TN', TRY: 'TR', TMT: 'TM',
  UGX: 'UG', UAH: 'UA', AED: 'AE', UYU: 'UY', UZS: 'UZ', VUV: 'VU', VES: 'VE', VND: 'VN', XPF: 'PF NC WF',
  YER: 'YE', ZMW: 'ZM', ZWG: 'ZW',
};

export function getDestinationCurrencyCode(countryCode: string) {
  return destinationCurrencyByCountryCode.get(countryCode.toUpperCase()) ?? null;
}

export function getBusinessInvestmentRangeOptions(currencyCode: string) {
  return [
    `Less than ${currencyCode} 25,000`,
    `${currencyCode} 25,000–100,000`,
    `${currencyCode} 100,000–500,000`,
    `More than ${currencyCode} 500,000`,
    'Not decided',
  ];
}

const destinationCurrencyByCountryCode = new Map(
  Object.entries(destinationCurrencyGroups)
    .flatMap(([currencyCode, countryCodes]) => countryCodes.split(' ').filter(Boolean).map((countryCode) => [countryCode, currencyCode] as const)),
);
