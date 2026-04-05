// Pronoun guessing based on first name.
// Returns a pronoun instruction string for AI prompts, plus metadata for the UI badge.

export type PronounSource = 'set' | 'guessed' | 'ambiguous';

export interface PronounInfo {
  pronouns: string;        // e.g. 'he/him', 'she/her', 'they/them'
  source: PronounSource;
}

// Common male first names (US school-age)
const MALE_NAMES = new Set([
  'aaron','adam','aiden','alex','alexander','alexis','andrew','angel','anthony','austin',
  'benjamin','blake','brandon','brayden','brian','bryce','caleb','cameron','carlos','carter',
  'charles','chase','christian','christopher','cole','colin','conner','connor','cooper','cory',
  'daniel','david','derek','devon','dominic','dylan','elijah','eric','ethan','evan',
  'gabriel','gavin','grant','henry','hunter','isaac','isaiah','jack','jackson','jacob',
  'jake','james','jason','javier','jayden','jermaine','jesse','joel','jonathan','jordan',
  'jose','joseph','joshua','juan','julian','justin','kevin','kyle','liam','logan',
  'lucas','luis','marcus','mason','matthew','max','michael','miguel','miles','nathan',
  'nicholas','noah','oliver','owen','parker','patrick','peter','philip','rafael','raymond',
  'richard','robert','ryan','samuel','santiago','sean','sebastian','seth','simon','stephen',
  'steven','thomas','timothy','travis','trevor','tristan','tyler','victor','vincent','william',
  'wyatt','xavier','zachary','zach','zion',
  // common nicknames
  'aj','bo','brad','brett','brock','cade','cal','cam','chad','charlie','chris','clint',
  'cody','damon','dane','darius','dash','drew','duke','eli','emmett','finn','gage','gio',
  'greg','hank','heath','ian','jake','jay','jeff','jed','jeremiah','jim','jo','joe',
  'jon','josh','jt','julian','kai','lance','lane','leo','levi','luca','luke','marc',
  'mark','matt','mike','miles','milo','nate','nolan','omar','oscar','paul','pete',
  'reed','rhett','rob','ron','ross','ruben','russ','sam','scott','shawn','tanner',
  'ted','terrell','terry','theo','tim','todd','tom','tony','trey','troy','ty','wade',
  'warren','will','winston','wren',
]);

// Common female first names (US school-age)
const FEMALE_NAMES = new Set([
  'abigail','addison','alexa','alexis','alice','alicia','alisha','alison','allison','alyssa',
  'amber','amelia','amy','ana','andrea','angela','anna','annabelle','aria','ariana',
  'ariel','ashley','audrey','aurora','ava','avery','bella','bethany','bianca','brianna',
  'brittany','brooke','brooklyn','camila','carly','carmen','caroline','cassandra','cassidy',
  'charlotte','chelsea','chloe','christina','claire','cora','daisy','dana','destiny',
  'diana','dominique','eleanor','elena','elise','eliza','elizabeth','ella','ellie','emily',
  'emma','eva','evelyn','faith','fiona','gabriella','genesis','grace','hailey','haley',
  'hannah','harper','hayley','heather','isabella','isis','ivy','jade','jasmine','jessica',
  'jocelyn','jordyn','josephine','julia','juliana','kaelyn','kaitlyn','kamila','karen',
  'kate','katelyn','katherine','katie','kayla','kaylee','kendall','kennedy','kiara','kimberly',
  'kylie','laila','laura','lauren','layla','leah','leila','lily','linda','lisa',
  'lola','lucy','luna','lydia','mackenzie','madeline','madison','makayla','marisol','marissa',
  'mary','maya','megan','melanie','melissa','mia','michaela','michelle','mikayla','molly',
  'morgan','naomi','natalia','natalie','natasha','nicole','nora','olivia','paige','paris',
  'payton','penelope','peyton','rachel','reagan','rebekah','riley','rose','ruby','sabrina',
  'samantha','sara','sarah','savannah','scarlett','selena','serenity','sierra','skylar','sofia',
  'sophia','stephanie','summer','sydney','taylor','tiffany','trinity','valentina','vanessa',
  'veronica','victoria','violet','vivian','whitney','willow','yasmine','zoe','zoey',
  // common nicknames
  'abby','ali','allie','ally','becca','bree','bri','brit','cait','cami','cass','cat',
  'christi','dani','dee','ellie','em','emmy','gabby','gigi','gracie','hallie','jess',
  'josie','jules','juli','kat','kay','kels','kelsey','kim','kris','kristin','lacy',
  'lanie','lexi','lex','linds','liv','liz','lizzie','lo','lori','maddie','mae',
  'maggie','mandy','mara','margo','mari','meg','mel','mia','mimi','mindy','missy',
  'nadia','nan','nat','nell','nikki','pam','paige','patty','phoebe','polly','quinn',
  'rach','remi','remy','rhi','ria','roo','rory','rosie','sam','sandy','shell','steph',
  'sue','tara','tess','tori','val','viv','wendy',
]);

/**
 * Guess pronouns from a first name.
 * Returns 'he/him', 'she/her', or falls back to 'they/them' if ambiguous.
 */
export function guessPronounsFromName(firstName: string): PronounInfo {
  const lower = firstName.trim().toLowerCase();

  if (MALE_NAMES.has(lower)) {
    return { pronouns: 'he/him', source: 'guessed' };
  }
  if (FEMALE_NAMES.has(lower)) {
    return { pronouns: 'she/her', source: 'guessed' };
  }
  // Ambiguous or unknown name — default to they/them
  return { pronouns: 'they/them', source: 'ambiguous' };
}

/**
 * Get the pronoun info for a student, respecting teacher-set pronouns first.
 */
export function getStudentPronounInfo(firstName: string, setPronouns?: string | null): PronounInfo {
  if (setPronouns && setPronouns.trim()) {
    return { pronouns: setPronouns.trim(), source: 'set' };
  }
  return guessPronounsFromName(firstName);
}

/**
 * Build the pronoun instruction line for AI prompts.
 * e.g. "Use he/him/his for this student."
 */
export function buildPronounInstruction(info: PronounInfo): string {
  const { pronouns } = info;

  if (pronouns === 'he/him') {
    return 'Use he/him/his pronouns for this student.';
  }
  if (pronouns === 'she/her') {
    return 'Use she/her/hers pronouns for this student.';
  }
  // they/them or any custom value
  const subject = pronouns.split('/')[0] || 'they';
  const object = pronouns.split('/')[1] || 'them';
  return `Use ${subject}/${object} pronouns for this student.`;
}
