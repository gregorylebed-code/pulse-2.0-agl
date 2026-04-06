// Pronoun guessing based on first name.
// Returns a pronoun instruction string for AI prompts, plus metadata for the UI badge.

export type PronounSource = 'set' | 'guessed' | 'ambiguous';

export interface PronounInfo {
  pronouns: string;        // e.g. 'he/him', 'she/her', 'they/them'
  source: PronounSource;
}

// Top 500 male names from SSA dataset (1880–present), all-time popularity
const MALE_NAMES = new Set([
  'john','james','william','robert','charles','michael','joseph','david','george','thomas',
  'richard','edward','frank','daniel','paul','donald','christopher','henry','walter','kenneth',
  'anthony','matthew','harry','andrew','arthur','mark','raymond','albert','ronald','steven',
  'brian','harold','fred','samuel','willie','kevin','joshua','timothy','jack','jason',
  'carl','stephen','joe','gary','jeffrey','clarence','louis','roy','larry','ralph',
  'nicholas','eric','jacob','benjamin','peter','ryan','lawrence','scott','jerry','patrick',
  'howard','ernest','earl','jonathan','eugene','justin','dennis','gregory','jesse','brandon',
  'douglas','francis','gerald','alexander','alfred','herbert','jose','aaron','leonard','adam',
  'russell','roger','charlie','stanley','frederick','nathan','philip','billy','martin','tyler',
  'lee','edwin','norman','keith','wayne','oscar','zachary','bruce','elmer','terry',
  'theodore','kyle','leo','ray','jeremy','victor','vincent','leroy','allen','melvin',
  'sam','bernard','marvin','herman','floyd','sean','bobby','lewis','clifford','phillip',
  'clyde','glenn','austin','eddie','johnny','bryan','alan','dale','juan','curtis',
  'lloyd','jimmy','christian','tom','chester','jim','alex','lester','edgar','randy',
  'leon','steve','warren','craig','harvey','shawn','travis','tony','jordan','alvin',
  'bradley','claude','danny','todd','isaac','wesley','joel','carlos','nathaniel','calvin',
  'mike','rodney','vernon','will','milton','bill','gordon','manuel','jessie','antonio',
  'cody','dylan','ben','chad','don','ethan','jay','cecil','gabriel','noah',
  'luis','leslie','troy','maurice','gilbert','marcus','jerome','jeffery','franklin','hugh',
  'luther','tommy','guy','derek','jesus','ricky','homer','everett','johnnie','randall',
  'max','glen','cameron','evan','oliver','logan','dustin','dean','sidney','ronnie',
  'luke','arnold','barry','elijah','dan','jimmie','gene','jared','caleb','marion',
  'adrian','willard','mitchell','shane','darrell','wallace','julius','corey','clayton','jon',
  'roland','julian','virgil','ian','morris','lonnie','horace','micheal','chris','ira',
  'angel','clinton','archie','bob','miguel','brett','hunter','seth','wilbur','jeff',
  'earnest','jake','marshall','otto','karl','ivan','mario','erik','otis','jeremiah',
  'isaiah','owen','duane','hubert','brent','ed','willis','francisco','marc','perry',
  'trevor','derrick','jackson','nelson','bert','grant','ross','lucas','neil','ruben',
  'dave','mason','connor','reginald','allan','ricardo','clifton','devin','blake','dominic',
  'abraham','cory','rudolph','garrett','preston','spencer','charley','august','grover','irving',
  'felix','bennie','byron','ted','taylor','edmund','rufus','levi','andre','jorge',
  'emil','mack','casey','fredrick','percy','andy','sylvester','alejandro','roberto','dwight',
  'freddie','pedro','chase','lance','orville','angelo','darren','harrison','gavin','wade',
  'hector','colin','lyle','jackie','ramon','dewey','elbert','emmett','irvin','mathew',
  'kelly','cole','ellis','darryl','forrest','delbert','pete','amos','tim','wilson',
  'simon','riley','stuart','jamie','malcolm','eduardo','alonzo','fernando','alton','kurt',
  'cornelius','salvatore','leland','nick','sherman','brad','raul','omar','rex','eli',
  'bryce','lynn','neal','ervin','moses','xavier','johnathan','tyrone','javier','rick',
  'wilbert','jess','wendell','roosevelt','harley','brendan','laurence','dwayne','greg','myron',
  'carroll','rafael','woodrow','carlton','loren','dallas','gerard','aidan','terrence','reuben',
  'dalton','kent','dominick','adolph','sebastian','roscoe','dakota','wyatt','clark','lowell',
  'miles','grady','lorenzo','armando','tanner','randolph','andres','carter','emanuel','jasper',
  'landon','kirk','brady','tracy','shaun','wilfred','jayden','terrance','maxwell','tristan',
  'donnie','nicolas','merle','tommie','diego','johnie','daryl','benny','gus','drew',
  'carson','hayden','aiden','sergio','damon','elias','jaime','jonathon','dana','alberto',
  'junior','ollie','colton','devon','conrad','rickey','nolan','kristopher','parker','marco',
  'dick','alfredo','louie','aubrey','cesar','julio','israel','erick','cleveland','billie',
  'collin','rudy','micah','rene','noel','enrique','solomon','geoffrey','anton','shannon',
  'boyd','loyd','claud','edmond','silas','morgan','bryant','roderick','alfonso','millard',
  'orlando','arturo','dillon','clay','stewart','monroe','garry','damian','sammy','elwood',
  // common short forms / nicknames
  'aj','bo','brock','cade','cal','cam','chad','clint','dane','darius','dash','duke',
  'finn','gage','gio','hank','heath','jake','jay','jed','jo','jt','kai','lane',
  'luca','luke','matt','milo','nate','reed','rhett','rob','ron','russ','scott','trey',
  'ty','wade','wren','zach','zion','liam','mason','ethan','noah','aiden','logan',
]);

// Top 500 female names from SSA dataset (1880–present), all-time popularity
const FEMALE_NAMES = new Set([
  'mary','elizabeth','margaret','helen','anna','dorothy','barbara','patricia','ruth','linda',
  'jennifer','betty','sarah','alice','nancy','susan','frances','laura','marie','emma',
  'martha','catherine','florence','rose','virginia','grace','jessica','mildred','karen','lillian',
  'annie','carol','ethel','lisa','shirley','sandra','donna','katherine','edna','clara',
  'amanda','evelyn','emily','rebecca','louise','kimberly','kathleen','michelle','bertha','julia',
  'melissa','sharon','amy','ashley','irene','minnie','edith','stephanie','doris','ida',
  'deborah','cynthia','bessie','angela','ann','josephine','carolyn','jean','christine','janet',
  'gladys','joan','gertrude','joyce','ruby','hazel','ella','rachel','carrie','eva',
  'kathryn','maria','brenda','mabel','pamela','nellie','pearl','esther','nicole','theresa',
  'lois','judith','heather','diane','myrtle','jane','elsie','julie','debra','sara',
  'gloria','christina','agnes','lillie','eleanor','samantha','ellen','anne','victoria','jessie',
  'pauline','kelly','marilyn','janice','beverly','marjorie','thelma','mattie','lucille','phyllis',
  'teresa','charlotte','jacqueline','cora','cheryl','beatrice','lucy','lena','jennie','judy',
  'alma','hannah','norma','lauren','andrea','megan','marion','bonnie','hattie','rosa',
  'viola','stella','rita','willie','sylvia','peggy','bernice','denise','diana','mae',
  'wanda','amber','danielle','katie','blanche','lula','ada','lori','tammy','brittany',
  'crystal','fannie','tiffany','dora','elaine','kathy','dolores','maggie','maude','juanita',
  'geraldine','caroline','nora','daisy','mamie','audrey','tina','georgia','erin','shannon',
  'vera','dawn','paula','connie','sally','natalie','olivia','loretta','vivian','lorraine',
  'kayla','robin','june','anita','alexis','lydia','jamie','leona','leslie','wendy',
  'sadie','taylor','tracy','monica','madison','veronica','joanne','susie','sheila','alyssa',
  'valerie','courtney','cindy','marian','roberta','allison','beulah','eileen','april','suzanne',
  'wilma','jeanette','sherry','marguerite','abigail','darlene','michele','erica','vanessa','della',
  'gail','alicia','violet','regina','harriet','madeline','sophia','kristen','melanie','jill',
  'flora','jo','jeanne','may','nettie','effie','nina','leah','rhonda','amelia',
  'annette','sue','jasmine','genevieve','rosemary','naomi','brianna','holly','arlene','hilda',
  'dana','sallie','alexandra','joann','renee','yvonne','lola','constance','lynn','kristin',
  'velma','claire','olive','lottie','tara','eunice','lizzie','debbie','inez','morgan',
  'kim','colleen','beth','stacy','margie','rosie','maxine','isabella','patsy','cathy',
  'geneva','laurie','delores','alberta','marlene','cassandra','marcia','brooke','etta','maureen',
  'verna','addie','carmen','claudia','opal','molly','henrietta','gina','stacey','miriam',
  'vicki','isabel','joy','sophie','charlene','estelle','carla','ollie','lindsey','mable',
  'priscilla','carole','kate','irma','mollie','chelsea','billie','terri','deanna','melinda',
  'heidi','janie','gwendolyn','kristina','eula','shelby','ora','haley','kaitlyn','olga',
  'tamara','sydney','kelsey','tonya','lela','iva','cecilia','sabrina','jenna','angelina',
  'lindsay','chloe','kay','glenda','tanya','yolanda','antoinette','essie','erma','jeannette',
  'erika','nannie','savannah','goldie','bobbie','destiny','celia','estella','isabelle','ava',
  'eliza','jordan','faye','brandy','paige','faith','winifred','marsha','joanna','vickie',
  'gabrielle','marissa','rosalie','katelyn','josie','cecelia','muriel','matilda','brandi','lucile',
  'christy','maud','alison','hailey','dianne','toni','caitlin','marcella','lily','katrina',
  'jenny','jackie','freda','felicia','terry','lila','penny','bridget','ola','miranda',
  'myra','mia','alta','ina','callie','iris','lee','kara','natasha','jacquelyn',
  'meghan','allie','luella','misty','whitney','lora','adeline','bethany','ana','tracey',
  'bettie','fern','becky','hope','rena','mackenzie','johnnie','rachael','shelly','kristine',
  'candace','ramona','kendra','mariah','sherri','lynda','angel','autumn','jodi','sierra',
  'nell','delia','lulu','karla','gracie','elva','flossie','belle','frieda','angelica',
  'kristi','johanna','briana','monique','alexandria','sheryl','melody','desiree','brittney','adele',
  'ernestine','kelli','lou','eloise','angie','augusta','alexa','jocelyn','millie','krista',
  'katharine','kaylee','shelley','maryann','meredith','marianne','kristy','selma','corinne','casey',
  'leila','zoe','patty','krystal','lorena','breanna','adrienne','leola','guadalupe','lorene',
  // modern names not in SSA top 500 but common in schools
  'addison','aria','ariana','ariel','aurora','avery','bella','bianca','brooklyn','camila',
  'carly','cassidy','elena','elise','ella','ellie','fiona','genesis','harper','isis',
  'ivy','jade','juliana','kaelyn','kamila','kennedy','kiara','kylie','laila','layla',
  'luna','makayla','marisol','maya','michaela','mikayla','nadia','paris','payton','penelope',
  'peyton','reagan','rebekah','riley','sabrina','scarlett','selena','serenity','skylar','sofia',
  'summer','trinity','valentina','willow','yasmine','zoey','abby','becca','bri','brit',
  'cami','cass','cat','dani','em','emmy','gabby','gigi','hallie','jess',
  'jules','kat','kels','lacy','lanie','lexi','lex','linds','liv','liz',
  'lizzie','lo','maddie','mandy','mara','margo','mari','meg','mel','mimi',
  'mindy','missy','nan','nat','nikki','pam','polly','quinn','rach','remi',
  'remy','rhi','ria','roo','rory','rosie','sandy','shell','steph','tess',
  'tori','val','viv',
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
