import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCreateAlertSubscription,
  useCreateSavedPlan,
  getGetSavedPlanQueryKey,
  getListSavedPlansQueryKey,
  useListChanges,
  useListGuidance,
  useListSavedPlans,
  useGetSavedPlan,
  useUpdateSavedPlan,
  type AlertSubscriptionInput,
  type GuidanceItem,
  type RegulationChange,
  type SavedPlan,
  type SavedPlanComparisonItem,
  type SavedPlanCostAssumptions,
  type SavedPlanDocument,
  type SavedPlanInput,
} from '@workspace/api-client-react';
import {
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  Bell,
  Banknote,
  BarChart3,
  BookMarked,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Compass,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Flag,
  Globe2,
  GraduationCap,
  HeartPulse,
  House,
  Info,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RadioTower,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
  Waypoints,
  X,
} from 'lucide-react';
import {
  determinePreliminaryStatus,
  getBusinessInvestmentRangeForCurrency,
  getBusinessInvestmentRangeOptions,
  getDestinationCurrencyCode,
  getPurposePlanningRules,
  inDemandSkills,
  isVisitorPurpose,
  isWorkPurpose,
  sanitizePlainText,
  supportedDestinationCountryCodes,
  validateCountrySelection,
  validateOccupation,
} from './lib/pathfinder-safety';
import { getDisplayableJobMarketRecords } from './lib/job-market-safety';
import { VisaResourceList, VisitorVisaOptionsSection } from './components/VisaResourceSections';
type PathfinderForm = {
  passport: string;
  destination: string;
  purpose: string;
  courseLevel: string;
  institutionStatus: string;
  studyFunding: string;
  businessStage: string;
  investmentRange: string;
  businessIntent: string;
  age: string;
  occupation: string;
  skills: string[];
  experience: string;
  workMode: string;
  education: string;
  english: string;
  funds: string;
  family: string;
};

const defaultForm: PathfinderForm = {
  passport: 'India',
  destination: 'Australia',
  purpose: 'Work and settle',
  courseLevel: 'Postgraduate coursework',
  institutionStatus: 'Still researching institutions',
  studyFunding: 'Personal or family funds',
  businessStage: 'Exploring an idea',
  investmentRange: 'Less than AUD 25,000',
  businessIntent: 'Own and actively operate',
  age: '29',
  occupation: 'Electrical engineer',
  skills: ['Power systems', 'AutoCAD', 'PLC programming'],
  experience: '5–10 years',
  workMode: 'Open to relocate or work remotely',
  education: "Bachelor's degree",
  english: 'Proficient (IELTS 7+)',
  funds: 'AUD 35,000',
  family: 'Partner, no children',
};

const studyCourseLevelOptions = ['Vocational or technical', 'Undergraduate', 'Postgraduate coursework', 'Research degree', 'Language or other course'];
const studyInstitutionStatusOptions = ['Still researching institutions', 'Applied and awaiting a decision', 'Offer received', 'Already enrolled'];
const studyFundingOptions = ['Personal or family funds', 'Scholarship', 'Education loan', 'Sponsor', 'Still arranging funding'];
const businessStageOptions = ['Exploring an idea', 'Business plan drafted', 'Registered but not operating', 'Already operating', 'Looking to acquire a business'];
const businessIntentOptions = ['Own and actively operate', 'Co-own and operate', 'Acquire and operate', 'Invest without day-to-day operation', 'Still deciding'];

function purposeEvidenceRows(form: PathfinderForm) {
  if (form.purpose === 'Study') {
    return [
      { label: 'Course level', value: form.courseLevel },
      { label: 'Institution or offer status', value: form.institutionStatus },
      { label: 'Study funding', value: form.studyFunding },
    ];
  }
  if (form.purpose === 'Start a business') {
    return [
      { label: 'Business stage', value: form.businessStage },
      { label: 'Investment range', value: form.investmentRange },
      { label: 'Ownership or operating intent', value: form.businessIntent },
    ];
  }
  if (form.purpose === 'Work and settle') {
    return [
      { label: 'Occupation', value: form.occupation },
      { label: 'Relevant experience', value: form.experience },
      { label: 'Work location preference', value: form.workMode },
      { label: 'Skills', value: form.skills.join(', ').slice(0, 120) || 'Not added' },
    ];
  }
  return [];
}

type PathfinderSnapshot = {
  form: PathfinderForm;
  hasSubmitted: boolean;
};

type PathfinderContextValue = PathfinderSnapshot & {
  commitForm: (form: PathfinderForm) => void;
};

const pathfinderStorageKey = 'visa-pathfinder-context-v1';
const PathfinderContext = createContext<PathfinderContextValue | null>(null);

function readPathfinderSnapshot(): PathfinderSnapshot {
  if (typeof window === 'undefined') return { form: defaultForm, hasSubmitted: false };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pathfinderStorageKey) ?? 'null') as Partial<PathfinderSnapshot> | null;
    if (!parsed?.form || typeof parsed.form.destination !== 'string') return { form: defaultForm, hasSubmitted: false };
    const restoredForm = {
      ...defaultForm,
      ...parsed.form,
      skills: Array.isArray(parsed.form.skills) ? parsed.form.skills.filter((skill): skill is string => typeof skill === 'string').slice(0, 12) : defaultForm.skills,
    };
    const currencyCode = getCurrencyCodeForDestination(restoredForm.destination);
    if (currencyCode) {
      restoredForm.investmentRange = getBusinessInvestmentRangeForCurrency(restoredForm.investmentRange, currencyCode);
    }
    return {
      form: restoredForm,
      hasSubmitted: Boolean(parsed.hasSubmitted),
    };
  } catch {
    return { form: defaultForm, hasSubmitted: false };
  }
}

function PathfinderProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<PathfinderSnapshot>(() => {
    const saved = readPathfinderSnapshot();
    if (maintainedDestinations.includes(saved.form.destination)) return saved;
    return {
      form: {
        ...saved.form,
        destination: defaultForm.destination,
        investmentRange: getBusinessInvestmentRangeForCurrency(saved.form.investmentRange, 'AUD'),
      },
      hasSubmitted: false,
    };
  });
  useEffect(() => {
    window.localStorage.setItem(pathfinderStorageKey, JSON.stringify(snapshot));
  }, [snapshot]);
  const commitForm = (form: PathfinderForm) => setSnapshot({ form: { ...form, skills: [...form.skills] }, hasSubmitted: true });
  return <PathfinderContext.Provider value={{ ...snapshot, commitForm }}>{children}</PathfinderContext.Provider>;
}

function usePathfinderContext() {
  const context = useContext(PathfinderContext);
  if (!context) throw new Error('usePathfinderContext must be used inside PathfinderProvider');
  return context;
}

const countryCodes = supportedDestinationCountryCodes;
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryCodeByName = new Map<string, string>();
for (const code of countryCodes) {
  const countryName = displayNames.of(code);
  if (countryName) countryCodeByName.set(countryName, code);
}
const countryOptions = countryCodes
  .map((code) => displayNames.of(code))
  .filter((name): name is string => Boolean(name))
  .sort((a, b) => a.localeCompare(b));

function getCurrencyCodeForDestination(destination: string) {
  const countryCode = countryCodeByName.get(destination);
  return countryCode ? getDestinationCurrencyCode(countryCode) : null;
}

type GlobalPathway = {
  id: string;
  country: string;
  name: string;
  routeType: string;
  summary: string;
  occupationTags: string[];
  skillTags: string[];
  workModes: string[];
  gateways: string[];
  marketExamples: Array<{ place: string; roles: string; sourceName: string; sourceUrl: string }>;
  remoteCaveat: string;
  evidenceGaps: string[];
  sourceName: string;
  sourceUrl: string;
  reviewedOn: string;
  authority: 'official' | 'community';
};

export const globalPathways: GlobalPathway[] = [
  {
    id: 'czechia-employee-card',
    country: 'Czechia',
    name: 'Employee Card',
    routeType: 'Employer-linked work residence',
    summary: 'A long-term residence permit for third-country nationals whose Czech job and employer meet the current Employee Card conditions.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'technician', 'support'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis', 'cybersecurity', 'technical support'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Czech employment offer', 'Eligible vacancy and employer conditions', 'Long-term residence application', 'Current documents and consular process'],
    marketExamples: [
      { place: 'Prague', roles: 'Software, cybersecurity, shared services, engineering and technical support employers', sourceName: 'Jobs.cz · English job search', sourceUrl: 'https://www.jobs.cz/en' },
      { place: 'Brno and Ostrava', roles: 'Industrial automation, manufacturing, engineering, technology and research employers', sourceName: 'EURES · Czechia vacancies', sourceUrl: 'https://eures.europa.eu/index_en' },
    ],
    remoteCaveat: 'An overseas remote job does not automatically give Czech residence or work permission. Check where the work is physically performed, employer registration, payroll, tax and social insurance.',
    evidenceGaps: ['Czech employment offer', 'Vacancy and employer details', 'Residence application documents', 'Current consular availability'],
    sourceName: 'Czech Ministry of the Interior · Employee Card',
    sourceUrl: 'https://ipc.gov.cz/en/visa-and-residence-permit-types/third-country-nationals/long-term-residence-permits/employee-card/',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'germany-eu-blue-card',
    country: 'Germany',
    name: 'EU Blue Card',
    routeType: 'Employer-sponsored skilled work',
    summary: 'A job-first route for qualified professionals with a qualifying German employment offer and salary threshold.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Qualifying German job offer', 'Recognised or comparable qualification', 'Current salary threshold and conditions'],
    marketExamples: [{ place: 'Berlin, Munich, Hamburg and Stuttgart', roles: 'Industrial automation, energy systems, software and manufacturing engineering', sourceName: 'Make it in Germany · job listings', sourceUrl: 'https://www.make-it-in-germany.com/en/working-in-germany/job-listings' }],
    remoteCaveat: 'A remote job with a foreign employer does not automatically grant residence or German work rights. Check payroll, tax, social insurance and the exact residence route.',
    evidenceGaps: ['German employment offer and contract', 'Qualification comparability', 'Current salary threshold'],
    sourceName: 'Make it in Germany · official portal',
    sourceUrl: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'canada-express-entry',
    country: 'Canada',
    name: 'Express Entry',
    routeType: 'Points-based permanent residence',
    summary: 'A profile-and-invitation route where language, skilled work history, education, age and other configured factors are assessed together.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'accountant'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work'],
    gateways: ['Eligible economic class', 'Language test', 'Education assessment where required', 'Invitation under the active round'],
    marketExamples: [{ place: 'Ontario, Alberta, British Columbia and Quebec', roles: 'Power, infrastructure, software, data and clean-energy employers', sourceName: 'Government of Canada · Job Bank', sourceUrl: 'https://www.jobbank.gc.ca/findajob' }],
    remoteCaveat: 'Remote work can support experience or a job search, but it is not itself a Canadian immigration status. The residence route and work location still need separate checking.',
    evidenceGaps: ['Language result', 'Education credential assessment', 'Complete skilled work history', 'Current invitation rules'],
    sourceName: 'Government of Canada · Express Entry',
    sourceUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'uk-skilled-worker',
    country: 'United Kingdom',
    name: 'Skilled Worker visa',
    routeType: 'Employer-sponsored skilled work',
    summary: 'An employer-led route that depends on a licensed sponsor, an eligible role and the current salary and language rules.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'nurse'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Approved UK sponsor', 'Certificate of sponsorship', 'Eligible occupation code', 'Salary and English requirements'],
    marketExamples: [{ place: 'London, Manchester, Birmingham and Cambridge', roles: 'Technology, energy, infrastructure and health employers', sourceName: 'GOV.UK · Find a job', sourceUrl: 'https://findajob.dwp.gov.uk/' }],
    remoteCaveat: 'A UK employer may have its own remote-work policy, but remote work from another country can create immigration, payroll and tax obligations outside the visa permission.',
    evidenceGaps: ['Sponsor and role confirmation', 'Occupation code', 'Salary package', 'English evidence'],
    sourceName: 'GOV.UK · Skilled Worker visa',
    sourceUrl: 'https://www.gov.uk/skilled-worker-visa',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'ireland-critical-skills',
    country: 'Ireland',
    name: 'Critical Skills Employment Permit',
    routeType: 'Critical-skills employment',
    summary: 'A job-offer route for listed occupations and salary bands, with the exact role and employer forming the main gateway.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Eligible occupation', 'Eligible Irish employment offer', 'Current salary and permit conditions'],
    marketExamples: [{ place: 'Dublin, Cork, Galway and Limerick', roles: 'Medtech, software, energy, manufacturing and engineering employers', sourceName: 'JobsIreland · public employment service', sourceUrl: 'https://www.jobsireland.ie/' }],
    remoteCaveat: 'Remote work for an Irish employer is not a substitute for the permit conditions. Confirm where the work is physically performed and how tax and payroll are handled.',
    evidenceGaps: ['Signed employment offer', 'Occupation-list match', 'Salary and employer details'],
    sourceName: 'Ireland Department of Enterprise · Critical Skills',
    sourceUrl: 'https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/permit-types/critical-skills-employment-permit/',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'netherlands-highly-skilled-migrant',
    country: 'Netherlands',
    name: 'Highly skilled migrant residence permit',
    routeType: 'Recognised-sponsor employment',
    summary: 'A recognised-employer route where the sponsor, role, salary and personal conditions need to be checked together.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Recognised sponsor', 'Employment contract', 'Current salary threshold and conditions'],
    marketExamples: [{ place: 'Amsterdam, Eindhoven, Rotterdam and Utrecht', roles: 'Semiconductors, high-tech systems, energy and software employers', sourceName: 'EURES · European public employment network', sourceUrl: 'https://eures.europa.eu/index_en' }],
    remoteCaveat: 'A remote arrangement can change the country where work is legally performed. Verify residence, payroll, tax and social-security consequences before relying on it.',
    evidenceGaps: ['Recognised sponsor', 'Employment contract', 'Current salary threshold'],
    sourceName: 'Dutch Immigration and Naturalisation Service',
    sourceUrl: 'https://ind.nl/en/residence-permits/work/highly-skilled-migrant',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'new-zealand-aewv',
    country: 'New Zealand',
    name: 'Accredited Employer Work Visa',
    routeType: 'Accredited-employer work',
    summary: 'A job-led work route based on an offer from an accredited employer and the current role, skills and market-check requirements.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'nurse', 'chef', 'construction'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Accredited employer', 'Job offer', 'Role and skill requirements', 'Health and character checks'],
    marketExamples: [{ place: 'Auckland, Wellington, Christchurch and Hamilton', roles: 'Infrastructure, construction, energy, software and manufacturing employers', sourceName: 'New Zealand Government · careers', sourceUrl: 'https://www.careers.govt.nz/' }],
    remoteCaveat: 'Remote work from outside New Zealand does not automatically satisfy an employer-sponsored work route. The physical work location and employer obligations matter.',
    evidenceGaps: ['Accredited employer and offer', 'Role requirements', 'Health and character evidence'],
    sourceName: 'Immigration New Zealand · AEWV',
    sourceUrl: 'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/accredited-employer-work-visa',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'singapore-employment-pass',
    country: 'Singapore',
    name: 'Employment Pass',
    routeType: 'Professional employment',
    summary: 'An employer-applied route for professionals, managers, executives and technicians subject to current salary, role and assessment conditions.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'accountant'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Singapore employer application', 'Current salary and role conditions', 'Employer fair-consideration requirements where applicable'],
    marketExamples: [{ place: 'Central Singapore, Jurong and one-north', roles: 'Advanced manufacturing, semiconductors, energy, logistics and technology employers', sourceName: 'MyCareersFuture · public jobs portal', sourceUrl: 'https://www.mycareersfuture.gov.sg/' }],
    remoteCaveat: 'An Employment Pass is tied to employment in Singapore. Working remotely from another country can have separate immigration and tax consequences.',
    evidenceGaps: ['Employer and role', 'Salary details', 'Current eligibility assessment'],
    sourceName: 'Singapore Ministry of Manpower',
    sourceUrl: 'https://www.mom.gov.sg/passes-and-permits/employment-pass',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'portugal-digital-nomad',
    country: 'Portugal',
    name: 'Remote work residence route',
    routeType: 'Remote-work residence',
    summary: 'A residence route for people performing remote work, subject to current income, residence and documentary conditions.',
    occupationTags: ['software', 'data', 'cloud', 'ai', 'designer', 'consultant', 'engineer', 'electrical engineer'],
    skillTags: ['python', 'java', 'cloud', 'ai/ml', 'data analysis', 'project management', 'consulting'],
    workModes: ['Work remotely from current country', 'Relocate while working remotely'],
    gateways: ['Qualifying remote employment or service relationship', 'Income evidence', 'Accommodation and identity evidence', 'Current consular requirements'],
    marketExamples: [{ place: 'Lisbon, Porto, Braga and Madeira', roles: 'Remote software, data, design, consulting and international-services work', sourceName: 'ePortugal · government services', sourceUrl: 'https://eportugal.gov.pt/en/servicos/obter-um-visto-de-residencia-para-o-exercicio-de-atividade-profissional-prestada-de-forma-remota' }],
    remoteCaveat: 'This is not a general permission to work for any employer in any country. Check employer approval, tax residence, social insurance, local registration and the current consular process.',
    evidenceGaps: ['Remote employment or client contracts', 'Income history', 'Accommodation evidence', 'Tax and payroll position'],
    sourceName: 'ePortugal · government services',
    sourceUrl: 'https://eportugal.gov.pt/en/servicos/obter-um-visto-de-residencia-para-o-exercicio-de-atividade-profissional-prestada-de-forma-remota',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'austria-red-white-red-card',
    country: 'Austria',
    name: 'Red-White-Red Card',
    routeType: 'Points-based skilled work residence',
    summary: 'A residence route for qualified third-country workers that can depend on shortage occupation, qualification, salary, job offer and points conditions.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'nurse', 'chef'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Qualifying Austrian job offer where required', 'Recognised qualification or shortage occupation', 'Current points and salary conditions', 'Residence application and insurance evidence'],
    marketExamples: [{ place: 'Vienna, Graz, Linz and Salzburg', roles: 'Engineering, advanced manufacturing, software, energy and technical services', sourceName: 'EURES · European public employment network', sourceUrl: 'https://eures.europa.eu/index_en' }],
    remoteCaveat: 'Working remotely for an overseas employer does not automatically grant Austrian residence or work permission. Check the physical work location, employer obligations, tax and social insurance.',
    evidenceGaps: ['Qualification recognition', 'Job offer and salary', 'Shortage occupation or points route', 'Current consular process'],
    sourceName: 'Migration.gv.at · Red-White-Red Card',
    sourceUrl: 'https://www.migration.gv.at/en/types-of-immigration/permanent-immigration/',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'belgium-single-permit',
    country: 'Belgium',
    name: 'Single Permit',
    routeType: 'Employer-led work and residence permit',
    summary: 'A combined work and residence route where the competent region and employer handle the applicable permit process for a non-EU worker.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'nurse', 'chef'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Belgian employer application', 'Regional work authorisation', 'Employment and salary conditions', 'Residence and identity evidence'],
    marketExamples: [{ place: 'Brussels, Antwerp, Ghent and Leuven', roles: 'Engineering, technology, logistics, chemicals and life-sciences employers', sourceName: 'Working in Belgium · official portal', sourceUrl: 'https://onestopcounter.workinginbelgium.be/en/fixed-term-single-permit.html' }],
    remoteCaveat: 'A foreign remote job is not a substitute for Belgian work authorisation. Confirm where the work is physically performed and the employer’s payroll, tax and social-security position.',
    evidenceGaps: ['Competent region', 'Employer application', 'Work authorisation conditions', 'Residence evidence'],
    sourceName: 'Working in Belgium · Single Permit',
    sourceUrl: 'https://onestopcounter.workinginbelgium.be/en/fixed-term-single-permit.html',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'finland-specialist',
    country: 'Finland',
    name: 'Residence permit for a specialist',
    routeType: 'Specialist employment residence',
    summary: 'A specialist route for people working in expert duties in Finland, subject to current salary, qualification, employer and application conditions.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'accountant'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Finnish employment contract', 'Specialist duties and salary', 'Identity and qualification evidence', 'Current residence permit process'],
    marketExamples: [{ place: 'Helsinki, Espoo, Tampere and Oulu', roles: 'Software, telecoms, clean technology, engineering and research employers', sourceName: 'Work in Finland · official service', sourceUrl: 'https://www.workinfinland.com/en/open-jobs/' }],
    remoteCaveat: 'Remote work from another country can change immigration, tax and social-insurance treatment. A Finnish employment relationship does not itself grant the right to reside or work outside the approved route.',
    evidenceGaps: ['Employment contract', 'Specialist role and salary', 'Qualification evidence', 'Residence permit appointment'],
    sourceName: 'Finnish Immigration Service · Specialist',
    sourceUrl: 'https://migri.fi/en/specialist',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'france-talent-passport',
    country: 'France',
    name: 'Talent Passport',
    routeType: 'Qualified work and talent residence',
    summary: 'A family of residence routes for qualifying employees, entrepreneurs, researchers and other talent profiles, with the exact subcategory and evidence determining the route.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'researcher', 'designer'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis', 'project management'],
    workModes: ['Relocate for work', 'Employer sponsorship', 'Work remotely from current country'],
    gateways: ['Correct Talent Passport category', 'Employment, research or business evidence', 'Current salary or investment condition', 'Residence and family documentation'],
    marketExamples: [{ place: 'Paris, Lyon, Toulouse and Grenoble', roles: 'Aerospace, software, engineering, research, energy and design employers', sourceName: 'France Travail · official employment service', sourceUrl: 'https://www.francetravail.fr/candidat/recherche-emploi.html' }],
    remoteCaveat: 'A remote-work arrangement needs its own immigration and tax analysis; the Talent Passport is not a blanket permission to work for any overseas employer from France.',
    evidenceGaps: ['Talent Passport category', 'Contract or project evidence', 'Salary or funding threshold', 'French consular process'],
    sourceName: 'France-Visas · Talent Passport',
    sourceUrl: 'https://france-visas.gouv.fr/en/web/france-visas/talents-internationaux-et-attractivite-economique',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'japan-engineer-specialist',
    country: 'Japan',
    name: 'Engineer / Specialist in Humanities / International Services',
    routeType: 'Employer-linked professional status of residence',
    summary: 'A professional work status for qualifying activities in engineering, technology, humanities or international services, tied to the role, employer and supporting qualifications.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'accountant', 'designer'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Japanese employment offer', 'Role within the status categories', 'Relevant education or experience', 'Certificate of Eligibility and residence process'],
    marketExamples: [{ place: 'Tokyo, Osaka, Nagoya and Fukuoka', roles: 'Software, electronics, mobility, manufacturing and international-services employers', sourceName: 'Hello Work · Japanese public employment service', sourceUrl: 'https://www.hellowork.mhlw.go.jp/' }],
    remoteCaveat: 'A foreign remote job does not automatically support this Japanese status of residence. Confirm the actual Japanese employer, work activity, location, tax and social-insurance obligations.',
    evidenceGaps: ['Japanese employment contract', 'Activity-category match', 'Qualification or experience evidence', 'Certificate of Eligibility'],
    sourceName: 'Immigration Services Agency of Japan · Work statuses',
    sourceUrl: 'https://www.moj.go.jp/isa/applications/status/gijinkoku.html?hl=en&lang=en',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'norway-skilled-worker',
    country: 'Norway',
    name: 'Skilled worker residence permit',
    routeType: 'Skilled employment residence',
    summary: 'A work residence route for a skilled worker with a concrete offer and duties that require the applicant’s qualifications, subject to current Norwegian conditions.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'nurse', 'chef', 'construction'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Concrete Norwegian job offer', 'Skilled qualification or vocational training', 'Role and salary conditions', 'Residence application and identity evidence'],
    marketExamples: [{ place: 'Oslo, Bergen, Stavanger and Trondheim', roles: 'Energy, maritime, construction, software and engineering employers', sourceName: 'NAV · Norwegian Labour and Welfare Administration', sourceUrl: 'https://arbeidsplassen.nav.no/stillinger' }],
    remoteCaveat: 'A remote role with a foreign employer is not itself a Norwegian residence or work permit. Physical work location, tax residence and social insurance must be checked separately.',
    evidenceGaps: ['Job offer and duties', 'Qualification recognition', 'Salary and employment conditions', 'Police or identity documents where requested'],
    sourceName: 'UDI · Skilled workers',
    sourceUrl: 'https://www.udi.no/en/want-to-apply/work-immigration/skilled-workers?c=nor',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'spain-international-teleworker',
    country: 'Spain',
    name: 'International teleworker residence',
    routeType: 'Remote-work residence',
    summary: 'A residence route for people working remotely for companies or clients outside Spain, subject to current income, relationship, qualification and documentary conditions.',
    occupationTags: ['software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'designer', 'consultant', 'engineer', 'electrical engineer'],
    skillTags: ['python', 'java', 'cloud', 'ai/ml', 'data analysis', 'project management', 'consulting'],
    workModes: ['Work remotely from current country', 'Relocate while working remotely'],
    gateways: ['Qualifying remote employment or professional relationship', 'Income and contract evidence', 'Health insurance and identity evidence', 'Current consular or in-country process'],
    marketExamples: [{ place: 'Madrid, Barcelona, Valencia and Málaga', roles: 'Remote software, design, consulting, digital services and international teams', sourceName: 'EURES · European public employment network', sourceUrl: 'https://eures.europa.eu/index_en' }],
    remoteCaveat: 'This route is specifically remote-work based but does not remove tax, social-security, employer-consent or local-registration obligations. Confirm the current income and relationship rules.',
    evidenceGaps: ['Remote contract or client relationship', 'Income history', 'Health coverage', 'Current application channel'],
    sourceName: 'Spanish Ministry of Inclusion · International teleworkers',
    sourceUrl: 'https://www.inclusion.gob.es/en/web/unidadgrandesempresas/teletrabajadores',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
  {
    id: 'sweden-work-permit',
    country: 'Sweden',
    name: 'Work permit',
    routeType: 'Employer-offered work residence',
    summary: 'A work permit route based on an offer from a Swedish employer, with current salary, insurance, terms of employment and advertising requirements to verify.',
    occupationTags: ['engineer', 'electrical engineer', 'software', 'data', 'cloud', 'ai', 'machine learning', 'cybersecurity', 'nurse', 'chef'],
    skillTags: ['power systems', 'plc programming', 'industrial automation', 'autocad', 'renewable energy', 'python', 'java', 'cloud', 'ai/ml', 'data analysis'],
    workModes: ['Relocate for work', 'Employer sponsorship'],
    gateways: ['Swedish employment offer', 'Terms at least matching applicable conditions', 'Employer insurance and recruitment process', 'Current permit application'],
    marketExamples: [{ place: 'Stockholm, Gothenburg, Malmö and Västerås', roles: 'Software, automotive, green industry, energy and engineering employers', sourceName: 'Arbetsförmedlingen · official employment service', sourceUrl: 'https://arbetsformedlingen.se/platsbanken' }],
    remoteCaveat: 'A foreign remote arrangement does not automatically provide Swedish work rights. Confirm the Swedish employer, physical work location, insurance, tax and social-security treatment.',
    evidenceGaps: ['Employer offer and terms', 'Insurance evidence', 'Role and salary checks', 'Current application and biometrics'],
    sourceName: 'Swedish Migration Agency · Work permit',
    sourceUrl: 'https://www.migrationsverket.se/en/you-want-to-apply/work/employee-or-self-employed/employees.html',
    reviewedOn: '2026-09-18',
    authority: 'official',
  },
];

const maintainedDestinations = ['Australia', ...globalPathways.map((pathway) => pathway.country)]
  .filter((country, index, all) => all.indexOf(country) === index)
  .sort((a, b) => a.localeCompare(b));

const maintainedDestinationSummary = maintainedDestinations.length <= 2
  ? maintainedDestinations.join(' and ')
  : `${maintainedDestinations.slice(0, -1).join(', ')}, and ${maintainedDestinations.at(-1)}`;
function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function rankGlobalPathways(form: PathfinderForm) {
  if (!isWorkPurpose(form.purpose)) return [];
  const occupation = normalizeSearchText(form.occupation);
  const skills = form.skills.map(normalizeSearchText);
  return globalPathways
    .filter((pathway) => pathway.country === form.destination)
    .map((pathway) => {
      const matchedSkills = pathway.skillTags.filter((tag) => skills.some((skill) => normalizeSearchText(tag).includes(skill) || skill.includes(normalizeSearchText(tag))));
      const matchedOccupation = pathway.occupationTags.find((tag) => occupation.includes(normalizeSearchText(tag)) || normalizeSearchText(tag).includes(occupation));
      const modePreference = form.workMode.toLowerCase();
      const remoteOnly = modePreference.includes('remotely from current');
      const relocateOnly = modePreference.includes('relocate for work') && !modePreference.includes('open to');
      const modeMatch = !remoteOnly && !relocateOnly
        ? true
        : pathway.workModes.some((mode) => remoteOnly ? mode.toLowerCase().includes('remote') : mode.toLowerCase().includes('relocate'));
       const profileComplete = Boolean(form.occupation.trim()) && form.skills.length > 0;
       const score = Math.min(96, 48 + matchedSkills.length * 9 + (matchedOccupation ? 17 : 0) + (modeMatch ? 8 : 0) + (form.experience.includes('5') || form.experience.includes('10') ? 5 : 0));
      return {
        pathway,
        score,
        matchedSkills,
        matchedOccupation,
        modeMatch,
         status: determinePreliminaryStatus({
           destinationConfigured: true,
           profileComplete,
           matchedSignal: matchedSkills.length > 0 || Boolean(matchedOccupation),
         }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const navItems = [
  { href: '/', label: 'Pathfinder', icon: Compass, end: true },
  { href: '/workspace', label: 'My workspace', icon: LayoutDashboard },
  { href: '/compare', label: 'Compare visas', icon: ArrowDownUp },
  { href: '/roadmaps', label: 'Roadmaps', icon: Waypoints },
  { href: '/resources', label: 'Resources', icon: BookOpen },
  { href: '/professionals', label: 'Professionals', icon: UserRound },
  { href: '/costs', label: 'Cost planner', icon: Calculator },
  { href: '/scam-check', label: 'Scam check', icon: ShieldCheck },
  { href: '/setup', label: 'Setup guidance', icon: Building2 },
];

const resources = [
  { id: 'r1', type: 'Official', icon: Landmark, title: 'Skilled migration points calculator', desc: 'Check how age, English, experience and education contribute to your indicative points.', source: 'Department of Home Affairs', time: '10 min', color: 'lime' },
  { id: 'r2', type: 'Official', icon: FileCheck2, title: 'Skills assessment starter list', desc: 'A practical document checklist for technology occupations and ACS assessment preparation.', source: 'ACS · official body', time: '12 min', color: 'aqua' },
  { id: 'r3', type: 'Community', icon: MessageCircle, title: 'What I wish I knew before lodging', desc: 'First-hand notes from people who documented their own skilled visa process.', source: 'Pathfinder community', time: '8 min', color: 'coral' },
  { id: 'r4', type: 'Official', icon: FileText, title: 'Health examinations explained', desc: 'When medical checks happen, who can perform them and what to bring.', source: 'Department of Home Affairs', time: '6 min', color: 'sand' },
  { id: 'r5', type: 'Template', icon: BookMarked, title: 'Employment evidence pack', desc: 'A clean index for reference letters, payslips and project evidence.', source: 'Pathfinder template', time: '15 min', color: 'aqua' },
  { id: 'r6', type: 'Community', icon: MoreHorizontal, title: 'State nomination watchlist', desc: 'A plain-language digest of what applicants are seeing across the states.', source: 'Community notes · updated monthly', time: '5 min', color: 'lime' },
];

type ContextResource = {
  id: string;
  title: string;
  desc: string;
  source: string;
  sourceUrl?: string;
  type: 'Official' | 'Template' | 'Community';
  time: string;
  color: 'lime' | 'aqua' | 'coral' | 'sand';
  icon: typeof FileCheck2;
};

const universalDocumentResources: Omit<ContextResource, 'source' | 'sourceUrl'>[] = [
  { id: 'doc-identity', type: 'Template', icon: FileCheck2, title: 'Identity document checklist', desc: 'Prepare a clear passport bio page, previous identity documents where requested, name-change evidence and complete pages. Match the destination authority’s validity and scan rules.', time: 'Checklist', color: 'aqua' },
  { id: 'doc-photo', type: 'Template', icon: UserRound, title: 'Passport photo reference', desc: 'A recent photo usually has strict size, background, lighting, expression and head-position rules. Do not reuse a generic passport photo without checking the destination specification.', time: 'Reference', color: 'lime' },
  { id: 'doc-health', type: 'Official', icon: HeartPulse, title: 'Health examination guide', desc: 'Learn when a medical exam, chest X-ray or panel-physician appointment may be required, what results mean and how long the evidence remains usable.', time: 'Guide', color: 'coral' },
  { id: 'doc-character', type: 'Official', icon: ShieldCheck, title: 'Character and police certificate guide', desc: 'Check whether police clearance certificates are needed from countries where you lived, the acceptable issuing authority, name variations and certificate validity.', time: 'Guide', color: 'sand' },
  { id: 'doc-translation', type: 'Template', icon: FileText, title: 'Translation and certification checklist', desc: 'Track which documents need certified translation, notarisation, legalisation or an apostille. Keep the original and translated copy together.', time: 'Checklist', color: 'aqua' },
  { id: 'doc-upload', type: 'Template', icon: BookMarked, title: 'Application upload index', desc: 'A file-by-file index for passports, photos, forms, health, police checks, funds, employment and relationship evidence. Use the official portal’s file limits first.', time: 'Template', color: 'lime' },
];

const visitorResources: ContextResource[] = [
  { id: 'visitor-itinerary', icon: MapPin, title: 'Visitor itinerary and accommodation pack', desc: 'A simple way to organise travel dates, accommodation, invitations, return plans and who will pay for the trip. Requirements vary by destination.', source: 'Pathfinder template · verify with destination authority', type: 'Template', time: 'Template', color: 'aqua' },
  { id: 'visitor-funds', icon: WalletCards, title: 'Visitor funds and return-ties reference', desc: 'Organise evidence of how the visit will be funded and your reasons for returning, without treating any amount or document as a universal requirement.', source: 'Pathfinder planning reference', type: 'Template', time: 'Guide', color: 'sand' },
];

const professionals = [
  { id: 'p1', initials: 'HC', name: 'Harbour & Co Migration', city: 'Melbourne · nationwide', fee: '$1,650', response: 'Usually within 1 business day', cases: '1,240 cases', success: '4.8 / 5 client rating', specialties: ['Skilled', 'Employer'], verified: true },
  { id: 'p2', initials: 'NS', name: 'North Star Legal', city: 'Sydney · video consults', fee: '$1,850', response: 'Usually within 2 business days', cases: '860 cases', success: '4.9 / 5 client rating', specialties: ['Skilled', 'Partner'], verified: true },
  { id: 'p3', initials: 'P', name: 'Pivot Migration Law', city: 'Brisbane · nationwide', fee: '$2,100', response: 'Usually within 2 business days', cases: '512 cases', success: '4.7 / 5 client rating', specialties: ['Employer', 'Appeals'], verified: true },
  { id: 'p4', initials: 'CW', name: 'Clearway Visa Advice', city: 'Perth · video consults', fee: '$2,450', response: 'Usually within 3 business days', cases: '334 cases', success: '4.6 / 5 client rating', specialties: ['Skilled', 'Student'], verified: true },
];

const roadmapSteps = [
  { id: 1, title: 'Confirm your occupation', status: 'Start here', duration: '1–2 hours', cost: '$0', risk: 'Medium', docs: ['Passport bio page', 'Current CV', 'Occupation description'], body: 'Your occupation code is the hinge point for every skilled pathway. Compare your actual day-to-day work with the official description, not just your job title.' },
  { id: 2, title: 'Prepare your English test', status: 'Next up', duration: '2–6 weeks', cost: '$410–$490', risk: 'Low', docs: ['Passport', 'Test booking', 'Score report'], body: 'A stronger score can move your points and widen the invitation pool. Book a recognised test and keep the score report for your expression of interest.' },
  { id: 3, title: 'Request a skills assessment', status: 'Evidence-heavy', duration: '8–12 weeks', cost: '$1,330', risk: 'High', docs: ['Degree certificate', 'Academic transcript', 'Employer references', 'Payslips'], body: 'The assessing authority checks whether your qualification and employment history match the nominated occupation. This is where tidy evidence pays off.' },
  { id: 4, title: 'Submit an expression of interest', status: 'Decision point', duration: '1 day', cost: '$0', risk: 'Medium', docs: ['Skills outcome', 'English result', 'Work history', 'EOI details'], body: 'An EOI is not a visa application. It places your profile in the invitation pool and can be updated if your circumstances change.' },
  { id: 5, title: 'Apply after invitation', status: 'Lodge', duration: '60 days', cost: '$4,765', risk: 'High', docs: ['Identity documents', 'Police checks', 'Health checks', 'Complete evidence pack'], body: 'You generally have a limited window after an invitation. Use the time to order police certificates and assemble a consistent, traceable evidence pack.' },
];

const setupItems = [
  { id: 'tax', label: 'Tax file number', icon: Landmark, summary: 'Apply for a TFN after you have work rights. It is free through the Australian Taxation Office.', source: 'ATO · official', done: false },
  { id: 'health', label: 'Medicare and healthcare', icon: HeartPulse, summary: 'Check reciprocal agreements and your visa conditions before assuming Medicare access.', source: 'Services Australia · official', done: false },
  { id: 'bank', label: 'Banking basics', icon: Banknote, summary: 'Compare everyday accounts, card fees and the ID required to open an account.', source: 'Community guide', done: false },
  { id: 'home', label: 'Renting a home', icon: House, summary: 'Learn the rental application documents, bond rules and inspection rhythm in your state.', source: 'State tenancy bodies · official', done: false },
  { id: 'school', label: 'Schools and childcare', icon: GraduationCap, summary: 'School enrolment rules vary by state. Start with your local education department.', source: 'State education departments · official', done: false },
  { id: 'drive', label: 'Driving licence', icon: CarFront, summary: 'Your overseas licence rules depend on the state and how long you stay.', source: 'State roads authority · official', done: false },
];

const defaultSavedCosts: SavedPlanCostAssumptions = {
  includePartner: true,
  includeAgent: false,
  monthlyRent: 2400,
  government: 7160,
  settlement: 10700,
  extras: 410,
  total: 18270,
};
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
      <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#dbe86b] text-[#202842] shadow-[4px_4px_0_#202842]">
        <Compass size={22} strokeWidth={2.5} />
      </span>
      <span className="font-label text-[13px] font-bold tracking-[-.04em] text-[#202842]">VISA<br />PATHFINDER</span>
    </Link>
  );
}

function SourceBadge({ type = 'Official' }: { type?: string }) {
  const official = type === 'Official';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[.08em] ${official ? 'bg-[#e1f1d9] text-[#276047]' : type === 'Community' ? 'bg-[#ffe9dc] text-[#9a4c31]' : 'bg-[#e0edf4] text-[#245773]'}`}>
      {official ? <BadgeCheck size={12} /> : <BookMarked size={12} />}
      {type}
    </span>
  );
}

function formatReviewedDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function SourceTrail({ sourceName, sourceUrl, reviewedOn, authority }: Pick<GuidanceItem, 'sourceName' | 'sourceUrl' | 'reviewedOn' | 'authority'>) {
  return (
    <div className="mt-4 border-t border-[#ecece4] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge type={authority === 'official' ? 'Official' : 'Community'} />
        <span className="font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">Reviewed {formatReviewedDate(reviewedOn)}</span>
      </div>
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#276047] hover:underline">
        {sourceName} <ExternalLink size={12} />
      </a>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { form, hasSubmitted } = usePathfinderContext();
  return (
    <div className="grain min-h-[100dvh] bg-[#f7f4ec] text-[#202842]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#dce0d7] bg-[#f5f1e8] px-5 py-7 lg:flex">
        <Logo />
        <div className="mt-12 flex flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between px-3">
            <span className="font-label text-[10px] font-bold uppercase tracking-[.14em] text-[#7d8492]">Your workspace</span>
            <span className="h-2 w-2 rounded-full bg-[#b8d247]" />
          </div>
          <nav className="space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.end ? location === '/' : location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center justify-between rounded-xl px-3 py-3 text-[13px] font-semibold transition-all ${active ? 'bg-[#202842] text-[#f4f1e8] shadow-[3px_3px_0_#b8d247]' : 'text-[#606879] hover:bg-[#e9eadf] hover:text-[#202842]'}`}>
                  <span className="flex items-center gap-3"><Icon size={17} strokeWidth={active ? 2.3 : 1.8} />{item.label}</span>
                  {active && <ChevronRight size={14} className="text-[#dbe86b]" />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#e4eee4] p-4">
            <div className="mb-3 flex items-center gap-2 text-[#276047]"><ShieldCheck size={17} /><span className="font-label text-[10px] font-bold uppercase tracking-[.09em]">Free-first promise</span></div>
            <p className="text-[12px] leading-5 text-[#466254]">No referral commissions. Official sources are always labelled.</p>
            <Link href="/resources" data-testid="link-sidebar-sources" className="mt-3 flex items-center gap-1 text-[12px] font-bold text-[#276047]">See our sources <ArrowRight size={13} /></Link>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#dce0d7] bg-[#f7f4ec]/95 px-5 py-4 backdrop-blur lg:hidden">
        <Logo />
        <button type="button" onClick={() => setMobileOpen((value) => !value)} data-testid="button-mobile-menu" className="rounded-xl bg-[#202842] p-2.5 text-[#dbe86b]">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
        {mobileOpen && (
          <div className="absolute inset-x-4 top-[68px] rounded-2xl border border-[#dce0d7] bg-[#f5f1e8] p-3 shadow-[0_14px_35px_rgba(32,40,66,.14)]">
            {navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} data-testid={`link-mobile-${item.label.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#4c566c] hover:bg-[#e9eadf]"><item.icon size={16} />{item.label}</Link>)}
          </div>
        )}
      </header>

       <main className="min-h-[100dvh] lg:pl-[248px]">
         <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
           <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce0d7] bg-[#fffdf7] px-4 py-3 text-[11px]">
             <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-label text-[9px] font-bold uppercase tracking-[.1em] text-[#7c8490]">Current planning context</span>{hasSubmitted ? <><strong>{form.passport} → {form.destination}</strong><span className="text-[#7c8490]">·</span><span className="text-[#687183]">{form.purpose}</span></> : <span className="text-[#687183]">Set your destination and purpose in Pathfinder first.</span>}</div>
             {hasSubmitted && <Link href="/" data-testid="link-edit-planning-context" className="font-bold text-[#276047] hover:underline">Edit context</Link>}
           </div>
           {children}
         </div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="animate-rise">
        <div className="mb-3 flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-[.17em] text-[#71806d]"><span className="h-1.5 w-1.5 rounded-full bg-[#d37a57]" />{eyebrow}</div>
        <h1 className="max-w-3xl font-display text-[clamp(2.3rem,5vw,4.7rem)] leading-[.98] tracking-[-.045em] text-[#202842]">{title}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-6 text-[#687183]">{children}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, value, onChange, options, type = 'text', testId }: { label: string; value: string; onChange: (value: string) => void; options?: string[]; type?: string; testId: string }) {
  return (
    <label className="block">
      <span className="mb-2 block font-label text-[10px] font-bold uppercase tracking-[.1em] text-[#7c8490]">{label}</span>
      {options ? (
        <span className="relative block">
          <select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} className="w-full appearance-none rounded-xl border border-[#d7dcd4] bg-[#fffdf7] px-3.5 py-3 text-[13px] font-semibold text-[#273049] outline-none transition focus:border-[#81a348] focus:ring-2 focus:ring-[#dbe86b]/60">
            {options.map((option) => <option key={option}>{option}</option>)}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-[#7c8490]" />
        </span>
      ) : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} className="w-full rounded-xl border border-[#d7dcd4] bg-[#fffdf7] px-3.5 py-3 text-[13px] font-semibold text-[#273049] outline-none transition placeholder:text-[#a1a7ae] focus:border-[#81a348] focus:ring-2 focus:ring-[#dbe86b]/60" />}
    </label>
  );
}

function CountryAutocompleteField({
  label,
  value,
  onChange,
  testId,
  options = countryOptions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  options?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const matches = options.filter((country) => country.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
  return (
    <label className="relative block">
      <span className="mb-2 block font-label text-[10px] font-bold uppercase tracking-[.1em] text-[#7c8490]">{label}</span>
      <span className="relative block">
        <input
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => { onChange(sanitizePlainText(event.target.value)); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && matches[0]) { event.preventDefault(); onChange(matches[0]); setOpen(false); }
          }}
          data-testid={testId}
          className="w-full rounded-xl border border-[#d7dcd4] bg-[#fffdf7] px-3.5 py-3 pr-9 text-[13px] font-semibold text-[#273049] outline-none transition focus:border-[#81a348] focus:ring-2 focus:ring-[#dbe86b]/60"
        />
        <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-[#7c8490]" />
      </span>
      {open && (
        <div className="absolute left-0 right-0 top-[72px] z-20 overflow-hidden rounded-xl border border-[#d7dcd4] bg-[#fffdf7] p-1 shadow-[0_18px_35px_rgba(32,40,66,.15)]">
          {matches.length > 0 ? matches.map((country) => (
            <button type="button" key={country} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(country); setOpen(false); }} data-testid={`option-${testId}-${country.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="block w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-[#3e485e] hover:bg-[#e8f1e8]">
              {country}
            </button>
          )) : <p className="px-3 py-3 text-[12px] text-[#7c8490]">No country matches that search.</p>}
          <p className="border-t border-[#ecece4] px-3 py-2 text-[10px] text-[#8a919b]">Type to search the available countries. Press Enter to choose the first match.</p>
        </div>
      )}
    </label>
  );
}

function OccupationField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const validation = validateOccupation(value);
  return (
    <label className="block">
      <span className="mb-2 block font-label text-[10px] font-bold uppercase tracking-[.1em] text-[#7c8490]">Occupation</span>
      <input
        type="text"
        value={value}
        maxLength={80}
        autoComplete="off"
        onChange={(event) => onChange(sanitizePlainText(event.target.value))}
        data-testid="input-occupation"
        placeholder="e.g. Software engineer"
        aria-invalid={!validation.valid}
        className={`w-full rounded-xl border bg-[#fffdf7] px-3.5 py-3 text-[13px] font-semibold text-[#273049] outline-none transition focus:ring-2 focus:ring-[#dbe86b]/60 ${validation.valid ? 'border-[#d7dcd4] focus:border-[#81a348]' : 'border-[#e7b69f] focus:border-[#c87859]'}`}
      />
      <span className={`mt-2 block text-[10px] leading-4 ${validation.valid ? 'text-[#397669]' : 'text-[#a05a40]'}`} role="status" data-testid="status-occupation-validation">
        {validation.message}
      </span>
      <span className="mt-2 block text-[10px] leading-4 text-[#8a919b]">
        In-demand examples: {inDemandSkills.slice(0, 5).map((skill) => skill.name).join(', ')}.
      </span>
    </label>
  );
}

function Signal({ children, tone = 'good' }: { children: React.ReactNode; tone?: 'good' | 'watch' | 'risk' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[.07em] ${tone === 'good' ? 'bg-[#e1f1d9] text-[#276047]' : tone === 'watch' ? 'bg-[#fff0c9] text-[#8b651f]' : 'bg-[#ffe4dc] text-[#994b37]'}`}>{tone === 'good' ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}{children}</span>;
}

function VisaCard({ visa, rank, onCompare, fitScore = visa.fitScore }: { visa: GuidanceItem; rank: number; onCompare: (id: string) => void; fitScore?: number }) {
  const tone = rank === 1 ? 'lime' : rank === 2 ? 'aqua' : 'coral';
  return (
    <article data-testid={`card-pathway-${visa.visaSubclass}`} className="group relative overflow-hidden rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(32,40,66,.1)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${tone === 'lime' ? 'bg-[#dbe86b]' : tone === 'aqua' ? 'bg-[#8bcfc1]' : 'bg-[#e99c7b]'}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-label text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8490]">0{rank} · {visa.shortName}</span>
          <h3 className="mt-1 font-display text-[25px] tracking-[-.03em]">{visa.name}</h3>
        </div>
        <div className="text-right"><strong className="font-display text-[28px]">{fitScore}%</strong><span className="block font-label text-[9px] uppercase tracking-[.1em] text-[#7c8490]">alignment</span></div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf0e8]"><div className={`h-full rounded-full ${tone === 'lime' ? 'bg-[#b8d247]' : tone === 'aqua' ? 'bg-[#65bcae]' : 'bg-[#dc8263]'}`} style={{ width: `${fitScore}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2"><Signal tone={rank === 3 ? 'watch' : 'good'}>{visa.signal}</Signal><span className="inline-flex items-center gap-1 rounded-full bg-[#f0f0e9] px-2.5 py-1 font-label text-[10px] font-bold text-[#687183]"><Clock3 size={12} />{visa.duration}</span></div>
      <p className="mt-4 text-[13px] leading-5 text-[#687183]">{visa.note}</p>
      <div className="my-4 grid grid-cols-2 gap-2 border-y border-[#ecece4] py-3 text-[12px]"><div><span className="block text-[#8b929c]">Government fee</span><strong>{visa.governmentFee}</strong></div><div><span className="block text-[#8b929c]">Next gate</span><strong>{visa.stage}</strong></div></div>
      <SourceTrail sourceName={visa.sourceName} sourceUrl={visa.sourceUrl} reviewedOn={visa.reviewedOn} authority={visa.authority} />
      <div className="mt-4 flex items-center justify-between"><button type="button" onClick={() => onCompare(visa.visaSubclass)} data-testid={`button-compare-${visa.visaSubclass}`} className="text-[12px] font-bold text-[#276047] hover:underline">Add to compare</button><Link href="/roadmaps" data-testid={`link-roadmap-${visa.visaSubclass}`} className="flex items-center gap-1 text-[12px] font-bold text-[#202842]">View roadmap <ArrowRight size={14} /></Link></div>
    </article>
  );
}

function SkillChipInput({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const suggestions = ['AI / ML', 'Power systems', 'PLC programming', 'Industrial automation', 'AutoCAD', 'Renewable energy', 'Python', 'Java', 'Cloud', 'Data analysis'].filter((skill) => !skills.includes(skill));
  const addSkill = (value: string) => {
    const clean = sanitizePlainText(value).trim();
    if (clean && !skills.some((skill) => skill.toLowerCase() === clean.toLowerCase())) onChange([...skills, clean]);
    setDraft('');
  };
  return (
    <div className="sm:col-span-2">
      <span className="mb-2 block font-label text-[10px] font-bold uppercase tracking-[.1em] text-[#7c8490]">Skills you can use</span>
      <div className="rounded-xl border border-[#d7dcd4] bg-[#fffdf7] p-3 focus-within:border-[#81a348] focus-within:ring-2 focus-within:ring-[#dbe86b]/60">
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => <button key={skill} type="button" onClick={() => onChange(skills.filter((current) => current !== skill))} data-testid={`button-remove-skill-${skill.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f1e8] px-2.5 py-1.5 text-[11px] font-bold text-[#276047]">{skill}<X size={12} /></button>)}
          <input value={draft} onChange={(event) => setDraft(sanitizePlainText(event.target.value))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(draft); } }} onBlur={() => draft && addSkill(draft)} data-testid="input-skill" placeholder={skills.length ? 'Add another skill' : 'e.g. power systems'} className="min-w-[150px] flex-1 bg-transparent px-1 py-1 text-[12px] outline-none placeholder:text-[#a1a7ae]" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.slice(0, 6).map((skill) => <button key={skill} type="button" onClick={() => addSkill(skill)} data-testid={`button-add-skill-${skill.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`} className="inline-flex items-center gap-1 rounded-full border border-[#d7dcd4] px-2 py-1 text-[10px] font-semibold text-[#687183] hover:border-[#81a348] hover:text-[#276047]"><Plus size={11} />{skill}</button>)}
      </div>
      <span className="mt-2 block text-[10px] leading-4 text-[#8a919b]">Demand is matched to your skill mix, not inferred from your degree alone. Use tools, methods and domains you can evidence.</span>
    </div>
  );
}

function GlobalPathwayCard({ result, rank }: { result: ReturnType<typeof rankGlobalPathways>[number]; rank: number }) {
  const { pathway } = result;
  const signal = result.matchedSkills.length >= 2 ? 'Strong demand signal' : result.matchedOccupation ? 'Occupation signal' : 'More information required';
  return (
    <article data-testid={`card-global-pathway-${pathway.id}`} className="group relative overflow-hidden rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(32,40,66,.1)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${rank === 1 ? 'bg-[#dbe86b]' : rank === 2 ? 'bg-[#8bcfc1]' : 'bg-[#e99c7b]'}`} />
      <div className="flex items-start justify-between gap-4">
        <div><span className="font-label text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8490]">0{rank} · {pathway.country}</span><h3 className="mt-1 font-display text-[25px] tracking-[-.03em]">{pathway.name}</h3><span className="mt-1 block text-[11px] font-semibold text-[#687183]">{pathway.routeType}</span></div>
        <div className="text-right"><strong className="font-display text-[28px]">{result.score}%</strong><span className="block font-label text-[9px] uppercase tracking-[.1em] text-[#7c8490]">alignment</span></div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf0e8]"><div className={`h-full rounded-full ${rank === 1 ? 'bg-[#b8d247]' : rank === 2 ? 'bg-[#65bcae]' : 'bg-[#dc8263]'}`} style={{ width: `${result.score}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2"><Signal tone={result.matchedSkills.length ? 'good' : 'watch'}>{signal}</Signal>{pathway.workModes.map((mode) => <span key={mode} className="inline-flex items-center gap-1 rounded-full bg-[#f0f0e9] px-2.5 py-1 font-label text-[10px] font-bold text-[#687183]"><MapPin size={12} />{mode}</span>)}</div>
      <p className="mt-4 text-[13px] leading-5 text-[#687183]">{pathway.summary}</p>
      <details className="mt-4 rounded-xl bg-[#f0f3e8] p-3">
        <summary className="cursor-pointer text-[12px] font-bold text-[#276047]">Why this surfaced</summary>
        <div className="mt-3 space-y-2 text-[11px] leading-5 text-[#526457]"><div><strong>Skill demand:</strong> {result.matchedSkills.length ? result.matchedSkills.join(', ') : 'UNKNOWN — add more skills or verify the occupation code.'}</div><div><strong>Occupation recognition:</strong> {result.matchedOccupation ?? 'UNKNOWN — the role needs a pathway-specific code check.'}</div><div><strong>Route access:</strong> {pathway.gateways.join(' · ')}</div><div><strong>Evidence state:</strong> APPLICANT_DECLARED until supporting records are reviewed.</div></div>
      </details>
      <div className="my-4 border-y border-[#ecece4] py-3"><span className="font-label text-[9px] font-bold uppercase tracking-[.1em] text-[#7c8490]">Where to look for work</span>{pathway.marketExamples.map((market) => <div key={market.place} className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-[#687183]"><MapPin size={13} className="mt-1 shrink-0 text-[#397669]" /><span><strong className="text-[#273049]">{market.place}</strong> — {market.roles}<a href={market.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 font-bold text-[#276047] hover:underline">{market.sourceName} <ExternalLink size={11} /></a></span></div>)}</div>
      <div className="rounded-xl border border-[#dcefeb] bg-[#f1f8f5] p-3 text-[11px] leading-5 text-[#466254]"><div className="flex items-center gap-2 font-label text-[9px] font-bold uppercase tracking-[.09em] text-[#397669]"><RadioTower size={13} />Remote-work boundary</div><p className="mt-1">{pathway.remoteCaveat}</p></div>
      <div className="mt-4"><span className="font-label text-[9px] font-bold uppercase tracking-[.1em] text-[#7c8490]">Evidence gaps</span><div className="mt-2 flex flex-wrap gap-1.5">{pathway.evidenceGaps.map((gap) => <span key={gap} className="rounded-full bg-[#fff0c9] px-2 py-1 text-[10px] font-semibold text-[#8b651f]">{gap}</span>)}</div></div>
      <div className="mt-4 border-t border-[#ecece4] pt-3"><div className="flex flex-wrap items-center gap-2"><SourceBadge type={pathway.authority === 'official' ? 'Official' : 'Community'} /><span className="font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">Reviewed {formatReviewedDate(pathway.reviewedOn)}</span></div><a href={pathway.sourceUrl} target="_blank" rel="noreferrer" data-testid={`link-global-source-${pathway.id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#276047] hover:underline">{pathway.sourceName} <ExternalLink size={12} /></a></div>
    </article>
  );
}

function Home() {
  const { form: savedForm, hasSubmitted, commitForm } = usePathfinderContext();
  const [form, setForm] = useState(savedForm);
  const [notice, setNotice] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  useEffect(() => setForm(savedForm), [savedForm]);
  const guidanceQuery = useListGuidance();
  const createPlanMutation = useCreateSavedPlan();
  const visaData = guidanceQuery.data?.items ?? [];
  const bestFit = visaData[0];
  const update = (key: keyof PathfinderForm) => (value: string) => {
    const cleaned = key === 'occupation' ? sanitizePlainText(value) : key === 'age' ? value.replace(/\D/g, '').slice(0, 3) : value;
    setForm((current) => ({ ...current, [key]: cleaned }));
  };
  const occupationValidation = useMemo(() => validateOccupation(form.occupation), [form.occupation]);
  const countrySelectionValid = validateCountrySelection(
    form.passport,
    form.destination,
    countryOptions,
    maintainedDestinations,
  );
  const purposeRules = getPurposePlanningRules(form.purpose);
  const workPurpose = purposeRules.showWorkFields;
  const visitorPurpose = isVisitorPurpose(form.purpose);
  const nonWorkPurpose = !workPurpose;
  const globalResults = useMemo(() => rankGlobalPathways(form), [form]);
  const isAustralia = form.destination === 'Australia';
  const investmentCurrencyCode = getCurrencyCodeForDestination(form.destination);
  const investmentRangeOptions = investmentCurrencyCode
    ? getBusinessInvestmentRangeOptions(investmentCurrencyCode)
    : ['Choose a supported destination to see ranges'];
  const investmentRangeValue = investmentCurrencyCode
    ? getBusinessInvestmentRangeForCurrency(form.investmentRange, investmentCurrencyCode)
    : investmentRangeOptions[0];
  const destinationIsConfigured = nonWorkPurpose || isAustralia || globalPathways.some((pathway) => pathway.country === form.destination);
  const canSubmit = countrySelectionValid && (!workPurpose || (occupationValidation.valid && form.skills.length > 0));
  const scoreOffset = useMemo(() => {
    if (!workPurpose) return 0;
    let score = 0;
    if (form.skills.length >= 3) score += 7;
    if (form.experience.includes('5') || form.experience.includes('10')) score += 5;
    if (form.english.includes('7+')) score += 3;
    if (occupationValidation.valid) score += 2;
    return score;
  }, [form, occupationValidation.valid]);
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); };
  const handlePathfinderSubmit = () => {
    if (!canSubmit) {
      showNotice(nonWorkPurpose ? 'Choose a passport country and destination.' : 'Choose a destination, plain occupation text and at least one skill.');
      return;
    }
    commitForm(form);
    showNotice(nonWorkPurpose ? 'Your purpose-specific planning context has been refreshed across the workspace.' : 'Your global pathway signals have been refreshed across the workspace.');
    window.requestAnimationFrame(() => {
      document.getElementById('pathfinder-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const saveCurrentPlan = () => {
    if (!purposeRules.allowPlanSave) {
      showNotice('Saved plans are available for work, study, and business planning.');
      return;
    }
    if (!canSubmit) {
      showNotice(workPurpose ? 'Choose a destination, plain occupation text and at least one skill.' : 'Choose a passport country and destination.');
      return;
    }
    createPlanMutation.mutate({ data: buildSavedPlanInput(form, visaData) }, {
      onSuccess: (plan) => {
        queryClient.invalidateQueries({ queryKey: getListSavedPlansQueryKey() });
        setLocation(`/workspace/${plan.id}`);
      },
    });
  };
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[28px] bg-[#202842] px-6 py-8 text-[#f8f4e9] shadow-[8px_8px_0_#dbe86b] sm:px-10 sm:py-11 lg:px-14 lg:py-14">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[1px] border-[#dbe86b]/30" /><div className="absolute -right-4 -top-12 h-52 w-52 rounded-full border-[1px] border-[#dbe86b]/20" />
        <div className="relative max-w-3xl animate-rise">
          <div className="mb-5 flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-[.18em] text-[#dbe86b]"><span className="h-2 w-2 rounded-full bg-[#dbe86b] animate-pulse-soft" />Global visa planning</div>
          <h1 className="font-display text-[clamp(3rem,7vw,6.6rem)] leading-[.88] tracking-[-.055em]">A clearer route<br /><span className="text-[#dbe86b]">starts here.</span></h1>
          <p className="mt-6 max-w-xl text-[15px] leading-6 text-[#c2c9d2]">Find skills-first work and visa routes around the world with transparent sources, practical job-market context and next steps you can take yourself.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 rounded-full bg-[#2d3858] px-3 py-2 text-[11px] font-semibold text-[#dce2df]"><ShieldCheck size={14} className="text-[#dbe86b]" />Free to use · no sales calls</span><span className="flex items-center gap-2 rounded-full bg-[#2d3858] px-3 py-2 text-[11px] font-semibold text-[#dce2df]"><BadgeCheck size={14} className="text-[#8bcfc1]" />Sources always labelled</span></div>
        </div>
        <div className="absolute bottom-8 right-10 hidden text-right lg:block"><span className="font-label text-[10px] uppercase tracking-[.13em] text-[#94a0b1]">Planning signal</span><strong className="mt-1 block font-display text-5xl text-[#f8f4e9]">01</strong><span className="font-label text-[10px] text-[#94a0b1]">of 04 · know your route</span></div>
      </section>

      <div className={`grid gap-8 ${hasSubmitted ? 'xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]' : ''}`}>
        <section className="animate-rise-delay">
          <div className="mb-4 flex items-end justify-between"><div><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#71806d]">Your starting point</div><h2 className="mt-2 font-display text-3xl tracking-[-.035em]">Tell us your purpose</h2></div><span className="font-label text-[10px] text-[#8a919b]">Takes about 2 minutes</span></div>
          <div className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 shadow-[0_10px_26px_rgba(32,40,66,.04)] sm:p-7">
              <div className="mb-6 flex items-start gap-3 rounded-xl bg-[#f0f3e8] p-3.5"><Info size={16} className="mt-0.5 shrink-0 text-[#4e775d]" /><p className="text-[12px] leading-5 text-[#526457]">{visitorPurpose ? 'Start with your travel purpose and destination. Visitor preparation does not use occupation, experience or skills.' : workPurpose ? 'Start with the skills you can demonstrate. This is a global discovery view using configured, reviewed examples — not a legal assessment or a live job guarantee.' : `Start with your ${form.purpose.toLowerCase()} purpose and destination. Work qualifications are not used for this planning path.`}</p></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <CountryAutocompleteField label="Passport country" value={form.passport} onChange={update('passport')} testId="input-passport-country" options={countryOptions} />
              <CountryAutocompleteField
                label="Destination"
                value={form.destination}
                onChange={(destination) => setForm((current) => {
                  const currencyCode = getCurrencyCodeForDestination(destination);
                  return {
                    ...current,
                    destination,
                    investmentRange: currencyCode
                      ? getBusinessInvestmentRangeForCurrency(current.investmentRange, currencyCode)
                      : current.investmentRange,
                  };
                })}
                testId="input-destination"
                options={maintainedDestinations}
              />
               <Field label="Main purpose" value={form.purpose} onChange={update('purpose')} options={['Work and settle', 'Study', 'Training', 'Visit or tourism', 'Start a business']} testId="input-purpose" />
              {purposeRules.showStudyFields && <>
                <Field label="Course level" value={form.courseLevel} onChange={update('courseLevel')} options={studyCourseLevelOptions} testId="input-study-course-level" />
                <Field label="Institution or offer status" value={form.institutionStatus} onChange={update('institutionStatus')} options={studyInstitutionStatusOptions} testId="input-study-institution-status" />
                <Field label="Study funding" value={form.studyFunding} onChange={update('studyFunding')} options={studyFundingOptions} testId="input-study-funding" />
              </>}
              {purposeRules.showBusinessFields && <>
                <Field label="Business stage" value={form.businessStage} onChange={update('businessStage')} options={businessStageOptions} testId="input-business-stage" />
                <div>
                  <Field
                    label={`Investment range (${investmentCurrencyCode ?? 'select destination'})`}
                    value={investmentRangeValue}
                    onChange={update('investmentRange')}
                    options={investmentRangeOptions}
                    testId="input-business-investment-range"
                  />
                  <p className="mt-2 text-[10px] leading-4 text-[#7c8490]" data-testid="text-business-investment-currency-note">
                    {investmentCurrencyCode
                      ? `Amounts are stated in ${investmentCurrencyCode}, the selected destination’s currency. These are planning bands, not visa thresholds, and are not converted between currencies.`
                      : 'Choose a listed destination to see investment ranges in its currency.'}
                  </p>
                </div>
                <Field label="Ownership or operating intent" value={form.businessIntent} onChange={update('businessIntent')} options={businessIntentOptions} testId="input-business-intent" />
              </>}
              {workPurpose && <><OccupationField value={form.occupation} onChange={update('occupation')} />
              <Field label="Relevant experience" value={form.experience} onChange={update('experience')} options={['Less than 2 years', '2–5 years', '5–10 years', '10+ years']} testId="input-experience" />
              <Field label="Work location preference" value={form.workMode} onChange={update('workMode')} options={['Open to relocate or work remotely', 'Relocate for work', 'Work remotely from current country']} testId="input-work-mode" />
              <SkillChipInput skills={form.skills} onChange={(skills) => setForm((current) => ({ ...current, skills }))} /></>}
              {nonWorkPurpose && <div className="rounded-xl border border-[#dcefeb] bg-[#f1f8f5] p-4 sm:col-span-2"><div className="font-label text-[10px] font-bold uppercase tracking-[.1em] text-[#397669]">{visitorPurpose ? 'Visitor planning' : `${form.purpose} planning`}</div><p className="mt-2 text-[12px] leading-5 text-[#526457]">{visitorPurpose ? 'Occupation, relevant experience, work location and skills are not used for tourism. Continue with your passport, destination and visit purpose.' : purposeRules.showStudyFields ? 'Occupation, work experience, work location and skills are not used here. These answers capture your course, institution status, and study funding only.' : purposeRules.showBusinessFields ? 'Occupation, work experience, work location and skills are not used here. These answers capture your business stage, investment range, and ownership intent only.' : `Occupation, relevant experience, work location and skills are not used for ${form.purpose.toLowerCase()}.`}</p></div>}
            </div>
            {!purposeRules.showStudyFields && !purposeRules.showBusinessFields && <>
              <button type="button" onClick={() => setShowContext((value) => !value)} data-testid="button-toggle-more-context" className="mt-5 flex items-center gap-2 text-[12px] font-bold text-[#276047] hover:underline">{showContext ? 'Hide additional context' : 'Add more context'}<ChevronDown size={14} className={showContext ? 'rotate-180' : ''} /></button>
              {showContext && <div className="mt-4 grid gap-5 border-t border-[#ecece4] pt-5 sm:grid-cols-2"><Field label="Your age" value={form.age} onChange={update('age')} type="number" testId="input-age" /><Field label="Highest education" value={form.education} onChange={update('education')} options={["Bachelor's degree", "Master's degree", 'Trade qualification', 'High school', 'Other']} testId="input-education" /><Field label="English level" value={form.english} onChange={update('english')} options={['Proficient (IELTS 7+)', 'Competent (IELTS 6)', 'Superior (IELTS 8+)', 'Not tested yet']} testId="input-english-level" /><Field label="Funds available" value={form.funds} onChange={update('funds')} options={['AUD 15,000', 'AUD 25,000', 'AUD 35,000', 'AUD 50,000+']} testId="input-funds" /><div className="sm:col-span-2"><Field label="Family situation" value={form.family} onChange={update('family')} options={['Partner, no children', 'Single', 'Partner and children', 'Children, no partner']} testId="input-family-situation" /></div></div>}
            </>}
              <button type="button" disabled={!canSubmit} onClick={handlePathfinderSubmit} data-testid="button-find-pathways" className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[13px] font-bold shadow-[3px_3px_0_#b8d247] transition ${canSubmit ? 'bg-[#202842] text-[#dbe86b] hover:translate-y-[-2px] hover:shadow-[4px_5px_0_#b8d247] active:translate-y-0' : 'cursor-not-allowed bg-[#dfe3da] text-[#89918c] shadow-none'}`}>{hasSubmitted ? (visitorPurpose ? 'Refresh visitor guidance' : nonWorkPurpose ? `Refresh ${form.purpose.toLowerCase()} guidance` : 'Refresh my pathways') : (visitorPurpose ? 'Prepare my visit' : nonWorkPurpose ? `Prepare for ${form.purpose.toLowerCase()}` : 'Find my pathways')} <ArrowRight size={16} /></button>
             <p className="mt-3 text-[10px] leading-4 text-[#8a919b]">Maintained route coverage currently includes {maintainedDestinationSummary}. Other destinations remain OUT_OF_SCOPE until a reviewed source catalogue is added.</p>
          </div>
        </section>

        {hasSubmitted && <section className="xl:pt-[39px]">
          <div className="rounded-2xl border border-[#dce0d7] bg-[#e8f1e8] p-5 sm:p-7">
             <div className="flex items-start justify-between"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#47715a]">Your planning snapshot</span><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">{nonWorkPurpose ? `${form.purpose} planning` : form.occupation}</h2><p className="mt-1 text-[13px] text-[#688070]">{form.passport} → {form.destination} · {form.purpose.toLowerCase()}</p></div><div className="grid h-11 w-11 place-items-center rounded-full bg-[#dbe86b] text-[#202842]"><Target size={20} /></div></div>
             {nonWorkPurpose ? <div className="my-6 rounded-xl bg-[#f5f8f0] p-4"><strong className="block text-[14px]">{visitorPurpose ? 'Visitor preparation context' : `${form.purpose} context`}</strong><p className="mt-2 text-[12px] leading-5 text-[#687183]">{visitorPurpose ? 'This search focuses on visitor documents, travel purpose, funds, return ties and destination guidance. Work qualifications and skills are not scored.' : `This search focuses on ${form.purpose.toLowerCase()} evidence and destination guidance. Work qualifications and skills are not scored.`}</p>{purposeEvidenceRows(form).length > 0 && <dl className="mt-4 grid gap-3 border-t border-[#dce5d9] pt-4 sm:grid-cols-2" data-testid="summary-submitted-purpose-evidence">{purposeEvidenceRows(form).map((item) => <div key={item.label}><dt className="font-label text-[9px] font-bold uppercase tracking-[.09em] text-[#7c8490]">{item.label}</dt><dd className="mt-1 text-[12px] font-semibold text-[#3e485e]">{item.value}</dd></div>)}</dl>}<p className="mt-4 text-[10px] leading-4 text-[#8a919b]">These are self-reported planning details, not a determination of visa eligibility. Confirm requirements with the destination's official authority.</p></div> : <><div className="my-6 flex items-center gap-5 rounded-xl bg-[#f5f8f0] p-4"><div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full border-[7px] border-[#b8d247]"><span className="font-display text-2xl">{Math.min(96, 70 + scoreOffset)}</span></div><div><strong className="block text-[14px]">Skill-led information signal</strong><p className="mt-1 text-[12px] leading-5 text-[#687183]">{hasSubmitted ? 'Updated from your latest answers.' : 'Based on the information you entered.'} This is preference alignment, not approval probability.</p></div></div>
             <div className="space-y-3">{[['Skills submitted', form.skills.length ? `${form.skills.length} skills will drive the demand match` : 'Add at least one skill', form.skills.length ? 'good' : 'watch'], ['Experience context', `${form.experience} selected`, 'good'], ['Occupation input', occupationValidation.message, occupationValidation.valid ? 'good' : 'watch'], ['Evidence state', 'Applicant-declared until documents are reviewed', 'watch']].map(([label, detail, tone]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-[#cfe0d2] pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-2.5"><span className={`grid h-6 w-6 place-items-center rounded-full ${tone === 'good' ? 'bg-[#d5e9c8] text-[#276047]' : 'bg-[#ffedc4] text-[#8b651f]'}`}>{tone === 'good' ? <Check size={13} /> : <Info size={13} />}</span><div><strong className="block text-[12px]">{label}</strong><span className="text-[11px] text-[#72807a]">{detail}</span></div></div><ChevronRight size={14} className="text-[#91a292]" /></div>)}</div></>}
              {purposeRules.allowPlanSave && <button type="button" onClick={saveCurrentPlan} disabled={!canSubmit || createPlanMutation.isPending} data-testid="button-save-current-plan" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b] shadow-[3px_3px_0_#b8d247] transition hover:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none">{createPlanMutation.isPending ? <Save size={15} className="animate-pulse-soft" /> : <Save size={15} />}{createPlanMutation.isPending ? 'Saving your plan…' : `Save ${form.purpose.toLowerCase()} plan`}</button>}
              {createPlanMutation.isError && <p role="alert" data-testid="status-save-plan-error" className="mt-3 text-[11px] font-semibold text-[#a45138]">We could not save this plan. Check your connection and try again.</p>}
          </div>
             <div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-3"><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Route scope</span><strong className="mt-1 block text-[14px]">{nonWorkPurpose ? `${form.purpose} guidance` : destinationIsConfigured ? (isAustralia ? 'Australia' : `${globalResults.length} routes`) : 'OUT_OF_SCOPE'}</strong></div><div className="rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-3"><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Skill signals</span><strong className="mt-1 block text-[14px]">{nonWorkPurpose ? 'Not used' : form.skills.length}</strong></div><div className="rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-3"><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Next step</span><strong className="mt-1 block text-[14px]">{nonWorkPurpose ? 'Purpose evidence' : isAustralia ? (bestFit?.stage ?? 'Skills check') : destinationIsConfigured ? 'Check gateways' : 'Add destination'}</strong></div></div>
        </section>}
      </div>

       {hasSubmitted && <section id="pathfinder-results" data-testid="section-pathfinder-results" className="scroll-mt-6">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#71806d]">{nonWorkPurpose ? 'Purpose preparation' : 'Pathways to investigate'}</div><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">{nonWorkPurpose ? `Prepare for ${form.purpose.toLowerCase()}` : isAustralia ? 'Australia routes' : 'Global route signals'}</h2><p className="mt-2 text-[11px] text-[#7c8490]">{nonWorkPurpose ? `${form.purpose} documentation and destination guidance only. Work qualifications and skills do not affect this search.` : isAustralia ? 'Preference alignment only — not approval probability. These maintained examples are not the complete Home Affairs result set; use its Visa Finder for options based on your answers.' : 'These maintained route examples are not a complete visa match or approval probability. Confirm current options with the destination’s official immigration authority.'}</p></div><Link href={nonWorkPurpose || !isAustralia ? '/resources' : '/compare'} data-testid="link-see-all-pathways" className="flex items-center gap-1 text-[12px] font-bold text-[#276047]">{nonWorkPurpose || !isAustralia ? 'Open source shelf' : 'Compare Australia visas'} <ArrowRight size={14} /></Link></div>
           {nonWorkPurpose ? visitorPurpose
             ? <VisitorVisaOptionsSection destinationCountry={form.destination} passportCountry={form.passport} />
              : <><div className="rounded-2xl border border-[#dcefeb] bg-[#f1f8f5] p-6"><div className="flex items-start gap-3"><Globe2 size={21} className="mt-0.5 text-[#397669]" /><div><h3 className="font-display text-2xl">No work visa selected</h3><p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#526457]">{`Your purpose is ${form.purpose.toLowerCase()}, so Pathfinder will not rank employment routes.`}</p>{purposeEvidenceRows(form).length > 0 && <dl className="mt-5 grid gap-3 sm:grid-cols-3" data-testid="summary-guidance-purpose-evidence">{purposeEvidenceRows(form).map((item) => <div key={item.label} className="rounded-xl bg-white/70 p-3"><dt className="font-label text-[9px] font-bold uppercase tracking-[.09em] text-[#7c8490]">{item.label}</dt><dd className="mt-1 text-[12px] font-semibold text-[#3e485e]">{item.value}</dd></div>)}</dl>}</div></div></div><VisaResourceList destinationCountry={form.destination} passportCountry={form.passport} purposeTag={form.purpose.toLowerCase().includes('study') ? 'study' : form.purpose.toLowerCase().includes('training') ? 'training' : 'business'} /></>
             : <><>{guidanceQuery.isLoading && <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center text-[13px] text-[#687183]">Loading the latest reviewed pathway guidance…</div>}
         {guidanceQuery.isError && <div role="alert" className="rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[13px] text-[#8d4a38]">Pathway guidance is temporarily unavailable. Please try again shortly; no stale figures are being shown.</div>}
          {!isAustralia && destinationIsConfigured && globalResults.length > 0 && <div className="grid gap-4 lg:grid-cols-2">{globalResults.map((result, index) => <GlobalPathwayCard key={result.pathway.id} result={result} rank={index + 1} />)}</div>}
          {!isAustralia && !destinationIsConfigured && <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center"><Globe2 size={24} className="mx-auto text-[#809084]" /><h2 className="mt-3 font-display text-2xl">OUT_OF_SCOPE for the configured catalogue</h2><p className="mt-2 text-[13px] text-[#687183]">This discovery release does not yet have a maintained pathway record for {form.destination}. No visa result is being invented. The maintained catalogue currently covers {maintainedDestinationSummary}. Use the official immigration authority for this country.</p></div>}
          {isAustralia && guidanceQuery.isLoading && <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center text-[13px] text-[#687183]">Loading the latest reviewed Australia guidance…</div>}
          {isAustralia && guidanceQuery.isError && <div role="alert" className="rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[13px] text-[#8d4a38]">Australia pathway guidance is temporarily unavailable. Please try again shortly; no stale figures are being shown.</div>}
           {isAustralia && !guidanceQuery.isLoading && !guidanceQuery.isError && visaData.length > 0 && <div className="grid gap-4 lg:grid-cols-3">{visaData.map((visa, index) => <VisaCard key={visa.id} visa={visa} fitScore={Math.min(97, visa.fitScore + (scoreOffset - 9))} rank={index + 1} onCompare={(id) => showNotice(`Subclass ${id} added to your comparison.`)} />)}</div>}</><VisaResourceList destinationCountry={form.destination} passportCountry={form.passport} purposeTag="work" /></>}
      </section>}
      {notice && <div role="status" data-testid="status-action-notice" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-semibold text-[#f5f1e8] shadow-[4px_4px_0_#dbe86b] animate-rise"><Check size={15} className="text-[#dbe86b]" />{notice}</div>}
    </div>
  );
}
/*
function Home() {
  const [form, setForm] = useState(defaultForm);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState('');
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const guidanceQuery = useListGuidance();
  const createPlanMutation = useCreateSavedPlan();
  const visaData = guidanceQuery.data?.items ?? [];
  const bestFit = visaData[0];
  const update = (key: keyof PathfinderForm) => (value: string) => {
    const cleaned = key === 'occupation' ? sanitizePlainText(value) : key === 'age' ? value.replace(/\D/g, '').slice(0, 3) : value;
    setForm((current) => ({ ...current, [key]: cleaned }));
  };
  const occupationValidation = useMemo(() => validateOccupation(form.occupation), [form.occupation]);
  const countrySelectionValid = countryOptions.includes(form.passport) && countryOptions.includes(form.destination);
  const canSubmit = occupationValidation.valid && countrySelectionValid;
  const scoreOffset = useMemo(() => {
    let score = 0;
    if (Number(form.age) < 33) score += 4;
    if (form.english.includes('7+')) score += 5;
    if (form.education.includes('Bachelor')) score += 2;
    if (occupationValidation.valid) score += 3;
    return score;
  }, [form, occupationValidation.valid]);
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); };
  const saveCurrentPlan = () => {
    if (!canSubmit) {
      showNotice('Choose a country and a matching occupation before saving.');
      return;
    }
    createPlanMutation.mutate({ data: buildSavedPlanInput(form, visaData) }, {
      onSuccess: (plan) => {
        queryClient.invalidateQueries({ queryKey: getListSavedPlansQueryKey() });
        setLocation(`/workspace/${plan.id}`);
      },
    });
  };
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[28px] bg-[#202842] px-6 py-8 text-[#f8f4e9] shadow-[8px_8px_0_#dbe86b] sm:px-10 sm:py-11 lg:px-14 lg:py-14">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[1px] border-[#dbe86b]/30" /><div className="absolute -right-4 -top-12 h-52 w-52 rounded-full border-[1px] border-[#dbe86b]/20" />
        <div className="relative max-w-3xl animate-rise">
          <div className="mb-5 flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-[.18em] text-[#dbe86b]"><span className="h-2 w-2 rounded-full bg-[#dbe86b] animate-pulse-soft" />Independent visa planning</div>
          <h1 className="font-display text-[clamp(3rem,7vw,6.6rem)] leading-[.88] tracking-[-.055em]">A clearer route<br /><span className="text-[#dbe86b]">starts here.</span></h1>
          <p className="mt-6 max-w-xl text-[15px] leading-6 text-[#c2c9d2]">Build an informed plan for Australia with transparent sources, real costs and next steps you can take yourself.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 rounded-full bg-[#2d3858] px-3 py-2 text-[11px] font-semibold text-[#dce2df]"><ShieldCheck size={14} className="text-[#dbe86b]" />Free to use · no sales calls</span><span className="flex items-center gap-2 rounded-full bg-[#2d3858] px-3 py-2 text-[11px] font-semibold text-[#dce2df]"><BadgeCheck size={14} className="text-[#8bcfc1]" />Sources always labelled</span></div>
        </div>
        <div className="absolute bottom-8 right-10 hidden text-right lg:block"><span className="font-label text-[10px] uppercase tracking-[.13em] text-[#94a0b1]">Planning signal</span><strong className="mt-1 block font-display text-5xl text-[#f8f4e9]">01</strong><span className="font-label text-[10px] text-[#94a0b1]">of 04 · know your route</span></div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
        <section className="animate-rise-delay">
          <div className="mb-4 flex items-end justify-between"><div><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#71806d]">Your starting point</div><h2 className="mt-2 font-display text-3xl tracking-[-.035em]">Tell us what you know.</h2></div><span className="font-label text-[10px] text-[#8a919b]">Takes about 2 minutes</span></div>
          <div className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 shadow-[0_10px_26px_rgba(32,40,66,.04)] sm:p-7">
            <div className="mb-6 flex items-start gap-3 rounded-xl bg-[#f0f3e8] p-3.5"><Info size={16} className="mt-0.5 shrink-0 text-[#4e775d]" /><p className="text-[12px] leading-5 text-[#526457]">Use your current situation. You can change anything later — this is an educational starting point, not a legal assessment.</p></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <CountryAutocompleteField label="Passport country" value={form.passport} onChange={update('passport')} testId="input-passport-country" />
              <CountryAutocompleteField label="Destination" value={form.destination} onChange={update('destination')} testId="input-destination" />
              <Field label="Main purpose" value={form.purpose} onChange={update('purpose')} options={['Work and settle', 'Study', 'Visit family', 'Start a business']} testId="input-purpose" />
              <Field label="Your age" value={form.age} onChange={update('age')} type="number" testId="input-age" />
              <OccupationField value={form.occupation} onChange={update('occupation')} />
              <Field label="Highest education" value={form.education} onChange={update('education')} options={["Bachelor's degree", "Master's degree", 'Trade qualification', 'High school', 'Other']} testId="input-education" />
              <Field label="English level" value={form.english} onChange={update('english')} options={['Proficient (IELTS 7+)', 'Competent (IELTS 6)', 'Superior (IELTS 8+)', 'Not tested yet']} testId="input-english-level" />
              <Field label="Funds available" value={form.funds} onChange={update('funds')} options={['AUD 15,000', 'AUD 25,000', 'AUD 35,000', 'AUD 50,000+']} testId="input-funds" />
              <div className="sm:col-span-2"><Field label="Family situation" value={form.family} onChange={update('family')} options={['Partner, no children', 'Single', 'Partner and children', 'Children, no partner']} testId="input-family-situation" /></div>
            </div>
            <button type="button" disabled={!canSubmit} onClick={() => { if (!canSubmit) { showNotice('Choose a country and a matching in-demand occupation first.'); return; } setSubmitted(true); showNotice('Your pathway signals have been refreshed.'); }} data-testid="button-find-pathways" className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[13px] font-bold shadow-[3px_3px_0_#b8d247] transition ${canSubmit ? 'bg-[#202842] text-[#dbe86b] hover:translate-y-[-2px] hover:shadow-[4px_5px_0_#b8d247] active:translate-y-0' : 'cursor-not-allowed bg-[#dfe3da] text-[#89918c] shadow-none'}`}>Find my pathways <ArrowRight size={16} /></button>
          </div>
        </section>

        <section className="xl:pt-[39px]">
          <div className="rounded-2xl border border-[#dce0d7] bg-[#e8f1e8] p-5 sm:p-7">
             <div className="flex items-start justify-between gap-4"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#47715a]">Your planning snapshot</span><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">{form.occupation}</h2><p className="mt-1 text-[13px] text-[#688070]">{form.passport} → {form.destination} · {form.purpose.toLowerCase()}</p></div><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#dbe86b] text-[#202842]"><Target size={20} /></div></div>
            <div className="my-6 flex items-center gap-5 rounded-xl bg-[#f5f8f0] p-4"><div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full border-[7px] border-[#b8d247]"><span className="font-display text-2xl">{Math.min(96, 82 + scoreOffset)}</span></div><div><strong className="block text-[14px]">A strong starting profile</strong><p className="mt-1 text-[12px] leading-5 text-[#687183]">{submitted ? 'Updated from your latest answers.' : 'Based on the information you entered.'} Signals are not a guarantee of eligibility.</p></div></div>
             <div className="space-y-3">{[['Occupation aligns', 'Software / ICT pathways are active', 'good'], ['Age points', `${form.age} keeps you in the points window`, 'good'], ['English evidence', form.english.includes('7+') ? 'Proficient score selected' : 'Consider a test for points', form.english.includes('7+') ? 'good' : 'watch'], ['Funds', `${form.funds} shown for planning`, 'watch']].map(([label, detail, tone]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-[#cfe0d2] pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-2.5"><span className={`grid h-6 w-6 place-items-center rounded-full ${tone === 'good' ? 'bg-[#d5e9c8] text-[#276047]' : 'bg-[#ffedc4] text-[#8b651f]'}`}>{tone === 'good' ? <Check size={13} /> : <Info size={13} />}</span><div><strong className="block text-[12px]">{label}</strong><span className="text-[11px] text-[#72807a]">{detail}</span></div></div><ChevronRight size={14} className="text-[#91a292]" /></div>)}</div>
             <button type="button" onClick={saveCurrentPlan} disabled={!canSubmit || createPlanMutation.isPending} data-testid="button-save-current-plan" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b] shadow-[3px_3px_0_#b8d247] transition hover:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none">{createPlanMutation.isPending ? <Save size={15} className="animate-pulse-soft" /> : <Save size={15} />}{createPlanMutation.isPending ? 'Saving your plan…' : 'Save this plan'}</button>
             {createPlanMutation.isError && <p role="alert" data-testid="status-save-plan-error" className="mt-3 text-[11px] font-semibold text-[#a45138]">We could not save this plan. Check your connection and try again.</p>}
          </div>
            <div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-3"><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Best fit</span><strong className="mt-1 block text-[14px]">{bestFit?.visaSubclass ?? '—'}</strong></div><div className="rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-3"><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Est. fee</span><strong className="mt-1 block text-[14px]">{bestFit?.governmentFee ?? '—'}</strong></div><div className="rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-3"><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Next step</span><strong className="mt-1 block text-[14px]">{bestFit?.stage ?? '—'}</strong></div></div>
        </section>
      </div>

      <section>
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#71806d]">Pathways to investigate</div><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Your likely routes</h2></div><Link href="/compare" data-testid="link-see-all-pathways" className="flex items-center gap-1 text-[12px] font-bold text-[#276047]">Compare all visas <ArrowRight size={14} /></Link></div>
        {guidanceQuery.isLoading && <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center text-[13px] text-[#687183]">Loading the latest reviewed pathway guidance…</div>}
        {guidanceQuery.isError && <div role="alert" className="rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[13px] text-[#8d4a38]">Pathway guidance is temporarily unavailable. Please try again shortly; no stale figures are being shown.</div>}
        {!guidanceQuery.isLoading && !guidanceQuery.isError && visaData.length > 0 && <div className="grid gap-4 lg:grid-cols-3">{visaData.map((visa, index) => <VisaCard key={visa.id} visa={visa} fitScore={Math.min(97, visa.fitScore + (scoreOffset - 9))} rank={index + 1} onCompare={(id) => showNotice(`Subclass ${id} added to your comparison.`)} />)}</div>}
      </section>
      {notice && <div role="status" data-testid="status-action-notice" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-semibold text-[#f5f1e8] shadow-[4px_4px_0_#dbe86b] animate-rise"><Check size={15} className="text-[#dbe86b]" />{notice}</div>}
    </div>
  );
}
*/

function ComparePage() {
  const { form, hasSubmitted } = usePathfinderContext();
  const [selected, setSelected] = useState(['189', '190', '482']);
  const [sort, setSort] = useState('fit');
  const guidanceQuery = useListGuidance();
  const visaData = guidanceQuery.data?.items ?? [];
  const workPurpose = isWorkPurpose(form.purpose);
  const ordered = useMemo(() => [...visaData].sort((a, b) => sort === 'fee' ? Number(a.governmentFee.replace(/\D/g, '')) - Number(b.governmentFee.replace(/\D/g, '')) : b.fitScore - a.fitScore), [sort, visaData]);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const comparisonRows: Array<[string, (visa: GuidanceItem) => React.ReactNode]> = [
    ['Indicative fit', (visa) => <strong className="font-display text-2xl">{visa.fitScore}%</strong>],
    ['Government fee', (visa) => <span>{visa.governmentFee}</span>],
    ['Typical decision', (visa) => <span>{visa.duration}</span>],
    ['Route shape', (visa) => <span>{visa.stage}</span>],
    ['Good to know', (visa) => <span className="max-w-[230px] leading-5 text-[#687183]">{visa.note}</span>],
  ];
  if (!hasSubmitted || !workPurpose || form.destination !== 'Australia') return <div><PageIntro eyebrow={hasSubmitted ? `${form.destination} comparison` : 'Set your planning context'} title={hasSubmitted ? (!workPurpose ? 'This purpose does not need a work-route comparison.' : 'Compare the routes for your selected destination.') : 'Choose a destination before comparing routes.'}>{hasSubmitted ? (!workPurpose ? `Your purpose is ${form.purpose.toLowerCase()}. Use the purpose-specific resources instead of comparing skilled work visas.` : `The detailed comparison table is currently maintained for Australia only. For ${form.destination}, use the pathway cards on Pathfinder and the context-filtered Resources page instead of seeing unrelated Australian routes.`) : 'Pathway comparisons are destination-specific. Return to Pathfinder, choose your passport, destination and purpose, then refresh your route.'}</PageIntro><div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center"><Globe2 size={24} className="mx-auto text-[#809084]" /><h2 className="mt-3 font-display text-2xl">{hasSubmitted ? (!workPurpose ? 'No work comparison for this purpose' : 'No Australia-only table here') : 'No comparison context yet'}</h2><p className="mt-2 text-[13px] text-[#687183]">{hasSubmitted ? (!workPurpose ? 'The comparison view is reserved for work-route research. Your current purpose stays focused on relevant evidence and destination guidance.' : `Your current context is ${form.destination} · ${form.purpose}. The workspace has been kept destination-aware so Australian fees and routes are not mixed into this view.`) : 'The comparison page will follow the committed Pathfinder context after you submit it.'}</p><Link href="/" data-testid="link-set-context-from-compare" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b]">{hasSubmitted ? `Open ${form.destination} Pathfinder` : 'Set Pathfinder context'} <ArrowRight size={15} /></Link></div></div>;
  return <div><PageIntro eyebrow="Compare with clarity" title="Side-by-side, without the sales pitch.">Put the routes you are considering next to each other. Fees are government charges only unless noted. Always confirm current figures at the official source.</PageIntro>
    {guidanceQuery.isLoading && <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center text-[13px] text-[#687183]">Loading the latest reviewed pathway guidance…</div>}
    {guidanceQuery.isError && <div role="alert" className="rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[13px] text-[#8d4a38]">Comparison guidance is temporarily unavailable. Please confirm figures on the official sources before making a decision.</div>}
    {!guidanceQuery.isLoading && !guidanceQuery.isError && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{visaData.map((visa) => <button type="button" key={visa.id} onClick={() => toggle(visa.visaSubclass)} data-testid={`button-toggle-visa-${visa.visaSubclass}`} className={`rounded-full border px-3 py-2 text-[12px] font-bold transition ${selected.includes(visa.visaSubclass) ? 'border-[#202842] bg-[#202842] text-[#dbe86b]' : 'border-[#d7dcd4] bg-[#fffdf7] text-[#687183]'}`}>{visa.shortName}</button>)}</div><button type="button" onClick={() => setSort(sort === 'fit' ? 'fee' : 'fit')} data-testid="button-sort-comparison" className="flex items-center gap-2 rounded-xl border border-[#d7dcd4] bg-[#fffdf7] px-3 py-2 text-[12px] font-bold text-[#4e586e]"><SlidersHorizontal size={14} />Sort by {sort === 'fit' ? 'fit' : 'fee'}</button></div>
    <div className="overflow-x-auto rounded-2xl border border-[#dce0d7] bg-[#fffdf7] shadow-[0_10px_26px_rgba(32,40,66,.04)]"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-[#dce0d7] bg-[#f0f3e8]"><th className="w-[190px] px-5 py-5 font-label text-[10px] uppercase tracking-[.13em] text-[#7c8490]">Route</th>{ordered.filter((visa) => selected.includes(visa.visaSubclass)).map((visa) => <th key={visa.id} className="px-5 py-5"><span className="font-label text-[10px] uppercase tracking-[.12em] text-[#7c8490]">{visa.shortName}</span><strong className="mt-1 block font-display text-xl">{visa.name}</strong><a href={visa.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#276047] hover:underline">{visa.sourceName} <ExternalLink size={11} /></a><span className="mt-1 block font-label text-[9px] text-[#8a919b]">Reviewed {formatReviewedDate(visa.reviewedOn)}</span></th>)}</tr></thead><tbody>{comparisonRows.map(([label, render]) => <tr key={label} className="border-b border-[#ecece4] last:border-0"><th className="px-5 py-5 align-top text-[12px] font-semibold text-[#7c8490]">{label}</th>{ordered.filter((visa) => selected.includes(visa.visaSubclass)).map((visa) => <td key={visa.id} className="px-5 py-5 align-top text-[13px] font-semibold">{render(visa)}</td>)}</tr>)}</tbody></table></div>
    <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#e8f1e8] p-4 text-[12px] leading-5 text-[#526457]"><Info size={16} className="mt-0.5 shrink-0 text-[#4e775d]" /><span>Comparison signals are educational estimates. An invitation, nomination or visa grant depends on current rules and your complete evidence. Each column links to its reviewed government source.</span></div></>}
  </div>;
}

function RoadmapsPage() {
  const { form, hasSubmitted } = usePathfinderContext();
  const [selectedStep, setSelectedStep] = useState(1);
  const [roadmap, setRoadmap] = useState('Skilled Independent · 189');
  const current = roadmapSteps.find((step) => step.id === selectedStep) ?? roadmapSteps[0];
  if (!hasSubmitted || form.destination !== 'Australia') return <div><PageIntro eyebrow={hasSubmitted ? `${form.destination} preparation` : 'Set your planning context'} title={hasSubmitted ? 'Build the evidence sequence for your route.' : 'Choose a destination before opening a roadmap.'}>{hasSubmitted ? 'The detailed milestone roadmap is currently maintained for Australia only. Your selected destination and purpose remain visible, while the document and source shelf is filtered to match them.' : 'Roadmaps are destination-specific. Set and submit your Pathfinder context before using this workspace.'}</PageIntro><div className="rounded-2xl bg-[#202842] p-7 text-[#f5f1e8]"><span className="font-label text-[10px] font-bold uppercase tracking-[.14em] text-[#dbe86b]">Current context</span><h2 className="mt-3 font-display text-4xl">{hasSubmitted ? `${form.destination} · ${form.purpose}` : 'No context submitted'}</h2><p className="mt-4 max-w-2xl text-[13px] leading-6 text-[#c5ccd2]">{hasSubmitted ? 'Start with identity, photo, health, character, translation and upload checklists. Open the official route source before preparing any country-specific evidence.' : 'Return to Pathfinder to choose your passport, destination and purpose.'}</p><Link href={hasSubmitted ? '/resources' : '/'} data-testid="link-context-resources-from-roadmaps" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#dbe86b] px-4 py-3 text-[12px] font-bold text-[#202842]">{hasSubmitted ? 'Open document resources' : 'Set Pathfinder context'} <ArrowRight size={15} /></Link></div></div>;
  return <div><PageIntro eyebrow="A route you can see" title="Turn a visa into a sequence of small moves.">Roadmaps make the hidden work visible — including the expensive, evidence-heavy parts that deserve your attention.</PageIntro>
    <div className="mb-6 flex flex-wrap gap-2"><button type="button" onClick={() => setRoadmap('Skilled Independent · 189')} data-testid="button-roadmap-189" className={`rounded-xl px-4 py-2.5 text-[12px] font-bold ${roadmap.includes('189') ? 'bg-[#202842] text-[#dbe86b]' : 'border border-[#d7dcd4] bg-[#fffdf7] text-[#687183]'}`}>Skilled Independent · 189</button><button type="button" onClick={() => setRoadmap('Skilled Nominated · 190')} data-testid="button-roadmap-190" className={`rounded-xl px-4 py-2.5 text-[12px] font-bold ${roadmap.includes('190') ? 'bg-[#202842] text-[#dbe86b]' : 'border border-[#d7dcd4] bg-[#fffdf7] text-[#687183]'}`}>Skilled Nominated · 190</button></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(340px,.8fr)_minmax(0,1.2fr)]"><div className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-4"><div className="mb-4 flex items-center justify-between px-2"><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#7c8490]">Five milestones</span><span className="rounded-full bg-[#e1f1d9] px-2.5 py-1 font-label text-[10px] font-bold text-[#276047]">0 / 5 complete</span></div><div className="relative space-y-2 before:absolute before:bottom-5 before:left-[28px] before:top-5 before:w-px before:bg-[#d7dcd4]">{roadmapSteps.map((step) => <button type="button" key={step.id} onClick={() => setSelectedStep(step.id)} data-testid={`button-roadmap-step-${step.id}`} className={`relative flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedStep === step.id ? 'bg-[#e8f1e8]' : 'hover:bg-[#f2f2e9]'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[12px] font-bold ${selectedStep === step.id ? 'border-[#7eaa4d] bg-[#dbe86b] text-[#202842]' : 'border-[#d7dcd4] bg-[#fffdf7] text-[#7c8490]'}`}>{step.id}</span><span><strong className="block text-[13px]">{step.title}</strong><span className="mt-0.5 block text-[11px] text-[#89918c]">{step.status} · {step.duration}</span></span><ChevronRight size={15} className="ml-auto text-[#96a098]" /></button>)}</div></div>
      <div className="rounded-2xl border border-[#dce0d7] bg-[#202842] p-6 text-[#f5f1e8] sm:p-8"><div className="flex items-start justify-between gap-3"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#dbe86b]">Milestone 0{current.id} · {current.status}</span><h2 className="mt-3 font-display text-4xl leading-none tracking-[-.04em]">{current.title}</h2></div><span className="grid h-11 w-11 place-items-center rounded-full bg-[#2d3858] text-[#dbe86b]"><span className="font-display text-xl">{current.id}</span></span></div><p className="mt-6 max-w-xl text-[14px] leading-6 text-[#c5ccd2]">{current.body}</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#2d3858] p-3"><Clock3 size={15} className="mb-3 text-[#8bcfc1]" /><span className="block font-label text-[9px] uppercase tracking-[.1em] text-[#96a0b3]">Time</span><strong className="mt-1 block text-[13px]">{current.duration}</strong></div><div className="rounded-xl bg-[#2d3858] p-3"><WalletCards size={15} className="mb-3 text-[#dbe86b]" /><span className="block font-label text-[9px] uppercase tracking-[.1em] text-[#96a0b3]">Direct cost</span><strong className="mt-1 block text-[13px]">{current.cost}</strong></div><div className="rounded-xl bg-[#2d3858] p-3"><CircleAlert size={15} className="mb-3 text-[#e99c7b]" /><span className="block font-label text-[9px] uppercase tracking-[.1em] text-[#96a0b3]">Risk to watch</span><strong className="mt-1 block text-[13px]">{current.risk}</strong></div></div><div className="mt-7 border-t border-[#3b4664] pt-6"><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#96a0b3]">Likely evidence</span><div className="mt-3 flex flex-wrap gap-2">{current.docs.map((doc) => <span key={doc} className="rounded-full border border-[#4a5672] px-3 py-1.5 text-[11px] text-[#dce2df]">{doc}</span>)}</div></div><button type="button" onClick={() => setSelectedStep((step) => Math.min(5, step + 1))} data-testid="button-roadmap-next" className="mt-7 flex items-center gap-2 rounded-xl bg-[#dbe86b] px-4 py-3 text-[12px] font-bold text-[#202842] transition hover:translate-x-1">Mark step understood <ArrowRight size={15} /></button></div></div>
  </div>;
}

const changeTypeLabels: Record<RegulationChange['changeType'], string> = {
  new_visa: 'New visa',
  fee_change: 'Fee change',
  occupation_list: 'Occupation list',
  policy_update: 'Policy update',
};

const alertTopics: AlertSubscriptionInput['topics'] = [
  'new_visa',
  'fee_change',
  'occupation_list',
  'policy_update',
];

function ChangeFeed({ changes, isLoading, isError }: { changes: RegulationChange[]; isLoading: boolean; isError: boolean }) {
  if (isLoading) return <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center text-[13px] text-[#687183]">Loading reviewed regulation updates…</div>;
  if (isError) return <div role="alert" className="rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[13px] text-[#8d4a38]">The change feed is temporarily unavailable. Check the official source pages before acting on a policy change.</div>;
  return <div className="space-y-3">{changes.map((change) => <article key={change.id} data-testid={`card-regulation-change-${change.id}`} className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#e8f1e8] px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[.07em] text-[#276047]">{changeTypeLabels[change.changeType]}</span><span className="font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">Reviewed {formatReviewedDate(change.reviewedOn)}</span></div><h3 className="mt-3 font-display text-[22px] tracking-[-.03em]">{change.title}</h3><p className="mt-2 text-[12px] leading-5 text-[#687183]">{change.summary}</p><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#ecece4] pt-3"><SourceBadge type={change.authority === 'official' ? 'Official' : 'Community'} /><a href={change.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#276047] hover:underline">{change.sourceName} <ExternalLink size={12} /></a>{change.effectiveOn && <span className="text-[10px] text-[#8a919b]">Effective {formatReviewedDate(change.effectiveOn)}</span>}</div></article>)}</div>;
}

function BellIcon() {
  return <Bell size={15} />;
}

type JobMarketPortal = {
  id: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  location: string;
  workMode: string;
  observedOn: string;
  freshnessState: 'fresh' | 'stale' | 'unavailable';
};

type JobMarketListing = {
  id: string;
  title: string;
  employer: string;
  location: string;
  workMode: string;
  sourceName: string;
  sourceUrl: string;
  postedOn: string | null;
  observedOn: string;
  availability: string;
  reviewStatus?: 'reviewed' | 'pending' | 'rejected';
  freshnessState: 'fresh' | 'stale' | 'unavailable';
  note: string;
};

type JobMarketResponse = {
  portals: JobMarketPortal[];
  listings: JobMarketListing[];
  reviewedAt: string;
  freshnessPolicy: string;
};

function JobMarketSection({ destination }: { destination: string; pathway?: GlobalPathway }) {
  const jobMarketQuery = useQuery<JobMarketResponse>({
    queryKey: ['/api/job-market', destination],
    queryFn: async () => {
      const response = await fetch(`/api/job-market?destination=${encodeURIComponent(destination)}`);
      if (!response.ok) throw new Error('Job market data unavailable');
      return response.json() as Promise<JobMarketResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const displayableRecords = getDisplayableJobMarketRecords({
    portals: jobMarketQuery.data?.portals ?? [],
    listings: jobMarketQuery.data?.listings ?? [],
  });
  const portals = displayableRecords.portals;
  const freshListings = displayableRecords.listings;
  const retiredListings = displayableRecords.suppressedListingCount;
  return <section className="mb-12 rounded-2xl border border-[#dce0d7] bg-[#eef3e9] p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#47715a]">Work-market check · {destination}</div><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Can you find work there?</h2><p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#687183]">Use live portals for the selected destination. Listings can close or change after this check; they are evidence of demand, not a job offer or immigration eligibility.</p></div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#fffdf7] px-3 py-2 font-label text-[10px] font-bold uppercase tracking-[.08em] text-[#687183]"><Clock3 size={13} />{jobMarketQuery.data ? `Reviewed ${formatReviewedDate(jobMarketQuery.data.reviewedAt)}` : 'Checking freshness…'}</span>
    </div>
    {jobMarketQuery.isLoading ? <div className="mt-6 rounded-xl border border-dashed border-[#c6cfc4] bg-[#fffdf7] p-5 text-[12px] text-[#687183]">Checking maintained job-market records…</div> : jobMarketQuery.isError ? <div role="alert" className="mt-6 rounded-xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[12px] text-[#8d4a38]">Job-market records are temporarily unavailable. No dated listings are being shown; use official live portals directly.</div> : <>{portals.length > 0 ? <div className="mt-6 grid gap-4 lg:grid-cols-4">
      {portals.map((portal) => <a key={portal.id} href={portal.sourceUrl} target="_blank" rel="noreferrer" data-testid={`link-job-portal-${portal.id}`} className="group flex min-h-[185px] flex-col rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-4 transition hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(32,40,66,.08)]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dcefeb] text-[#397669]"><BriefcaseBusiness size={18} /></span><h3 className="mt-4 font-display text-[20px] leading-tight tracking-[-.02em]">{portal.title}</h3><p className="mt-2 flex-1 text-[11px] leading-5 text-[#687183]">{portal.description}</p><div className="mt-3 flex items-center justify-between border-t border-[#ecece4] pt-3"><span className="font-label text-[9px] uppercase tracking-[.07em] text-[#8a919b]">{portal.location} · Live portal</span><ExternalLink size={13} className="text-[#276047]" /></div></a>)}
    </div> : <div className="mt-6 rounded-xl border border-dashed border-[#c6cfc4] bg-[#fffdf7] p-5 text-[12px] text-[#687183]">No maintained live employment portal is attached to this destination yet. Use the official immigration authority linked in the pathway card and verify local employment sources before relying on them.</div>}
    {freshListings.length > 0 ? <div className="mt-8"><div className="mb-4 flex items-center justify-between gap-3"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.12em] text-[#71806d]">Dated examples</span><h3 className="mt-1 font-display text-2xl tracking-[-.03em]">Recent {destination} postings</h3></div><span className="rounded-full bg-[#dbe86b] px-2.5 py-1 font-label text-[9px] font-bold uppercase tracking-[.08em]">Observed this month</span></div><div className="grid gap-3 lg:grid-cols-2">{freshListings.map((job) => <article key={job.id} data-testid={`card-current-job-${job.id}`} className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-4"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex items-center gap-1 rounded-full bg-[#e8f1e8] px-2 py-1 font-label text-[9px] font-bold uppercase tracking-[.08em] text-[#276047]"><CheckCircle2 size={11} />Dated example</span><h4 className="mt-3 font-display text-[21px] leading-tight tracking-[-.02em]">{job.title}</h4></div><MapPin size={16} className="mt-1 shrink-0 text-[#397669]" /></div><p className="mt-2 text-[12px] font-semibold text-[#526457]">{job.employer} · {job.location}</p><div className="mt-3 grid gap-2 text-[11px] text-[#687183] sm:grid-cols-2"><span><strong className="text-[#273049]">Posted:</strong> {job.postedOn ? formatReviewedDate(job.postedOn) : 'Not provided'}</span><span><strong className="text-[#273049]">Observed:</strong> {formatReviewedDate(job.observedOn)}</span><span><strong className="text-[#273049]">Work mode:</strong> {job.workMode}</span></div><p className="mt-3 text-[11px] leading-5 text-[#7c8490]">{job.note}</p><a href={job.sourceUrl} target="_blank" rel="noreferrer" data-testid={`link-current-job-${job.id}`} className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-[#276047] hover:underline">{job.sourceName} <ExternalLink size={12} /></a></article>)}</div></div> : <div className="mt-8 rounded-xl bg-[#fffdf7] p-4 text-[11px] leading-5 text-[#687183]">No dated examples are current enough to show. Live portals remain available above.</div>}
    {retiredListings > 0 && <p className="mt-4 text-[11px] text-[#7c8490]">{retiredListings} dated example{retiredListings === 1 ? '' : 's'} withheld because the observation is stale, unreviewed or the source is no longer available.</p>}</>}
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#e7d6ba] bg-[#fff5df] p-3 text-[11px] leading-5 text-[#735c35]"><CircleAlert size={15} className="mt-0.5 shrink-0" /><span>Always confirm the listing is still open, the employer can sponsor or hire your status, the work location, salary and language requirements, and the visa route before acting.</span></div>
  </section>;
}

function ContextResourceShelf({ resources: contextResources, destination }: { resources: ContextResource[]; destination: string }) {
  if (contextResources.length === 0) return null;
  return <section className="mb-12 rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7">
    <div className="mb-5"><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#47715a]">Document preparation · {destination}</div><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Get every file ready before you apply.</h2><p className="mt-2 max-w-3xl text-[13px] leading-5 text-[#687183]">These checklists explain what each evidence category usually means. They are templates and references, not a substitute for the selected destination’s current document instructions.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{contextResources.map((resource) => { const Icon = resource.icon; return <article key={resource.id} data-testid={`card-context-resource-${resource.id}`} className="flex min-h-[220px] flex-col rounded-2xl border border-[#dce0d7] bg-[#f7f8f2] p-5"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${resource.color === 'lime' ? 'bg-[#edf3c8] text-[#667c27]' : resource.color === 'aqua' ? 'bg-[#dcefeb] text-[#397669]' : resource.color === 'coral' ? 'bg-[#ffe7dc] text-[#a05a40]' : 'bg-[#f3e8cf] text-[#8a6835]'}`}><Icon size={19} /></span><SourceBadge type={resource.type} /></div><h3 className="mt-5 font-display text-[22px] leading-tight tracking-[-.03em]">{resource.title}</h3><p className="mt-2 flex-1 text-[12px] leading-5 text-[#687183]">{resource.desc}</p><div className="mt-4 flex items-center justify-between border-t border-[#dce0d7] pt-3 text-[10px] font-label uppercase tracking-[.08em] text-[#8a919b]"><span>{resource.time}</span>{resource.sourceUrl ? <a href={resource.sourceUrl} target="_blank" rel="noreferrer" data-testid={`link-context-resource-${resource.id}`} className="inline-flex items-center gap-1 font-bold text-[#276047] hover:underline">{resource.source} <ExternalLink size={11} /></a> : <span>{resource.source}</span>}</div></article>; })}</div>
  </section>;
}

function ResourcesPage() {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const { form, hasSubmitted } = usePathfinderContext();
  const changesQuery = useListChanges({ limit: 20 });
  const alertMutation = useCreateAlertSubscription();
  const guidanceQuery = useListGuidance();
  const destinationPathway = hasSubmitted ? globalPathways.find((pathway) => pathway.country === form.destination) : undefined;
  const purpose = form.purpose.toLowerCase();
  const isVisitor = hasSubmitted && (purpose.includes('visit') || purpose.includes('tour'));
  const officialSourceUrl = hasSubmitted && !isVisitor ? (destinationPathway?.sourceUrl ?? (form.destination === 'Australia' ? guidanceQuery.data?.items?.[0]?.sourceUrl : undefined)) : undefined;
  const officialSourceName = hasSubmitted && !isVisitor ? (destinationPathway?.sourceName ?? (form.destination === 'Australia' ? guidanceQuery.data?.items?.[0]?.sourceName : undefined) ?? `${form.destination} official immigration authority`) : 'Destination official immigration authority';
  const isWorkContext = hasSubmitted && (purpose.includes('work and settle') || purpose === 'work' || purpose.includes('work'));
  const purposeTag = isWorkContext ? 'work' : isVisitor ? 'visit' : purpose.includes('study') ? 'study' : purpose.includes('training') ? 'training' : 'business';
  const showLegacyResources = hasSubmitted && form.destination === 'Australia' && isWorkContext;
  const contextualDocuments = isVisitor ? [] : universalDocumentResources.map((resource) => ({ ...resource, source: officialSourceName, sourceUrl: officialSourceUrl }));
  const contextualVisitorResources = visitorResources;
  const contextualResources = [...contextualDocuments, ...(isVisitor ? contextualVisitorResources : [])];
  const filtered = showLegacyResources ? resources.filter((resource) => (filter === 'All' || resource.type === filter) && `${resource.title} ${resource.desc}`.toLowerCase().includes(query.toLowerCase())) : [];
  return <div><PageIntro eyebrow={hasSubmitted ? `${form.destination} source shelf` : 'The global source shelf'} title={isVisitor ? 'Prepare the visit, not a work plan.' : isWorkContext ? 'Prepare the route, then test the job market.' : hasSubmitted ? 'Prepare the route with the right evidence.' : 'Set your context, then open the right resources.'}>{isVisitor ? `Visitor resources stay focused on trip purpose, funds and return ties. Work, relocation and payroll materials are intentionally hidden for this context${form.destination === 'Australia' ? '; Australian Visitor visa streams and the Home Affairs visa finder are included below when configured.' : '.'}` : isWorkContext ? `Resources are filtered for ${form.destination}: current work-market sources, route evidence and document preparation. Other contexts are not mixed into this view.` : hasSubmitted ? `Resources are filtered for ${form.destination} and ${form.purpose.toLowerCase()}. Start with the document pack, then verify the destination authority’s current instructions.` : 'The page will show universal document preparation only until you submit a destination and purpose in Pathfinder.'}</PageIntro>
     {isVisitor && hasSubmitted && <VisitorVisaOptionsSection destinationCountry={form.destination} passportCountry={form.passport} />}
     {hasSubmitted && !isVisitor && <VisaResourceList destinationCountry={form.destination} passportCountry={form.passport} purposeTag={purposeTag} />}
    <ContextResourceShelf resources={contextualResources} destination={hasSubmitted ? form.destination : 'your destination'} />
    {isWorkContext && <JobMarketSection destination={form.destination} pathway={destinationPathway} />}
    {showLegacyResources && <><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row"><div className="flex flex-wrap gap-2">{['All', 'Official', 'Community', 'Template'].map((item) => <button type="button" key={item} onClick={() => setFilter(item)} data-testid={`button-resource-filter-${item.toLowerCase()}`} className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${filter === item ? 'bg-[#202842] text-[#dbe86b]' : 'border border-[#d7dcd4] bg-[#fffdf7] text-[#687183]'}`}>{item}</button>)}</div><label className="relative block sm:w-[260px]"><Search size={15} className="absolute left-3 top-3 text-[#8a919b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} data-testid="input-resource-search" placeholder="Search resources" className="w-full rounded-xl border border-[#d7dcd4] bg-[#fffdf7] py-2.5 pl-9 pr-3 text-[12px] outline-none focus:border-[#81a348]" /></label></div>
      {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-12 text-center"><Search size={25} className="mx-auto text-[#809084]" /><h2 className="mt-3 font-display text-2xl">No documents match that search.</h2><p className="mt-2 text-[13px] text-[#687183]">Try a broader phrase or switch the source filter.</p><button type="button" onClick={() => { setQuery(''); setFilter('All'); }} data-testid="button-clear-resource-search" className="mt-5 rounded-xl bg-[#202842] px-4 py-2.5 text-[12px] font-bold text-[#dbe86b]">Clear search</button></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((resource) => { const Icon = resource.icon; const isSaved = saved.includes(resource.id); return <article key={resource.id} data-testid={`card-resource-${resource.id}`} className="group flex min-h-[245px] flex-col rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 transition hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(32,40,66,.08)]"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${resource.color === 'lime' ? 'bg-[#edf3c8] text-[#667c27]' : resource.color === 'aqua' ? 'bg-[#dcefeb] text-[#397669]' : resource.color === 'coral' ? 'bg-[#ffe7dc] text-[#a05a40]' : 'bg-[#f3e8cf] text-[#8a6835]'}`}><Icon size={19} /></span><button type="button" onClick={() => setSaved((current) => isSaved ? current.filter((id) => id !== resource.id) : [...current, resource.id])} data-testid={`button-save-resource-${resource.id}`} className={`rounded-lg p-2 ${isSaved ? 'bg-[#dbe86b] text-[#202842]' : 'text-[#939b9f] hover:bg-[#edf0e8]'}`}><BookMarked size={16} /></button></div><div className="mt-5"><SourceBadge type={resource.type} /><h2 className="mt-3 font-display text-[23px] leading-tight tracking-[-.03em]">{resource.title}</h2><p className="mt-2 text-[12px] leading-5 text-[#687183]">{resource.desc}</p></div><div className="mt-auto flex items-center justify-between border-t border-[#ecece4] pt-4 text-[10px] font-label uppercase tracking-[.08em] text-[#8a919b]"><span>{resource.source}</span><span>{resource.time}</span></div></article>; })}</div>}
      <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[#e7d6ba] bg-[#fff5df] p-4 text-[12px] leading-5 text-[#735c35]"><CircleAlert size={16} className="mt-0.5 shrink-0" /><span>Community advice can be useful context, but it is not a source of law. Look for the official badge before relying on a date, fee or eligibility rule.</span></div></>}
    {showLegacyResources && <section className="mt-12 border-t border-[#dce0d7] pt-8">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#71806d]">Regulation watch</div><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">What has moved recently.</h2><p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#687183]">A reviewed feed for visa launches, government fees, occupation lists and policy updates. Every item links to its source.</p></div><button type="button" disabled={alertMutation.isPending || alertsEnabled} onClick={() => alertMutation.mutate({ data: { topics: alertTopics } }, { onSuccess: () => setAlertsEnabled(true) })} data-testid="button-subscribe-alerts" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b] disabled:cursor-not-allowed disabled:opacity-70">{alertsEnabled ? <Check size={15} /> : <BellIcon />} {alertsEnabled ? 'Alerts enabled' : alertMutation.isPending ? 'Enabling alerts…' : 'Enable change alerts'}</button></div>
      {alertMutation.isError && <p role="alert" className="mb-4 text-[12px] font-semibold text-[#a45138]">We could not enable alerts right now. No contact details were collected; please try again.</p>}
      {alertsEnabled && <p role="status" className="mb-4 text-[12px] text-[#276047]">You are subscribed to in-app updates for all four policy areas. No email, account or profile was saved.</p>}
      <ChangeFeed changes={changesQuery.data?.items ?? []} isLoading={changesQuery.isLoading} isError={changesQuery.isError} />
     </section>}
  </div>;
}

function ProfessionalsPage() {
  const { form, hasSubmitted } = usePathfinderContext();
  const [specialty, setSpecialty] = useState('All');
  const [lowestFirst, setLowestFirst] = useState(true);
  const [notice, setNotice] = useState('');
  const filtered = professionals.filter((person) => specialty === 'All' || person.specialties.includes(specialty)).sort((a, b) => lowestFirst ? Number(a.fee.replace(/\D/g, '')) - Number(b.fee.replace(/\D/g, '')) : 0);
  if (!hasSubmitted || form.destination !== 'Australia') return <div><PageIntro eyebrow={hasSubmitted ? `${form.destination} professional support` : 'Set your planning context'} title="Keep professional help in context.">{hasSubmitted ? `The current directory is maintained for Australia only. It is hidden for ${form.destination} so Australian provider fees and claims are not presented as relevant to your route.` : 'Choose and submit a destination before looking at professional support.'}</PageIntro><div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center"><ShieldCheck size={24} className="mx-auto text-[#809084]" /><h2 className="mt-3 font-display text-2xl">{hasSubmitted ? 'No local directory published' : 'No professional context yet'}</h2><p className="mt-2 text-[13px] text-[#687183]">{hasSubmitted ? `Use the official destination source and the document resources for ${form.destination} first.` : 'The professional directory will not assume Australia until Pathfinder is submitted.'}</p><Link href={hasSubmitted ? '/resources' : '/'} data-testid="link-context-resources-from-professionals" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b]">{hasSubmitted ? `Open ${form.destination} resources` : 'Set Pathfinder context'} <ArrowRight size={15} /></Link></div></div>;
  return <div><PageIntro eyebrow="When you want a second opinion" title="Professionals, with the price tag up front.">A directory for the moments you genuinely want advice. No paid placement, no hidden lead fee and no pressure to book.</PageIntro>
    <div className="mb-6 rounded-2xl bg-[#202842] p-5 text-[#f5f1e8] sm:p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 shrink-0 text-[#dbe86b]" size={20} /><div><strong className="block text-[14px]">How this directory works</strong><p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#bfc7d0]">Fees are self-reported and shown before contact. Metrics are included for comparison, not as a promise of an outcome.</p></div></div><span className="whitespace-nowrap rounded-full bg-[#2d3858] px-3 py-2 font-label text-[10px] font-bold uppercase tracking-[.08em] text-[#dbe86b]">4 listed · 0 sponsored</span></div></div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{['All', 'Skilled', 'Employer', 'Partner'].map((item) => <button type="button" key={item} onClick={() => setSpecialty(item)} data-testid={`button-professional-filter-${item.toLowerCase()}`} className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${specialty === item ? 'bg-[#202842] text-[#dbe86b]' : 'border border-[#d7dcd4] bg-[#fffdf7] text-[#687183]'}`}>{item}</button>)}</div><button type="button" onClick={() => setLowestFirst((value) => !value)} data-testid="button-sort-fee" className="flex items-center gap-2 rounded-xl border border-[#d7dcd4] bg-[#fffdf7] px-3 py-2 text-[12px] font-bold text-[#4e586e]"><ArrowDownUp size={14} />{lowestFirst ? 'Lowest fee first' : 'Recommended order'}</button></div>
    <div className="space-y-3">{filtered.map((person, index) => <article key={person.id} data-testid={`card-professional-${person.id}`} className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 transition hover:border-[#a8bc87] hover:shadow-[0_12px_26px_rgba(32,40,66,.07)] sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><div className="flex min-w-[280px] items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dcefeb] font-label text-[12px] font-bold text-[#397669]">{person.initials}</span><div><div className="flex items-center gap-2"><h2 className="font-display text-[22px] tracking-[-.03em]">{person.name}</h2>{person.verified && <BadgeCheck size={15} className="text-[#4b8b69]" />}</div><p className="mt-1 text-[12px] text-[#7c8490]">{person.city}</p></div></div><div className="grid flex-1 gap-4 sm:grid-cols-3"><div><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Starting fee</span><strong className="mt-1 block text-[15px]">{person.fee}</strong></div><div><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Experience</span><strong className="mt-1 block text-[13px]">{person.cases}</strong></div><div><span className="font-label text-[9px] uppercase tracking-[.1em] text-[#8a919b]">Client rating</span><strong className="mt-1 block text-[13px]">{person.success}</strong></div></div><div className="flex items-center gap-3 lg:w-[175px] lg:justify-end"><div className="flex flex-wrap gap-1.5">{person.specialties.map((tag) => <span key={tag} className="rounded-full bg-[#eef0e8] px-2 py-1 text-[10px] font-bold text-[#667066]">{tag}</span>)}</div><button type="button" onClick={() => setNotice(`${person.name} is saved for your shortlist.`)} data-testid={`button-save-professional-${person.id}`} className="rounded-xl bg-[#dbe86b] p-3 text-[#202842] transition hover:scale-105"><Check size={16} /></button></div></div><div className="mt-4 flex items-center gap-2 border-t border-[#ecece4] pt-3 text-[11px] text-[#7c8490]"><Clock3 size={13} />{person.response}<span className="mx-1 text-[#c2c8c3]">·</span><span>Fee shown is an initial scope estimate; request a written quote.</span></div></article>)}</div>
    {notice && <div role="status" data-testid="status-professional-notice" className="fixed bottom-5 right-5 z-40 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-semibold text-[#f5f1e8] shadow-[4px_4px_0_#dbe86b] animate-rise">{notice}</div>}
  </div>;
}

function CostsPage() {
  const { form, hasSubmitted } = usePathfinderContext();
  const [includePartner, setIncludePartner] = useState(true);
  const [includeAgent, setIncludeAgent] = useState(false);
  const [rent, setRent] = useState('2400');
  const government = includePartner ? 4765 + 2395 : 4765;
  const settlement = Number(rent) * 3 + 3500;
  const extras = includeAgent ? 1850 + 410 : 410;
  const total = government + settlement + extras;
  const money = (value: number) => `$${value.toLocaleString('en-AU')}`;
  if (!hasSubmitted || form.destination !== 'Australia') return <div><PageIntro eyebrow={hasSubmitted ? `${form.destination} cost context` : 'Set your planning context'} title={hasSubmitted ? 'Do not reuse an Australian cost model.' : 'Choose a destination before planning costs.'}>{hasSubmitted ? 'Government fees, currency, health checks, proof-of-funds expectations and settlement costs vary by destination and purpose.' : 'Cost planning is destination-specific. Submit Pathfinder first so this page does not show unrelated Australian figures.'}</PageIntro><div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-8 text-center"><Calculator size={24} className="mx-auto text-[#809084]" /><h2 className="mt-3 font-display text-2xl">{hasSubmitted ? 'Destination cost model not published' : 'No cost context yet'}</h2><p className="mt-2 text-[13px] text-[#687183]">{hasSubmitted ? `Your current context is ${form.destination} · ${form.purpose}. Use the official pathway source and document resources rather than applying Australian dollar figures.` : 'Return to Pathfinder to set the destination and purpose.'}</p><Link href={hasSubmitted ? '/resources' : '/'} data-testid="link-context-resources-from-costs" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b]">{hasSubmitted ? `Open ${form.destination} resources` : 'Set Pathfinder context'} <ArrowRight size={15} /></Link></div></div>;
  return <div><PageIntro eyebrow="The cost of getting there" title="Plan for the full number, not just the visa fee.">A simple scenario planner for the first year. Change the assumptions and see what moves. Currency is AUD and figures are indicative.</PageIntro>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(380px,1.1fr)]"><section className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3c8] text-[#667c27]"><SlidersHorizontal size={19} /></span><div><h2 className="font-display text-2xl">Your scenario</h2><p className="text-[12px] text-[#7c8490]">Toggle what applies to you.</p></div></div><div className="space-y-3"><label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#dce0d7] p-4"><span><strong className="block text-[13px]">Include partner visa applicant</strong><span className="text-[11px] text-[#7c8490]">Adds an additional government applicant charge</span></span><input type="checkbox" checked={includePartner} onChange={(event) => setIncludePartner(event.target.checked)} data-testid="input-include-partner" className="h-5 w-5 accent-[#7eaa4d]" /></label><label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#dce0d7] p-4"><span><strong className="block text-[13px]">Budget for professional help</strong><span className="text-[11px] text-[#7c8490]">A placeholder mid-range initial scope</span></span><input type="checkbox" checked={includeAgent} onChange={(event) => setIncludeAgent(event.target.checked)} data-testid="input-include-professional" className="h-5 w-5 accent-[#7eaa4d]" /></label><label className="block rounded-xl border border-[#dce0d7] p-4"><span className="block text-[13px] font-bold">Monthly rent target</span><span className="mt-1 block text-[11px] text-[#7c8490]">Used for a three-month arrival buffer</span><div className="mt-3 flex items-center gap-2"><span className="text-sm text-[#7c8490]">$</span><input type="number" value={rent} onChange={(event) => setRent(event.target.value)} data-testid="input-monthly-rent" className="w-full rounded-lg border border-[#d7dcd4] bg-[#f7f4ec] px-3 py-2 text-sm font-bold outline-none focus:border-[#81a348]" /><span className="text-[11px] text-[#7c8490]">/ month</span></div></label></div><div className="mt-6 rounded-xl bg-[#fff5df] p-4 text-[11px] leading-5 text-[#735c35]"><Info size={14} className="mb-1" />Government fees change. Confirm on the official visa page before you pay.</div></section><section className="rounded-2xl bg-[#202842] p-6 text-[#f5f1e8] sm:p-8"><div className="flex items-start justify-between"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.14em] text-[#dbe86b]">Indicative first-year plan</span><div data-testid="text-total-migration-cost" className="mt-3 font-display text-5xl tracking-[-.05em]">{money(total)}</div><p className="mt-2 text-[12px] text-[#bfc7d0]">including visa, arrival buffer and selected extras</p></div><Calculator size={23} className="text-[#8bcfc1]" /></div><div className="mt-8 space-y-4">{[['Government charges', government, '#dbe86b'], ['Arrival buffer', settlement, '#8bcfc1'], ['English + help', extras, '#e99c7b']].map(([label, amount, color]) => <div key={label as string}><div className="mb-1 flex justify-between text-[12px]"><span className="text-[#c5ccd2]">{label as string}</span><strong>{money(amount as number)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#35405f]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, ((amount as number) / total) * 100 * 2.1)}%`, backgroundColor: color as string }} /></div></div>)}</div><div className="mt-8 border-t border-[#3b4664] pt-5"><div className="flex justify-between text-[11px] text-[#aeb8c4]"><span>Biggest lever</span><span>Rent / arrival buffer</span></div><p className="mt-2 text-[12px] leading-5 text-[#c5ccd2]">Your visa fee is only one line in the journey. Keeping a cash buffer protects your choices after arrival.</p></div></section></div>
  </div>;
}

function ScamCheckPage() {
  const [proposal, setProposal] = useState('Pay $7,800 today to guarantee your skilled visa invitation. We will lodge everything for you and you do not need to check the official website.');
  const [analyzed, setAnalyzed] = useState(true);
  const flags = useMemo(() => { const text = proposal.toLowerCase(); return [{ term: 'Guarantee language', detail: 'No one can guarantee an invitation or visa grant.', hit: text.includes('guarantee') || text.includes('guaranteed') }, { term: 'Urgency or upfront pressure', detail: 'A demand to pay today is a reason to pause and verify.', hit: text.includes('today') || text.includes('now') || text.includes('urgent') }, { term: 'Missing fee breakdown', detail: 'A written scope should separate government fees from professional fees.', hit: text.includes('$') && !text.includes('government') }, { term: 'Official-source distance', detail: 'You should be able to verify every claim on an official site.', hit: text.includes('official') || text.includes('home affairs') }]; }, [proposal]);
  const flagged = flags.filter((flag) => flag.hit).length;
  return <div><PageIntro eyebrow="Pause before you pay" title="Read the fine print with fresh eyes.">Paste a proposal, quote or message. This tool highlights language patterns worth questioning — it does not determine whether a person is a registered professional.</PageIntro>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.82fr)]"><section className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-2xl">Paste the message</h2><p className="mt-1 text-[12px] text-[#7c8490]">Nothing is uploaded or saved in this demo.</p></div><FileWarningIcon /></div><textarea value={proposal} onChange={(event) => { setProposal(event.target.value); setAnalyzed(false); }} data-testid="textarea-agent-proposal" className="min-h-[260px] w-full resize-y rounded-xl border border-[#d7dcd4] bg-[#f7f4ec] p-4 text-[13px] leading-6 text-[#3e485e] outline-none focus:border-[#81a348] focus:ring-2 focus:ring-[#dbe86b]/60" /><button type="button" onClick={() => setAnalyzed(true)} data-testid="button-analyze-proposal" className="mt-4 flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b] transition hover:translate-x-1">Analyze red flags <ShieldCheck size={16} /></button></section><section className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7">{!analyzed ? <div className="flex min-h-[350px] flex-col items-center justify-center text-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-[#eef0e8] text-[#7b8d7d]"><ShieldCheck size={24} /></span><h2 className="mt-4 font-display text-2xl">Ready when you are.</h2><p className="mt-2 max-w-xs text-[12px] leading-5 text-[#7c8490]">Run the analysis after you finish pasting the complete message.</p></div> : <><div className={`rounded-xl p-4 ${flagged > 1 ? 'bg-[#ffe9df]' : 'bg-[#e1f1d9]'}`}><div className="flex items-center gap-2">{flagged > 1 ? <CircleAlert size={19} className="text-[#a45138]" /> : <CheckCircle2 size={19} className="text-[#276047]" />}<strong className="text-[15px]">{flagged} pattern{flagged === 1 ? '' : 's'} worth checking</strong></div><p className="mt-2 text-[12px] leading-5 text-[#66706c]">{flagged > 1 ? 'Do not send money until each point is answered in writing.' : 'Still verify the person and the written scope independently.'}</p></div><div className="mt-6 space-y-3">{flags.map((flag) => <div key={flag.term} className="flex gap-3 border-b border-[#ecece4] pb-3 last:border-0"><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${flag.hit ? 'bg-[#ffe4dc] text-[#a45138]' : 'bg-[#e1f1d9] text-[#276047]'}`}>{flag.hit ? <CircleAlert size={13} /> : <Check size={13} />}</span><div><strong className="block text-[13px]">{flag.term}</strong><span className="mt-1 block text-[11px] leading-5 text-[#7c8490]">{flag.detail}</span></div></div>)}</div><div className="mt-4 rounded-xl bg-[#f0f3e8] p-3 text-[11px] leading-5 text-[#526457]"><strong>Next safe step:</strong> ask for the migration agent's registration details, an itemised quote and links to the official rule behind every promise.</div></>}</section></div>
    <div className="mt-6 rounded-2xl bg-[#202842] p-5 text-[12px] leading-5 text-[#c5ccd2]"><div className="flex items-start gap-3"><Flag size={17} className="mt-0.5 shrink-0 text-[#dbe86b]" /><span>This is pattern recognition, not a legal or regulatory finding. For urgent concerns, contact the relevant regulator or consumer protection body in your country.</span></div></div>
  </div>;
}

function FileWarningIcon() { return <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffe7dc] text-[#a05a40]"><CircleAlert size={19} /></span>; }

function SetupPage() {
  const { form, hasSubmitted } = usePathfinderContext();
  const [active, setActive] = useState('tax');
  const [done, setDone] = useState<string[]>([]);
  const current = setupItems.find((item) => item.id === active) ?? setupItems[0];
  if (!hasSubmitted || form.destination !== 'Australia') return <div><PageIntro eyebrow={hasSubmitted ? `${form.destination} settlement context` : 'Set your planning context'} title={hasSubmitted ? 'Keep arrival guidance destination-specific.' : 'Choose a destination before opening setup guidance.'}>{hasSubmitted ? `The detailed admin checklist is currently maintained for Australia only. It is hidden for ${form.destination} so tax, healthcare, banking and driving advice is not mistaken for a universal rule.` : 'Setup guidance depends on destination and purpose. Submit Pathfinder first.'}</PageIntro><div className="rounded-2xl bg-[#202842] p-7 text-[#f5f1e8]"><span className="font-label text-[10px] font-bold uppercase tracking-[.14em] text-[#dbe86b]">Selected purpose</span><h2 className="mt-3 font-display text-4xl">{hasSubmitted ? form.purpose : 'No context submitted'}</h2><p className="mt-4 max-w-2xl text-[13px] leading-6 text-[#c5ccd2]">{hasSubmitted ? `For ${form.destination}, start with the official route source and the context-filtered document resources. Settlement, tax and healthcare rules need destination-specific evidence.` : 'Return to Pathfinder to set the destination and purpose.'}</p><Link href={hasSubmitted ? '/resources' : '/'} data-testid="link-context-resources-from-setup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#dbe86b] px-4 py-3 text-[12px] font-bold text-[#202842]">{hasSubmitted ? 'Open document resources' : 'Set Pathfinder context'} <ArrowRight size={15} /></Link></div></div>;
  return <div><PageIntro eyebrow="Landing well" title="Your first Australian admin, in plain English.">A practical setup list for the first weeks after arrival. Start with the things that unlock work, care and a stable home.</PageIntro>
    <div className="grid gap-6 lg:grid-cols-[minmax(250px,.62fr)_minmax(0,1.38fr)]"><div className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-3"><div className="mb-3 px-3 pt-2 font-label text-[10px] font-bold uppercase tracking-[.14em] text-[#7c8490]">Setup checklist</div>{setupItems.map((item) => { const Icon = item.icon; const isDone = done.includes(item.id); return <button type="button" key={item.id} onClick={() => setActive(item.id)} data-testid={`button-setup-${item.id}`} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${active === item.id ? 'bg-[#e8f1e8]' : 'hover:bg-[#f2f2e9]'}`}><span className={`grid h-9 w-9 place-items-center rounded-xl ${isDone ? 'bg-[#dbe86b] text-[#202842]' : 'bg-[#eef0e8] text-[#687183]'}`}>{isDone ? <Check size={16} /> : <Icon size={16} />}</span><span className="flex-1"><strong className="block text-[12px]">{item.label}</strong><span className="mt-0.5 block text-[10px] text-[#8a919b]">{isDone ? 'Done for now' : item.source}</span></span><ChevronRight size={14} className="text-[#9ca59e]" /></button>; })}</div><div className="rounded-2xl bg-[#202842] p-6 text-[#f5f1e8] sm:p-8"><div className="flex items-start justify-between"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.14em] text-[#dbe86b]">Setup note</span><h2 className="mt-3 font-display text-4xl tracking-[-.045em]">{current.label}</h2></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2d3858] text-[#8bcfc1]"><current.icon size={22} /></span></div><p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#c5ccd2]">{current.summary}</p><div className="mt-8 rounded-xl bg-[#2d3858] p-4"><div className="flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-[.11em] text-[#96a0b3]"><BadgeCheck size={14} className="text-[#8bcfc1]" />Source trail</div><p className="mt-2 text-[12px] text-[#d7dfe0]">{current.source}</p><button type="button" data-testid={`button-open-source-${current.id}`} onClick={() => window.alert('In the full version, this opens the labelled source trail.')} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#dbe86b]">View source trail <ExternalLink size={13} /></button></div><button type="button" onClick={() => setDone((currentDone) => currentDone.includes(current.id) ? currentDone.filter((id) => id !== current.id) : [...currentDone, current.id])} data-testid={`button-mark-setup-${current.id}`} className="mt-7 flex items-center gap-2 rounded-xl bg-[#dbe86b] px-4 py-3 text-[12px] font-bold text-[#202842] transition hover:translate-x-1">{done.includes(current.id) ? <Check size={15} /> : <ListChecks size={15} />}{done.includes(current.id) ? 'Marked complete' : 'Mark this as done'}</button></div></div>
    <div className="mt-7 rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#edf3c8] text-[#667c27]"><Sparkles size={17} /></div><div><strong className="text-[13px]">Small wins add up</strong><p className="text-[12px] text-[#7c8490]">{done.length} of {setupItems.length} setup items marked as done. Keep this list as a gentle first-month guide.</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0e8]"><div className="h-full rounded-full bg-[#b8d247] transition-all" style={{ width: `${(done.length / setupItems.length) * 100}%` }} /></div></div>
  </div>;
}

function WorkspaceReminder() {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#e7d6ba] bg-[#fff5df] p-4 text-[12px] leading-5 text-[#735c35]"><Info size={16} className="mt-0.5 shrink-0" /><span><strong className="font-bold">Keep checking the source.</strong> This workspace is educational. Dates, fees and rules can change, so recheck every decision against the labelled official sources before acting.</span></div>;
}
function NotFound() {
  return <div className="mx-auto max-w-xl py-24 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#dbe86b] text-[#202842]"><Compass size={27} /></div><h1 className="mt-6 font-display text-5xl">This path is unmapped.</h1><p className="mt-3 text-sm text-[#687183]">The page you requested is not part of this route yet.</p><Link href="/" data-testid="link-back-home" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b]">Back to Pathfinder <ArrowRight size={15} /></Link></div>;
}

function Router() {
  return <Shell><Switch><Route path="/" component={Home} /><Route path="/workspace" component={WorkspacePage} /><Route path="/workspace/:id" component={WorkspaceDetailPage} /><Route path="/compare" component={ComparePage} /><Route path="/roadmaps" component={RoadmapsPage} /><Route path="/resources" component={ResourcesPage} /><Route path="/professionals" component={ProfessionalsPage} /><Route path="/costs" component={CostsPage} /><Route path="/scam-check" component={ScamCheckPage} /><Route path="/setup" component={SetupPage} /><Route component={NotFound} /></Switch></Shell>;
}

function App() {
  return <PathfinderProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></PathfinderProvider>;
}

export default App;

function buildSavedPlanInput(form: PathfinderForm, visas: GuidanceItem[]): SavedPlanInput {
  const rules = getPurposePlanningRules(form.purpose);
  if (!rules.allowPlanSave) throw new Error(`Saved planning is not available for ${form.purpose}.`);
  const purposeContext = buildSavedPlanningContext(form);
  const purposeSpecific = rules.showStudyFields || rules.showBusinessFields;
  const evidenceSummary = purposeContext.evidence.map((item) => item.value).join(' · ');
  return {
    name: (purposeSpecific
      ? `${form.purpose} · ${form.destination} · ${evidenceSummary}`
      : `${form.occupation} · ${form.destination}`).slice(0, 100),
    pathway: purposeSpecific ? savedPathwayForPurpose(form.purpose) : savedPathwayFromGuidance(visas[0]),
    comparison: purposeSpecific ? [] : savedComparisonFromGuidance(visas),
    roadmap: purposeSpecific
      ? { roadmapId: `purpose-${form.purpose === 'Study' ? 'study' : 'business'}`, roadmapLabel: `${form.purpose} preparation`, completedStepIds: [] }
      : { roadmapId: 'skilled-independent-189', roadmapLabel: 'Skilled Independent · 189', completedStepIds: [] },
    documentChecklist: purposeSpecific ? purposePlanDocuments(form.purpose) : savedPlanDocuments(),
    costAssumptions: { ...defaultSavedCosts },
    planningContext: purposeContext,
  };
}

function buildSavedPlanningContext(form: PathfinderForm): NonNullable<SavedPlanInput['planningContext']> {
  const purpose = form.purpose === 'Study'
    ? 'Study'
    : form.purpose === 'Start a business'
      ? 'Start a business'
      : 'Work and settle';
  return {
    purpose,
    passportCountry: form.passport,
    destination: form.destination,
    evidence: purposeEvidenceRows(form).map(({ label, value }) => ({
      label: label.slice(0, 60),
      value: value.slice(0, 120),
    })),
  };
}

function savedPathwayForPurpose(purpose: string): SavedPlanInput['pathway'] {
  const isStudy = purpose === 'Study';
  return {
    visaSubclass: isStudy ? 'STUDY-PLAN' : 'BUSINESS-PLAN',
    name: isStudy ? 'Study preparation' : 'Business preparation',
    shortName: isStudy ? 'Study' : 'Business',
    fitScore: 0,
    governmentFee: 'Not estimated',
    stage: 'Check destination requirements',
  };
}

function purposePlanDocuments(purpose: string): SavedPlanDocument[] {
  const labels = purpose === 'Study'
    ? [
      'Passport and identity records',
      'Institution application or offer documents',
      'Evidence of study funding and its source',
      'Check the destination authority’s current student requirements',
    ]
    : [
      'Business plan and operating model',
      'Evidence of investment amount and source of funds',
      'Ownership and operating-intent records',
      'Check the destination authority’s current business requirements',
    ];
  return labels.map((label, index) => ({
    id: `purpose-evidence-${index + 1}`,
    label,
    completed: false,
  }));
}

function WorkspacePage() {
  const plansQuery = useListSavedPlans();
  const plans = plansQuery.data?.items ?? [];
  return <div>
    <PageIntro
      eyebrow="Your private planning desk"
      title="Plans that wait for you."
      action={<Link href="/" data-testid="link-workspace-new-plan" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b] shadow-[3px_3px_0_#b8d247] transition hover:translate-y-[-2px]"><Compass size={15} /> Start a new plan</Link>}
    >
      Your saved plans live in this anonymous browser workspace. Pick up the evidence, costs and next small move whenever you are ready.
    </PageIntro>
    <WorkspaceReminder />
    {plansQuery.isLoading && <div className="mt-7 grid gap-4 md:grid-cols-2" aria-label="Loading saved plans">{[1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-[#dce0d7] bg-[#eef0e8]" />)}</div>}
    {plansQuery.isError && <div className="mt-7 rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[13px] text-[#8d4a38]" role="alert"><strong className="block">Your workspace could not be loaded.</strong><span className="mt-1 block">The browser-scoped plan list is temporarily unavailable.</span><button type="button" onClick={() => plansQuery.refetch()} data-testid="button-retry-workspace" className="mt-4 rounded-xl bg-[#202842] px-4 py-2.5 text-[12px] font-bold text-[#dbe86b]">Try again</button></div>}
    {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 && <div className="mt-7 rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] px-6 py-14 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#dbe86b] text-[#202842] shadow-[3px_3px_0_#b8d247]"><LayoutDashboard size={24} /></span><h2 className="mt-5 font-display text-3xl tracking-[-.035em]">No saved plans yet.</h2><p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#687183]">Start with the Pathfinder, then save a useful snapshot when the route begins to take shape. Nothing here needs an account.</p><Link href="/" data-testid="link-empty-workspace-start" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b]">Build your first plan <ArrowRight size={15} /></Link></div>}
    {!plansQuery.isLoading && !plansQuery.isError && plans.length > 0 && <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => {
        const roadmapDone = plan.roadmap.completedStepIds.length;
        const documentsDone = plan.documentChecklist.filter((document) => document.completed).length;
        return <Link href={`/workspace/${plan.id}`} key={plan.id} data-testid={`card-saved-plan-${plan.id}`} className="group flex min-h-[238px] flex-col rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#a8bc87] hover:shadow-[0_18px_35px_rgba(32,40,66,.1)]">
          <div className="flex items-start justify-between gap-4"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#7c8490]">{plan.pathway.shortName} · saved plan</span><h2 data-testid={`text-saved-plan-name-${plan.id}`} className="mt-2 font-display text-[25px] leading-tight tracking-[-.035em]">{plan.name}</h2></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3c8] text-[#667c27] transition group-hover:bg-[#dbe86b]"><Pencil size={17} /></span></div>
           <p className="mt-3 text-[12px] text-[#687183]">{plan.planningContext ? `${plan.planningContext.passportCountry} → ${plan.planningContext.destination} · ${plan.planningContext.purpose}` : plan.pathway.name}</p>
           {plan.planningContext?.evidence.length ? <dl data-testid={`summary-saved-plan-evidence-${plan.id}`} className="mt-3 grid gap-1.5 border-t border-[#ecece4] pt-3">{plan.planningContext.evidence.map((item) => <div key={item.label} className="flex flex-wrap gap-x-2 text-[11px] leading-4"><dt className="font-semibold text-[#7c8490]">{item.label}:</dt><dd className="text-[#3e485e]">{item.value}</dd></div>)}</dl> : null}
          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-[#ecece4] pt-4"><div><span className="block font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">Roadmap</span><strong className="mt-1 block text-[13px]">{roadmapDone} / {roadmapSteps.length}</strong></div><div><span className="block font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">Documents</span><strong className="mt-1 block text-[13px]">{documentsDone} / {plan.documentChecklist.length}</strong></div><div><span className="block font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">Updated</span><strong className="mt-1 block text-[13px]">{formatReviewedDate(plan.updatedAt)}</strong></div></div>
        </Link>;
      })}
    </div>}
  </div>;
}

function savedPathwayFromGuidance(visa: GuidanceItem | undefined): SavedPlanInput['pathway'] {
  return {
    visaSubclass: visa?.visaSubclass ?? '189',
    name: visa?.name ?? 'Skilled Independent visa',
    shortName: visa?.shortName ?? '189',
    fitScore: visa?.fitScore ?? 0,
    governmentFee: visa?.governmentFee ?? 'Confirm current fee',
    stage: visa?.stage ?? 'Research eligibility',
  };
}

function WorkspaceDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const queryClient = useQueryClient();
  const planQuery = useGetSavedPlan(id, { query: { enabled: Boolean(id), queryKey: getGetSavedPlanQueryKey(id) } });
  const guidanceQuery = useListGuidance();
  const updateMutation = useUpdateSavedPlan();
  const [draft, setDraft] = useState<SavedPlanInput | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (planQuery.data && planQuery.data.id === id) {
      const plan = planQuery.data;
      setDraft({
        name: plan.name,
        pathway: { ...plan.pathway },
        comparison: plan.comparison.map((item) => ({ ...item })),
        roadmap: { ...plan.roadmap, completedStepIds: [...plan.roadmap.completedStepIds] },
        documentChecklist: plan.documentChecklist.map((document) => ({ ...document })),
        costAssumptions: { ...plan.costAssumptions },
        planningContext: plan.planningContext ? {
          ...plan.planningContext,
          evidence: plan.planningContext.evidence.map((item) => ({ ...item })),
        } : null,
      });
      setSavedMessage('');
    }
  }, [id, planQuery.data]);

  const updateDraft = (change: (current: SavedPlanInput) => SavedPlanInput) => setDraft((current) => current ? change(current) : current);
  const updatePurposeEvidence = (label: string, value: string) => updateDraft((current) => {
    const context = current.planningContext;
    if (!context) return current;
    const hasEvidence = context.evidence.some((item) => item.label === label);
    const evidence = hasEvidence
      ? context.evidence.map((item) => item.label === label ? { ...item, value } : item)
      : [...context.evidence, { label, value }];
    return { ...current, planningContext: { ...context, evidence } };
  });
  const updateCosts = (change: Partial<SavedPlanCostAssumptions>) => updateDraft((current) => {
    const next = { ...current.costAssumptions, ...change };
    next.total = next.government + next.settlement + next.extras;
    return { ...current, costAssumptions: next };
  });
  const toggleRoadmapStep = (stepId: number) => updateDraft((current) => {
    const completedStepIds = current.roadmap.completedStepIds.includes(stepId)
      ? current.roadmap.completedStepIds.filter((idValue) => idValue !== stepId)
      : [...current.roadmap.completedStepIds, stepId].sort((a, b) => a - b);
    return { ...current, roadmap: { ...current.roadmap, completedStepIds } };
  });
  const toggleDocument = (documentId: string) => updateDraft((current) => ({ ...current, documentChecklist: current.documentChecklist.map((document) => document.id === documentId ? { ...document, completed: !document.completed } : document) }));
  const availableComparisons = useMemo(() => {
    const saved = draft?.comparison ?? [];
    const fromGuidance = (guidanceQuery.data?.items ?? []).map((visa) => ({
      visaSubclass: visa.visaSubclass,
      name: visa.name,
      shortName: visa.shortName,
      fitScore: visa.fitScore,
      governmentFee: visa.governmentFee,
      stage: visa.stage,
    }));
    const bySubclass = new Map<string, SavedPlanComparisonItem>();
    [...saved, ...fromGuidance].forEach((item) => bySubclass.set(item.visaSubclass, item));
    return [...bySubclass.values()];
  }, [draft?.comparison, guidanceQuery.data?.items]);
  const toggleComparison = (item: SavedPlanComparisonItem) => updateDraft((current) => ({
    ...current,
    comparison: current.comparison.some((saved) => saved.visaSubclass === item.visaSubclass)
      ? current.comparison.filter((saved) => saved.visaSubclass !== item.visaSubclass)
      : [...current.comparison, item].slice(0, 10),
  }));
  const saveChanges = () => {
    if (!draft || !id) return;
    updateMutation.mutate({ id, data: draft }, {
      onSuccess: (savedPlan: SavedPlan) => {
        queryClient.setQueryData(getGetSavedPlanQueryKey(id), savedPlan);
        queryClient.invalidateQueries({ queryKey: getListSavedPlansQueryKey() });
        setSavedMessage('Saved just now');
      },
    });
  };

  if (planQuery.isLoading || !id) return <div className="space-y-5"><div className="h-5 w-32 animate-pulse rounded bg-[#e5e9df]" /><div className="h-20 w-2/3 animate-pulse rounded-2xl bg-[#eef0e8]" /><div className="h-72 animate-pulse rounded-2xl bg-[#eef0e8]" /></div>;
  if (planQuery.isError || !planQuery.data) return <div className="rounded-2xl border border-[#e7c8ba] bg-[#fff0e9] p-6" role="alert"><h1 className="font-display text-3xl">This plan could not be opened.</h1><p className="mt-2 text-[13px] text-[#8d4a38]">It may have been removed from this browser workspace. Try the workspace list again.</p><Link href="/workspace" data-testid="link-back-workspace-error" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b]">Back to workspace <ArrowRight size={15} /></Link></div>;
  if (!draft) return <div className="rounded-2xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-10 text-center text-[13px] text-[#687183]">Preparing your saved plan…</div>;

  const roadmapComplete = draft.roadmap.completedStepIds.length;
  const documentsComplete = draft.documentChecklist.filter((document) => document.completed).length;
  const purposeSpecificPlan = draft.planningContext?.purpose === 'Study' || draft.planningContext?.purpose === 'Start a business';
  const isStudyPlan = draft.planningContext?.purpose === 'Study';
  const isBusinessPlan = draft.planningContext?.purpose === 'Start a business';
  const purposeEvidenceValue = (label: string, fallback: string) => draft.planningContext?.evidence.find((item) => item.label === label)?.value ?? fallback;
  const businessCurrencyCode = isBusinessPlan && draft.planningContext
    ? getCurrencyCodeForDestination(draft.planningContext.destination)
    : null;
  const businessInvestmentOptions = businessCurrencyCode
    ? getBusinessInvestmentRangeOptions(businessCurrencyCode)
    : undefined;
  const businessInvestmentValue = purposeEvidenceValue('Investment range', businessInvestmentOptions?.[0] ?? 'Not decided');
  const displayedBusinessInvestment = businessCurrencyCode
    ? getBusinessInvestmentRangeForCurrency(businessInvestmentValue, businessCurrencyCode)
    : businessInvestmentValue;
  return <div>
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><Link href="/workspace" data-testid="link-back-workspace" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#276047]"><ArrowRight size={14} className="rotate-180" /> All saved plans</Link><div className="mt-5 font-label text-[10px] font-bold uppercase tracking-[.16em] text-[#71806d]">Saved plan editor</div><h1 className="mt-2 font-display text-[clamp(2.3rem,5vw,4.4rem)] leading-none tracking-[-.05em]">Make the next move visible.</h1><p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#687183]">Edit the parts of your plan that change as you gather evidence. Your changes stay in this anonymous browser workspace.</p></div><div className="flex flex-col items-stretch gap-2 sm:items-end"><button type="button" onClick={saveChanges} disabled={updateMutation.isPending} data-testid="button-save-workspace-plan" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202842] px-4 py-3 text-[12px] font-bold text-[#dbe86b] shadow-[3px_3px_0_#b8d247] transition hover:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none">{updateMutation.isPending ? <Check size={15} className="animate-pulse-soft" /> : <Save size={15} />}{updateMutation.isPending ? 'Saving changes…' : 'Save changes'}</button>{savedMessage && <span role="status" data-testid="status-workspace-saved" className="flex items-center gap-1.5 text-[11px] font-semibold text-[#397669] animate-rise"><CheckCircle2 size={14} />{savedMessage}</span>}{updateMutation.isError && <span role="alert" data-testid="status-workspace-save-error" className="text-[11px] font-semibold text-[#a45138]">Could not save. Try again.</span>}</div></div>
    <WorkspaceReminder />
    <section className="mt-6 rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 shadow-[0_10px_26px_rgba(32,40,66,.04)] sm:p-7">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3c8] text-[#667c27]"><Pencil size={18} /></span><div className="flex-1"><span className="font-label text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8490]">Plan name</span><input value={draft.name} onChange={(event) => updateDraft((current) => ({ ...current, name: sanitizePlainText(event.target.value).slice(0, 100) }))} data-testid="input-workspace-plan-name" className="mt-2 w-full border-b border-[#d7dcd4] bg-transparent pb-2 font-display text-3xl tracking-[-.04em] text-[#202842] outline-none focus:border-[#81a348]" /></div></div>
      {!purposeSpecificPlan ? <div className="mt-7 grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-xl bg-[#e8f1e8] p-4">
          <span className="font-label text-[9px] font-bold uppercase tracking-[.11em] text-[#47715a]">Pathway snapshot</span>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1"><span className="mb-1 block text-[10px] text-[#7c8490]">Visa route</span><input value={draft.pathway.name} onChange={(event) => updateDraft((current) => ({ ...current, pathway: { ...current.pathway, name: event.target.value.slice(0, 120) } }))} data-testid="input-workspace-pathway-name" className="w-full rounded-lg border border-[#cfe0d2] bg-[#f5f8f0] px-3 py-2 text-[12px] font-bold outline-none focus:border-[#81a348]" /></label>
            <label className="sm:w-32"><span className="mb-1 block text-[10px] text-[#7c8490]">Subclass</span><input value={draft.pathway.visaSubclass} onChange={(event) => updateDraft((current) => ({ ...current, pathway: { ...current.pathway, visaSubclass: event.target.value.slice(0, 20) } }))} data-testid="input-workspace-pathway-subclass" className="w-full rounded-lg border border-[#cfe0d2] bg-[#f5f8f0] px-3 py-2 text-[12px] font-bold outline-none focus:border-[#81a348]" /></label>
          </div>
        </div>
        <div className="rounded-xl bg-[#202842] p-4 text-[#f5f1e8]"><span className="font-label text-[9px] font-bold uppercase tracking-[.11em] text-[#96a0b3]">Current signal</span><strong className="mt-2 block font-display text-3xl text-[#dbe86b]">{draft.pathway.fitScore}%</strong><span className="mt-1 block text-[11px] text-[#bfc7d0]">{draft.pathway.stage} · {draft.pathway.governmentFee}</span></div>
      </div> : <div className="mt-7 rounded-xl bg-[#e8f1e8] p-5" data-testid="summary-saved-purpose-evidence">
        <span className="font-label text-[10px] font-bold uppercase tracking-[.11em] text-[#47715a]">{draft.planningContext?.purpose} preparation details</span>
        <p className="mt-2 text-[12px] text-[#687183]">{draft.planningContext?.passportCountry} → {draft.planningContext?.destination} · self-reported planning context, not a visa eligibility assessment.</p>
        {isStudyPlan && <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="form-saved-study-evidence">
          <Field label="Course level" value={purposeEvidenceValue('Course level', studyCourseLevelOptions[0])} onChange={(value) => updatePurposeEvidence('Course level', value)} options={studyCourseLevelOptions} testId="input-workspace-study-course-level" />
          <Field label="Institution or offer status" value={purposeEvidenceValue('Institution or offer status', studyInstitutionStatusOptions[0])} onChange={(value) => updatePurposeEvidence('Institution or offer status', value)} options={studyInstitutionStatusOptions} testId="input-workspace-study-institution-status" />
          <Field label="Study funding" value={purposeEvidenceValue('Study funding', studyFundingOptions[0])} onChange={(value) => updatePurposeEvidence('Study funding', value)} options={studyFundingOptions} testId="input-workspace-study-funding" />
        </div>}
        {isBusinessPlan && <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="form-saved-business-evidence">
          <Field label="Business stage" value={purposeEvidenceValue('Business stage', businessStageOptions[0])} onChange={(value) => updatePurposeEvidence('Business stage', value)} options={businessStageOptions} testId="input-workspace-business-stage" />
          <Field label={`Investment range${businessCurrencyCode ? ` (${businessCurrencyCode})` : ''}`} value={displayedBusinessInvestment} onChange={(value) => updatePurposeEvidence('Investment range', value)} options={businessInvestmentOptions} testId="input-workspace-business-investment-range" />
          <Field label="Ownership or operating intent" value={purposeEvidenceValue('Ownership or operating intent', businessIntentOptions[0])} onChange={(value) => updatePurposeEvidence('Ownership or operating intent', value)} options={businessIntentOptions} testId="input-workspace-business-intent" />
          {!businessCurrencyCode && <p className="text-[10px] leading-4 text-[#7c8490] sm:col-span-3">The destination currency is unavailable, so enter the investment range as text.</p>}
        </div>}
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">{draft.planningContext?.evidence.map((item) => <div key={item.label} className="rounded-lg bg-white/70 p-3"><dt className="font-label text-[9px] font-bold uppercase tracking-[.09em] text-[#7c8490]">{item.label}</dt><dd className="mt-1 text-[12px] font-semibold text-[#3e485e]">{item.value}</dd></div>)}</dl>
      </div>}
    </section>
    <div className={`mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)] ${purposeSpecificPlan ? '[&>section:first-child]:hidden' : ''}`}>
      <section className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7"><div className="flex items-end justify-between gap-3"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#71806d]">Roadmap completion</span><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Five small moves.</h2></div><span className="rounded-full bg-[#e1f1d9] px-2.5 py-1 font-label text-[10px] font-bold text-[#276047]" data-testid="status-roadmap-completion">{roadmapComplete} / {roadmapSteps.length} complete</span></div><div className="mt-5 space-y-2">{roadmapSteps.map((step) => { const complete = draft.roadmap.completedStepIds.includes(step.id); return <label key={step.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${complete ? 'border-[#b8d247] bg-[#f0f5df]' : 'border-[#ecece4] hover:bg-[#f7f7f0]'}`}><input type="checkbox" checked={complete} onChange={() => toggleRoadmapStep(step.id)} data-testid={`input-workspace-roadmap-${step.id}`} className="mt-1 h-4 w-4 accent-[#7eaa4d]" /><span className="flex-1"><strong className={`block text-[13px] ${complete ? 'text-[#397669]' : ''}`}>{step.title}</strong><span className="mt-1 block text-[11px] text-[#8a919b]">{step.status} · {step.duration}</span></span>{complete && <CheckCircle2 size={17} className="mt-0.5 text-[#397669] animate-check-pop" />}</label>; })}</div></section>
      <section className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7"><div className="flex items-end justify-between gap-3"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#71806d]">Document checklist</span><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Evidence, in order.</h2></div><span className="rounded-full bg-[#eef0e8] px-2.5 py-1 font-label text-[10px] font-bold text-[#687183]" data-testid="status-document-completion">{documentsComplete} / {draft.documentChecklist.length}</span></div><div className="mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">{draft.documentChecklist.map((document) => <label key={document.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${document.completed ? 'border-[#b8d247] bg-[#f0f5df]' : 'border-[#ecece4] hover:bg-[#f7f7f0]'}`}><input type="checkbox" checked={document.completed} onChange={() => toggleDocument(document.id)} data-testid={`input-workspace-document-${document.id}`} className="h-4 w-4 accent-[#7eaa4d]" /><span className={`text-[12px] font-semibold ${document.completed ? 'text-[#397669] line-through decoration-[#b8d247]' : 'text-[#3e485e]'}`}>{document.label}</span>{document.completed && <Check size={15} className="ml-auto text-[#397669] animate-check-pop" />}</label>)}</div></section>
    </div>
    {!purposeSpecificPlan && <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
      <section className="rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#71806d]">Comparison snapshot</span><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Keep the alternatives honest.</h2><p className="mt-2 text-[12px] leading-5 text-[#687183]">Choose the routes you want to keep beside your saved pathway. These are indicative signals, not an outcome.</p></div><div className="mt-5 space-y-2">{availableComparisons.map((item) => { const selected = draft.comparison.some((saved) => saved.visaSubclass === item.visaSubclass); return <button type="button" key={item.visaSubclass} onClick={() => toggleComparison(item)} data-testid={`button-workspace-comparison-${item.visaSubclass}`} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-[#202842] bg-[#eef3e9]' : 'border-[#ecece4] hover:bg-[#f7f7f0]'}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${selected ? 'bg-[#dbe86b] text-[#202842]' : 'bg-[#eef0e8] text-[#7c8490]'}`}>{selected ? <Check size={15} className="animate-check-pop" /> : <ArrowDownUp size={14} />}</span><span className="flex-1"><strong className="block text-[13px]">{item.shortName} · {item.name}</strong><span className="mt-1 block text-[11px] text-[#7c8490]">{item.fitScore}% indicative fit · {item.governmentFee}</span></span><span className="font-label text-[10px] font-bold uppercase tracking-[.08em] text-[#7c8490]">{selected ? 'Included' : 'Add'}</span></button>; })}</div>{guidanceQuery.isLoading && <p className="mt-4 text-[11px] text-[#8a919b]">Loading current comparison options…</p>}{guidanceQuery.isError && <p className="mt-4 text-[11px] text-[#a45138]">Current comparison options are unavailable; your saved snapshot is still editable.</p>}</section>
      <section className="rounded-2xl bg-[#202842] p-5 text-[#f5f1e8] sm:p-7"><div><span className="font-label text-[10px] font-bold uppercase tracking-[.13em] text-[#dbe86b]">Cost assumptions</span><h2 className="mt-2 font-display text-3xl tracking-[-.04em]">What are you planning around?</h2></div><div className="mt-5 space-y-3"><label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#2d3858] p-3"><span className="text-[12px] font-semibold">Include partner applicant</span><input type="checkbox" checked={draft.costAssumptions.includePartner} onChange={(event) => updateCosts({ includePartner: event.target.checked })} data-testid="input-workspace-include-partner" className="h-4 w-4 accent-[#dbe86b]" /></label><label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#2d3858] p-3"><span className="text-[12px] font-semibold">Budget for professional help</span><input type="checkbox" checked={draft.costAssumptions.includeAgent} onChange={(event) => updateCosts({ includeAgent: event.target.checked })} data-testid="input-workspace-include-agent" className="h-4 w-4 accent-[#dbe86b]" /></label>{[['monthlyRent', 'Monthly rent', draft.costAssumptions.monthlyRent], ['government', 'Government charges', draft.costAssumptions.government], ['settlement', 'Settlement buffer', draft.costAssumptions.settlement], ['extras', 'English + other extras', draft.costAssumptions.extras]].map(([key, label, value]) => <label key={key as string} className="block"><span className="mb-1 block text-[10px] text-[#aeb8c4]">{label as string}</span><div className="flex items-center gap-2"><span className="text-[#8bcfc1]">$</span><input type="number" min="0" value={value as number} onChange={(event) => updateCosts({ [key as string]: Math.max(0, Number(event.target.value) || 0) })} data-testid={`input-workspace-cost-${key}`} className="w-full rounded-lg border border-[#4a5672] bg-[#2d3858] px-3 py-2 text-[12px] font-bold text-[#f5f1e8] outline-none focus:border-[#dbe86b]" /></div></label>)}</div><div className="mt-6 border-t border-[#3b4664] pt-5"><span className="font-label text-[9px] uppercase tracking-[.11em] text-[#96a0b3]">Indicative total</span><strong data-testid="text-workspace-cost-total" className="mt-1 block font-display text-4xl text-[#dbe86b]">${draft.costAssumptions.total.toLocaleString('en-AU')}</strong><p className="mt-2 text-[11px] leading-5 text-[#bfc7d0]">A planning assumption, not a quote. Recheck current fees and your arrival buffer before lodging.</p></div></section>
    </div>}
  </div>;
}

function savedComparisonFromGuidance(visas: GuidanceItem[]): SavedPlanComparisonItem[] {
  return visas.slice(0, 3).map((visa) => ({
    visaSubclass: visa.visaSubclass,
    name: visa.name,
    shortName: visa.shortName,
    fitScore: visa.fitScore,
    governmentFee: visa.governmentFee,
    stage: visa.stage,
  }));
}

function savedPlanDocuments(): SavedPlanDocument[] {
  const roadmapDocuments = roadmapSteps.flatMap((step) => step.docs.map((label) => ({ id: `roadmap-${step.id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, completed: false })));
  const setupDocuments = setupItems.map((item) => ({ id: `setup-${item.id}`, label: item.label, completed: false }));
  const unique = new Map<string, SavedPlanDocument>();
  [...roadmapDocuments, ...setupDocuments].forEach((document) => unique.set(document.label, document));
  return [...unique.values()];
}
